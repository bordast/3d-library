import { getModel } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const ALLOWED_EXTS = new Set(['.webp', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ktx2', '.basis', '.bin', '.glb'])

type Context = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Context) {
    const { id } = await params
    const model = await getModel(id)
    if (!model) return Response.json({ error: 'Not found' }, { status: 404 })
    if (model.format !== '.gltf') return Response.json({ error: 'Not a GLTF model' }, { status: 400 })

    // Only folder-based GLTF models have a valid target directory
    if (model.fileUrl.split('/').length < 5)
        return Response.json({ error: 'Model is not stored in a folder' }, { status: 400 })

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    if (!files.length) return Response.json({ error: 'No files provided' }, { status: 400 })

    const modelDir = path.join(process.cwd(), 'public', path.dirname(model.fileUrl))
    await mkdir(modelDir, { recursive: true })

    const saved: string[] = []
    for (const file of files) {
        const ext = path.extname(file.name).toLowerCase()
        if (!ALLOWED_EXTS.has(ext)) continue
        const safeName = path.basename(file.name).replace(/\s+/g, '-')
        const buffer = Buffer.from(await file.arrayBuffer())
        await writeFile(path.join(modelDir, safeName), buffer)
        saved.push(safeName)
    }

    return Response.json({ saved }, { status: 201 })
}
