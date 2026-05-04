import { db } from '@/lib/db'
import ModelCard from '@/components/ModelCard'

export default async function ModelsPage() {
    const models = await db.model.findMany({
        orderBy: { createdAt: 'desc' }
    })

    return (
        <main>
            <h1>3D Library</h1>
            <div>
                {models.length === 0
                    ? <p>No models yet.</p>
                    : models.map(model => (
                        <ModelCard key={model.id} model={model} />
                    ))
                }
            </div>
        </main>
    )
}