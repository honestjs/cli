import path from 'path'
import { BaseGenerator, GenerateOptions, GenerateResult } from '../base'

export async function generateView(options: GenerateOptions): Promise<GenerateResult> {
	const generator = new ViewGenerator(options)
	return await generator.generate()
}

class ViewGenerator extends BaseGenerator {
	async generate(): Promise<GenerateResult> {
		const targetPath = this.getTargetPath()
		const files: string[] = []
		const imports: string[] = []

		await this.ensureDirectory(targetPath)

		const viewFileName = `${this.getFileName()}.view.tsx`
		const viewFilePath = path.join(targetPath, viewFileName)
		const viewContent = this.generateViewContent()

		await this.writeFile(viewFilePath, viewContent)
		files.push(viewFilePath)

		if (!this.options.skipImport) {
			const importPath = this.options.flat
				? `./views/${this.getFileName()}.view`
				: `./modules/${this.getPluralFileName()}/views/${this.getFileName()}.view`

			imports.push(`import ${this.getViewName()} from '${importPath}';`)
		}

		return { files, imports }
	}

	private generateViewContent(): string {
		const className = this.getViewName()
		const serviceName = this.getServiceName()

		return `import { Ctx, Page, View } from 'honestjs'
import type { Context } from 'hono'
import type { FC } from 'hono/jsx'
import ${serviceName} from './${this.getFileName()}.service'

interface ${this.getClassName()} {
	id: number
	name: string
	email: string
	role: 'user' | 'admin'
}

interface ${this.getClassName()}ListProps {
	${this.getPluralVariableName()}: ${this.getClassName()}[]
}

const ${this.getClassName()}List: FC<${this.getClassName()}ListProps> = ({ ${this.getPluralVariableName()} }) => {
	return (
		<div>
			<h2>${this.getPluralClassName()}</h2>
			<ul>
				{${this.getPluralVariableName()}.map((${this.getSingularVariableName()}) => (
					<li key={${this.getSingularVariableName()}.id}>
						{${this.getSingularVariableName()}.name} - {${this.getSingularVariableName()}.email}
					</li>
				))}
			</ul>
		</div>
	)
}

@View('/${this.getPluralFileName()}')
class ${className} {
	stylesheets: string[] = ['/static/css/views/${this.getFileName()}.css']
	scripts: string[] = ['/static/js/views/${this.getFileName()}.js']

	constructor(private readonly ${this.getSingularVariableName()}Service: ${serviceName}) {}

	@Page()
	async index(@Ctx() ctx: Context) {
		const ${this.getPluralVariableName()} = await this.${this.getSingularVariableName()}Service.findAll()
		return ctx.render(<${this.getClassName()}List ${this.getPluralVariableName()}={${this.getPluralVariableName()}} />, {
			title: '[ ${this.getPluralClassName().toUpperCase()} ]',
			description: 'List of ${this.getPluralVariableName()}',
			stylesheets: this.stylesheets,
			scripts: this.scripts
		})
	}
}

export default ${className}
`
	}
}
