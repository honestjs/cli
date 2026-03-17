/**
 * Template cache: downloads honestjs/templates to a stable temp dir and reuses it.
 * Set HONESTJS_TEMPLATES_FORCE=1 to force a fresh download.
 * When localPath is provided, returns the resolved local path (no download).
 */

import { downloadTemplate } from '@bluwy/giget-core'
import fs from 'fs-extra'
import os from 'os'
import path from 'path'

let cacheDir: string | null = null

const CACHE_DIR_NAME = 'honestjs-templates'

function resolveLocalPath(rawPath: string): string {
	const expanded = rawPath.startsWith('~') ? path.join(os.homedir(), rawPath.slice(1)) : rawPath
	return path.resolve(process.cwd(), expanded)
}

/**
 * Returns the template cache directory, downloading templates if needed.
 * Reuses cache unless force=true. When offline=true, uses existing cache only (force overrides offline).
 * When localPath is provided, returns the resolved local path immediately (no download).
 * Note: Template utilities typically use getTemplatesRoot(options) so that templatesRoot or localPath
 * in options are handled in one place; the cache is then only used for remote download. Use this
 * function directly when you need a single "root" from cache or local path.
 */
export async function getTemplateCache(force?: boolean, offline?: boolean, localPath?: string): Promise<string> {
	if (localPath) {
		return resolveLocalPath(localPath)
	}
	const forceRefresh = force ?? process.env.HONESTJS_TEMPLATES_FORCE === '1'
	const stableCacheDir = path.join(os.tmpdir(), CACHE_DIR_NAME)

	if (!forceRefresh && cacheDir && fs.existsSync(cacheDir)) {
		return cacheDir
	}

	// Reuse existing cache when not forcing refresh
	if (!forceRefresh && fs.existsSync(stableCacheDir)) {
		const registryPath = path.join(stableCacheDir, 'templates.json')
		if (fs.existsSync(registryPath)) {
			cacheDir = stableCacheDir
			return cacheDir
		}
	}

	// Offline mode: use cache only, no download (force overrides offline)
	if (offline && !forceRefresh) {
		throw new Error('Templates not found. Run without --offline first to download templates (e.g. honestjs list).')
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
