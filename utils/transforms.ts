import { consola } from 'consola'
import fs from 'fs-extra'
import path from 'path'
import { ProjectConfig, Template } from './template'

export async function applyTemplateTransforms(
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
			consola.warn(`⚠ Could not load transforms for template '${template.name}': ${error}`)
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
				consola.warn(`⚠ Transform failed for ${relativePath}`)
			}
		}
	}
}

export async function copySharedConfigs(
	projectPath: string,
	config: ProjectConfig,
	templatesRoot: string
): Promise<void> {
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
				consola.log(`✓ Copied ${file}`)
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

export async function applyProjectConfiguration(projectPath: string, config?: Partial<ProjectConfig>): Promise<void> {
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
			consola.log('✓ Initialized git repository')
		} catch {
			consola.warn('⚠ Could not initialize git repository')
		}
	}

	if (config.install) {
		try {
			const { execSync } = await import('child_process')
			const command = config.packageManager === 'bun' ? 'bun install' : `${config.packageManager} install`
			execSync(command, { cwd: projectPath, stdio: 'inherit' })
			consola.log('✓ Installed dependencies')
		} catch {
			consola.warn('⚠ Could not install dependencies')
		}
	}
}
