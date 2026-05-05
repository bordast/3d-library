import { getModel } from '@/lib/db'
import Viewer from '@/components/Viewer'

type Props = {
    params: Promise<{ id: string }>
}

export default async function ModelPage({ params }: Props) {
    const { id } = await params
    const model = await getModel(id)

    if (!model) return <main><h1>Model not found</h1></main>

    return (
        <main>
            <h1>{model.name}</h1>
            <Viewer url={model.fileUrl} />
        </main>
    )
}
