import { readFile, writeFile } from 'fs/promises'
import path from 'path'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function uniqueSlug(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base
  let i = 2
  while (existing.has(`${base}-${i}`)) i++
  return `${base}-${i}`
}

export type Category = {
  id: string
  name: string
}

export type Model = {
  id: string
  name: string
  category: string
  format: string
  fileUrl: string
  createdAt: string
  thumbnailUrl?: string
}

type DbData = {
  categories: Category[]
  models: Model[]
}

const DATA_FILE = path.join(process.cwd(), 'data/models.json')

let cache: DbData | null = null

async function readData(): Promise<DbData> {
  if (cache) return cache
  try {
    const content = await readFile(DATA_FILE, 'utf-8')
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed)) {
      cache = {
        categories: [],
        models: parsed.map(m => ({ ...m, category: m.category ?? 'uncategorised' })),
      }
    } else {
      cache = {
        categories: parsed.categories ?? [],
        models: (parsed.models ?? []).map((m: Partial<Model>) => ({
          ...m,
          category: m.category ?? 'uncategorised',
        })),
      }
    }
    return cache
  } catch {
    cache = { categories: [], models: [] }
    return cache
  }
}

async function writeData(data: DbData): Promise<void> {
  cache = data
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2))
}

// Category CRUD

export async function getCategories(): Promise<Category[]> {
  const data = await readData()
  return data.categories
}

export async function createCategory(name: string): Promise<Category> {
  const data = await readData()
  const existing = new Set(data.categories.map(c => c.id))
  const id = uniqueSlug(toSlug(name), existing)
  const category: Category = { id, name: name.trim() }
  data.categories.push(category)
  await writeData(data)
  return category
}

export async function updateCategory(id: string, name: string): Promise<Category | null> {
  const data = await readData()
  const idx = data.categories.findIndex(c => c.id === id)
  if (idx === -1) return null
  const oldName = data.categories[idx].name
  data.categories[idx] = { id, name: name.trim() }
  data.models = data.models.map(m =>
    m.category === oldName ? { ...m, category: name.trim() } : m
  )
  await writeData(data)
  return data.categories[idx]
}

export async function deleteCategory(id: string): Promise<Category | null> {
  const data = await readData()
  const idx = data.categories.findIndex(c => c.id === id)
  if (idx === -1) return null
  const [removed] = data.categories.splice(idx, 1)
  data.models = data.models.map(m =>
    m.category === removed.name ? { ...m, category: 'uncategorised' } : m
  )
  await writeData(data)
  return removed
}

// Model CRUD

export async function getModels(): Promise<Model[]> {
  const data = await readData()
  return data.models.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export async function getModel(id: string): Promise<Model | undefined> {
  const data = await readData()
  return data.models.find(m => m.id === id)
}

export async function createModel(input: {
  name: string
  category?: string
  format: string
  fileUrl: string
}): Promise<Model> {
  const data = await readData()
  const existing = new Set(data.models.map(m => m.id))
  const model: Model = {
    id: uniqueSlug(toSlug(input.name), existing),
    name: input.name,
    category: input.category?.trim() || 'uncategorised',
    format: input.format,
    fileUrl: input.fileUrl,
    createdAt: new Date().toISOString(),
  }
  data.models.push(model)
  await writeData(data)
  return model
}

export async function updateModel(
  id: string,
  update: { name: string; category?: string }
): Promise<Model | null> {
  const data = await readData()
  const idx = data.models.findIndex(m => m.id === id)
  if (idx === -1) return null
  data.models[idx] = {
    ...data.models[idx],
    name: update.name,
    category: update.category?.trim() || data.models[idx].category,
  }
  await writeData(data)
  return data.models[idx]
}

export async function updateModelThumbnail(id: string, thumbnailUrl: string): Promise<Model | null> {
  const data = await readData()
  const idx = data.models.findIndex(m => m.id === id)
  if (idx === -1) return null
  data.models[idx] = { ...data.models[idx], thumbnailUrl }
  await writeData(data)
  return data.models[idx]
}

export async function deleteModel(id: string): Promise<Model | null> {
  const data = await readData()
  const idx = data.models.findIndex(m => m.id === id)
  if (idx === -1) return null
  const [removed] = data.models.splice(idx, 1)
  await writeData(data)
  return removed
}
