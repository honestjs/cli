import chalk from 'chalk'
import { Command } from 'commander'
import fs from 'fs-extra'
import path from 'path'
import { getTemplates } from '../utils/template'

const infoCommand = new Command('info').description('Show CLI and template information').action(async () => {
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

		console.log(chalk.cyan('\n🚀 HonestJS CLI Information'))
		console.log(chalk.cyan('==========================\n'))

		const packageJson = await fs.readJson(path.join(process.cwd(), 'package.json'))
		console.log(chalk.white(`${chalk.bold('CLI Version:')} ${packageJson.version}`))
		console.log(chalk.white(`${chalk.bold('Runtime:')} Bun`))
		console.log(chalk.white(`${chalk.bold('Templates Repository:')} honestjs/templates`))
		console.log('')

		console.log(chalk.white(`${chalk.bold('Available Templates:')} ${templates.length}`))
		templates.forEach((template) => {
			console.log(chalk.gray(`  • ${template.name}: ${template.description}`))
		})
		console.log(chalk.gray('  (All templates support the same CLI-level configuration options)'))
		console.log('')

		console.log(chalk.white(`${chalk.bold('Node.js Version:')} ${process.version}`))
		console.log(chalk.white(`${chalk.bold('Platform:')} ${process.platform}`))
		console.log(chalk.white(`${chalk.bold('Architecture:')} ${process.arch}`))
		console.log('')

		console.log(chalk.cyan('🔗 Useful Links:'))
		console.log(chalk.white('  Documentation: https://honestjs.dev'))
		console.log(chalk.white('  GitHub: https://github.com/honestjs/honestjs'))
		console.log(chalk.white('  Templates: https://github.com/honestjs/templates'))
		console.log(chalk.white('  Issues: https://github.com/honestjs/honestjs/issues'))
	} catch (error) {
		console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
		process.exit(1)
	}
})

export { infoCommand }
