import { getModels, createModel } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { UPLOAD } from '@/lib/config'

export async function GET() {
    const models = await getModels()
    return Response.json(models, {
        headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    })
}

export async function POST(request: Request) {
    const formData = await request.formData()

    const name = formData.get('name') as string
    const category = formData.get('category') as string | null
    const file = formData.get('file') as File

    if (!name || !file) {
        return Response.json({ error: 'Name and file are required' }, { status: 400 })
    }

    if (file.size > UPLOAD.model.maxBytes) {
        return Response.json({ error: 'File exceeds 200 MB limit' }, { status: 400 })
    }

    const ext = path.extname(file.name).toLowerCase()
    if (!UPLOAD.model.accept.includes(ext)) {
        return Response.json({ error: 'Only .glb, .gltf files allowed' }, { status: 400 })
    }

    const uploadsRoot = path.join(process.cwd(), 'public/uploads')
    const filename = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`
    const buffer = Buffer.from(await file.arrayBuffer())

    let fileUrl: string
    try {
        if (ext === '.gltf') {
            const stem = filename.slice(0, -(ext.length))
            const dir = path.join(uploadsRoot, ext.slice(1), stem)
            await mkdir(dir, { recursive: true })
            await writeFile(path.join(dir, filename), buffer)
            fileUrl = `/uploads/${ext.slice(1)}/${stem}/${filename}`
        } else {
            const dir = path.join(uploadsRoot, ext.slice(1))
            await mkdir(dir, { recursive: true })
            await writeFile(path.join(dir, filename), buffer)
            fileUrl = `/uploads/${ext.slice(1)}/${filename}`
        }
    } catch {
        return Response.json({ error: 'Failed to save file' }, { status: 500 })
    }

    const model = await createModel({
        name,
        category: category ?? undefined,
        format: ext,
        fileUrl,
    })

    return Response.json(model, { status: 201 })
}
