/**
 * `honestjs doctor` - Diagnoses environment: runtime, git, package managers, template cache, network.
 */

import { execSync } from 'child_process'
import chalk from 'chalk'
import { Command } from 'commander'
import { consola } from 'consola'
import fs from 'fs-extra'
import os from 'os'
import path from 'path'

const ok = (s: string) => chalk.green('✓') + ' ' + s
const warn = (s: string) => chalk.yellow('○') + ' ' + s
const fail = (s: string) => chalk.red('✗') + ' ' + s

const CACHE_DIR_NAME = 'honestjs-templates'

function checkRuntime(): { ok: boolean; message: string } {
	const isBun = typeof (process.versions as { bun?: string })?.bun !== 'undefined'
	const runtime = isBun ? 'Bun' : 'Node.js'
	const version = process.version
	const minNode = 18
	const major = parseInt(version.slice(1).split('.')[0], 10)
	if (!isBun && major < minNode) {
		return { ok: false, message: `${runtime} ${version} (requires Node >= ${minNode})` }
	}
	return { ok: true, message: `${runtime} ${version}` }
}

function checkGit(): { ok: boolean; message: string } {
	try {
		execSync('git --version', { stdio: 'pipe' })
		const out = execSync('git --version', { encoding: 'utf-8' })
		return { ok: true, message: out.trim() }
	} catch {
		return { ok: false, message: 'Not found' }
	}
}

function checkPackageManager(name: string): { ok: boolean; message: string } {
	try {
		const cmd = name === 'npm' ? 'npm --version' : `${name} --version`
		execSync(cmd, { stdio: 'pipe' })
		const out = execSync(cmd, { encoding: 'utf-8' })
		return { ok: true, message: out.trim() }
	} catch {
		return { ok: false, message: 'Not found' }
	}
}

function checkTemplateCache(): { ok: boolean; message: string } {
	const registryPath = path.join(os.tmpdir(), CACHE_DIR_NAME, 'templates.json')
	if (fs.existsSync(registryPath)) {
		return { ok: true, message: 'Cached' }
	}
	return { ok: false, message: 'Not cached (run honestjs list or new first)' }
}

async function checkNetwork(): Promise<{ ok: boolean; message: string }> {
	try {
		const res = await fetch('https://api.github.com', { signal: AbortSignal.timeout(5000) })
		return { ok: res.ok, message: res.ok ? 'Reachable' : `HTTP ${res.status}` }
	} catch (err) {
		return { ok: false, message: err instanceof Error ? err.message : 'Unreachable' }
	}
}

const doctorCommand = new Command('doctor')
	.description('Diagnose environment: runtime, git, package managers, template cache, network')
	.action(async () => {
		try {
			consola.info('\nHonestJS Doctor')
			consola.info('===============\n')

			const runtime = checkRuntime()
			consola.log(`Runtime:    ${runtime.ok ? ok(runtime.message) : fail(runtime.message)}`)

			const git = checkGit()
			consola.log(`Git:       ${git.ok ? ok(git.message) : warn(git.message)}`)

			for (const pm of ['bun', 'npm', 'yarn', 'pnpm']) {
				const r = checkPackageManager(pm)
				consola.log(`${pm.padEnd(10)} ${r.ok ? ok(r.message) : warn(r.message)}`)
			}

			const cache = checkTemplateCache()
			consola.log(`Templates:  ${cache.ok ? ok(cache.message) : warn(cache.message)}`)

			consola.start('Checking network...')
			const network = await checkNetwork()
			consola.log(`Network:   ${network.ok ? ok(network.message) : warn(network.message)}`)

			consola.log('')
		} catch (error) {
			consola.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
			process.exit(1)
		}
	})

export { doctorCommand }
