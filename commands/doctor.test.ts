import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockExecSync, mockConsola, mockExistsSync } = vi.hoisted(() => ({
	mockExecSync: vi.fn(),
	mockConsola: {
		start: vi.fn(),
		success: vi.fn(),
		info: vi.fn(),
		log: vi.fn(),
		warn: vi.fn(),
		error: vi.fn()
	},
	mockExistsSync: vi.fn()
}))

vi.mock('child_process', () => ({
	execSync: mockExecSync
}))

vi.mock('consola', () => ({
	consola: mockConsola
}))

vi.mock('fs-extra', () => ({
	default: {
		existsSync: mockExistsSync
	}
}))

import { doctorCommand } from './doctor'

describe('doctorCommand', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockExistsSync.mockReturnValue(false)
		mockExecSync.mockImplementation((command: string, options?: { encoding?: string }) => {
			if (command === 'git --version') {
				return options?.encoding ? 'git version 2.49.0\n' : Buffer.from('ok')
			}
			if (command === 'bun --version') {
				return options?.encoding ? '1.3.10\n' : Buffer.from('ok')
			}
			if (command === 'npm --version') {
				return options?.encoding ? '10.9.2\n' : Buffer.from('ok')
			}
			throw new Error(`missing ${command}`)
		})
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				status: 200
			})
		)
	})

	it('prints diagnostics for tools and network', async () => {
		await doctorCommand.parseAsync([], { from: 'user' })

		expect(mockExecSync).toHaveBeenCalledWith('git --version', { stdio: 'pipe' })
		expect(mockConsola.start).toHaveBeenCalledWith('Checking network...')
		expect(mockConsola.log).toHaveBeenCalledWith(expect.stringContaining('Network:'))
	})

	it('shows cache as cached when registry exists', async () => {
		mockExistsSync.mockReturnValue(true)

		await doctorCommand.parseAsync([], { from: 'user' })

		expect(mockConsola.log).toHaveBeenCalledWith(expect.stringContaining('Templates:'))
	})
})
