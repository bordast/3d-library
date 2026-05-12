import { getModel, updateModelThumbnail } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

type Context = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Context) {
    const { id } = await params
    const model = await getModel(id)
    if (!model) return Response.json({ error: 'Not found' }, { status: 404 })

    const { dataUrl } = await request.json()
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/'))
        return Response.json({ error: 'Invalid data URL' }, { status: 400 })

    const [header, base64] = dataUrl.split(',')
    const ext = header.includes('webp') ? '.webp' : '.png'
    const buffer = Buffer.from(base64, 'base64')

    const thumbDir = path.join(process.cwd(), 'public/thumbnails')
    await mkdir(thumbDir, { recursive: true })
    const filename = `${id}${ext}`
    await writeFile(path.join(thumbDir, filename), buffer)

    const thumbnailUrl = `/thumbnails/${filename}`
    await updateModelThumbnail(id, thumbnailUrl)

    return Response.json({ thumbnailUrl })
}
