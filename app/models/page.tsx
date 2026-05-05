import { getModels } from '@/lib/db'
import ModelCard from '@/components/ModelCard'
import Link from 'next/link'

export default async function ModelsPage() {
    const models = await getModels()

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Models</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {models.length} {models.length === 1 ? 'model' : 'models'} in your library
                    </p>
                </div>
                <Link
                    href="/admin"
                    className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-medium h-9 px-4 shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                    Upload
                </Link>
            </div>

            {models.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-border rounded-lg">
                    <p className="text-muted-foreground text-sm">No models yet.</p>
                    <Link href="/admin" className="mt-3 text-sm font-medium text-foreground underline underline-offset-4">
                        Upload your first model
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {models.map(model => (
                        <ModelCard key={model.id} model={model} />
                    ))}
                </div>
            )}
        </div>
    )
}
