'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Video } from '@/lib/videodb'

const SOURCE_LABELS: Record<Video['sourceType'], string> = {
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  upload: 'Upload',
}

function PlayIcon() {
  return (
    <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
        stroke="currentColor" strokeWidth={1} className="size-10">
        <circle cx="12" cy="12" r="10" />
        <polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none" />
      </svg>
    </div>
  )
}

export default function VideoCard({ video }: { video: Video }) {
  const [imgFailed, setImgFailed] = useState(false)

  return (
    <Link
      href={`/videos/${video.id}`}
      className="group block rounded-lg border border-border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="h-40 rounded-t-lg overflow-hidden bg-muted">
        {video.thumbnailUrl && !imgFailed ? (
          <img
            src={video.thumbnailUrl}
            alt={video.name}
            className="w-full h-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <PlayIcon />
        )}
      </div>
      <div className="p-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{video.name}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{video.category}</p>
        </div>
        <span className="shrink-0 inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {SOURCE_LABELS[video.sourceType]}
        </span>
      </div>
    </Link>
  )
}
