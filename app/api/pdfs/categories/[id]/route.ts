import { updatePdfCategory, deletePdfCategory } from '@/lib/pdfdb'

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const { name } = body
    if (!name?.trim()) {
        return Response.json({ error: 'Name is required' }, { status: 400 })
    }
    const updated = await updatePdfCategory(id, name.trim())
    if (!updated) return Response.json({ error: 'Not found' }, { status: 404 })
    return Response.json(updated)
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const removed = await deletePdfCategory(id)
    if (!removed) return Response.json({ error: 'Not found' }, { status: 404 })
    return Response.json(removed)
}
