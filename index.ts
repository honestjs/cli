#!/usr/bin/env node
/**
 * HonestJS CLI entry point.
 * Registers commands (new, list, info, generate) and parses CLI arguments.
 * Version is read from package.json at runtime.
 */

import chalk from 'chalk'
import { Command } from 'commander'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { doctorCommand } from './commands/doctor.js'
import { generateCommand } from './commands/generate.js'
import { infoCommand } from './commands/info.js'
import { listCommand } from './commands/list.js'
import { newCommand } from './commands/new.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkgPath = [join(__dirname, 'package.json'), join(__dirname, '..', 'package.json')].find((p) => existsSync(p))
if (!pkgPath) throw new Error('Could not find CLI package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))

const program = new Command()

program.name('honestjs').description('CLI tool for scaffolding honestjs projects').version(pkg.version)

program.addCommand(newCommand)
program.addCommand(listCommand)
program.addCommand(infoCommand)
program.addCommand(doctorCommand)
program.addCommand(generateCommand)

try {
	await program.parseAsync()
} catch (err) {
	if (err instanceof Error) {
		console.error(chalk.red('Error:'), err.message)
	} else {
		console.error(chalk.red('An unexpected error occurred'))
	}
	process.exit(1)
}
