import path from 'path'
import { BaseGenerator, GenerateOptions, GenerateResult } from '../base'

export async function generateFilter(options: GenerateOptions): Promise<GenerateResult> {
	const generator = new FilterGenerator(options)
	return await generator.generate()
}

class FilterGenerator extends BaseGenerator {
	protected getBasePath(): string {
		return 'components'
	}

	async generate(): Promise<GenerateResult> {
		const targetPath = this.getTargetPath()
		const files: string[] = []
		const imports: string[] = []

		await this.ensureDirectory(targetPath)

		const filterFileName = `${this.getFileName()}.filter.ts`
		const filterFilePath = path.join(targetPath, filterFileName)
		const filterContent = this.generateFilterContent()

		await this.writeFile(filterFilePath, filterContent)
		files.push(filterFilePath)

		if (!this.options.skipImport) {
			const importPath = this.options.flat
				? `./${this.getFileName()}.filter`
				: `./components/${this.getPluralFileName()}/${this.getFileName()}.filter`

			imports.push(`import ${this.getFilterName()} from '${importPath}';`)
		}

		return { files, imports }
	}

	private generateFilterContent(): string {
		const className = this.getFilterName()

		return `import { IFilter } from 'honestjs'
import { Context } from 'hono'
import { NotFoundException } from 'http-essentials'

export class ${className} implements IFilter<NotFoundException> {
	catch(exception: NotFoundException, context: Context) {
		if (exception instanceof NotFoundException) {
			context.status(404)
			return context.json({
				statusCode: 404,
				message: 'The requested resource was not found.',
				error: 'Not Found',
				timestamp: new Date().toISOString(),
				path: context.req.path,
			})
		}
		
		throw exception
	}
}

export default ${className}
`
	}

	private getFilterName(): string {
		return this.getClassName() + 'Filter'
	}
}
