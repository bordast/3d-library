import { getPdf } from '@/lib/pdfdb'
import PdfViewerClient from '@/components/PdfViewerClient'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function PdfDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const pdf = await getPdf(id)
    if (!pdf) notFound()

    return (
        <div>
            <div className="mb-6 flex items-center gap-3">
                <Link
                    href="/pdfs"
                    transitionTypes={['nav-back']}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    ← PDFs
                </Link>
            </div>

            <div className="mb-4">
                <h1 className="text-xl font-bold tracking-tight text-foreground">{pdf.name}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">{pdf.category}</p>
            </div>

            <PdfViewerClient url={pdf.fileUrl} />
        </div>
    )
}
