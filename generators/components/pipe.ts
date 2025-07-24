import path from 'path'
import { BaseGenerator, GenerateOptions, GenerateResult } from '../base'

export async function generatePipe(options: GenerateOptions): Promise<GenerateResult> {
	const generator = new PipeGenerator(options)
	return await generator.generate()
}

class PipeGenerator extends BaseGenerator {
	protected getBasePath(): string {
		return 'components'
	}

	async generate(): Promise<GenerateResult> {
		const targetPath = this.getTargetPath()
		const files: string[] = []
		const imports: string[] = []

		await this.ensureDirectory(targetPath)

		const pipeFileName = `${this.getFileName()}.pipe.ts`
		const pipeFilePath = path.join(targetPath, pipeFileName)
		const pipeContent = this.generatePipeContent()

		await this.writeFile(pipeFilePath, pipeContent)
		files.push(pipeFilePath)

		if (!this.options.skipImport) {
			const importPath = this.options.flat
				? `./${this.getFileName()}.pipe`
				: `./components/${this.getPluralFileName()}/${this.getFileName()}.pipe`

			imports.push(`import ${this.getPipeName()} from '${importPath}';`)
		}

		return { files, imports }
	}

	private generatePipeContent(): string {
		const className = this.getPipeName()

		return `import { IPipe, ArgumentMetadata } from 'honestjs'
import { BadRequestException } from 'http-essentials'

export class ${className} implements IPipe<string> {
	transform(value: string, metadata: ArgumentMetadata): number {
		const val = parseInt(value, 10)
		
		if (isNaN(val)) {
			throw new BadRequestException('Validation failed: not a number')
		}
		
		return val
	}
}

export default ${className}
`
	}

	private getPipeName(): string {
		return this.getClassName() + 'Pipe'
	}
}
