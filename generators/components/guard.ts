import path from 'path'
import { BaseGenerator, GenerateOptions, GenerateResult } from '../base'

export async function generateGuard(options: GenerateOptions): Promise<GenerateResult> {
	const generator = new GuardGenerator(options)
	return await generator.generate()
}

class GuardGenerator extends BaseGenerator {
	protected getBasePath(): string {
		return 'components'
	}

	async generate(): Promise<GenerateResult> {
		const targetPath = this.getTargetPath()
		const files: string[] = []
		const imports: string[] = []

		await this.ensureDirectory(targetPath)

		const guardFileName = `${this.getFileName()}.guard.ts`
		const guardFilePath = path.join(targetPath, guardFileName)
		const guardContent = this.generateGuardContent()

		await this.writeFile(guardFilePath, guardContent)
		files.push(guardFilePath)

		if (!this.options.skipImport) {
			const importPath = this.options.flat
				? `./${this.getFileName()}.guard`
				: `./components/${this.getPluralFileName()}/${this.getFileName()}.guard`

			imports.push(`import ${this.getGuardName()} from '${importPath}';`)
		}

		return { files, imports }
	}

	private generateGuardContent(): string {
		const className = this.getGuardName()

		return `import type { IGuard } from 'honestjs'
import type { Context } from 'hono'

export class ${className} implements IGuard {
	async canActivate(c: Context): Promise<boolean> {
		const authHeader = c.req.header('Authorization')
		
		return !!authHeader
	}
}

export default ${className}
`
	}

	private getGuardName(): string {
		return this.getClassName() + 'Guard'
	}
}
