import { getModels, createModel } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export async function GET() {
    const models = await getModels()
    return Response.json(models)
}

export async function POST(request: Request) {
    const formData = await request.formData()

    const name = formData.get('name') as string
    const category = formData.get('category') as string | null
    const file = formData.get('file') as File

    if (!name || !file) {
        return Response.json({ error: 'Name and file are required' }, { status: 400 })
    }

    const ext = path.extname(file.name).toLowerCase()
    if (!['.glb', '.gltf', '.obj'].includes(ext)) {
        return Response.json({ error: 'Only .glb, .gltf, .obj files allowed' }, { status: 400 })
    }

    const uploadDir = path.join(process.cwd(), 'public/uploads')
    await mkdir(uploadDir, { recursive: true })

    const filename = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(path.join(uploadDir, filename), buffer)

    const model = await createModel({
        name,
        category: category ?? undefined,
        format: ext,
        fileUrl: `/uploads/${filename}`,
    })

    return Response.json(model, { status: 201 })
}
