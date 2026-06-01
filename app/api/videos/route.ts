import { getVideos, createVideo } from '@/lib/videodb'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { UPLOAD } from '@/lib/config'

function parseYouTubeId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('?')[0]
    if (u.hostname.includes('youtube.com')) {
      if (u.searchParams.has('v')) return u.searchParams.get('v')
      const match = u.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)
      if (match) return match[1]
    }
  } catch { /* invalid URL */ }
  return null
}

function parseVimeoId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.includes('vimeo.com')) {
      const match = u.pathname.match(/\/(\d+)/)
      if (match) return match[1]
    }
  } catch { /* invalid URL */ }
  return null
}

export async function GET() {
  const videos = await getVideos()
  return Response.json(videos, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  })
}

export async function POST(request: Request) {
  const ct = request.headers.get('content-type') ?? ''

  if (ct.includes('multipart/form-data')) {
    const formData = await request.formData()
    const name = (formData.get('name') as string)?.trim()
    const category = (formData.get('category') as string) || undefined
    const file = formData.get('file') as File | null

    if (!name || !file) {
      return Response.json({ error: 'Name and file are required' }, { status: 400 })
    }
    if (file.size > UPLOAD.video.maxBytes) {
      return Response.json({ error: 'File exceeds 500 MB limit' }, { status: 400 })
    }
    const ext = path.extname(file.name).toLowerCase()
    if (!UPLOAD.video.accept.includes(ext)) {
      return Response.json({ error: 'Only .mp4 and .webm files are allowed' }, { status: 400 })
    }

    const filename = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`
    const dir = path.join(process.cwd(), 'public/uploads/videos')
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()))

    const video = await createVideo({
      name,
      category,
      sourceType: 'upload',
      sourceUrl: `/uploads/videos/${filename}`,
    })
    return Response.json(video, { status: 201 })
  }

  // JSON body — URL submission
  let body: { name?: string; category?: string; url?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { name, category, url } = body
  if (!name?.trim() || !url?.trim()) {
    return Response.json({ error: 'Name and url are required' }, { status: 400 })
  }

  const ytId = parseYouTubeId(url)
  const vmId = !ytId ? parseVimeoId(url) : null

  if (!ytId && !vmId) {
    return Response.json({ error: 'Unrecognised YouTube or Vimeo URL' }, { status: 400 })
  }

  const video = await createVideo({
    name: name.trim(),
    category,
    sourceType: ytId ? 'youtube' : 'vimeo',
    sourceUrl: url.trim(),
    thumbnailUrl: ytId
      ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
      : undefined,
  })
  return Response.json(video, { status: 201 })
}
