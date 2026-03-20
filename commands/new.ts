/**
 * `honestjs new` - Creates a new HonestJS project from a template.
 * Supports interactive prompts or --yes for defaults. Templates: blank, barebone, mvc.
 */

import { Command } from 'commander'
import { consola } from 'consola'
import fs from 'fs-extra'
import prompts, { PromptObject } from 'prompts'
import path from 'path'
import {
	copyTemplate,
	handleCommandError,
	getLocalTemplatesRoot,
	getTemplateDir,
	getTemplatePrompts,
	getTemplates,
	getSharedConfigsToCopy,
	getTemplatesRoot,
	isLocalTemplatePath,
	listTemplateFiles,
	resolveLocalTemplatePath,
	TemplateError,
	type GetTemplatesOptions,
	type ProjectConfig,
	type Template,
	ValidationError
} from '../utils'

const newCommand = new Command('new')
	.alias('create')
	.alias('scaffold')
	.description('Create a new honestjs project')
	.argument('[project-name]', 'Name of the project')
	.option('-t, --template <template>', 'Template name (barebone, blank, mvc) or local path (./path, ~/path)')
	.option('-p, --package-manager <manager>', 'Package manager to use (bun, npm, yarn, pnpm)')
	.option('--typescript', 'Use TypeScript')
	.option('--no-typescript', 'Skip TypeScript')
	.option('--eslint', 'Add ESLint configuration')
	.option('--no-eslint', 'Skip ESLint')
	.option('--prettier', 'Add Prettier configuration')
	.option('--no-prettier', 'Skip Prettier')
	.option('--docker', 'Add Docker configuration')
	.option('--no-docker', 'Skip Docker')
	.option('--git', 'Initialize git repository')
	.option('--no-git', 'Skip git initialization')
	.option('--install', 'Install dependencies after creation')
	.option('--no-install', 'Skip dependency installation')
	.option('-y, --yes', 'Skip prompts and use defaults')
	.option('--offline', 'Use cached templates only (no network)')
	.option('--refresh-templates', 'Force refresh template cache before use')
	.option('--strict', 'Fail on first transform error (e.g. for CI)')
	.option('--dry-run', 'Show what would be created without writing files')
	.option('--json', 'Output result as JSON')
	.action(async (projectName, options) => {
		let config: ProjectConfig = {
			name: projectName || '',
			template: options.template || '',
			packageManager: options.packageManager,
			typescript: options.typescript,
			eslint: options.eslint,
			prettier: options.prettier,
			docker: options.docker,
			git: options.git,
			install: options.install
		}

		try {
			const useLocalPath = isLocalTemplatePath(options.template || '')
			let templateOptions: GetTemplatesOptions

			if (useLocalPath) {
				const resolved = resolveLocalTemplatePath(options.template!)
				const info = getLocalTemplatesRoot(resolved)
				if (!info) {
					throw new ValidationError(
						`Invalid local template path: '${options.template}'. Expected a directory with templates.json (repo root) or template.json + files/ (single template).`
					)
				}
				templateOptions = {
					localPath: resolved,
					templatesRoot: info.root,
					strict: options.strict ?? process.env.HONESTJS_STRICT === '1'
				}
				if (info.mode === 'single') {
					config.template = info.templateName
				}
			} else {
				templateOptions = {
					offline: options.offline,
					force: options.refreshTemplates,
					strict: options.strict ?? process.env.HONESTJS_STRICT === '1'
				}
			}

			const templates = await getTemplates(templateOptions)

			if (options.yes) {
				config = createDefaultConfig(config, templates, useLocalPath)
				validateProjectConfig(config)
				validateTemplateRuntimeCompatibility(config, templates)
			} else {
				if (config.name?.trim()) {
					validateProjectName(config.name.trim())
				}
				config = await promptForConfiguration(config, templates, templateOptions)
				validateProjectConfig(config)
				validateTemplateRuntimeCompatibility(config, templates)
			}

			if (options.dryRun) {
				const root = await getTemplatesRoot(templateOptions)
				const template = (await getTemplates(templateOptions)).find((t) => t.name === config.template)
				if (!template) throw new TemplateError(`Template '${config.template}' not found`)
				const projectPath = path.join(process.cwd(), config.name)
				const templateDir = getTemplateDir(root, template)
				const sharedConfigOutput: string[] = []
				const outputFiles: string[] = []
				const filesDir = path.join(templateDir, 'files')
				if (fs.existsSync(filesDir)) {
					const fileList = await listTemplateFiles(filesDir)
					outputFiles.push(...fileList)
				}
				const mergedConfig: ProjectConfig = {
					...config,
					packageManager: config.packageManager ?? 'bun',
					install: config.install ?? true,
					git: config.git ?? true,
					typescript: config.typescript ?? true,
					eslint: config.eslint ?? true,
					prettier: config.prettier ?? true,
					docker: config.docker ?? true
				}
				const sharedConfigs = await getSharedConfigsToCopy(mergedConfig, root)
				sharedConfigOutput.push(...sharedConfigs)

				if (options.json) {
					consola.log(
						JSON.stringify(
							{
								action: 'new',
								dryRun: true,
								target: projectPath,
								template: config.template,
								templateDir,
								files: outputFiles,
								sharedConfigs: sharedConfigOutput,
								config: mergedConfig
							},
							null,
							2
						)
					)
				} else {
					consola.info('Dry run: the following would be created')
					consola.log(`  Target: ${projectPath}`)
					consola.log(`  Template: ${config.template} (${templateDir})`)
					consola.log(`  Would copy ${outputFiles.length} file(s) from template`)
					if (outputFiles.length <= 20) {
						outputFiles.forEach((f) => consola.log(`    - ${f}`))
					} else {
						outputFiles.slice(0, 15).forEach((f) => consola.log(`    - ${f}`))
						consola.log(`    ... and ${outputFiles.length - 15} more`)
					}
					consola.log(`  Would add shared configs: ${sharedConfigOutput.length} file(s)`)
					sharedConfigOutput.forEach((f) => consola.log(`    - ${f}`))
					consola.success('Dry run complete. Run without --dry-run to create the project.')
				}
				return
			}

			if (!options.json) consola.start('Creating project...')
			await copyTemplate(config.template, config.name, config, templateOptions)
			if (options.json) {
				consola.log(
					JSON.stringify(
						{
							action: 'new',
							dryRun: false,
							created: true,
							project: config.name,
							template: config.template,
							packageManager: config.packageManager,
							nextSteps: [
								`cd ${config.name}`,
								...(config.install ? [] : [`${config.packageManager} install`]),
								`${config.packageManager} run dev`
							]
						},
						null,
						2
					)
				)
			} else {
				consola.success('Project created successfully!')
				showNextSteps(config)
			}
		} catch (error) {
			handleCommandError(error, { json: options.json })
		}
	})

