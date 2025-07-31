import { Command } from 'commander'
import { consola } from 'consola'
import fs from 'fs-extra'
import prompts, { PromptObject } from 'prompts'
import { cleanupCache, copyTemplate, getTemplatePrompts, getTemplates, Template } from '../utils'

interface ProjectConfig {
	name: string
	template: string
	packageManager: 'bun' | 'npm' | 'yarn' | 'pnpm'
	typescript: boolean
	eslint: boolean
	prettier: boolean
	docker: boolean
	git: boolean
	install: boolean
	[key: string]: any
}

const newCommand = new Command('new')
	.description('Create a new honestjs project')
	.argument('[project-name]', 'Name of the project')
	.option('-t, --template <template>', 'Template to use (barebone, blank, mvc)')
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
			const templates = await getTemplates()

			if (options.yes) {
				config = createDefaultConfig(config, templates)
			} else {
				config = await promptForConfiguration(config, templates)
			}

			validateProjectConfig(config)

			consola.start('Creating project...')
			await copyTemplate(config.template, config.name, config)
			consola.success('Project created successfully!')

			showNextSteps(config)
		} catch (error) {
			handleError(error)
		} finally {
			await cleanupCache()
		}
	})

function createDefaultConfig(initialConfig: ProjectConfig, templates: Template[]): ProjectConfig {
	const defaultConfig = {
		...initialConfig,
		name: initialConfig.name || 'honestjs-project',
		template: initialConfig.template || 'barebone',
		packageManager: initialConfig.packageManager || 'bun',
		typescript: initialConfig.typescript ?? true,
		eslint: initialConfig.eslint ?? true,
		prettier: initialConfig.prettier ?? true,
		docker: initialConfig.docker ?? true,
		git: initialConfig.git ?? true,
		install: initialConfig.install ?? true
	}

	if (!templates.find((t) => t.name === defaultConfig.template)) {
		consola.error(`Error: Template '${defaultConfig.template}' not found`)
		consola.warn('Available templates:')
		templates.forEach((t) => {
			consola.info(`  - ${t.name}: ${t.description}`)
		})
		process.exit(1)
	}

	return defaultConfig
}

async function promptForConfiguration(initialConfig: ProjectConfig, templates: Template[]): Promise<ProjectConfig> {
	let config = { ...initialConfig }

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

	const answers = await prompts(questions.filter((q: PromptObject) => q.type !== null))
	config = { ...config, ...answers }

	const templatePrompts = await getTemplatePrompts(config.template)
	if (templatePrompts && templatePrompts.length > 0) {
		consola.info(`\n📋 Configuring ${config.template} template...`)
		const templateAnswers = await prompts(templatePrompts)
		config = { ...config, ...templateAnswers }
	}

	const generalQuestions: PromptObject[] = [
		{
			type: config.packageManager === undefined ? 'select' : null,
			name: 'packageManager',
			message: 'Which package manager would you like to use?',
			choices: [
				{ title: 'Bun (recommended)', value: 'bun' },
				{ title: 'npm', value: 'npm' },
				{ title: 'yarn', value: 'yarn' },
				{ title: 'pnpm', value: 'pnpm' }
			],
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

	const generalAnswers = await prompts(generalQuestions.filter((q: PromptObject) => q.type !== null))
	return { ...config, ...generalAnswers }
}

function validateProjectConfig(config: ProjectConfig): void {
	if (!config.name) {
		consola.error('Error: Project name is required')
		process.exit(1)
	}

	if (fs.existsSync(config.name)) {
		consola.error(`Error: Directory '${config.name}' already exists`)
		process.exit(1)
	}
}

function showNextSteps(config: ProjectConfig): void {
	consola.info('\nNext steps:')
	consola.log(`  cd ${config.name}`)

	if (!config.install) {
		consola.log(`  ${config.packageManager} install`)
	}

	consola.log(`  ${config.packageManager} run dev`)
	consola.log('\nHappy coding! 🚀')
}

function handleError(error: any): void {
	consola.error(`\nError: ${error instanceof Error ? error.message : 'An unknown error occurred'}`)
	process.exit(1)
}

export { newCommand }
