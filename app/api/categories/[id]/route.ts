import { updateCategory, deleteCategory } from '@/lib/db'

type Context = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Context) {
    const { id } = await params
    const { name } = await request.json()
    if (!name?.trim()) {
        return Response.json({ error: 'Name is required' }, { status: 400 })
    }
    const category = await updateCategory(id, name.trim())
    if (!category) return Response.json({ error: 'Not found' }, { status: 404 })
    return Response.json(category)
}

export async function DELETE(_: Request, { params }: Context) {
    const { id } = await params
    const category = await deleteCategory(id)
    if (!category) return Response.json({ error: 'Not found' }, { status: 404 })
    return new Response(null, { status: 204 })
}
