import { getPdfCategories, createPdfCategory } from '@/lib/pdfdb'

export async function GET() {
    const categories = await getPdfCategories()
    return Response.json(categories)
}

export async function POST(request: Request) {
    const body = await request.json().catch(() => ({}))
    const { name } = body
    if (!name?.trim()) {
        return Response.json({ error: 'Name is required' }, { status: 400 })
    }
    const category = await createPdfCategory(name.trim())
    return Response.json(category, { status: 201 })
}
