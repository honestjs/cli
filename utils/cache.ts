/**
 * Template cache: downloads honestjs/templates to a stable temp dir and reuses it.
 * Set HONESTJS_TEMPLATES_FORCE=1 to force a fresh download.
 */

import { downloadTemplate } from '@bluwy/giget-core'
import fs from 'fs-extra'
import os from 'os'
import path from 'path'

let cacheDir: string | null = null

const CACHE_DIR_NAME = 'honestjs-templates'

/** Returns the template cache directory, downloading templates if needed. Reuses cache unless force=true. */
export async function getTemplateCache(force?: boolean): Promise<string> {
	const forceRefresh = force ?? process.env.HONESTJS_TEMPLATES_FORCE === '1'
	const stableCacheDir = path.join(os.tmpdir(), CACHE_DIR_NAME)

	if (!forceRefresh && cacheDir && fs.existsSync(cacheDir)) {
		return cacheDir
	}

	// Reuse existing cache when not forcing refresh
	if (!forceRefresh && fs.existsSync(stableCacheDir)) {
		cacheDir = stableCacheDir
		return cacheDir
	}

	try {
		const { dir } = await downloadTemplate('honestjs/templates', {
			dir: stableCacheDir,
			force: forceRefresh
		})
		cacheDir = dir
		return cacheDir
	} catch (error) {
		throw new Error(`Failed to download templates: ${error instanceof Error ? error.message : 'Unknown error'}`, {
			cause: error
		})
	}
}

/** Removes the template cache directory. Useful for freeing disk space or forcing a fresh download. */
export async function cleanupCache(): Promise<void> {
	if (cacheDir && fs.existsSync(cacheDir)) {
		await fs.remove(cacheDir)
		cacheDir = null
	}
}
