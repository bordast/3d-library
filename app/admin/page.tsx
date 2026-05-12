import { getModels, getCategories } from '@/lib/db'
import { access } from 'fs/promises'
import path from 'path'
import AdminClient from './AdminClient'

export default async function AdminPage() {
    const [models, categories] = await Promise.all([getModels(), getCategories()])

    const missingMtl = (await Promise.all(
        models
            .filter(m => m.format === '.obj')
            .map(async m => {
                const mtlPath = path.join(
                    process.cwd(), 'public',
                    m.fileUrl.replace(/\.obj(\?.*)?$/i, '.mtl'),
                )
                try { await access(mtlPath); return null }
                catch { return m.id }
            }),
    )).filter(Boolean) as string[]

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Admin Dashboard</h1>
                <p className="text-sm text-muted-foreground mt-1">Manage your 3D model library.</p>
            </div>
            <AdminClient initialModels={models} initialCategories={categories} initialMissingMtl={missingMtl} />
        </div>
    )
}
