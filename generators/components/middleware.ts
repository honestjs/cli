import path from 'path'
import { BaseGenerator, GenerateOptions, GenerateResult } from '../base'

export async function generateMiddleware(options: GenerateOptions): Promise<GenerateResult> {
	const generator = new MiddlewareGenerator(options)
	return await generator.generate()
}

class MiddlewareGenerator extends BaseGenerator {
	protected getBasePath(): string {
		return 'components'
	}

	async generate(): Promise<GenerateResult> {
		const targetPath = this.getTargetPath()
		const files: string[] = []
		const imports: string[] = []

		await this.ensureDirectory(targetPath)

		const middlewareFileName = `${this.getFileName()}.middleware.ts`
		const middlewareFilePath = path.join(targetPath, middlewareFileName)
		const middlewareContent = this.generateMiddlewareContent()

		await this.writeFile(middlewareFilePath, middlewareContent)
		files.push(middlewareFilePath)

		if (!this.options.skipImport) {
			const importPath = this.options.flat
				? `./${this.getFileName()}.middleware`
				: `./components/${this.getPluralFileName()}/${this.getFileName()}.middleware`

			imports.push(`import ${this.getMiddlewareName()} from '${importPath}';`)
		}

		return { files, imports }
	}

	private generateMiddlewareContent(): string {
		const className = this.getMiddlewareName()

		return `import type { IMiddleware } from 'honestjs'
import type { Context, Next } from 'hono'

export class ${className} implements IMiddleware {
	async use(c: Context, next: Next) {
		console.log(\`[\${c.req.method}] \${c.req.url} - Request received\`)
		
		await next()
		
		console.log(\`Response status: \${c.res.status}\`)
	}
}

export default ${className}
`
	}

	private getMiddlewareName(): string {
		return this.getClassName() + 'Middleware'
	}
}