/** Builds config with defaults when --yes is used. Validates template exists. */
function createDefaultConfig(
	initialConfig: ProjectConfig,
	templates: Template[],
	useLocalPath?: boolean
): ProjectConfig {
	// For local repo mode + --yes: initialConfig.template is the path, use first template
	// For local single template: initialConfig.template is already the template name
	// For external: use initialConfig.template or 'barebone'
	const template =
		useLocalPath && templates.length > 0 && !templates.find((t) => t.name === initialConfig.template)
			? templates[0].name
			: initialConfig.template || 'barebone'
	const templateMeta = templates.find((t) => t.name === template)
	const defaultPackageManager =
		initialConfig.packageManager ??
		(templateMeta?.runtimes?.length
			? templateMeta.runtimes!.includes('bun')
				? 'bun'
				: templateMeta.runtimes!.includes('node')
					? 'npm'
					: 'bun'
			: 'bun')
	const defaultConfig = {
		...initialConfig,
		name: initialConfig.name || 'honestjs-project',
		template,
		packageManager: defaultPackageManager,
		typescript: initialConfig.typescript ?? true,
		eslint: initialConfig.eslint ?? true,
		prettier: initialConfig.prettier ?? true,
		docker: initialConfig.docker ?? true,
		git: initialConfig.git ?? true,
		install: initialConfig.install ?? true,
		// Template-specific prompt defaults (used by transforms)
		testing: initialConfig.testing ?? true,
		frontend: initialConfig.frontend ?? template === 'mvc'
	}

	if (!templates.find((t) => t.name === defaultConfig.template)) {
		throw new TemplateError(
			`Template '${defaultConfig.template}' not found. Available templates: ${templates
				.map((t) => t.name)
				.join(', ')}`
		)
	}

	return defaultConfig
}

