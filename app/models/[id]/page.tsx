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
        <ViewTransition name={`model-preview-${id}`} share="morph">
            <Viewer
                url={model.fileUrl}
                name={model.name}
                category={model.category}
                format={model.format}
            />
        </ViewTransition>
    )
}
