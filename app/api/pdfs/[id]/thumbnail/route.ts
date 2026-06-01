import { updatePdfThumbnail } from '@/lib/pdfdb'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const { dataUrl } = await request.json()

    if (!dataUrl?.startsWith('data:image/')) {
        return Response.json({ error: 'Invalid dataUrl' }, { status: 400 })
    }

    const base64 = dataUrl.split(',')[1]
    const buffer = Buffer.from(base64, 'base64')
    const dir = path.join(process.cwd(), 'public/thumbnails/pdfs')
    await mkdir(dir, { recursive: true })
    const filename = `${id}.webp`
    await writeFile(path.join(dir, filename), buffer)

    const thumbnailUrl = `/thumbnails/pdfs/${filename}`
    const updated = await updatePdfThumbnail(id, thumbnailUrl)
    if (!updated) return Response.json({ error: 'Not found' }, { status: 404 })
    return Response.json({ thumbnailUrl })
}
