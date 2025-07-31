import { Command } from 'commander'
import { consola } from 'consola'
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
			consola.start('Generating files...')

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
					consola.error(`Unknown schematic: ${schematic}`)
					consola.warn('\nAvailable schematics:')
					consola.log('  controller (c)     - Generate a controller')
					consola.log('  service (s)         - Generate a service')
					consola.log('  module (m)          - Generate a module')
					consola.log('  view (v)            - Generate a view')
					consola.log('  middleware (c-m)    - Generate a middleware')
					consola.log('  guard (c-g)         - Generate a guard')
					consola.log('  filter (c-f)        - Generate a filter')
					consola.log('  pipe (c-p)          - Generate a pipe')
					consola.warn('\nExamples:')
					consola.log('  honestjs g controller user    -> modules/users/users.controller.ts')
					consola.log('  honestjs g controller users   -> modules/users/users.controller.ts')
					consola.log('  honestjs g service user       -> modules/users/users.service.ts')
					consola.log('  honestjs g view users         -> modules/users/views/users.view.tsx')
					consola.log('  honestjs g middleware logger  -> components/logger/logger.middleware.ts')
					consola.log('  honestjs g guard auth         -> components/auth/auth.guard.ts')
					consola.log('  honestjs g filter notfound    -> components/notfound/notfound.filter.ts')
					consola.log('  honestjs g pipe parseInt      -> components/parseint/parseint.pipe.ts')
					process.exit(1)
			}

			consola.success('Files generated successfully!')

			consola.info('\n📁 Generated files:')
			result.files.forEach((file: string) => {
				consola.log(`  ✓ ${file}`)
			})

			if (result.imports.length > 0) {
				consola.info('\n📦 Import statements to add:')
				result.imports.forEach((importStmt: string) => {
					consola.log(`  ${importStmt}`)
				})
			}
		} catch (error) {
			consola.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
			process.exit(1)
		}
	})

export { generateCommand }
