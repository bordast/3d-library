import { readFile, access } from 'fs/promises'
import path from 'path'

const FALLBACK_EXTS = ['.webp', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ktx2', '.basis']

const MIME: Record<string, string> = {
    '.webp': 'image/webp',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.ktx2': 'image/ktx2',
    '.basis': 'image/basis',
}

type Context = { params: Promise<{ path: string[] }> }

export async function GET(_: Request, { params }: Context) {
    const { path: segments } = await params
    const filePath = segments.join('/')
    const ext = path.extname(filePath).toLowerCase()
    const stem = filePath.slice(0, filePath.length - ext.length)

    const publicDir = path.resolve(path.join(process.cwd(), 'public'))

    // Build fallback order: webp first, then requested ext, then the rest
    const order = ['.webp']
    if (ext && ext !== '.webp') order.push(ext)
    for (const e of FALLBACK_EXTS) {
        if (!order.includes(e)) order.push(e)
    }

    for (const tryExt of order) {
        const fullPath = path.resolve(path.join(publicDir, stem + tryExt))
        // Prevent path traversal
        if (!fullPath.startsWith(publicDir)) break
        try {
            await access(fullPath)
            const buffer = await readFile(fullPath)
            return new Response(buffer, {
                headers: {
                    'Content-Type': MIME[tryExt] ?? 'application/octet-stream',
                    'Cache-Control': 'public, max-age=3600',
                },
            })
        } catch {
            // not found, try next
        }
    }

    return new Response(null, { status: 404 })
}
