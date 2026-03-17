import { describe, expect, it } from 'vitest'
import { getTemplateCache } from './cache'

describe('getTemplateCache', () => {
	it('returns a string path when cache exists or download succeeds', async () => {
		// With offline=false (default), downloads if needed; with offline=true, returns cache if it exists
		const result = await getTemplateCache()
		expect(typeof result).toBe('string')
		expect(result.length).toBeGreaterThan(0)
	})
})
