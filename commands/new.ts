import chalk from 'chalk'
import { Command } from 'commander'
import fs from 'fs-extra'
import inquirer from 'inquirer'
import ora from 'ora'
import { copyTemplate, getTemplatePrompts, getTemplates } from '../utils/template'

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
		try {
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

			if (!options.yes) {
				config = await promptForConfiguration(config)
			} else {
				config = {
					...config,
					packageManager: config.packageManager || 'bun',
					typescript: config.typescript ?? true,
					eslint: config.eslint ?? true,
					prettier: config.prettier ?? true,
					docker: config.docker ?? true,
					git: config.git ?? true,
					install: config.install ?? true
				}
			}

			if (!config.name) {
				console.error(chalk.red('Error: Project name is required'))
				process.exit(1)
			}

			if (fs.existsSync(config.name)) {
				console.error(chalk.red(`Error: Directory '${config.name}' already exists`))
				process.exit(1)
			}

			let templates
			try {
				templates = await getTemplates()
			} catch (error) {
				console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Failed to fetch templates')
				console.log(
					chalk.yellow(
						'\nMake sure you have internet connection and the honestjs/templates repository is accessible.'
					)
				)
				process.exit(1)
			}

			if (!config.template) {
				config.template = 'barebone'
			}

			if (!templates.find((t) => t.name === config.template)) {
				console.error(chalk.red(`Error: Template '${config.template}' not found`))
				console.log(chalk.yellow('Available templates:'))
				templates.forEach((t) => {
					console.log(chalk.cyan(`  - ${t.name}: ${t.description}`))
				})
				process.exit(1)
			}

			const spinner = ora('Creating project...').start()

			try {
				await copyTemplate(config.template, config.name, config)
				spinner.succeed(chalk.green('Project created successfully!'))

				showNextSteps(config)
			} catch (error) {
				spinner.fail(chalk.red('Failed to create project'))
				console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
				process.exit(1)
			}
		} catch (error) {
			console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
			process.exit(1)
		}
	})

async function promptForConfiguration(initialConfig: ProjectConfig): Promise<ProjectConfig> {
	let config = { ...initialConfig }

	if (!config.name) {
		const nameAnswer = await inquirer.prompt([
			{
				type: 'input',
				name: 'name',
				message: 'What is the name of your project?',
				validate: (input: string) => {
					if (!input.trim()) return 'Project name is required'
					if (!/^[a-z0-9-]+$/.test(input)) {
						return 'Project name must be lowercase with hyphens only'
					}
					return true
				}
			}
		])
		config = { ...config, ...nameAnswer }
	}

	if (!config.template) {
		let templates
		try {
			templates = await getTemplates()
		} catch (error) {
			console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Failed to fetch templates')
			console.log(
				chalk.yellow(
					'\nMake sure you have internet connection and the honestjs/templates repository is accessible.'
				)
			)
			process.exit(1)
		}

		const templateAnswer = await inquirer.prompt([
			{
				type: 'list',
				name: 'template',
				message: 'Which template would you like to use?',
				choices: templates.map((t) => ({
					name: `${t.name}: ${t.description}`,
					value: t.name
				}))
			}
		])
		config = { ...config, ...templateAnswer }
	}

	const templatePrompts = await getTemplatePrompts(config.template)
	if (templatePrompts && templatePrompts.length > 0) {
		console.log(chalk.cyan(`\n📋 Configuring ${config.template} template...`))
		const templateAnswers = await inquirer.prompt(templatePrompts)
		config = { ...config, ...templateAnswers }
	}

	const generalQuestions: any[] = []

	if (config.packageManager === undefined) {
		generalQuestions.push({
			type: 'list',
			name: 'packageManager',
			message: 'Which package manager would you like to use?',
			choices: [
				{ name: 'Bun (recommended)', value: 'bun' },
				{ name: 'npm', value: 'npm' },
				{ name: 'yarn', value: 'yarn' },
				{ name: 'pnpm', value: 'pnpm' }
			],
			default: 'bun'
		})
	}

	if (config.typescript === undefined) {
		generalQuestions.push({
			type: 'confirm',
			name: 'typescript',
			message: 'Use TypeScript?',
			default: true
		})
	}

	if (config.eslint === undefined) {
		generalQuestions.push({
			type: 'confirm',
			name: 'eslint',
			message: 'Add ESLint for code linting?',
			default: true
		})
	}

	if (config.prettier === undefined) {
		generalQuestions.push({
			type: 'confirm',
			name: 'prettier',
			message: 'Add Prettier for code formatting?',
			default: true
		})
	}

	if (config.docker === undefined) {
		generalQuestions.push({
			type: 'confirm',
			name: 'docker',
			message: 'Add Docker configuration?',
			default: true
		})
	}

	if (config.git === undefined) {
		generalQuestions.push({
			type: 'confirm',
			name: 'git',
			message: 'Initialize git repository?',
			default: true
		})
	}

	if (config.install === undefined) {
		generalQuestions.push({
			type: 'confirm',
			name: 'install',
			message: 'Install dependencies after creation?',
			default: true
		})
	}

	if (generalQuestions.length > 0) {
		const generalAnswers = await inquirer.prompt(generalQuestions)
		config = { ...config, ...generalAnswers }
	}

	return {
		...config,
		packageManager: config.packageManager || 'bun',
		typescript: config.typescript ?? true,
		eslint: config.eslint ?? true,
		prettier: config.prettier ?? true,
		docker: config.docker ?? true,
		git: config.git ?? true,
		install: config.install ?? true
	}
}

function showNextSteps(config: ProjectConfig): void {
	console.log('\n' + chalk.green('🎉 Project created successfully!'))
	console.log('\n' + chalk.blue('Next steps:'))
	console.log(chalk.cyan(`  cd ${config.name}`))

	if (!config.install) {
		console.log(chalk.cyan(`  ${config.packageManager} install`))
	}

	console.log(chalk.cyan(`  ${config.packageManager} run dev`))
	console.log('\n' + chalk.gray('Happy coding! 🚀'))
}

export { newCommand }
