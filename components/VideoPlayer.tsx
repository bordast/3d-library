'use client'

import type { Video } from '@/lib/videodb'

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

function getEmbedUrl(video: Video): string | null {
  if (video.sourceType === 'youtube') {
    const id = parseYouTubeId(video.sourceUrl)
    if (id) return `https://www.youtube.com/embed/${id}`
  }
  if (video.sourceType === 'vimeo') {
    const id = parseVimeoId(video.sourceUrl)
    if (id) return `https://player.vimeo.com/video/${id}`
  }
  return null
}

export default function VideoPlayer({ video }: { video: Video }) {
  if (video.sourceType === 'upload') {
    return (
      <video
        src={video.sourceUrl}
        controls
        className="w-full rounded-lg border border-border bg-black aspect-video"
        style={{ maxHeight: '70vh' }}
      />
    )
  }

  const embedUrl = getEmbedUrl(video)
  if (!embedUrl) {
    return (
      <div className="w-full aspect-video rounded-lg border border-border bg-muted flex items-center justify-center text-muted-foreground text-sm">
        Could not generate embed URL.
      </div>
    )
  }

  return (
    <div className="w-full aspect-video rounded-lg border border-border overflow-hidden bg-black">
      <iframe
        src={embedUrl}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title={video.name}
      />
    </div>
  )
}
