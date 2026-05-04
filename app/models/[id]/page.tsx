// app/models/[id]/page.tsx
import { FAKE_MODELS } from '@/lib/db'
import Viewer from '@/components/Viewer'

type Props = {
    params: Promise<{ id: string }>
}

export default async function ModelPage({ params }: Props) {
    const { id } = await params
    const model = FAKE_MODELS.find(m => m.id === id)

    if (!model) return <main><h1>Model not found</h1></main>

    return (
        <main>
            <h1>{model.name}</h1>
            <Viewer url="/test-model.glb" />
        </main>
    )
}