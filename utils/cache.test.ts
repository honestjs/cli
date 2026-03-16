import { describe, expect, it } from 'vitest'
import path from 'path'
import { getTemplateCache } from './cache'

describe('getTemplateCache', () => {
	it('returns resolved path when localPath is provided', async () => {
		const result = await getTemplateCache(undefined, undefined, './foo')
		expect(path.isAbsolute(result)).toBe(true)
		expect(result).toContain('foo')
	})

	it('resolves ~ in localPath to home directory', async () => {
		const result = await getTemplateCache(undefined, undefined, '~/test-cache-path')
		expect(path.isAbsolute(result)).toBe(true)
		expect(result).toContain('test-cache-path')
	})

	it('returns same path for same localPath input', async () => {
		const result1 = await getTemplateCache(undefined, undefined, './bar')
		const result2 = await getTemplateCache(undefined, undefined, './bar')
		expect(result1).toBe(result2)
	})
})
