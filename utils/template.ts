import { downloadTemplate } from '@bluwy/giget-core'
import chalk from 'chalk'
import fs from 'fs-extra'
import os from 'os'
import path from 'path'

export interface Template {
	name: string
	description: string
	path: string
	category?: string
	tags?: string[]
	version?: string
	author?: string
}

export interface TemplateRegistry {
	version: string
	templates: Record<string, Template>
	categories: Record<string, string>
}

export interface ProjectConfig {
	name: string
	template: string
	packageManager: 'bun' | 'npm' | 'yarn' | 'pnpm'
	typescript: boolean
	eslint: boolean
	prettier: boolean
	docker: boolean
	git: boolean
	install: boolean
}

export async function getTemplates(): Promise<Template[]> {
	const tempDir = path.join(os.tmpdir(), `honestjs-templates-${Date.now()}`)

	try {
		await downloadTemplate('honestjs/templates', {
			dir: tempDir,
			force: true
		})

		const registryPath = path.join(tempDir, 'templates.json')
		if (fs.existsSync(registryPath)) {
			const registry: TemplateRegistry = await fs.readJson(registryPath)
			const templates = Object.entries(registry.templates).map(([key, template]) => ({
				...template,
				name: key,
				path: template.path || key
			}))

			await fs.remove(tempDir)
			return templates
		}

		await fs.remove(tempDir)
		throw new Error('templates.json not found in repository')
	} catch (error) {
		if (fs.existsSync(tempDir)) {
			await fs.remove(tempDir)
		}

		throw new Error(
			`Failed to fetch templates from honestjs/templates: ${
				error instanceof Error ? error.message : 'Unknown error'
			}`
		)
	}
}

export async function getTemplateInfo(templateName: string): Promise<Template | null> {
	const templates = await getTemplates()
	return templates.find((t) => t.name === templateName) || null
}

export async function getTemplatePrompts(templateName: string): Promise<any[] | null> {
	const tempDir = path.join(os.tmpdir(), `honestjs-templates-${Date.now()}`)

	try {
		await downloadTemplate('honestjs/templates', {
			dir: tempDir,
			force: true
		})

		const template = await getTemplateInfo(templateName)
		if (!template) {
			await fs.remove(tempDir)
			return null
		}

		let templateDir: string
		if (template.path.startsWith('templates/')) {
			templateDir = path.join(tempDir, template.path)
		} else {
			templateDir = path.join(tempDir, 'templates', template.path)
		}

		const promptsPath = path.join(templateDir, 'prompts.js')
		if (fs.existsSync(promptsPath)) {
			try {
				const { prompts } = await import(promptsPath)
				await fs.remove(tempDir)
				return prompts
			} catch (error) {
				console.log(chalk.yellow(`⚠ Could not load prompts for template '${templateName}': ${error}`))
			}
		}

		await fs.remove(tempDir)
		return null
	} catch (error) {
		if (fs.existsSync(tempDir)) {
			await fs.remove(tempDir)
		}

		console.log(
			chalk.yellow(
				`⚠ Could not fetch template prompts for '${templateName}': ${
					error instanceof Error ? error.message : 'Unknown error'
				}`
			)
		)
		return null
	}
}

