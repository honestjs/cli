import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import {
	copyTemplate,
	getLocalTemplatesRoot,
	getTemplates,
	getTemplatePrompts,
	isLocalTemplatePath,
	resolveLocalTemplatePath
} from './template'
import { composeTemplatePackageJson, loadSharedPackageBase } from './transforms'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATES_ROOT = path.resolve(__dirname, '..', '..', 'templates')

describe('isLocalTemplatePath', () => {
	it('returns true for relative paths', () => {
		expect(isLocalTemplatePath('./foo')).toBe(true)
		expect(isLocalTemplatePath('../foo')).toBe(true)
		expect(isLocalTemplatePath('./templates/barebone')).toBe(true)
	})

	it('returns true for home paths', () => {
		expect(isLocalTemplatePath('~/foo')).toBe(true)
		expect(isLocalTemplatePath('~\\foo')).toBe(true)
	})

	it('returns true for absolute paths', () => {
		expect(isLocalTemplatePath('/foo/bar')).toBe(true)
		if (process.platform === 'win32') {
			expect(isLocalTemplatePath('C:\\foo')).toBe(true)
		}
	})

	it('returns false for template names', () => {
		expect(isLocalTemplatePath('barebone')).toBe(false)
		expect(isLocalTemplatePath('barebone')).toBe(false)
		expect(isLocalTemplatePath('mvc')).toBe(false)
	})

	it('returns false for empty or invalid input', () => {
		expect(isLocalTemplatePath('')).toBe(false)
		expect(isLocalTemplatePath('   ')).toBe(false)
	})
})

describe('resolveLocalTemplatePath', () => {
	const originalCwd = process.cwd()

	beforeEach(() => {
		process.chdir(path.join(__dirname, '..'))
	})

	afterEach(() => {
		process.chdir(originalCwd)
	})

	it('resolves relative paths to absolute', () => {
		const result = resolveLocalTemplatePath('./foo')
		expect(path.isAbsolute(result)).toBe(true)
		expect(result).toContain('foo')
	})

	it('expands ~ to home directory', () => {
		const result = resolveLocalTemplatePath('~/test-path')
		expect(path.isAbsolute(result)).toBe(true)
		expect(result).toContain('test-path')
	})
})

describe('getLocalTemplatesRoot', () => {
	it('returns repo mode for directory with templates.json', () => {
		if (!fs.existsSync(TEMPLATES_ROOT)) {
			return
		}
		const result = getLocalTemplatesRoot(TEMPLATES_ROOT)
		expect(result).not.toBeNull()
		expect(result!.mode).toBe('repo')
		expect(result!.root).toBe(TEMPLATES_ROOT)
	})

	it('returns single mode for directory with template.json and files/', () => {
		const barebonePath = path.join(TEMPLATES_ROOT, 'templates', 'barebone')
		if (!fs.existsSync(barebonePath)) {
			return
		}
		const result = getLocalTemplatesRoot(barebonePath)
		expect(result).not.toBeNull()
		expect(result!.mode).toBe('single')
		if (result && result.mode === 'single') {
			expect(result.templateName).toBe('barebone')
		}
		expect(result!.root).toBe(barebonePath)
	})

	it('returns null for non-existent path', () => {
		const result = getLocalTemplatesRoot('/non/existent/path-12345')
		expect(result).toBeNull()
	})

	it('returns null for file instead of directory', async () => {
		const tmpFile = path.join(await fs.mkdtemp(path.join(process.cwd(), 'tmp-')), 'file.txt')
		await fs.writeFile(tmpFile, '')
		const result = getLocalTemplatesRoot(tmpFile)
		expect(result).toBeNull()
		await fs.remove(path.dirname(tmpFile))
	})
})

