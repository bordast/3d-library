import { getModels, getCategories } from '@/lib/db'
import { getVideos, getVideoCategories } from '@/lib/videodb'
import { getPdfs, getPdfCategories } from '@/lib/pdfdb'
import AdminClient from './AdminClient'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
    const [models, categories, videos, videoCategories, pdfs, pdfCategories] = await Promise.all([
        getModels(), getCategories(), getVideos(), getVideoCategories(), getPdfs(), getPdfCategories(),
    ])

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Admin Dashboard</h1>
                <p className="text-sm text-muted-foreground mt-1">Manage your 3D model, video, and PDF library.</p>
            </div>
            <AdminClient
                initialModels={models}
                initialCategories={categories}
                initialVideos={videos}
                initialVideoCategories={videoCategories}
                initialPdfs={pdfs}
                initialPdfCategories={pdfCategories}
            />
        </div>
    )
}
