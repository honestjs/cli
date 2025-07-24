import chalk from 'chalk'
import { Command } from 'commander'
import ora from 'ora'
import { generateFilter } from '../generators/components/filter'
import { generateGuard } from '../generators/components/guard'
import { generateMiddleware } from '../generators/components/middleware'
import { generatePipe } from '../generators/components/pipe'
import { generateController } from '../generators/core/controller'
import { generateModule } from '../generators/core/module'
import { generateService } from '../generators/core/service'
import { generateView } from '../generators/core/view'

interface GenerateOptions {
	name: string
	path?: string
	flat?: boolean
	skipImport?: boolean
	export?: boolean
}

const generateCommand = new Command('generate')
	.alias('g')
	.description('Generate and/or modify files based on a schematic')
	.argument('<schematic>', 'The schematic to generate')
	.argument('<name>', 'The name of the generated item')
	.option('-p, --path <path>', 'Specify the path where the file should be created')
	.option('-f, --flat', 'Create files in a flat structure')

	.option('--skip-import', 'Skip importing the generated item')
	.option('--export', 'Export the generated item')
	.action(async (schematic, name, options) => {
		try {
			const spinner = ora('Generating files...').start()

			const generateOptions: GenerateOptions = {
				name,
				path: options.path,
				flat: options.flat,
				skipImport: options.skipImport,
				export: options.export
			}

			let result

			switch (schematic.toLowerCase()) {
				case 'controller':
				case 'c':
					result = await generateController(generateOptions)
					break
				case 'service':
				case 's':
					result = await generateService(generateOptions)
					break
				case 'module':
				case 'm':
					result = await generateModule(generateOptions)
					break
				case 'view':
				case 'v':
					result = await generateView(generateOptions)
					break
				case 'middleware':
				case 'c-m':
					result = await generateMiddleware(generateOptions)
					break
				case 'guard':
				case 'c-g':
					result = await generateGuard(generateOptions)
					break
				case 'filter':
				case 'c-f':
					result = await generateFilter(generateOptions)
					break
				case 'pipe':
				case 'c-p':
					result = await generatePipe(generateOptions)
					break
				default:
					spinner.fail(chalk.red(`Unknown schematic: ${schematic}`))
					console.log(chalk.yellow('\nAvailable schematics:'))
					console.log(chalk.white('  controller (c)     - Generate a controller'))
					console.log(chalk.white('  service (s)         - Generate a service'))
					console.log(chalk.white('  module (m)          - Generate a module'))
					console.log(chalk.white('  view (v)            - Generate a view'))
					console.log(chalk.white('  middleware (c-m)    - Generate a middleware'))
					console.log(chalk.white('  guard (c-g)         - Generate a guard'))
					console.log(chalk.white('  filter (c-f)        - Generate a filter'))
					console.log(chalk.white('  pipe (c-p)          - Generate a pipe'))
					console.log(chalk.yellow('\nExamples:'))
					console.log(chalk.white('  honestjs g controller user    -> modules/users/users.controller.ts'))
					console.log(chalk.white('  honestjs g controller users   -> modules/users/users.controller.ts'))
					console.log(chalk.white('  honestjs g service user       -> modules/users/users.service.ts'))
					console.log(chalk.white('  honestjs g view users         -> modules/users/views/users.view.tsx'))
					console.log(
						chalk.white('  honestjs g middleware logger  -> components/logger/logger.middleware.ts')
					)
					console.log(chalk.white('  honestjs g guard auth         -> components/auth/auth.guard.ts'))
					console.log(
						chalk.white('  honestjs g filter notfound    -> components/notfound/notfound.filter.ts')
					)
					console.log(chalk.white('  honestjs g pipe parseInt      -> components/parseint/parseint.pipe.ts'))
					process.exit(1)
			}

			spinner.succeed(chalk.green('Files generated successfully!'))

			console.log(chalk.cyan('\n📁 Generated files:'))
			result.files.forEach((file: string) => {
				console.log(chalk.white(`  ✓ ${file}`))
			})

			if (result.imports.length > 0) {
				console.log(chalk.cyan('\n📦 Import statements to add:'))
				result.imports.forEach((importStmt: string) => {
					console.log(chalk.white(`  ${importStmt}`))
				})
			}
		} catch (error) {
			console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
			process.exit(1)
		}
	})

export { generateCommand }
