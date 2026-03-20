import { consola } from 'consola'

export enum ExitCode {
	Unknown = 1,
	Validation = 2,
	Network = 3,
	FileSystem = 4,
	Template = 5
}

export class CliError extends Error {
	readonly code: ExitCode
	readonly kind: string

	constructor(message: string, code: ExitCode = ExitCode.Unknown, kind = 'Error') {
		super(message)
		this.name = 'CliError'
		this.code = code
		this.kind = kind
	}
}

export class ValidationError extends CliError {
	constructor(message: string) {
		super(message, ExitCode.Validation, 'ValidationError')
		this.name = 'ValidationError'
	}
}

export class TemplateError extends CliError {
	constructor(message: string) {
		super(message, ExitCode.Template, 'TemplateError')
		this.name = 'TemplateError'
	}
}

export interface CommandErrorOptions {
	json?: boolean
	fallbackCode?: ExitCode
}

function toCliError(error: unknown, fallbackCode: ExitCode = ExitCode.Unknown): CliError {
	if (error instanceof CliError) return error
	if (error instanceof Error) {
		return new CliError(error.message, fallbackCode)
	}
	return new CliError('Unknown error', fallbackCode)
}

export function handleCommandError(error: unknown, options: CommandErrorOptions = {}): never {
	const cliError = toCliError(error, options.fallbackCode)

	if (options.json) {
		consola.log(
			JSON.stringify(
				{
					error: {
						kind: cliError.kind,
						message: cliError.message,
						code: cliError.code
					}
				},
				null,
				2
			)
		)
	} else {
		consola.error(`❌ ${cliError.kind}: ${cliError.message}`)
	}

	process.exit(cliError.code)
}
