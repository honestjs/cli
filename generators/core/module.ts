import path from 'path'
import { BaseGenerator, GenerateOptions, GenerateResult } from '../base'

export async function generateModule(options: GenerateOptions): Promise<GenerateResult> {
	const generator = new ModuleGenerator(options)
	return await generator.generate()
}

class ModuleGenerator extends BaseGenerator {
	async generate(): Promise<GenerateResult> {
		const targetPath = this.getTargetPath()
		const files: string[] = []
		const imports: string[] = []

		await this.ensureDirectory(targetPath)

		const moduleFileName = `${this.getFileName()}.module.ts`
		const moduleFilePath = path.join(targetPath, moduleFileName)
		const moduleContent = this.generateModuleContent()

		await this.writeFile(moduleFilePath, moduleContent)
		files.push(moduleFilePath)

		if (!this.options.skipImport) {
			const importPath = this.options.flat
				? `./${this.getFileName()}.module`
				: `./modules/${this.getPluralFileName()}/${this.getFileName()}.module`

			imports.push(`import ${this.getModuleName()} from '${importPath}';`)
		}

		return { files, imports }
	}

	private generateModuleContent(): string {
		const className = this.getModuleName()
		const controllerName = this.getControllerName()
		const serviceName = this.getServiceName()
		const viewName = this.getViewName()

		return `import { MvcModule } from 'honestjs'
import ${controllerName} from './${this.getFileName()}.controller'
import ${serviceName} from './${this.getFileName()}.service'
import ${viewName} from './${this.getFileName()}.view'

@MvcModule({
	views: [${viewName}],
	controllers: [${controllerName}],
	services: [${serviceName}]
})
class ${className} {}

export default ${className}
`
	}
}
