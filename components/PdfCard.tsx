'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Pdf } from '@/lib/pdfdb'
import { CARD } from '@/lib/config'

function DocumentIcon() {
    return (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={1} className="size-10">
                <path strokeLinecap="round" strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
        </div>
    )
}

export default function PdfCard({ pdf }: { pdf: Pdf }) {
    const [imgFailed, setImgFailed] = useState(false)

    return (
        <Link
            href={`/pdfs/${pdf.id}`}
            className="group block rounded-lg border border-border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md"
        >
            <div className={`${CARD.thumbnailClass} rounded-t-lg overflow-hidden bg-muted`}>
                {pdf.thumbnailUrl && !imgFailed ? (
                    <img
                        src={pdf.thumbnailUrl}
                        alt={pdf.name}
                        className="w-full h-full object-cover"
                        onError={() => setImgFailed(true)}
                    />
                ) : (
                    <DocumentIcon />
                )}
            </div>
            <div className="p-4 flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{pdf.name}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{pdf.category}</p>
                </div>
                <span className="shrink-0 inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    PDF
                </span>
            </div>
        </Link>
    )
}
