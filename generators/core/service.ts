import path from 'path'
import { BaseGenerator, GenerateOptions, GenerateResult } from '../base'

export async function generateService(options: GenerateOptions): Promise<GenerateResult> {
	const generator = new ServiceGenerator(options)
	return await generator.generate()
}

class ServiceGenerator extends BaseGenerator {
	async generate(): Promise<GenerateResult> {
		const targetPath = this.getTargetPath()
		const files: string[] = []
		const imports: string[] = []

		await this.ensureDirectory(targetPath)

		const serviceFileName = `${this.getFileName()}.service.ts`
		const serviceFilePath = path.join(targetPath, serviceFileName)
		const serviceContent = this.generateServiceContent()

		await this.writeFile(serviceFilePath, serviceContent)
		files.push(serviceFilePath)

		if (!this.options.skipImport) {
			const importPath = this.options.flat
				? `./${this.getFileName()}.service`
				: `./modules/${this.getPluralFileName()}/${this.getFileName()}.service`

			imports.push(`import ${this.getServiceName()} from '${importPath}';`)
		}

		return { files, imports }
	}

	private generateServiceContent(): string {
		const className = this.getServiceName()

		return `import { Service } from 'honestjs'

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

@Service()
class ${className} {
	private ${this.getPluralVariableName()}: ${this.getClassName()}[] = [
		{ id: 1, name: 'John', email: 'john@mail.com', role: 'admin' },
		{ id: 2, name: 'Jane', email: 'jane@mail.com', role: 'admin' }
	]

	async create(${this.getSingularVariableName()}: Create${this.getClassName()}Dto): Promise<${this.getClassName()}> {
		const id = this.${this.getPluralVariableName()}.length + 1
		this.${this.getPluralVariableName()}.push({
			id,
			name: ${this.getSingularVariableName()}.name,
			email: ${this.getSingularVariableName()}.email,
			role: 'user'
		})
		return this.${this.getPluralVariableName()}[id - 1]
	}

	async findAll(): Promise<${this.getClassName()}[]> {
		return this.${this.getPluralVariableName()}
	}

	async findById(id: number): Promise<${this.getClassName()} | null> {
		return this.${this.getPluralVariableName()}.find((${this.getSingularVariableName()}) => ${this.getSingularVariableName()}.id === id) || null
	}

	async update(id: number, ${this.getSingularVariableName()}Data: Partial<${this.getClassName()}>): Promise<${this.getClassName()} | null> {
		const ${this.getSingularVariableName()}Index = this.${this.getPluralVariableName()}.findIndex((${this.getSingularVariableName()}) => ${this.getSingularVariableName()}.id === id)
		if (${this.getSingularVariableName()}Index === -1) return null

		this.${this.getPluralVariableName()}[${this.getSingularVariableName()}Index] = { ...this.${this.getPluralVariableName()}[${this.getSingularVariableName()}Index], ...${this.getSingularVariableName()}Data }
		return this.${this.getPluralVariableName()}[${this.getSingularVariableName()}Index]
	}

	async delete(id: number): Promise<boolean> {
		const ${this.getSingularVariableName()}Index = this.${this.getPluralVariableName()}.findIndex((${this.getSingularVariableName()}) => ${this.getSingularVariableName()}.id === id)
		if (${this.getSingularVariableName()}Index === -1) return false

		this.${this.getPluralVariableName()}.splice(${this.getSingularVariableName()}Index, 1)
		return true
	}
}
export default ${className}
`
	}
}
