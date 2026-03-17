import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetTemplates, mockConsola } = vi.hoisted(() => ({
	mockGetTemplates: vi.fn(),
	mockConsola: {
		start: vi.fn(),
		success: vi.fn(),
		info: vi.fn(),
		log: vi.fn(),
		warn: vi.fn(),
		error: vi.fn()
	}
}))

vi.mock('../utils', () => ({
	getTemplates: mockGetTemplates
}))

vi.mock('consola', () => ({
	consola: mockConsola
}))

import { listCommand } from './list'

describe('listCommand', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('prints JSON output when --json is used', async () => {
		const templates = [
			{
				name: 'barebone',
				description: 'Minimal app',
				category: 'backend',
				path: 'templates/barebone',
				tags: ['api']
			}
		]
		mockGetTemplates.mockResolvedValueOnce(templates)
		await listCommand.parseAsync(['--json'], { from: 'user' })

		expect(mockGetTemplates).toHaveBeenCalledWith({ offline: undefined, force: undefined })
		expect(mockConsola.log).toHaveBeenCalledWith(JSON.stringify(templates, null, 2))
		expect(mockConsola.warn).not.toHaveBeenCalled()
	})

	it('filters by category and tag', async () => {
		mockGetTemplates.mockResolvedValueOnce([
			{
				name: 'blank',
				description: 'Node template',
				category: 'backend',
				path: 'templates/blank',
				tags: ['node']
			},
			{
				name: 'mvc',
				description: 'MVC template',
				category: 'fullstack',
				path: 'templates/mvc',
				tags: ['node', 'ui']
			}
		])
		await listCommand.parseAsync(['--category', 'fullstack', '--tag', 'ui'], { from: 'user' })

		expect(mockConsola.log).toHaveBeenCalledWith('FULLSTACK:')
		expect(mockConsola.log).toHaveBeenCalledWith('  1. mvc')
		expect(mockConsola.log).not.toHaveBeenCalledWith('  1. blank')
	})

	it('warns when no templates match filters', async () => {
		mockGetTemplates.mockResolvedValueOnce([
			{
				name: 'blank',
				description: 'Node template',
				category: 'backend',
				path: 'templates/blank',
				tags: ['node']
			}
		])
		await listCommand.parseAsync(['--category', 'fullstack'], { from: 'user' })

		expect(mockConsola.warn).toHaveBeenCalledWith('No templates found matching your criteria.')
	})
})
