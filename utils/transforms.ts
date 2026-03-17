/**
 * Template transforms: variable substitution, file transforms (exact + glob),
 * shared config copy, and project configuration (package.json, git, install).
 */

import { consola } from 'consola'
import fs from 'fs-extra'
import { minimatch } from 'minimatch'
import path from 'path'
import { getTemplateDir, ProjectConfig, Template } from './template'

const PM_EXEC: Record<NonNullable<ProjectConfig['packageManager']>, string> = {
	bun: 'bunx',
	npm: 'npx',
	pnpm: 'pnpm dlx',
	yarn: 'yarn dlx'
}

/**
 * Replaces {{pm}} and {{pmExec}} in script values. Templates use these placeholders
 * so we substitute once at scaffold time; no pattern-matching on "bun run" / "bunx".
 */
function substitutePackageManagerPlaceholders(
	script: string,
	packageManager: NonNullable<ProjectConfig['packageManager']>
): string {
	if (!script) return script
	const pm = packageManager
	const pmExec = PM_EXEC[pm]
	return script.replace(/\{\{pm\}\}/g, pm).replace(/\{\{pmExec\}\}/g, pmExec)
}

/** Returns true if the pattern contains glob characters (* or ?). */
function isGlobPattern(pattern: string): boolean {
	return pattern.includes('*') || pattern.includes('?')
}

export type TransformResult = string | null | { source: string }
export type TransformFn = (content: string, config: ProjectConfig) => TransformResult | Promise<TransformResult>

/**
 * Finds a transform for the given file path. Tries exact match first, then glob patterns.
 * Transform keys can be exact paths (e.g. package.json) or glob patterns.
 */
function findMatchingTransform(
	relativePath: string,
	transforms: Record<string, TransformFn>
): [string, TransformFn] | null {
	const exact = transforms[relativePath]
	if (exact) return [relativePath, exact]

	// Normalize for cross-platform (use forward slashes for minimatch)
	const normalizedPath = relativePath.replace(/\\/g, '/')

	// Glob match: check each key that looks like a glob
	for (const [pattern, transform] of Object.entries(transforms)) {
		if (isGlobPattern(pattern) && minimatch(normalizedPath, pattern.replace(/\\/g, '/'))) {
			return [pattern, transform]
		}
	}
	return null
}

/**
 * Applies template transforms: variable substitutions from template.json,
 * transforms from transforms.js (exact + glob), then project configuration.
 */
export interface ApplyTemplateTransformsOptions {
	/** When true, rethrow on first transform error instead of warning. */
	strict?: boolean
}

export async function applyTemplateTransforms(
	projectPath: string,
	template: Template,
	config: ProjectConfig,
	templatesRoot: string,
	options?: ApplyTemplateTransformsOptions
): Promise<void> {
	const templateDir = getTemplateDir(templatesRoot, template)
	const templateConfigPath = path.join(templateDir, 'template.json')
	const transformsPath = path.join(templateDir, 'transforms.js')

	if (fs.existsSync(templateConfigPath)) {
		const templateConfig = await fs.readJson(templateConfigPath)
		const substitutionMap = buildSubstitutionMap(config, templateConfig.variables ?? {})
		await applyVariableSubstitutions(projectPath, substitutionMap)
	} else {
		const substitutionMap = buildSubstitutionMap(config, {})
		await applyVariableSubstitutions(projectPath, substitutionMap)
	}

	if (fs.existsSync(transformsPath)) {
		try {
			const { transforms } = await import(transformsPath)
			await applyTransforms(projectPath, transforms, config, templatesRoot, {
				strict: options?.strict
			})
		} catch (error) {
			consola.warn(`⚠ Could not load transforms for template '${template.name}': ${error}`)
		}
	}

	await applyProjectConfiguration(projectPath, config)
}