describe('getTemplates', () => {
	it('loads templates from local repo path', async () => {
		if (!fs.existsSync(TEMPLATES_ROOT)) {
			return
		}
		const templates = await getTemplates({ localPath: TEMPLATES_ROOT })
		expect(templates.length).toBeGreaterThan(0)
		expect(templates.some((t) => t.name === 'barebone')).toBe(true)
		expect(templates.some((t) => t.name === 'blank')).toBe(true)
		expect(templates.some((t) => t.name === 'mvc')).toBe(true)
	})

	it('loads single template from local path', async () => {
		const barebonePath = path.join(TEMPLATES_ROOT, 'templates', 'barebone')
		if (!fs.existsSync(barebonePath)) {
			return
		}
		const templates = await getTemplates({ localPath: barebonePath })
		expect(templates).toHaveLength(1)
		expect(templates[0].name).toBe('barebone')
		expect(templates[0].path).toBe('.')
		expect(templates[0].category).toBe('local')
	})

	it('throws for invalid local path', async () => {
		await expect(getTemplates({ localPath: '/invalid/path-xyz-123' })).rejects.toThrow(
			'Invalid local template path'
		)
	})
})

describe('getTemplatePrompts', () => {
	it('returns prompts for template with prompts.js', async () => {
		if (!fs.existsSync(TEMPLATES_ROOT)) {
			return
		}
		const prompts = await getTemplatePrompts('barebone', { localPath: TEMPLATES_ROOT })
		expect(prompts).not.toBeNull()
		expect(Array.isArray(prompts)).toBe(true)
		expect(prompts!.length).toBeGreaterThan(0)
	})

	it('returns null for non-existent template', async () => {
		if (!fs.existsSync(TEMPLATES_ROOT)) {
			return
		}
		const prompts = await getTemplatePrompts('nonexistent', { localPath: TEMPLATES_ROOT })
		expect(prompts).toBeNull()
	})
})

describe('copyTemplate', () => {
	const originalCwd = process.cwd()
	let tmpDir: string

	beforeEach(async () => {
		tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'honestjs-test-'))
		process.chdir(tmpDir)
	})

	afterEach(async () => {
		process.chdir(originalCwd)
		await fs.remove(tmpDir).catch(() => {})
	})

	it('scaffolds project from local single template', async () => {
		const barebonePath = path.join(TEMPLATES_ROOT, 'templates', 'barebone')
		if (!fs.existsSync(barebonePath)) {
			return
		}
		await copyTemplate(
			'barebone',
			'my-project',
			{
				git: false,
				install: false
			},
			{
				localPath: barebonePath,
				templatesRoot: barebonePath
			}
		)
		const projectPath = path.join(tmpDir, 'my-project')
		expect(fs.existsSync(projectPath)).toBe(true)
		expect(fs.existsSync(path.join(projectPath, 'package.json'))).toBe(true)
		expect(fs.existsSync(path.join(projectPath, 'src', 'main.ts'))).toBe(true)
	})

	it('scaffolds project from local repo', async () => {
		if (!fs.existsSync(TEMPLATES_ROOT)) {
			return
		}
		await copyTemplate(
			'blank',
			'blank-project',
			{
				git: false,
				install: false
			},
			{
				localPath: TEMPLATES_ROOT,
				templatesRoot: TEMPLATES_ROOT
			}
		)
		const projectPath = path.join(tmpDir, 'blank-project')
		expect(fs.existsSync(projectPath)).toBe(true)
		expect(fs.existsSync(path.join(projectPath, 'package.json'))).toBe(true)
	})

	it('scaffold output does not include node_modules', async () => {
		if (!fs.existsSync(TEMPLATES_ROOT)) {
			return
		}
		await copyTemplate(
			'blank',
			'no-deps-project',
			{ git: false, install: false },
			{ localPath: TEMPLATES_ROOT, templatesRoot: TEMPLATES_ROOT }
		)
		const projectPath = path.join(tmpDir, 'no-deps-project')
		expect(fs.existsSync(projectPath)).toBe(true)
		expect(fs.existsSync(path.join(projectPath, 'node_modules'))).toBe(false)
	})

	it('rewrites only bun run / bunx when scaffolding with npm', async () => {
		if (!fs.existsSync(TEMPLATES_ROOT)) {
			return
		}
		await copyTemplate(
			'blank',
			'npm-scripts-project',
			{
				git: false,
				install: false,
				packageManager: 'npm'
			},
			{ localPath: TEMPLATES_ROOT, templatesRoot: TEMPLATES_ROOT }
		)
		const projectPath = path.join(tmpDir, 'npm-scripts-project')
		const pkg = await fs.readJson(path.join(projectPath, 'package.json'))
		const scripts = pkg.scripts || {}
		expect(scripts.start).toBe('bun dist/main.js')
		expect(scripts.dev).toMatch(/npm run/)
	})

	it('throws for non-existent template', async () => {
		if (!fs.existsSync(TEMPLATES_ROOT)) {
			return
		}
		await expect(copyTemplate('nonexistent', 'my-project', {}, { localPath: TEMPLATES_ROOT })).rejects.toThrow(
			"Template 'nonexistent' not found"
		)
	})
})

