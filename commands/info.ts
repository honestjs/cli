import { Command } from 'commander'
import { consola } from 'consola'
import fs from 'fs-extra'
import path from 'path'
import { cleanupCache, getTemplates } from '../utils'

const infoCommand = new Command('info').description('Show CLI and template information').action(async () => {
	try {
		consola.start('Fetching templates...')
		const templates = await getTemplates()
		consola.success('Templates fetched successfully!')

		consola.info('\n🚀 HonestJS CLI Information')
		consola.info('==========================\n')

		const packageJson = await fs.readJson(path.join(process.cwd(), 'package.json'))
		consola.log(`CLI Version: ${packageJson.version}`)
		consola.log(`Runtime: Bun`)
		consola.log(`Templates Repository: honestjs/templates`)
		consola.log('')

		consola.log(`Available Templates: ${templates.length}`)
		templates.forEach((template) => {
			consola.log(`  • ${template.name}: ${template.description}`)
		})
		consola.log('  (All templates support the same CLI-level configuration options)')
		consola.log('')

		consola.log(`Node.js Version: ${process.version}`)
		consola.log(`Platform: ${process.platform}`)
		consola.log(`Architecture: ${process.arch}`)
		consola.log('')

		consola.info('🔗 Useful Links:')
		consola.log('  Documentation: https://honestjs.dev')
		consola.log('  GitHub: https://github.com/honestjs/honestjs')
		consola.log('  Templates: https://github.com/honestjs/templates')
		consola.log('  Issues: https://github.com/honestjs/honestjs/issues')
	} catch (error) {
		consola.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
		process.exit(1)
	} finally {
		await cleanupCache()
	}
})

export { infoCommand }
