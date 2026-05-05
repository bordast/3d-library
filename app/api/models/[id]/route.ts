import { updateModel, deleteModel } from '@/lib/db'
import { unlink } from 'fs/promises'
import path from 'path'

type Context = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Context) {
    const { id } = await params
    const { name } = await request.json()

    if (!name?.trim()) {
        return Response.json({ error: 'Name is required' }, { status: 400 })
    }

    const model = await updateModel(id, { name: name.trim() })
    if (!model) return Response.json({ error: 'Not found' }, { status: 404 })

    return Response.json(model)
}

export async function DELETE(_: Request, { params }: Context) {
    const { id } = await params

    const model = await deleteModel(id)
    if (!model) return Response.json({ error: 'Not found' }, { status: 404 })

    try {
        await unlink(path.join(process.cwd(), 'public', model.fileUrl))
    } catch {
        // file may already be gone
    }

    return new Response(null, { status: 204 })
}
