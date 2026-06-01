/**
 * Migrates public/uploads/ from flat layout to format-segregated layout:
 *   /uploads/filename.glb  →  /uploads/glb/filename.glb
 *   /uploads/filename.gltf →  /uploads/gltf/filename.gltf
 *   /uploads/filename.obj  →  /uploads/obj/stem/filename.obj  (+ .mtl if present)
 *
 * Updates data/models.json fileUrl fields to match. Safe to re-run: already-migrated
 * entries are skipped.
 *
 * Usage: node scripts/migrate-uploads.mjs
 */

import { readFile, writeFile, mkdir, rename, access } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA_FILE = path.join(root, 'data/models.json')
const UPLOADS_DIR = path.join(root, 'public/uploads')

async function exists(p) {
    try { await access(p); return true } catch { return false }
}

async function main() {
    const raw = JSON.parse(await readFile(DATA_FILE, 'utf-8'))
    const categories = Array.isArray(raw) ? [] : (raw.categories ?? [])
    const models = Array.isArray(raw) ? raw : (raw.models ?? [])

    let changed = 0

    for (const model of models) {
        const url = model.fileUrl
        if (/^\/uploads\/(glb|gltf|obj)\//.test(url)) {
            console.log(`skip  ${model.name}`)
            continue
        }

        const filename = path.basename(url)
        const ext = path.extname(filename).toLowerCase()
        const src = path.join(root, 'public', url)

        if (!(await exists(src))) {
            console.warn(`warn  ${model.name}: file missing at ${src}`)
            continue
        }

        let dest, newUrl

        if (ext === '.obj') {
            const stem = filename.slice(0, -4) // strip .obj
            const dir = path.join(UPLOADS_DIR, 'obj', stem)
            await mkdir(dir, { recursive: true })
            dest = path.join(dir, filename)
            newUrl = `/uploads/obj/${stem}/${filename}`

            const mtlSrc = src.replace(/\.obj$/i, '.mtl')
            if (await exists(mtlSrc)) {
                const mtlName = stem + '.mtl'
                await rename(mtlSrc, path.join(dir, mtlName))
                console.log(`move  ${path.basename(mtlSrc)} → obj/${stem}/${mtlName}`)
            }
        } else {
            const subdir = ext.slice(1) // 'glb' | 'gltf'
            const dir = path.join(UPLOADS_DIR, subdir)
            await mkdir(dir, { recursive: true })
            dest = path.join(dir, filename)
            newUrl = `/uploads/${subdir}/${filename}`
        }

        await rename(src, dest)
        model.fileUrl = newUrl
        changed++
        console.log(`move  ${filename} → ${newUrl}`)
    }

    if (changed > 0) {
        await writeFile(DATA_FILE, JSON.stringify({ categories, models }, null, 2))
        console.log(`\nMigrated ${changed} model(s). data/models.json updated.`)
    } else {
        console.log('\nAll models already on new layout — nothing to do.')
    }
}

main().catch(err => { console.error(err); process.exit(1) })
