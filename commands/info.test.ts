import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetTemplates, mockConsola, mockFs } = vi.hoisted(() => ({
	mockGetTemplates: vi.fn(),
	mockConsola: {
		start: vi.fn(),
		success: vi.fn(),
		info: vi.fn(),
		log: vi.fn(),
		warn: vi.fn(),
		error: vi.fn()
	},
	mockFs: {
		existsSync: vi.fn(),
		readFileSync: vi.fn(),
		readJson: vi.fn()
	}
}))

vi.mock('../utils', () => ({
	getTemplates: mockGetTemplates
}))

vi.mock('consola', () => ({
	consola: mockConsola
}))

vi.mock('fs-extra', () => ({
	default: mockFs
}))

import { infoCommand } from './info'

describe('infoCommand', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockGetTemplates.mockResolvedValue([
			{ name: 'barebone', description: 'Minimal app', path: 'templates/barebone' }
		])
		mockFs.existsSync.mockReturnValue(true)
		mockFs.readFileSync.mockReturnValue(JSON.stringify({ name: '@honestjs/cli' }))
		mockFs.readJson.mockResolvedValue({ version: '0.1.12' })
	})

	it('loads templates from remote source by default', async () => {
		await infoCommand.parseAsync([], { from: 'user' })

		expect(mockGetTemplates).toHaveBeenCalledWith(undefined)
		expect(mockConsola.log).toHaveBeenCalledWith('CLI Version: 0.1.12')
		expect(mockConsola.log).toHaveBeenCalledWith('Templates Source: honestjs/templates')
	})

	it('loads templates from local source when --local is passed', async () => {
		await infoCommand.parseAsync(['--local', './templates'], { from: 'user' })

		expect(mockGetTemplates).toHaveBeenCalledWith({ localPath: './templates' })
		expect(mockConsola.start).toHaveBeenCalledWith('Loading local templates...')
		expect(mockConsola.log).toHaveBeenCalledWith('Templates Source: local (./templates)')
	})
})
