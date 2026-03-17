/**
 * Template utilities: registry loading, template prompts, and project scaffolding.
 * Templates are fetched from honestjs/templates (via cache) or from a local path.
 */

import { consola } from 'consola'
import fs from 'fs-extra'
import os from 'os'
import path from 'path'
import type { PromptObject } from 'prompts'
import { getTemplateCache } from './cache'
import { applyProjectConfiguration, applyTemplateTransforms, copySharedConfigs } from './transforms'

/** Returns true if the value looks like a local filesystem path. */
export function isLocalTemplatePath(value: string): boolean {
	if (!value || typeof value !== 'string') return false
	const trimmed = value.trim()
	return (
		trimmed.startsWith('./') ||
		trimmed.startsWith('../') ||
		trimmed.startsWith('~/') ||
		trimmed.startsWith('~\\') ||
		path.isAbsolute(trimmed)
	)
}

/** Resolves a local path: expands ~ and converts to absolute path. */
export function resolveLocalTemplatePath(rawPath: string): string {
	const expanded = rawPath.startsWith('~') ? path.join(os.homedir(), rawPath.slice(1)) : rawPath
	return path.resolve(process.cwd(), expanded)
}

export type LocalTemplatesRoot = { root: string; mode: 'repo' } | { root: string; mode: 'single'; templateName: string }

/** Detects whether path is a templates repo root or a single template dir. Returns null if invalid. */
export function getLocalTemplatesRoot(resolvedPath: string): LocalTemplatesRoot | null {
	if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isDirectory()) {
		return null
	}
	const hasTemplatesJson = fs.existsSync(path.join(resolvedPath, 'templates.json'))
	if (hasTemplatesJson) {
		return { root: resolvedPath, mode: 'repo' }
	}
	const hasTemplateJson = fs.existsSync(path.join(resolvedPath, 'template.json'))
	const hasFilesDir = fs.existsSync(path.join(resolvedPath, 'files'))
	if (hasTemplateJson && hasFilesDir) {
		return { root: resolvedPath, mode: 'single', templateName: path.basename(resolvedPath) }
	}
	return null
}

export interface Template {
	name: string
	description: string
	path: string
	category?: string
	tags?: string[]
	version?: string
	author?: string
	/** Supported runtimes (e.g. "bun", "node"). When absent, assume both. */
	runtimes?: string[]
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
	testing?: boolean
	frontend?: boolean
	[key: string]: unknown
}

export interface GetTemplatesOptions {
	offline?: boolean
	force?: boolean
	/** When set, load templates from local path instead of cache. */
	localPath?: string
	/** When set (e.g. for local templates), use this as templates root instead of cache. */
	templatesRoot?: string
	/** When true, rethrow on first transform error instead of warning (e.g. for CI). */
	strict?: boolean
}

/** Returns the absolute path to a template directory given the templates root and template metadata. */
export function getTemplateDir(root: string, template: Template): string {
	if (template.path === '.' || template.path.startsWith('templates/')) {
		return path.join(root, template.path)
	}
	return path.join(root, 'templates', template.path)
}

/** Lists relative paths under dir that would be copied (excludes node_modules and .git). */
export async function listTemplateFiles(filesDir: string): Promise<string[]> {
	const out: string[] = []
	async function walk(dir: string, prefix: string): Promise<void> {
		const entries = await fs.readdir(dir, { withFileTypes: true })
		for (const entry of entries) {
			const normalized = path.join(prefix, entry.name).replace(/\\/g, '/')
			if (normalized.includes('node_modules') || normalized.includes('.git')) continue
			const full = path.join(dir, entry.name)
			if (entry.isDirectory()) {
				await walk(full, path.join(prefix, entry.name))
			} else {
				out.push(path.join(prefix, entry.name).replace(/\\/g, '/'))
			}
		}
	}
	await walk(filesDir, '')
	return out
}