/**
 * Runs transforms on each file. Transform can return (or resolve to):
 * - string: replace file content
 * - null: delete the file
 * - { source: string }: copy from template (path relative to templatesRoot)
 */
async function applyTransforms(
	projectPath: string,
	transforms: Record<string, TransformFn>,
	config: ProjectConfig,
	templatesRoot: string,
	options?: { strict?: boolean }
): Promise<void> {
	const files = await getAllFiles(projectPath)

	for (const file of files) {
		const relativePath = path.relative(projectPath, file)
		const match = findMatchingTransform(relativePath, transforms)

		if (match) {
			const [, transform] = match
			try {
				const content = await fs.readFile(file, 'utf-8')
				const result = await Promise.resolve(transform(content, config))

				if (result === null) {
					await fs.remove(file)
				} else if (typeof result === 'string') {
					await fs.writeFile(file, result)
				} else if (typeof result === 'object' && result.source) {
					const sourcePath = path.isAbsolute(result.source)
						? result.source
						: path.join(templatesRoot, result.source)
					await fs.copy(sourcePath, file)
				}
			} catch (err) {
				if (options?.strict) throw err
				consola.warn(`⚠ Transform failed for ${relativePath}`)
			}
		}
	}
}

/** Paths under templates root for shared package base fragments. */
const SHARED_PACKAGE_SCRIPTS = 'shared/package/scripts.json'
const SHARED_PACKAGE_DEPS = 'shared/package/devDependencies.json'

/**
 * Loads shared package base (scripts and devDependencies) from templates repo.
 * Returns null if either file is missing (no-op for older caches).
 */
export async function loadSharedPackageBase(templatesRoot: string): Promise<{
	scripts: Record<string, string>
	devDependencies: Record<string, string>
} | null> {
	const scriptsPath = path.join(templatesRoot, SHARED_PACKAGE_SCRIPTS)
	const depsPath = path.join(templatesRoot, SHARED_PACKAGE_DEPS)
	if (!fs.existsSync(scriptsPath) || !fs.existsSync(depsPath)) {
		return null
	}
	const scripts = (await fs.readJson(scriptsPath)) as Record<string, string>
	const devDependencies = (await fs.readJson(depsPath)) as Record<string, string>
	return { scripts, devDependencies }
}

/**
 * Composes project package.json with shared base scripts and devDependencies.
 * Template-specific keys override shared defaults. No-op if package.json missing or shared base missing.
 */
export async function composeTemplatePackageJson(projectPath: string, templatesRoot: string): Promise<void> {
	const packageJsonPath = path.join(projectPath, 'package.json')
	if (!fs.existsSync(packageJsonPath)) return

	const base = await loadSharedPackageBase(templatesRoot)
	if (!base) return

	const pkg = (await fs.readJson(packageJsonPath)) as Record<string, unknown>
	pkg.scripts = { ...base.scripts, ...(pkg.scripts as Record<string, string>) }
	pkg.devDependencies = { ...base.devDependencies, ...(pkg.devDependencies as Record<string, string>) }
	await fs.writeJson(packageJsonPath, pkg, { spaces: 2 })
}

const SHARED_CONFIGS_FALLBACK: { file: string; condition: string | boolean }[] = [
	{ file: 'eslint.config.js', condition: 'eslint' },
	{ file: 'prettier.config.js', condition: 'prettier' },
	{ file: 'tsconfig.json', condition: 'typescript' },
	{ file: 'Dockerfile', condition: 'docker' },
	{ file: 'docker-compose.yml', condition: 'docker' },
	{ file: '.dockerignore', condition: 'docker' },
	{ file: '.gitignore', condition: 'git' },
	{ file: '.prettierignore', condition: 'prettier' },
	{ file: 'LICENSE', condition: true }
]

/**
 * Returns the list of shared config file names that would be copied for the given config.
 * Used by copySharedConfigs and by --dry-run. Only includes files that exist in shared/configs.
 */