export async function copyTemplate(
	templateName: string,
	projectName: string,
	config?: Partial<ProjectConfig>
): Promise<void> {
	const template = await getTemplateInfo(templateName)
	if (!template) {
		throw new Error(`Template '${templateName}' not found`)
	}

	const projectPath = path.join(process.cwd(), projectName)
	const tempDir = path.join(os.tmpdir(), `honestjs-template-${Date.now()}`)

	try {
		console.log(chalk.blue(`Fetching template '${templateName}' from honestjs/templates...`))

		const result = await downloadTemplate('honestjs/templates', {
			dir: tempDir,
			force: true
		})

		console.log(chalk.gray(`Templates downloaded to: ${result.dir}`))

		let templateDir: string
		if (template.path.startsWith('templates/')) {
			templateDir = path.join(result.dir, template.path)
		} else {
			templateDir = path.join(result.dir, 'templates', template.path)
		}

		console.log(chalk.gray(`Looking for template at: ${templateDir}`))

		const templateConfigPath = path.join(templateDir, 'template.json')
		const filesDir = path.join(templateDir, 'files')

		if (fs.existsSync(templateConfigPath) && fs.existsSync(filesDir)) {
			console.log(chalk.gray('Using new template structure (files/ directory)'))
			await fs.copy(filesDir, projectPath)

			const mergedConfig: ProjectConfig = {
				name: projectName,
				template: templateName,
				packageManager: 'bun',
				install: true,
				git: true,
				typescript: true,
				eslint: true,
				prettier: true,
				docker: true,
				...config
			}

			await applyTemplateTransforms(projectPath, template, mergedConfig, result.dir)

			await copySharedConfigs(projectPath, mergedConfig, result.dir)
		} else {
			console.log(chalk.gray('Using legacy template structure (direct files)'))
			await fs.copy(templateDir, projectPath)

			await applyProjectConfiguration(projectPath, config)
		}

		await fs.remove(tempDir)
	} catch (error) {
		if (fs.existsSync(tempDir)) {
			await fs.remove(tempDir)
		}

		if (fs.existsSync(projectPath)) {
			await fs.remove(projectPath)
		}

		throw new Error(
			`Failed to fetch template '${templateName}': ${error instanceof Error ? error.message : 'Unknown error'}`
		)
	}
}

async function applyTemplateTransforms(
	projectPath: string,
	template: Template,
	config: ProjectConfig,
	templatesRoot: string
): Promise<void> {
	let templateDir: string
	if (template.path.startsWith('templates/')) {
		templateDir = path.join(templatesRoot, template.path)
	} else {
		templateDir = path.join(templatesRoot, 'templates', template.path)
	}

	const templateConfigPath = path.join(templateDir, 'template.json')
	const transformsPath = path.join(templateDir, 'transforms.js')

	if (fs.existsSync(templateConfigPath)) {
		const templateConfig = await fs.readJson(templateConfigPath)

		if (templateConfig.variables && config) {
			await applyVariableSubstitutions(projectPath, templateConfig.variables, config)
		}
	}

	if (fs.existsSync(transformsPath)) {
		try {
			const { transforms } = await import(transformsPath)
			await applyTransforms(projectPath, transforms, config)
		} catch (error) {
			console.log(chalk.yellow(`⚠ Could not load transforms for template '${template.name}': ${error}`))
		}
	}

	await applyProjectConfiguration(projectPath, config)
}

async function applyTransforms(
	projectPath: string,
	transforms: Record<string, (content: string, config: ProjectConfig) => string | null | { source: string }>,
	config: ProjectConfig
): Promise<void> {
	const files = await getAllFiles(projectPath)

	for (const file of files) {
		const relativePath = path.relative(projectPath, file)
		const transform = transforms[relativePath] || transforms[file]

		if (transform) {
			try {
				const content = await fs.readFile(file, 'utf-8')
				const result = transform(content, config)

				if (result === null) {
					await fs.remove(file)
				} else if (typeof result === 'string') {
					await fs.writeFile(file, result)
				} else if (typeof result === 'object' && result.source) {
					await fs.copy(result.source, file)
				}
			} catch {
				console.log(chalk.yellow(`⚠ Transform failed for ${relativePath}`))
			}
		}
	}
}

async function copySharedConfigs(projectPath: string, config: ProjectConfig, templatesRoot: string): Promise<void> {
	const sharedConfigsDir = path.join(templatesRoot, 'shared', 'configs')

	if (!fs.existsSync(sharedConfigsDir)) {
		return
	}

	const configsToCopy = [
		{ file: 'eslint.config.js', condition: config.eslint },
		{ file: 'prettier.config.js', condition: config.prettier },
		{ file: 'tsconfig.json', condition: config.typescript },
		{ file: 'Dockerfile', condition: config.docker },
		{ file: 'docker-compose.yml', condition: config.docker },
		{ file: '.dockerignore', condition: config.docker },
		{ file: '.gitignore', condition: config.git },
		{ file: '.prettierignore', condition: config.prettier },
		{ file: 'LICENSE', condition: true }
	]

	for (const { file, condition } of configsToCopy) {
		if (condition) {
			const sourcePath = path.join(sharedConfigsDir, file)
			const targetPath = path.join(projectPath, file)

			if (fs.existsSync(sourcePath)) {
				await fs.copy(sourcePath, targetPath)
				console.log(chalk.gray(`✓ Copied ${file}`))
			}
		}
	}
}

