'use client'

import { useState, useRef } from 'react'
import type { Model } from '@/lib/db'

export default function AdminClient({ initialModels }: { initialModels: Model[] }) {
    const [models, setModels] = useState<Model[]>(initialModels)
    const [uploading, setUploading] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editName, setEditName] = useState('')
    const [editCategory, setEditCategory] = useState('')
    const nameRef = useRef<HTMLInputElement>(null)
    const categoryRef = useRef<HTMLInputElement>(null)
    const fileRef = useRef<HTMLInputElement>(null)

    async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const form = e.currentTarget
        const name = nameRef.current?.value.trim()
        const file = fileRef.current?.files?.[0]
        if (!name || !file) return

        setUploading(true)
        const body = new FormData()
        body.append('name', name)
        const cat = categoryRef.current?.value.trim()
        if (cat) body.append('category', cat)
        body.append('file', file)

        const res = await fetch('/api/models', { method: 'POST', body })
        if (res.ok) {
            const model: Model = await res.json()
            setModels(prev => [model, ...prev])
            form.reset()
        }
        setUploading(false)
    }

    function startEdit(model: Model) {
        setEditingId(model.id)
        setEditName(model.name)
        setEditCategory(model.category)
    }

    async function saveEdit(id: string) {
        const trimmedName = editName.trim()
        const trimmedCategory = editCategory.trim()
        if (!trimmedName) return
        const res = await fetch(`/api/models/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: trimmedName, category: trimmedCategory }),
        })
        if (res.ok) {
            const updated: Model = await res.json()
            setModels(prev => prev.map(m => m.id === id ? updated : m))
        }
        setEditingId(null)
    }

    async function handleDelete(id: string) {
        if (!confirm('Delete this model?')) return
        const res = await fetch(`/api/models/${id}`, { method: 'DELETE' })
        if (res.ok) setModels(prev => prev.filter(m => m.id !== id))
    }

    return (
        <div className="flex flex-col gap-8">

            {/* Upload card */}
            <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
                <div className="flex flex-col gap-1 p-6 border-b border-border">
                    <h2 className="text-base font-semibold leading-none tracking-tight">Upload Model</h2>
                    <p className="text-sm text-muted-foreground">Add a new 3D model to your library. Supports .glb, .gltf, .obj</p>
                </div>
                <form onSubmit={handleUpload} className="p-6 flex flex-col sm:flex-row gap-3 flex-wrap">
                    <input
                        ref={nameRef}
                        type="text"
                        placeholder="Model name"
                        required
                        className="flex h-9 w-full sm:max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <input
                        ref={categoryRef}
                        type="text"
                        placeholder="Category (optional)"
                        className="flex h-9 w-full sm:max-w-44 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".glb,.gltf,.obj"
                        required
                        className="flex h-9 w-full sm:flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm text-muted-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                    />
                    <button
                        type="submit"
                        disabled={uploading}
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md bg-primary text-primary-foreground text-sm font-medium h-9 px-4 shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                    >
                        {uploading ? 'Uploading…' : 'Upload'}
                    </button>
                </form>
            </div>

            {/* Models table card */}
            <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-base font-semibold leading-none tracking-tight">Models</h2>
                        <p className="text-sm text-muted-foreground">{models.length} {models.length === 1 ? 'model' : 'models'} total</p>
                    </div>
                </div>

                {models.length === 0 ? (
                    <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                        No models yet. Upload one above.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/50">
                                    <th className="h-10 px-6 text-left font-medium text-muted-foreground">Name</th>
                                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Category</th>
                                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Format</th>
                                    <th className="h-10 px-4 text-left font-medium text-muted-foreground">Added</th>
                                    <th className="h-10 px-6 text-right font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {models.map(model => (
                                    <tr key={model.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                                        <td className="px-6 py-3">
                                            {editingId === model.id ? (
                                                <input
                                                    value={editName}
                                                    onChange={e => setEditName(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') saveEdit(model.id)
                                                        if (e.key === 'Escape') setEditingId(null)
                                                    }}
                                                    autoFocus
                                                    className="flex h-7 w-full max-w-xs rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                />
                                            ) : (
                                                <span className="font-medium">{model.name}</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {editingId === model.id ? (
                                                <input
                                                    value={editCategory}
                                                    onChange={e => setEditCategory(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') saveEdit(model.id)
                                                        if (e.key === 'Escape') setEditingId(null)
                                                    }}
                                                    placeholder="Category"
                                                    className="flex h-7 w-full max-w-36 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                />
                                            ) : (
                                                <span className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                                    {model.category}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                                {model.format}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {new Date(model.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-3">
                                            <div className="flex items-center justify-end gap-2">
                                                {editingId === model.id ? (
                                                    <>
                                                        <button
                                                            onClick={() => saveEdit(model.id)}
                                                            className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-medium h-7 px-3 shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                        >
                                                            Save
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingId(null)}
                                                            className="inline-flex items-center justify-center rounded-md border border-border bg-background text-foreground text-xs font-medium h-7 px-3 shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => startEdit(model)}
                                                            className="inline-flex items-center justify-center rounded-md border border-border bg-background text-foreground text-xs font-medium h-7 px-3 shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(model.id)}
                                                            className="inline-flex items-center justify-center rounded-md bg-destructive text-destructive-foreground text-xs font-medium h-7 px-3 shadow-sm transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                        >
                                                            Delete
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
