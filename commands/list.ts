import chalk from 'chalk'
import { Command } from 'commander'
import { getTemplates } from '../utils/template'

const listCommand = new Command('list')
	.description('List available templates')
	.option('-j, --json', 'Output in JSON format')
	.option('-c, --category <category>', 'Filter by category')
	.option('-t, --tag <tag>', 'Filter by tag')
	.action(async (options) => {
		try {
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

			let filteredTemplates = templates

			if (options.category) {
				filteredTemplates = templates.filter((t) => t.category === options.category)
			}

			if (options.tag) {
				filteredTemplates = templates.filter((t) => t.tags?.includes(options.tag))
			}

			if (options.json) {
				console.log(JSON.stringify(filteredTemplates, null, 2))
				return
			}

			if (filteredTemplates.length === 0) {
				console.log(chalk.yellow('No templates found matching your criteria.'))
				return
			}

			console.log(chalk.cyan('\n📋 Available Templates:'))
			console.log(chalk.cyan('=====================\n'))

			const templatesByCategory = filteredTemplates.reduce(
				(acc, template) => {
					const category = template.category || 'Other'
					if (!acc[category]) {
						acc[category] = []
					}
					acc[category].push(template)
					return acc
				},
				{} as Record<string, typeof templates>
			)

			Object.entries(templatesByCategory).forEach(([category, categoryTemplates]) => {
				console.log(chalk.white(`${chalk.bold(category.toUpperCase())}:`))

				categoryTemplates.forEach((template, index) => {
					console.log(chalk.white(`  ${index + 1}. ${chalk.bold(template.name)}`))
					console.log(chalk.gray(`     ${template.description}`))

					if (template.version) {
						console.log(chalk.blue(`     Version: ${template.version}`))
					}

					if (template.author) {
						console.log(chalk.blue(`     Author: ${template.author}`))
					}

					if (template.tags && template.tags.length > 0) {
						console.log(chalk.blue(`     Tags: ${template.tags.join(', ')}`))
					}

					console.log(chalk.blue(`     Template: honestjs/templates/${template.path}`))
					console.log('')
				})
			})

			const categories = [...new Set(templates.map((t) => t.category).filter(Boolean))]
			if (categories.length > 0) {
				console.log(chalk.cyan('Categories:'))
				categories.forEach((category) => {
					console.log(chalk.white(`  • ${category}`))
				})
				console.log('')
			}

			const allTags = [...new Set(templates.flatMap((t) => t.tags || []))]
			if (allTags.length > 0) {
				console.log(chalk.cyan('Tags:'))
				allTags.forEach((tag) => {
					console.log(chalk.white(`  • ${tag}`))
				})
				console.log('')
			}

			console.log(chalk.cyan('Usage:'))
			console.log(chalk.white('  honestjs new <project-name> --template <template-name>'))
			console.log(chalk.white('  honestjs new <project-name> (interactive mode)'))
			console.log(chalk.white('  honestjs list --category <category>'))
			console.log(chalk.white('  honestjs list --tag <tag>'))
			console.log('')
			console.log(chalk.cyan('All templates support:'))
			console.log(chalk.gray('  • TypeScript, ESLint, Prettier, Docker, Git'))
			console.log(chalk.gray('  • Package manager selection (Bun, npm, yarn, pnpm)'))
			console.log(chalk.gray('  • Automatic dependency installation'))
		} catch (error) {
			console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
			process.exit(1)
		}
	})

export { listCommand }