describe('loadSharedPackageBase', () => {
	it('returns null when shared package files are missing', async () => {
		const result = await loadSharedPackageBase('/nonexistent-root-12345')
		expect(result).toBeNull()
	})

	it('returns scripts and devDependencies when shared package exists', async () => {
		if (!fs.existsSync(TEMPLATES_ROOT)) {
			return
		}
		const result = await loadSharedPackageBase(TEMPLATES_ROOT)
		expect(result).not.toBeNull()
		expect(result!.scripts).toBeDefined()
		expect(result!.scripts.dev).toContain('{{pm}}')
		expect(result!.devDependencies).toBeDefined()
		expect(result!.devDependencies.typescript).toBeDefined()
	})
})

describe('composeTemplatePackageJson', () => {
	let tmpDir: string
	const originalCwd = process.cwd()

	beforeEach(async () => {
		tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'honestjs-compose-test-'))
		process.chdir(tmpDir)
	})

	afterEach(async () => {
		process.chdir(originalCwd)
		await fs.remove(tmpDir).catch(() => {})
	})

	it('no-ops when project has no package.json', async () => {
		await composeTemplatePackageJson(tmpDir, TEMPLATES_ROOT)
		expect(fs.existsSync(path.join(tmpDir, 'package.json'))).toBe(false)
	})

	it('no-ops when shared base is missing', async () => {
		await fs.writeJson(path.join(tmpDir, 'package.json'), { name: 'test', scripts: { dev: 'custom' } })
		await composeTemplatePackageJson(tmpDir, '/no-shared-root-xyz')
		const pkg = await fs.readJson(path.join(tmpDir, 'package.json'))
		expect(pkg.scripts.dev).toBe('custom')
	})

	it('merges shared scripts and devDependencies when shared base exists', async () => {
		if (!fs.existsSync(TEMPLATES_ROOT)) {
			return
		}
		await fs.writeJson(path.join(tmpDir, 'package.json'), {
			name: 'my-app',
			dependencies: {}
		})
		await composeTemplatePackageJson(tmpDir, TEMPLATES_ROOT)
		const pkg = await fs.readJson(path.join(tmpDir, 'package.json'))
		expect(pkg.name).toBe('my-app')
		expect(pkg.scripts).toBeDefined()
		expect(pkg.scripts.dev).toBeDefined()
		expect(pkg.scripts.tunnel).toBeDefined()
		expect(pkg.devDependencies).toBeDefined()
		expect(pkg.devDependencies.typescript).toBeDefined()
	})

	it('template scripts override shared', async () => {
		if (!fs.existsSync(TEMPLATES_ROOT)) {
			return
		}
		await fs.writeJson(path.join(tmpDir, 'package.json'), {
			name: 'my-app',
			scripts: { dev: 'custom-dev' },
			dependencies: {}
		})
		await composeTemplatePackageJson(tmpDir, TEMPLATES_ROOT)
		const pkg = await fs.readJson(path.join(tmpDir, 'package.json'))
		expect(pkg.scripts.dev).toBe('custom-dev')
		expect(pkg.scripts.tunnel).toBeDefined()
	})
})
