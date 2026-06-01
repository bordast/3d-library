import { getPdf, updatePdf, deletePdf } from '@/lib/pdfdb'
import { unlink } from 'fs/promises'
import path from 'path'

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const body = await request.json()
    const { name, category } = body
    if (!name?.trim()) {
        return Response.json({ error: 'Name is required' }, { status: 400 })
    }
    const updated = await updatePdf(id, { name: name.trim(), category })
    if (!updated) return Response.json({ error: 'Not found' }, { status: 404 })
    return Response.json(updated)
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const pdf = await getPdf(id)
    if (!pdf) return Response.json({ error: 'Not found' }, { status: 404 })

    const removed = await deletePdf(id)

    if (pdf.fileUrl) {
        try {
            await unlink(path.join(process.cwd(), 'public', pdf.fileUrl))
        } catch { /* file may already be missing */ }
    }
    if (pdf.thumbnailUrl) {
        try {
            await unlink(path.join(process.cwd(), 'public', pdf.thumbnailUrl))
        } catch { /* thumbnail may not exist */ }
    }

    return Response.json(removed)
}