/** Runs interactive prompts: project name, template, template-specific options, then general options. */
async function promptForConfiguration(
	initialConfig: ProjectConfig,
	templates: Template[],
	templateOptions?: GetTemplatesOptions
): Promise<ProjectConfig> {
	let config = { ...initialConfig }
	const onCancel = () => {
		consola.info('Cancelled.')
		process.exit(0)
	}

	const questions: PromptObject[] = [
		{
			type: config.name ? null : 'text',
			name: 'name',
			message: 'What is the name of your project?',
			validate: (input: string) => {
				if (!input.trim()) return 'Project name is required'
				if (!/^[a-z0-9-]+$/.test(input)) {
					return 'Project name must be lowercase with hyphens only'
				}
				if (fs.existsSync(input.trim())) {
					return `Directory '${input.trim()}' already exists`
				}
				return true
			}
		},
		{
			type: config.template ? null : 'select',
			name: 'template',
			message: 'Which template would you like to use?',
			choices: templates.map((t) => ({
				title: `${t.name}: ${t.description}`,
				value: t.name
			}))
		}
	]

	const answers = await prompts(
		questions.filter((q: PromptObject) => q.type !== null),
		{ onCancel }
	)
	config = { ...config, ...answers }

	const templatePrompts = await getTemplatePrompts(config.template, templateOptions)
	if (templatePrompts && templatePrompts.length > 0) {
		consola.info(`\n📋 Configuring ${config.template} template...`)
		const templateAnswers = await prompts(templatePrompts, { onCancel })
		config = { ...config, ...templateAnswers }
	}

	const selectedTemplate = templates.find((t) => t.name === config.template)
	const allowedPms = selectedTemplate ? getAllowedPackageManagers(selectedTemplate) : null
	const packageManagerChoices =
		allowedPms === null
			? [
					{ title: 'Bun (recommended)', value: 'bun' as const },
					{ title: 'npm', value: 'npm' as const },
					{ title: 'yarn', value: 'yarn' as const },
					{ title: 'pnpm', value: 'pnpm' as const }
				]
			: allowedPms.length === 1
				? [{ title: `Bun (required for ${config.template})`, value: 'bun' as const }]
				: allowedPms.map((pm) => ({
						title: pm === 'bun' ? 'Bun (recommended)' : pm,
						value: pm
					}))
	const generalQuestions: PromptObject[] = [
		{
			type: config.packageManager === undefined ? 'select' : null,
			name: 'packageManager',
			message: 'Which package manager would you like to use?',
			choices: packageManagerChoices,
			initial: 0
		},
		{
			type: config.typescript === undefined ? 'toggle' : null,
			name: 'typescript',
			message: 'Use TypeScript?',
			initial: true,
			active: 'yes',
			inactive: 'no'
		},
		{
			type: config.eslint === undefined ? 'toggle' : null,
			name: 'eslint',
			message: 'Add ESLint for code linting?',
			initial: true,
			active: 'yes',
			inactive: 'no'
		},
		{
			type: config.prettier === undefined ? 'toggle' : null,
			name: 'prettier',
			message: 'Add Prettier for code formatting?',
			initial: true,
			active: 'yes',
			inactive: 'no'
		},
		{
			type: config.docker === undefined ? 'toggle' : null,
			name: 'docker',
			message: 'Add Docker configuration?',
			initial: true,
			active: 'yes',
			inactive: 'no'
		},
		{
			type: config.git === undefined ? 'toggle' : null,
			name: 'git',
			message: 'Initialize git repository?',
			initial: true,
			active: 'yes',
			inactive: 'no'
		},
		{
			type: config.install === undefined ? 'toggle' : null,
			name: 'install',
			message: 'Install dependencies after creation?',
			initial: true,
			active: 'yes',
			inactive: 'no'
		}
	]

	const generalAnswers = await prompts(
		generalQuestions.filter((q: PromptObject) => q.type !== null),
		{ onCancel }
	)
	return { ...config, ...generalAnswers }
}

/** Validates project name (required, format, directory must not exist). Exits on failure. Call before asking other questions when name is already known. */
function validateProjectName(name: string): void {
	if (!name || !name.trim()) {
		throw new ValidationError('Project name is required')
	}
	const trimmed = name.trim()
	if (!/^[a-z0-9-]+$/.test(trimmed)) {
		throw new ValidationError('Project name must be lowercase with hyphens only')
	}
	if (fs.existsSync(trimmed)) {
		throw new ValidationError(`Directory '${trimmed}' already exists`)
	}
}

/** Maps package manager to runtime. */
function packageManagerToRuntime(pm: ProjectConfig['packageManager']): string {
	return pm === 'bun' ? 'bun' : 'node'
}

/** Returns package managers allowed by template runtimes, or null if no restriction. */
function getAllowedPackageManagers(template: Template): ProjectConfig['packageManager'][] | null {
	if (!template.runtimes || template.runtimes.length === 0) return null
	const allowed: ProjectConfig['packageManager'][] = []
	if (template.runtimes.includes('bun')) allowed.push('bun')
	if (template.runtimes.includes('node')) allowed.push('npm', 'yarn', 'pnpm')
	return allowed.length === 0 ? [] : allowed
}

/** Validates that the chosen package manager is allowed by the template's runtimes. Exits on failure. */
function validateTemplateRuntimeCompatibility(config: ProjectConfig, templates: Template[]): void {
	const template = templates.find((t) => t.name === config.template)
	if (!template?.runtimes || template.runtimes.length === 0) return
	const pm = config.packageManager ?? 'bun'
	const runtime = packageManagerToRuntime(pm)
	if (!template.runtimes.includes(runtime)) {
		const allowed = getAllowedPackageManagers(template)!
		const hint =
			allowed.length === 1
				? `Use --package-manager ${allowed[0]}.`
				: `Use one of: ${allowed.map((m) => `--package-manager ${m}`).join(', ')}.`
		throw new ValidationError(
			`Template '${config.template}' only supports ${template.runtimes.join(' and ')}. ${hint}`
		)
	}
}

/** Ensures project name is set and target directory does not exist. */
function validateProjectConfig(config: ProjectConfig): void {
	if (!config.name) {
		throw new ValidationError('Project name is required')
	}
	validateProjectName(config.name)
}

/** Prints post-creation instructions (cd, install, dev). */
function showNextSteps(config: ProjectConfig): void {
	consola.info('\nNext steps:')
	consola.log(`  cd ${config.name}`)

	if (!config.install) {
		consola.log(`  ${config.packageManager} install`)
	}

	consola.log(`  ${config.packageManager} run dev`)
	consola.log('\nHappy coding! 🚀')
}

export { newCommand }
