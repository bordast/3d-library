import { getModels, getCategories } from '@/lib/db'
import AdminClient from './AdminClient'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
    const [models, categories] = await Promise.all([getModels(), getCategories()])

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Admin Dashboard</h1>
                <p className="text-sm text-muted-foreground mt-1">Manage your 3D model library.</p>
            </div>
            <AdminClient initialModels={models} initialCategories={categories} />
        </div>
    )
}
