import { db } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export async function GET() {
    const models = await db.model.findMany({ orderBy: { createdAt: 'desc' } })
    return Response.json(models)
}

export async function POST(request: Request) {
    const formData = await request.formData()

    const name = formData.get('name') as string
    const file = formData.get('file') as File

    // Validate
    if (!name || !file) {
        return Response.json({ error: 'Name and file are required' }, { status: 400 })
    }

    const ext = path.extname(file.name).toLowerCase()
    if (!['.glb', '.gltf', '.obj'].includes(ext)) {
        return Response.json({ error: 'Only .glb, .gltf, .obj files allowed' }, { status: 400 })
    }

    // Save file to disk
    const uploadDir = path.join(process.cwd(), 'public/uploads')
    await mkdir(uploadDir, { recursive: true })

    const filename = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(path.join(uploadDir, filename), buffer)

    // Save to database
    const model = await db.model.create({
        data: {
            name,
            format: ext,
            fileUrl: `/uploads/${filename}`,
        }
    })

    return Response.json(model, { status: 201 })
}