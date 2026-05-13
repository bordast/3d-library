import { resetDb } from '@/lib/db'
import { rm, mkdir } from 'fs/promises'
import path from 'path'

export async function POST() {
    const pub = path.join(process.cwd(), 'public')

    await resetDb()

    await rm(path.join(pub, 'uploads'), { recursive: true, force: true })
    await mkdir(path.join(pub, 'uploads/glb'), { recursive: true })
    await mkdir(path.join(pub, 'uploads/gltf'), { recursive: true })
    await mkdir(path.join(pub, 'uploads/obj'), { recursive: true })

    await rm(path.join(pub, 'thumbnails'), { recursive: true, force: true })
    await mkdir(path.join(pub, 'thumbnails'), { recursive: true })

    return Response.json({ ok: true })
}
