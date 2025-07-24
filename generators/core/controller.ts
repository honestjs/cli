import path from 'path'
import { BaseGenerator, GenerateOptions, GenerateResult } from '../base'

export async function generateController(options: GenerateOptions): Promise<GenerateResult> {
	const generator = new ControllerGenerator(options)
	return await generator.generate()
}

class ControllerGenerator extends BaseGenerator {
	async generate(): Promise<GenerateResult> {
		const targetPath = this.getTargetPath()
		const files: string[] = []
		const imports: string[] = []

		await this.ensureDirectory(targetPath)

		const controllerFileName = `${this.getFileName()}.controller.ts`
		const controllerFilePath = path.join(targetPath, controllerFileName)
		const controllerContent = this.generateControllerContent()

		await this.writeFile(controllerFilePath, controllerContent)
		files.push(controllerFilePath)

		if (!this.options.skipImport) {
			const importPath = this.options.flat
				? `./${this.getFileName()}.controller`
				: `./modules/${this.getPluralFileName()}/${this.getFileName()}.controller`

			imports.push(`import ${this.getControllerName()} from '${importPath}';`)
		}

		return { files, imports }
	}

	private generateControllerContent(): string {
		const className = this.getControllerName()
		const serviceName = this.getServiceName()

		return `import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from 'honestjs'
import { NotFoundException } from 'http-essentials'
import ${serviceName} from './${this.getFileName()}.service'

interface Create${this.getClassName()}Dto {
	name: string
	email: string
}

interface ${this.getClassName()} {
	id: number
	name: string
	email: string
	role: 'user' | 'admin'
}

@Controller('/${this.getPluralFileName()}')
class ${className} {
	constructor(private readonly ${this.getSingularVariableName()}Service: ${serviceName}) {}

	@Post()
	async create${this.getClassName()}(@Body() body: Create${this.getClassName()}Dto): Promise<${this.getClassName()}> {
		return await this.${this.getSingularVariableName()}Service.create(body)
	}

	@Get()
	async get${this.getPluralClassName()}(): Promise<${this.getClassName()}[]> {
		return await this.${this.getSingularVariableName()}Service.findAll()
	}

	@Get('/:id')
	async get${this.getClassName()}(@Param('id') id: number): Promise<${this.getClassName()}> {
		const ${this.getSingularVariableName()} = await this.${this.getSingularVariableName()}Service.findById(Number(id))
		if (!${this.getSingularVariableName()}) {
			throw new NotFoundException('${this.getClassName()} not found')
		}
		return ${this.getSingularVariableName()}
	}

	@Put('/:id')
	async update${this.getClassName()}(@Param('id') id: number, @Body() body: Partial<Create${this.getClassName()}Dto>): Promise<${this.getClassName()}> {
		const updated${this.getClassName()} = await this.${this.getSingularVariableName()}Service.update(Number(id), body)
		if (!updated${this.getClassName()}) {
			throw new NotFoundException('${this.getClassName()} not found')
		}
		return updated${this.getClassName()}
	}

	@Patch('/:id')
	async patch${this.getClassName()}(@Param('id') id: number, @Body() body: Partial<Create${this.getClassName()}Dto>): Promise<${this.getClassName()}> {
		const updated${this.getClassName()} = await this.${this.getSingularVariableName()}Service.update(Number(id), body)
		if (!updated${this.getClassName()}) {
			throw new NotFoundException('${this.getClassName()} not found')
		}
		return updated${this.getClassName()}
	}

	@Delete('/:id')
	async delete${this.getClassName()}(@Param('id') id: number): Promise<boolean> {
		const deleted = await this.${this.getSingularVariableName()}Service.delete(Number(id))
		if (!deleted) {
			throw new NotFoundException('${this.getClassName()} not found')
		}
		return deleted
	}
}

export default ${className}
`
	}
}
