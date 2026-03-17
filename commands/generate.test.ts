import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
	mockGenerateController,
	mockGenerateService,
	mockGenerateModule,
	mockGenerateView,
	mockGenerateMiddleware,
	mockGenerateGuard,
	mockGenerateFilter,
	mockGeneratePipe,
	mockPathExists,
	mockConsola
} = vi.hoisted(() => ({
	mockGenerateController: vi.fn(),
	mockGenerateService: vi.fn(),
	mockGenerateModule: vi.fn(),
	mockGenerateView: vi.fn(),
	mockGenerateMiddleware: vi.fn(),
	mockGenerateGuard: vi.fn(),
	mockGenerateFilter: vi.fn(),
	mockGeneratePipe: vi.fn(),
	mockPathExists: vi.fn(),
	mockConsola: {
		start: vi.fn(),
		success: vi.fn(),
		info: vi.fn(),
		log: vi.fn(),
		warn: vi.fn(),
		error: vi.fn()
	}
}))

vi.mock('fs-extra', () => ({
	default: {
		pathExists: mockPathExists
	}
}))

vi.mock('../generators/core/controller', () => ({
	generateController: mockGenerateController
}))

vi.mock('../generators/core/service', () => ({
	generateService: mockGenerateService
}))

vi.mock('../generators/core/module', () => ({
	generateModule: mockGenerateModule
}))

vi.mock('../generators/core/view', () => ({
	generateView: mockGenerateView
}))

vi.mock('../generators/components/middleware', () => ({
	generateMiddleware: mockGenerateMiddleware
}))

vi.mock('../generators/components/guard', () => ({
	generateGuard: mockGenerateGuard
}))

vi.mock('../generators/components/filter', () => ({
	generateFilter: mockGenerateFilter
}))

vi.mock('../generators/components/pipe', () => ({
	generatePipe: mockGeneratePipe
}))

vi.mock('consola', () => ({
	consola: mockConsola
}))

import { generateCommand } from './generate'

describe('generateCommand', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockPathExists.mockResolvedValue(false)
	})

	it('dispatches to service generator with mapped options', async () => {
		mockPathExists.mockResolvedValueOnce(true)
		mockGenerateService.mockResolvedValueOnce({
			files: ['src/modules/users/users.service.ts'],
			imports: []
		})
		await generateCommand.parseAsync(
			[
				'service',
				'users',
				'--path',
				'src/modules',
				'--flat',
				'--skip-import',
				'--export',
				'--force',
				'--dry-run'
			],
			{ from: 'user' }
		)

		expect(mockGenerateService).toHaveBeenCalledWith({
			name: 'users',
			path: 'src/modules',
			flat: true,
			skipImport: true,
			export: true,
			force: true,
			dryRun: true
		})
		expect(mockConsola.success).toHaveBeenCalledWith('Dry run complete.')
		expect(mockConsola.log).toHaveBeenCalledWith(
			'  ✓ src/modules/users/users.service.ts (exists, use --force to overwrite)'
		)
	})

	it('supports schematic aliases', async () => {
		mockGenerateController.mockResolvedValueOnce({
			files: ['src/modules/users/users.controller.ts'],
			imports: []
		})
		await generateCommand.parseAsync(['c', 'users'], { from: 'user' })

		expect(mockGenerateController).toHaveBeenCalledWith({
			name: 'users',
			path: undefined,
			flat: undefined,
			skipImport: undefined,
			export: undefined,
			force: undefined,
			dryRun: undefined
		})
	})

	it('exits with code 1 for unknown schematic', async () => {
		const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
			throw new Error(`exit:${code ?? 0}`)
		})

		await expect(generateCommand.parseAsync(['unknown', 'users'], { from: 'user' })).rejects.toThrow('exit:1')
		expect(mockConsola.error).toHaveBeenCalledWith('Unknown schematic: unknown')

		exitSpy.mockRestore()
	})
})
