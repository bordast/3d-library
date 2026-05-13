import { getCategories, createCategory } from '@/lib/db'

export async function GET() {
    const categories = await getCategories()
    return Response.json(categories, {
        headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    })
}

export async function POST(request: Request) {
    let body: { name?: string }
    try {
        body = await request.json()
    } catch {
        return Response.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const { name } = body
    if (!name?.trim()) {
        return Response.json({ error: 'Name is required' }, { status: 400 })
    }
    const category = await createCategory(name.trim())
    return Response.json(category, { status: 201 })
}
