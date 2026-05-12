import { getModel } from '@/lib/db'
import { writeFile } from 'fs/promises'
import path from 'path'

type Context = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Context) {
    const { id } = await params
    const model = await getModel(id)
    if (!model) return Response.json({ error: 'Not found' }, { status: 404 })
    if (model.format !== '.obj') return Response.json({ error: 'Not an OBJ model' }, { status: 400 })

    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return Response.json({ error: 'File required' }, { status: 400 })

    if (path.extname(file.name).toLowerCase() !== '.mtl')
        return Response.json({ error: 'Only .mtl files allowed' }, { status: 400 })

    const mtlFilename = path.basename(model.fileUrl).replace(/\.obj(\?.*)?$/i, '.mtl')
    const objDir = path.join(process.cwd(), 'public', path.dirname(model.fileUrl))
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(path.join(objDir, mtlFilename), buffer)

    return Response.json({ mtlUrl: `/uploads/${mtlFilename}` }, { status: 201 })
}
