import { readFile, writeFile } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

export type Model = {
  id: string
  name: string
  format: string
  fileUrl: string
  createdAt: string
}

const DATA_FILE = path.join(process.cwd(), 'data/models.json')

async function readModels(): Promise<Model[]> {
  try {
    const content = await readFile(DATA_FILE, 'utf-8')
    return JSON.parse(content)
  } catch {
    return []
  }
}

async function writeModels(models: Model[]): Promise<void> {
  await writeFile(DATA_FILE, JSON.stringify(models, null, 2))
}

export async function getModels(): Promise<Model[]> {
  const models = await readModels()
  return models.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export async function getModel(id: string): Promise<Model | undefined> {
  const models = await readModels()
  return models.find(m => m.id === id)
}

export async function createModel(data: { name: string; format: string; fileUrl: string }): Promise<Model> {
  const models = await readModels()
  const model: Model = {
    id: randomUUID(),
    ...data,
    createdAt: new Date().toISOString(),
  }
  models.push(model)
  await writeModels(models)
  return model
}

export async function updateModel(id: string, data: { name: string }): Promise<Model | null> {
  const models = await readModels()
  const idx = models.findIndex(m => m.id === id)
  if (idx === -1) return null
  models[idx] = { ...models[idx], ...data }
  await writeModels(models)
  return models[idx]
}

export async function deleteModel(id: string): Promise<Model | null> {
  const models = await readModels()
  const idx = models.findIndex(m => m.id === id)
  if (idx === -1) return null
  const [removed] = models.splice(idx, 1)
  await writeModels(models)
  return removed
}
