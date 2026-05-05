'use client'

import { useState, useRef } from 'react'
import type { Model } from '@/lib/db'

export default function AdminClient({ initialModels }: { initialModels: Model[] }) {
    const [models, setModels] = useState<Model[]>(initialModels)
    const [uploading, setUploading] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editName, setEditName] = useState('')
    const nameRef = useRef<HTMLInputElement>(null)
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
    }

    async function saveEdit(id: string) {
        const trimmed = editName.trim()
        if (!trimmed) return

        const res = await fetch(`/api/models/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: trimmed }),
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
        if (res.ok) {
            setModels(prev => prev.filter(m => m.id !== id))
        }
    }

    return (
        <div>
            <section>
                <h2>Upload Model</h2>
                <form onSubmit={handleUpload}>
                    <input ref={nameRef} type="text" placeholder="Model name" required />
                    <input ref={fileRef} type="file" accept=".glb,.gltf,.obj" required />
                    <button type="submit" disabled={uploading}>
                        {uploading ? 'Uploading…' : 'Upload'}
                    </button>
                </form>
            </section>

            <section>
                <h2>Models ({models.length})</h2>
                {models.length === 0 ? (
                    <p>No models yet.</p>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Format</th>
                                <th>Added</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {models.map(model => (
                                <tr key={model.id}>
                                    <td>
                                        {editingId === model.id ? (
                                            <input
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') saveEdit(model.id)
                                                    if (e.key === 'Escape') setEditingId(null)
                                                }}
                                                autoFocus
                                            />
                                        ) : (
                                            model.name
                                        )}
                                    </td>
                                    <td>{model.format}</td>
                                    <td>{new Date(model.createdAt).toLocaleDateString()}</td>
                                    <td>
                                        {editingId === model.id ? (
                                            <>
                                                <button onClick={() => saveEdit(model.id)}>Save</button>
                                                <button onClick={() => setEditingId(null)}>Cancel</button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={() => startEdit(model)}>Rename</button>
                                                <button onClick={() => handleDelete(model.id)}>Delete</button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>
        </div>
    )
}
