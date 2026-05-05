import { getModels } from '@/lib/db'
import AdminClient from './AdminClient'

export default async function AdminPage() {
    const models = await getModels()
    return (
        <main>
            <h1>Admin Dashboard</h1>
            <AdminClient initialModels={models} />
        </main>
    )
}
