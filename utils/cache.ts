import { downloadTemplate } from '@bluwy/giget-core'
import fs from 'fs-extra'
import os from 'os'
import path from 'path'

let cacheDir: string | null = null

export async function getTemplateCache(): Promise<string> {
	if (cacheDir && fs.existsSync(cacheDir)) {
		return cacheDir
	}

	const tempDir = path.join(os.tmpdir(), `honestjs-templates-${Date.now()}`)

	try {
		const { dir } = await downloadTemplate('honestjs/templates', {
			dir: tempDir,
			force: true
		})
		cacheDir = dir
		return cacheDir
	} catch (error) {
		throw new Error(`Failed to download templates: ${error instanceof Error ? error.message : 'Unknown error'}`)
	}
}

export async function cleanupCache(): Promise<void> {
	if (cacheDir && fs.existsSync(cacheDir)) {
		await fs.remove(cacheDir)
		cacheDir = null
	}
}
