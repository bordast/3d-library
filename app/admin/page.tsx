import { getModels } from '@/lib/db'
import AdminClient from './AdminClient'

export default async function AdminPage() {
    const models = await getModels()
    return (
        <div>
            <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Admin Dashboard</h1>
                <p className="text-sm text-muted-foreground mt-1">Manage your 3D model library.</p>
            </div>
            <AdminClient initialModels={models} />
        </div>
    )
}