/** Returns the templates root directory (cache dir or local repo root). Use this instead of getTemplateCache when options may include templatesRoot or localPath. */
export async function getTemplatesRoot(options?: GetTemplatesOptions): Promise<string> {
	if (options?.templatesRoot) return options.templatesRoot
	if (options?.localPath) {
		const resolved = resolveLocalTemplatePath(options.localPath)
		const info = getLocalTemplatesRoot(resolved)
		if (!info) {
			throw new Error(
				`Invalid local template path: '${options.localPath}'. Expected a directory with templates.json (repo root) or template.json + files/ (single template).`
			)
		}
		return info.root
	}
	return getTemplateCache(options?.force, options?.offline)
}

/** Loads the template registry (templates.json) from the cache or local path and returns template metadata. */
export async function getTemplates(options?: GetTemplatesOptions): Promise<Template[]> {
	const { localPath } = options ?? {}

	if (localPath) {
		const resolved = resolveLocalTemplatePath(localPath)
		const info = getLocalTemplatesRoot(resolved)
		if (!info) {
			throw new Error(
				`Invalid local template path: '${localPath}'. Expected a directory with templates.json (repo root) or template.json + files/ (single template).`
			)
		}
		if (info.mode === 'repo') {
			const registryPath = path.join(info.root, 'templates.json')
			const registry: TemplateRegistry = await fs.readJson(registryPath)
			return Object.entries(registry.templates).map(([key, template]) => ({
				...template,
				name: key,
				path: template.path || key
			}))
		}
		// Single template mode
		const templateJsonPath = path.join(info.root, 'template.json')
		const templateConfig = await fs.readJson(templateJsonPath)
		return [
			{
				name: info.templateName,
				description: templateConfig.description ?? 'Local template',
				path: '.',
				category: 'local',
				version: templateConfig.version,
				author: templateConfig.author,
				runtimes: templateConfig.runtimes
			}
		]
	}

	const root = await getTemplatesRoot(options)
	const registryPath = path.join(root, 'templates.json')

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

/** Loads template-specific prompts (prompts.js) for interactive configuration. */
export async function getTemplatePrompts(
	templateName: string,
	options?: GetTemplatesOptions
): Promise<PromptObject[] | null> {
	const templatesRoot = await getTemplatesRoot(options)
	const templates = await getTemplates(options)
	const template = templates.find((t) => t.name === templateName)
	if (!template) return null

	const templateDir = getTemplateDir(templatesRoot, template)
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

/**
 * Scaffolds a new project: copies template files, applies transforms, copies shared configs.
 * On failure, removes the partially created project directory.
 */
export async function copyTemplate(
	templateName: string,
	projectName: string,
	config?: Partial<ProjectConfig>,
	options?: GetTemplatesOptions
): Promise<void> {
	const templates = await getTemplates(options)
	const template = templates.find((t) => t.name === templateName)

	if (!template) {
		throw new Error(`Template '${templateName}' not found`)
	}

	const projectPath = path.join(process.cwd(), projectName)
	const root = await getTemplatesRoot(options)

	try {
		consola.info(`Creating project from template '${templateName}'...`)

		const templateDir = getTemplateDir(root, template)
		consola.log(`Using template from: ${templateDir}`)

		const templateConfigPath = path.join(templateDir, 'template.json')
		const filesDir = path.join(templateDir, 'files')

		if (fs.existsSync(templateConfigPath) && fs.existsSync(filesDir)) {
			await fs.copy(filesDir, projectPath, {
				filter: (src) => {
					const normalized = src.replace(/\\/g, '/')
					return !normalized.includes('node_modules') && !normalized.includes('.git')
				}
			})

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

			await applyTemplateTransforms(projectPath, template, mergedConfig, root, {
				strict: options?.strict
			})

			await copySharedConfigs(projectPath, mergedConfig, root)
		} else {
			await fs.copy(templateDir, projectPath, {
				filter: (src) => {
					const normalized = src.replace(/\\/g, '/')
					return !normalized.includes('node_modules') && !normalized.includes('.git')
				}
			})
			await applyProjectConfiguration(projectPath, config)
		}
	} catch (error) {
		if (fs.existsSync(projectPath)) {
			await fs.remove(projectPath)
		}

		throw new Error(
			`Failed to create project from template '${templateName}': ${
				error instanceof Error ? error.message : 'Unknown error'
			}`,
			{ cause: error }
		)
	}
}
