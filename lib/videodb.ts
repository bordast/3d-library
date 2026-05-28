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

export type VideoCategory = {
  id: string
  name: string
}

export type Video = {
  id: string
  name: string
  category: string
  sourceType: 'youtube' | 'vimeo' | 'upload'
  sourceUrl: string
  thumbnailUrl?: string
  createdAt: string
}

type VideoDbData = {
  categories: VideoCategory[]
  videos: Video[]
}

const DATA_FILE = path.join(process.cwd(), 'data/videos.json')

async function readData(): Promise<VideoDbData> {
  try {
    const content = await readFile(DATA_FILE, 'utf-8')
    const parsed = JSON.parse(content)
    return {
      categories: parsed.categories ?? [],
      videos: (parsed.videos ?? []).map((v: Partial<Video>) => ({
        ...v,
        category: v.category ?? 'uncategorised',
      })),
    }
  } catch {
    return { categories: [], videos: [] }
  }
}

async function writeData(data: VideoDbData): Promise<void> {
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2))
}

// VideoCategory CRUD

export async function getVideoCategories(): Promise<VideoCategory[]> {
  const data = await readData()
  return data.categories
}

export async function createVideoCategory(name: string): Promise<VideoCategory> {
  const data = await readData()
  const existing = new Set(data.categories.map(c => c.id))
  const id = uniqueSlug(toSlug(name), existing)
  const category: VideoCategory = { id, name: name.trim() }
  data.categories.push(category)
  await writeData(data)
  return category
}

export async function updateVideoCategory(id: string, name: string): Promise<VideoCategory | null> {
  const data = await readData()
  const idx = data.categories.findIndex(c => c.id === id)
  if (idx === -1) return null
  const oldName = data.categories[idx].name
  data.categories[idx] = { id, name: name.trim() }
  data.videos = data.videos.map(v =>
    v.category === oldName ? { ...v, category: name.trim() } : v
  )
  await writeData(data)
  return data.categories[idx]
}

export async function deleteVideoCategory(id: string): Promise<VideoCategory | null> {
  const data = await readData()
  const idx = data.categories.findIndex(c => c.id === id)
  if (idx === -1) return null
  const [removed] = data.categories.splice(idx, 1)
  data.videos = data.videos.map(v =>
    v.category === removed.name ? { ...v, category: 'uncategorised' } : v
  )
  await writeData(data)
  return removed
}

// Video CRUD

export async function getVideos(): Promise<Video[]> {
  const data = await readData()
  return data.videos.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export async function getVideo(id: string): Promise<Video | undefined> {
  const data = await readData()
  return data.videos.find(v => v.id === id)
}

export async function createVideo(input: {
  name: string
  category?: string
  sourceType: Video['sourceType']
  sourceUrl: string
  thumbnailUrl?: string
}): Promise<Video> {
  const data = await readData()
  const existing = new Set(data.videos.map(v => v.id))
  const video: Video = {
    id: uniqueSlug(toSlug(input.name), existing),
    name: input.name,
    category: input.category?.trim() || 'uncategorised',
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl,
    thumbnailUrl: input.thumbnailUrl,
    createdAt: new Date().toISOString(),
  }
  data.videos.push(video)
  await writeData(data)
  return video
}

export async function updateVideo(
  id: string,
  update: { name: string; category?: string }
): Promise<Video | null> {
  const data = await readData()
  const idx = data.videos.findIndex(v => v.id === id)
  if (idx === -1) return null
  data.videos[idx] = {
    ...data.videos[idx],
    name: update.name,
    category: update.category?.trim() || data.videos[idx].category,
  }
  await writeData(data)
  return data.videos[idx]
}

export async function updateVideoThumbnail(id: string, thumbnailUrl: string): Promise<Video | null> {
  const data = await readData()
  const idx = data.videos.findIndex(v => v.id === id)
  if (idx === -1) return null
  data.videos[idx] = { ...data.videos[idx], thumbnailUrl }
  await writeData(data)
  return data.videos[idx]
}

export async function deleteVideo(id: string): Promise<Video | null> {
  const data = await readData()
  const idx = data.videos.findIndex(v => v.id === id)
  if (idx === -1) return null
  const [removed] = data.videos.splice(idx, 1)
  await writeData(data)
  return removed
}

export async function resetVideoDb(): Promise<void> {
  await writeData({ categories: [], videos: [] })
}
