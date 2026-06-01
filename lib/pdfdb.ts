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

export type PdfCategory = {
    id: string
    name: string
}

export type Pdf = {
    id: string
    name: string
    category: string
    fileUrl: string       // /uploads/pdfs/<timestamp>-<name>.pdf
    thumbnailUrl?: string // /thumbnails/pdfs/<id>.webp
    createdAt: string
}

type PdfDbData = {
    categories: PdfCategory[]
    pdfs: Pdf[]
}

const DATA_FILE = path.join(process.cwd(), 'data/pdfs.json')

async function readData(): Promise<PdfDbData> {
    try {
        const content = await readFile(DATA_FILE, 'utf-8')
        const parsed = JSON.parse(content)
        return {
            categories: parsed.categories ?? [],
            pdfs: (parsed.pdfs ?? []).map((p: Partial<Pdf>) => ({
                ...p,
                category: p.category ?? 'uncategorised',
            })),
        }
    } catch {
        return { categories: [], pdfs: [] }
    }
}

async function writeData(data: PdfDbData): Promise<void> {
    await writeFile(DATA_FILE, JSON.stringify(data, null, 2))
}

// PdfCategory CRUD

export async function getPdfCategories(): Promise<PdfCategory[]> {
    const data = await readData()
    return data.categories
}

export async function createPdfCategory(name: string): Promise<PdfCategory> {
    const data = await readData()
    const existing = new Set(data.categories.map(c => c.id))
    const id = uniqueSlug(toSlug(name), existing)
    const category: PdfCategory = { id, name: name.trim() }
    data.categories.push(category)
    await writeData(data)
    return category
}

export async function updatePdfCategory(id: string, name: string): Promise<PdfCategory | null> {
    const data = await readData()
    const idx = data.categories.findIndex(c => c.id === id)
    if (idx === -1) return null
    const oldName = data.categories[idx].name
    data.categories[idx] = { id, name: name.trim() }
    data.pdfs = data.pdfs.map(p =>
        p.category === oldName ? { ...p, category: name.trim() } : p
    )
    await writeData(data)
    return data.categories[idx]
}

export async function deletePdfCategory(id: string): Promise<PdfCategory | null> {
    const data = await readData()
    const idx = data.categories.findIndex(c => c.id === id)
    if (idx === -1) return null
    const [removed] = data.categories.splice(idx, 1)
    data.pdfs = data.pdfs.map(p =>
        p.category === removed.name ? { ...p, category: 'uncategorised' } : p
    )
    await writeData(data)
    return removed
}

// Pdf CRUD

export async function getPdfs(): Promise<Pdf[]> {
    const data = await readData()
    return data.pdfs.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
}

export async function getPdf(id: string): Promise<Pdf | undefined> {
    const data = await readData()
    return data.pdfs.find(p => p.id === id)
}

export async function createPdf(input: {
    name: string
    category?: string
    fileUrl: string
}): Promise<Pdf> {
    const data = await readData()
    const existing = new Set(data.pdfs.map(p => p.id))
    const pdf: Pdf = {
        id: uniqueSlug(toSlug(input.name), existing),
        name: input.name,
        category: input.category?.trim() || 'uncategorised',
        fileUrl: input.fileUrl,
        createdAt: new Date().toISOString(),
    }
    data.pdfs.push(pdf)
    await writeData(data)
    return pdf
}

export async function updatePdf(
    id: string,
    update: { name: string; category?: string }
): Promise<Pdf | null> {
    const data = await readData()
    const idx = data.pdfs.findIndex(p => p.id === id)
    if (idx === -1) return null
    data.pdfs[idx] = {
        ...data.pdfs[idx],
        name: update.name,
        category: update.category?.trim() || data.pdfs[idx].category,
    }
    await writeData(data)
    return data.pdfs[idx]
}

export async function updatePdfThumbnail(id: string, thumbnailUrl: string): Promise<Pdf | null> {
    const data = await readData()
    const idx = data.pdfs.findIndex(p => p.id === id)
    if (idx === -1) return null
    data.pdfs[idx] = { ...data.pdfs[idx], thumbnailUrl }
    await writeData(data)
    return data.pdfs[idx]
}

export async function deletePdf(id: string): Promise<Pdf | null> {
    const data = await readData()
    const idx = data.pdfs.findIndex(p => p.id === id)
    if (idx === -1) return null
    const [removed] = data.pdfs.splice(idx, 1)
    await writeData(data)
    return removed
}

export async function resetPdfDb(): Promise<void> {
    await writeData({ categories: [], pdfs: [] })
}
