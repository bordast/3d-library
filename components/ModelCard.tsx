'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ViewTransition } from 'react'
import type { Model } from '@/lib/db'

const PlaceholderIcon = ({ format }: { format: string }) => (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground/40">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1} className="size-10">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
        </svg>
        <span className="text-xs">{format}</span>
    </div>
)

export default function ModelCard({ model }: { model: Model }) {
    const [imgFailed, setImgFailed] = useState(false)

    return (
        <Link href={`/models/${model.id}`} transitionTypes={['nav-forward']} className="group block rounded-lg border border-border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md">
            <ViewTransition name={`model-preview-${model.id}`} share="morph">
                <div className="h-40 rounded-t-lg overflow-hidden bg-muted">
                    {model.thumbnailUrl && !imgFailed ? (
                        <img
                            src={model.thumbnailUrl}
                            alt={model.name}
                            className="w-full h-full object-cover"
                            onError={() => setImgFailed(true)}
                        />
                    ) : (
                        <PlaceholderIcon format={model.format} />
                    )}
                </div>
            </ViewTransition>
            <div className="p-4 flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{model.name}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{model.category}</p>
                </div>
                <span className="shrink-0 inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {model.format}
                </span>
            </div>
        </Link>
    )
}
