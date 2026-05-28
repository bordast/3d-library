import { updateVideo, deleteVideo } from '@/lib/videodb'
import { unlink } from 'fs/promises'
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
  if (!body.name?.trim()) {
    return Response.json({ error: 'Name is required' }, { status: 400 })
  }
  const video = await updateVideo(id, { name: body.name.trim(), category: body.category })
  if (!video) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(video)
}

export async function DELETE(_: Request, { params }: Context) {
  const { id } = await params
  const video = await deleteVideo(id)
  if (!video) return Response.json({ error: 'Not found' }, { status: 404 })

  if (video.sourceType === 'upload') {
    try {
      await unlink(path.join(process.cwd(), 'public', video.sourceUrl))
    } catch { /* already gone */ }
  }
  return new Response(null, { status: 204 })
}
