import fs from 'fs-extra'
import path from 'path'
import pluralize from 'pluralize'

export interface GenerateOptions {
	name: string
	path?: string
	flat?: boolean
	skipImport?: boolean
	export?: boolean
}

export interface GenerateResult {
	files: string[]
	imports: string[]
}

export abstract class BaseGenerator {
	protected options: GenerateOptions
	protected projectRoot: string

	constructor(options: GenerateOptions) {
		this.options = options
		this.projectRoot = process.cwd()
	}

	abstract generate(): Promise<GenerateResult>

	protected getTargetPath(): string {
		if (this.options.path) {
			return path.join(this.projectRoot, this.options.path)
		}

		if (!this.options.flat) {
			return path.join(this.projectRoot, 'src', this.getBasePath(), this.getPluralFileName())
		}

		return path.join(this.projectRoot, 'src')
	}

	protected getBasePath(): string {
		return 'modules'
	}

	protected async ensureDirectory(dir: string): Promise<void> {
		await fs.ensureDir(dir)
	}

	protected async writeFile(filePath: string, content: string): Promise<void> {
		await fs.writeFile(filePath, content, 'utf-8')
	}

	protected getClassName(): string {
		const singularName = pluralize.singular(this.options.name)
		return singularName.charAt(0).toUpperCase() + singularName.slice(1)
	}

	protected getFileName(): string {
		return pluralize(this.options.name).toLowerCase()
	}

	protected getModuleName(): string {
		const pluralName = pluralize(this.options.name)
		return pluralName.charAt(0).toUpperCase() + pluralName.slice(1) + 'Module'
	}

	protected getServiceName(): string {
		return this.getClassName() + 'Service'
	}

	protected getControllerName(): string {
		return this.getClassName() + 'Controller'
	}

	protected getViewName(): string {
		return this.getClassName() + 'View'
	}

	protected getPluralClassName(): string {
		const pluralName = pluralize(this.options.name)
		return pluralName.charAt(0).toUpperCase() + pluralName.slice(1)
	}

	protected getPluralFileName(): string {
		return pluralize(this.options.name).toLowerCase()
	}

	protected getPluralVariableName(): string {
		return pluralize(this.options.name).toLowerCase()
	}

	protected getSingularClassName(): string {
		const singularName = pluralize.singular(this.options.name)
		return singularName.charAt(0).toUpperCase() + singularName.slice(1)
	}

	protected getSingularFileName(): string {
		return pluralize.singular(this.options.name).toLowerCase()
	}

	protected getSingularVariableName(): string {
		return pluralize.singular(this.options.name).toLowerCase()
	}
}
