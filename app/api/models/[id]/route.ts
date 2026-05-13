import { updateModel, deleteModel } from '@/lib/db'
import { unlink, rm } from 'fs/promises'
import path from 'path'

type Context = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Context) {
    const { id } = await params
    let body: { name?: string; category?: string }
    try {
        body = await request.json()
    } catch {
        return Response.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const { name, category } = body

    if (!name?.trim()) {
        return Response.json({ error: 'Name is required' }, { status: 400 })
    }

    const model = await updateModel(id, { name: name.trim(), category })
    if (!model) return Response.json({ error: 'Not found' }, { status: 404 })

    return Response.json(model)
}

export async function DELETE(_: Request, { params }: Context) {
    const { id } = await params

    const model = await deleteModel(id)
    if (!model) return Response.json({ error: 'Not found' }, { status: 404 })

    try {
        const isFolderBased =
            (model.format === '.obj' && model.fileUrl.startsWith('/uploads/obj/') && model.fileUrl.split('/').length >= 5) ||
            (model.format === '.gltf' && model.fileUrl.startsWith('/uploads/gltf/') && model.fileUrl.split('/').length >= 5)
        if (isFolderBased) {
            // Remove entire <format>/<stem>/ directory (contains model + textures/mtl)
            const dir = path.join(process.cwd(), 'public', path.dirname(model.fileUrl))
            await rm(dir, { recursive: true, force: true })
        } else {
            await unlink(path.join(process.cwd(), 'public', model.fileUrl))
            // Old flat OBJ layout: also remove companion .mtl if present
            if (model.format === '.obj') {
                await unlink(
                    path.join(process.cwd(), 'public', model.fileUrl.replace(/\.obj$/i, '.mtl'))
                ).catch(() => {})
            }
        }
    } catch {
        // file may already be gone
    }

    return new Response(null, { status: 204 })
}
