import { consola } from 'consola'
import fs from 'fs-extra'
import path from 'path'
import { getTemplateCache } from './cache'
import { applyProjectConfiguration, applyTemplateTransforms, copySharedConfigs } from './transforms'

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
	const cacheDir = await getTemplateCache()
	const registryPath = path.join(cacheDir, 'templates.json')

	if (fs.existsSync(registryPath)) {
		const registry: TemplateRegistry = await fs.readJson(registryPath)
		return Object.entries(registry.templates).map(([key, template]) => ({
			...template,
			name: key,
			path: template.path || key
		}))
	}

	throw new Error('templates.json not found in repository')
}

export async function getTemplatePrompts(templateName: string): Promise<any[] | null> {
	const cacheDir = await getTemplateCache()
	const templates = await getTemplates()
	const template = templates.find((t) => t.name === templateName)

	if (!template) {
		return null
	}

	let templateDir: string
	if (template.path.startsWith('templates/')) {
		templateDir = path.join(cacheDir, template.path)
	} else {
		templateDir = path.join(cacheDir, 'templates', template.path)
	}

	const promptsPath = path.join(templateDir, 'prompts.js')
	if (fs.existsSync(promptsPath)) {
		try {
			const { prompts } = await import(promptsPath)
			return prompts
		} catch (error) {
			consola.warn(`⚠ Could not load prompts for template '${templateName}': ${error}`)
		}
	}

	return null
}

export async function copyTemplate(
	templateName: string,
	projectName: string,
	config?: Partial<ProjectConfig>
): Promise<void> {
	const templates = await getTemplates()
	const template = templates.find((t) => t.name === templateName)

	if (!template) {
		throw new Error(`Template '${templateName}' not found`)
	}

	const projectPath = path.join(process.cwd(), projectName)
	const cacheDir = await getTemplateCache()

	try {
		consola.info(`Creating project from template '${templateName}'...`)

		let templateDir: string
		if (template.path.startsWith('templates/')) {
			templateDir = path.join(cacheDir, template.path)
		} else {
			templateDir = path.join(cacheDir, 'templates', template.path)
		}

		consola.log(`Using template from: ${templateDir}`)

		const templateConfigPath = path.join(templateDir, 'template.json')
		const filesDir = path.join(templateDir, 'files')

		if (fs.existsSync(templateConfigPath) && fs.existsSync(filesDir)) {
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

			await applyTemplateTransforms(projectPath, template, mergedConfig, cacheDir)

			await copySharedConfigs(projectPath, mergedConfig, cacheDir)
		} else {
			await fs.copy(templateDir, projectPath)
			await applyProjectConfiguration(projectPath, config)
		}
	} catch (error) {
		if (fs.existsSync(projectPath)) {
			await fs.remove(projectPath)
		}

		throw new Error(
			`Failed to create project from template '${templateName}': ${
				error instanceof Error ? error.message : 'Unknown error'
			}`
		)
	}
}