async function applyVariableSubstitutions(projectPath: string, variables: any, config: ProjectConfig): Promise<void> {
	const files = await getAllFiles(projectPath)

	for (const file of files) {
		if (file.endsWith('.json') || file.endsWith('.md') || file.endsWith('.js') || file.endsWith('.ts')) {
			let content = await fs.readFile(file, 'utf-8')

			content = content.replace(/\{\{projectName\}\}/g, config.name || '')
			content = content.replace(/\{\{packageManager\}\}/g, config.packageManager || 'bun')

			await fs.writeFile(file, content)
		}
	}
}

async function getAllFiles(dir: string): Promise<string[]> {
	const files: string[] = []
	const items = await fs.readdir(dir)

	for (const item of items) {
		const fullPath = path.join(dir, item)
		const stat = await fs.stat(fullPath)

		if (stat.isDirectory()) {
			files.push(...(await getAllFiles(fullPath)))
		} else {
			files.push(fullPath)
		}
	}

	return files
}

async function applyProjectConfiguration(projectPath: string, config?: Partial<ProjectConfig>): Promise<void> {
	if (!config) return

	const packageJsonPath = path.join(projectPath, 'package.json')
	if (fs.existsSync(packageJsonPath)) {
		const packageJson = await fs.readJson(packageJsonPath)

		packageJson.name = config.name || packageJson.name

		if (config.packageManager && config.packageManager !== 'bun') {
			Object.keys(packageJson.scripts || {}).forEach((key) => {
				if (packageJson.scripts[key].startsWith('bun ')) {
					packageJson.scripts[key] = packageJson.scripts[key].replace('bun ', `${config.packageManager} `)
				}
			})
		}

		const pm = config.packageManager || 'bun'

		if (!config.eslint) {
			delete packageJson.scripts?.lint
			delete packageJson.scripts?.['lint:fix']
		} else {
			packageJson.scripts = packageJson.scripts || {}
			packageJson.scripts.lint = `${pm} run eslint .`
			packageJson.scripts['lint:fix'] = `${pm} run eslint . --fix`
		}

		if (!config.prettier) {
			delete packageJson.scripts?.format
			delete packageJson.scripts?.['format:check']
		} else {
			packageJson.scripts = packageJson.scripts || {}
			packageJson.scripts.format = `${pm} run prettier --write .`
			packageJson.scripts['format:check'] = `${pm} run prettier --check .`
		}

		if (!config.docker) {
			delete packageJson.scripts?.['docker:build']
			delete packageJson.scripts?.['docker:up']
			delete packageJson.scripts?.['docker:up:build']
			delete packageJson.scripts?.['docker:down']
		} else {
			packageJson.scripts = packageJson.scripts || {}
			packageJson.scripts['docker:build'] = 'docker compose build'
			packageJson.scripts['docker:up'] = 'docker compose up -d'
			packageJson.scripts['docker:up:build'] = 'docker compose up -d --build'
			packageJson.scripts['docker:down'] = 'docker compose down'
		}

		await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 })
	}

	const readmePath = path.join(projectPath, 'README.md')
	if (fs.existsSync(readmePath)) {
		let content = await fs.readFile(readmePath, 'utf-8')
		content = content.replace(/\{\{projectName\}\}/g, config.name || '')
		content = content.replace(/\{\{packageManager\}\}/g, config.packageManager || 'bun')
		await fs.writeFile(readmePath, content)
	}

	if (config.git) {
		try {
			const { execSync } = await import('child_process')
			execSync('git init', { cwd: projectPath, stdio: 'ignore' })
			console.log(chalk.gray('✓ Initialized git repository'))
		} catch {
			console.log(chalk.yellow('⚠ Could not initialize git repository'))
		}
	}

	if (config.install) {
		try {
			const { execSync } = await import('child_process')
			const command = config.packageManager === 'bun' ? 'bun install' : `${config.packageManager} install`
			execSync(command, { cwd: projectPath, stdio: 'inherit' })
			console.log(chalk.gray('✓ Installed dependencies'))
		} catch {
			console.log(chalk.yellow('⚠ Could not install dependencies'))
		}
	}
}
