import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		glob: ['**/*.test.ts'],
		environment: 'node'
	}
})
