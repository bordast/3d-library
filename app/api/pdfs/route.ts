import { getPdfs, createPdf } from '@/lib/pdfdb'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { UPLOAD } from '@/lib/config'

export async function GET() {
    const pdfs = await getPdfs()
    return Response.json(pdfs, {
        headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    })
}

export async function POST(request: Request) {
    const formData = await request.formData()

    const name = (formData.get('name') as string)?.trim()
    const category = (formData.get('category') as string) || undefined
    const file = formData.get('file') as File | null

    if (!name || !file) {
        return Response.json({ error: 'Name and file are required' }, { status: 400 })
    }
    if (file.size > UPLOAD.pdf.maxBytes) {
        return Response.json({ error: 'File exceeds 100 MB limit' }, { status: 400 })
    }
    const ext = path.extname(file.name).toLowerCase()
    if (!UPLOAD.pdf.accept.includes(ext)) {
        return Response.json({ error: 'Only .pdf files are allowed' }, { status: 400 })
    }

    const filename = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`
    const dir = path.join(process.cwd(), 'public/uploads/pdfs')
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()))

    const pdf = await createPdf({
        name,
        category,
        fileUrl: `/uploads/pdfs/${filename}`,
    })
    return Response.json(pdf, { status: 201 })
}