export async function getSharedConfigsToCopy(config: ProjectConfig, templatesRoot: string): Promise<string[]> {
	const sharedConfigsDir = path.join(templatesRoot, 'shared', 'configs')

	if (!fs.existsSync(sharedConfigsDir)) {
		return []
	}

	const manifestPath = path.join(sharedConfigsDir, 'manifest.json')
	let configsToCopy: { file: string; condition: string | boolean }[]

	if (fs.existsSync(manifestPath)) {
		const manifest = (await fs.readJson(manifestPath)) as { file: string; condition: string | boolean }[]
		configsToCopy = manifest
	} else {
		configsToCopy = SHARED_CONFIGS_FALLBACK
	}

	const out: string[] = []
	for (const { file, condition } of configsToCopy) {
		const shouldCopy =
			condition === true || (typeof condition === 'string' && config[condition as keyof ProjectConfig])
		if (shouldCopy) {
			const sourcePath = path.join(sharedConfigsDir, file)
			if (fs.existsSync(sourcePath)) {
				out.push(file)
			}
		}
	}
	return out
}

/**
 * Copies shared config files (eslint, prettier, docker, etc.) into the project
 * based on config flags. Reads templates/shared/configs/manifest.json when present;
 * otherwise uses a hardcoded list for backward compatibility.
 */
export async function copySharedConfigs(
	projectPath: string,
	config: ProjectConfig,
	templatesRoot: string
): Promise<void> {
	const sharedConfigsDir = path.join(templatesRoot, 'shared', 'configs')
	const filesToCopy = await getSharedConfigsToCopy(config, templatesRoot)

	for (const file of filesToCopy) {
		const sourcePath = path.join(sharedConfigsDir, file)
		const targetPath = path.join(projectPath, file)
		await fs.copy(sourcePath, targetPath)
		consola.log(`✓ Copied ${file}`)
	}
}

/** Builds a flat map of placeholder keys to string values from config and template variables (primitives only). Config wins over template variables. */
function buildSubstitutionMap(
	config: ProjectConfig,
	templateVariables: Record<string, unknown>
): Record<string, string> {
	const merged = { ...templateVariables, ...config }
	const map: Record<string, string> = {}
	for (const [key, value] of Object.entries(merged)) {
		if (value === null || value === undefined) {
			map[key] = ''
		} else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
			map[key] = String(value)
		}
	}
	return map
}

/** Replaces {{key}} placeholders in JSON, MD, JS, TS files using the given substitution map. */
async function applyVariableSubstitutions(projectPath: string, substitutionMap: Record<string, string>): Promise<void> {
	const files = await getAllFiles(projectPath)

	for (const file of files) {
		if (file.endsWith('.json') || file.endsWith('.md') || file.endsWith('.js') || file.endsWith('.ts')) {
			let content = await fs.readFile(file, 'utf-8')

			for (const [key, value] of Object.entries(substitutionMap)) {
				const placeholder = `{{${key}}}`
				content = content.replace(new RegExp(escapeRegExp(placeholder), 'g'), value)
			}

			await fs.writeFile(file, content)
		}
	}
}

/** Escapes special regex characters in a string. */
function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Recursively collects all file paths under a directory. */
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

/**
 * Applies project config: package.json (name, scripts, package manager),
 * README placeholders, git init, and dependency install.
 */
export async function applyProjectConfiguration(projectPath: string, config?: Partial<ProjectConfig>): Promise<void> {
	if (!config) return

	const packageJsonPath = path.join(projectPath, 'package.json')
	if (fs.existsSync(packageJsonPath)) {
		const packageJson = await fs.readJson(packageJsonPath)

		packageJson.name = config.name || packageJson.name

		const pm = config.packageManager || 'bun'
		Object.keys(packageJson.scripts || {}).forEach((key) => {
			packageJson.scripts[key] = substitutePackageManagerPlaceholders(packageJson.scripts[key], pm)
		})

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
