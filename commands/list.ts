import { Command } from 'commander'
import { consola } from 'consola'
import { cleanupCache, getTemplates } from '../utils'

const listCommand = new Command('list')
	.description('List available templates')
	.option('-j, --json', 'Output in JSON format')
	.option('-c, --category <category>', 'Filter by category')
	.option('-t, --tag <tag>', 'Filter by tag')
	.action(async (options) => {
		try {
			consola.start('Fetching templates...')
			const templates = await getTemplates()
			consola.success('Templates fetched successfully!')

			let filteredTemplates = templates

			if (options.category) {
				filteredTemplates = templates.filter((t) => t.category === options.cagetTemplates())
			}

			if (options.tag) {
				filteredTemplates = templates.filter((t) => t.tags?.includes(options.tag))
			}

			if (options.json) {
				consola.log(JSON.stringify(filteredTemplates, null, 2))
				return
			}

			if (filteredTemplates.length === 0) {
				consola.warn('No templates found matching your criteria.')
				return
			}

			consola.info('\n📋 Available Templates:')
			consola.info('=====================\n')

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
				consola.log(`${consola.log(category.toUpperCase())}:`)

				categoryTemplates.forEach((template, index) => {
					consola.log(`  ${index + 1}. ${template.name}`)
					consola.log(`     ${template.description}`)

					if (template.version) {
						consola.info(`     Version: ${template.version}`)
					}

					if (template.author) {
						consola.info(`     Author: ${template.author}`)
					}

					if (template.tags && template.tags.length > 0) {
						consola.info(`     Tags: ${template.tags.join(', ')}`)
					}

					consola.info(`     Template: honestjs/templates/${template.path}`)
					consola.log('')
				})
			})

			const categories = [...new Set(templates.map((t) => t.category).filter(Boolean))]
			if (categories.length > 0) {
				consola.info('Categories:')
				categories.forEach((category) => {
					consola.log(`  • ${category}`)
				})
				consola.log('')
			}

			const allTags = [...new Set(templates.flatMap((t) => t.tags || []))]
			if (allTags.length > 0) {
				consola.info('Tags:')
				allTags.forEach((tag) => {
					consola.log(`  • ${tag}`)
				})
				consola.log('')
			}

			consola.info('Usage:')
			consola.log('  honestjs new <project-name> --template <template-name>')
			consola.log('  honestjs new <project-name> (interactive mode)')
			consola.log('  honestjs list --category <category>')
			consola.log('  honestjs list --tag <tag>')
			consola.log('')
			consola.info('All templates support:')
			consola.log('  • TypeScript, ESLint, Prettier, Docker, Git')
			consola.log('  • Package manager selection (Bun, npm, yarn, pnpm)')
			consola.log('  • Automatic dependency installation')
		} catch (error) {
			consola.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
			process.exit(1)
		} finally {
			await cleanupCache()
		}
	})

export { listCommand }
