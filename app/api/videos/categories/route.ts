import { getVideoCategories, createVideoCategory } from '@/lib/videodb'

export async function GET() {
  const categories = await getVideoCategories()
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
  if (!body.name?.trim()) {
    return Response.json({ error: 'Name is required' }, { status: 400 })
  }
  const category = await createVideoCategory(body.name.trim())
  return Response.json(category, { status: 201 })
}
