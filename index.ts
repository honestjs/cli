#!/usr/bin/env node

import chalk from 'chalk'
import { Command } from 'commander'
import { generateCommand } from './commands/generate.js'
import { infoCommand } from './commands/info.js'
import { listCommand } from './commands/list.js'
import { newCommand } from './commands/new.js'

const program = new Command()

program.name('honestjs').description('CLI tool for scaffolding honestjs projects').version('1.0.0')

program.addCommand(newCommand)
program.addCommand(listCommand)
program.addCommand(infoCommand)
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
