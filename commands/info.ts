/**
 * `honestjs info` - Shows CLI version, available templates, and environment info.
 * Version is resolved from the CLI package (works when bundled or installed).
 */

import { Command } from 'commander'
import { consola } from 'consola'
import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import { getTemplates } from '../utils'

/** Traverses up from this file to find package.json with name @honestjs/cli. */
function getCliPackagePath(): string {
	let dir = path.dirname(fileURLToPath(import.meta.url))
	for (let i = 0; i < 5; i++) {
		const p = path.join(dir, 'package.json')
		if (fs.existsSync(p)) {
			const pkg = JSON.parse(fs.readFileSync(p, 'utf-8'))
			if (pkg.name === '@honestjs/cli') return p
		}
		dir = path.dirname(dir)
	}
	throw new Error('Could not find CLI package.json')
}

const infoCommand = new Command('info').description('Show CLI and template information').action(async () => {
	try {
		consola.start('Fetching templates...')
		const templates = await getTemplates()
		consola.success('Templates fetched successfully!')

		consola.info('\n🚀 HonestJS CLI Information')
		consola.info('==========================\n')

		let packageJson: { version?: string } = { version: 'unknown' }
		try {
			packageJson = await fs.readJson(getCliPackagePath())
		} catch {
			// CLI package not found, use unknown
		}
		consola.log(`CLI Version: ${packageJson.version}`)
		const runtime = typeof (process.versions as { bun?: string })?.bun !== 'undefined' ? 'Bun' : 'Node.js'
		consola.log(`Runtime: ${runtime}`)
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
	}
})

export { infoCommand }
