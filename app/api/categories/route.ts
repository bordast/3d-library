import { getCategories, createCategory } from '@/lib/db'

export async function GET() {
    const categories = await getCategories()
    return Response.json(categories)
}

export async function POST(request: Request) {
    const { name } = await request.json()
    if (!name?.trim()) {
        return Response.json({ error: 'Name is required' }, { status: 400 })
    }
    const category = await createCategory(name.trim())
    return Response.json(category, { status: 201 })
}
