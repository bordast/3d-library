import { getModel } from '@/lib/db'
import Viewer from '@/components/Viewer'
import Link from 'next/link'
import { ViewTransition } from 'react'

type Props = {
    params: Promise<{ id: string }>
}

export default async function ModelPage({ params }: Props) {
    const { id } = await params
    const model = await getModel(id)

    if (!model) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <p className="text-lg font-semibold text-foreground">Model not found</p>
                <Link href="/models" className="mt-3 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
                    Back to library
                </Link>
            </div>
        )
    }

    return (
        <div>
            <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
                <Link href="/models" transitionTypes={['nav-back']} className="hover:text-foreground transition-colors">Models</Link>
                <span>/</span>
                <span className="text-foreground font-medium">{model.name}</span>
            </nav>

            <div className="flex items-center gap-3 mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">{model.name}</h1>
                <span className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {model.format}
                </span>
            </div>

            <ViewTransition name={`model-preview-${id}`} share="morph">
                <div className="rounded-lg border border-border overflow-hidden bg-card shadow-sm">
                    <Viewer url={model.fileUrl} />
                </div>
            </ViewTransition>

            <p className="mt-3 text-xs text-muted-foreground">
                Uploaded {new Date(model.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
        </div>
    )
}
