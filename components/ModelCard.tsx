'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'

const ModelPreview = dynamic(() => import('./ModelPreview'), { ssr: false })

type Model = {
    id: string
    name: string
    category: string
    format: string
    fileUrl: string
}

export default function ModelCard({ model }: { model: Model }) {
    return (
        <Link href={`/models/${model.id}`} className="group block rounded-lg border border-border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md">
            <div className="h-40 rounded-t-lg overflow-hidden bg-muted">
                <ModelPreview url={model.fileUrl} />
            </div>
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
