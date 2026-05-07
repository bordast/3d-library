'use client'

import { useState, useRef } from 'react'
import { Spinner } from '@/components/ui/spinner'
import type { Model, Category } from '@/lib/db'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button, buttonVariants } from '@/components/ui/button'

export default function AdminClient({
    initialModels,
    initialCategories,
}: {
    initialModels: Model[]
    initialCategories: Category[]
}) {
    const [models, setModels] = useState<Model[]>(initialModels)
    const [categories, setCategories] = useState<Category[]>(initialCategories)

    // Upload state
    const [uploading, setUploading] = useState(false)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const nameRef = useRef<HTMLInputElement>(null)
    const categorySelectRef = useRef<HTMLSelectElement>(null)
    const fileRef = useRef<HTMLInputElement>(null)

    // Model edit state
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editName, setEditName] = useState('')
    const [editCategory, setEditCategory] = useState('')
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

    // Category state
    const [newCategoryName, setNewCategoryName] = useState('')
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
    const [editCategoryName, setEditCategoryName] = useState('')
    const [deleteCategoryTargetId, setDeleteCategoryTargetId] = useState<string | null>(null)
    const [categoryError, setCategoryError] = useState<string | null>(null)

    async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const form = e.currentTarget
        const name = nameRef.current?.value.trim()
        const file = fileRef.current?.files?.[0]
        if (!name || !file) return

        setUploading(true)
        setUploadError(null)
        const body = new FormData()
        body.append('name', name)
        const cat = categorySelectRef.current?.value
        if (cat) body.append('category', cat)
        body.append('file', file)

        try {
            const res = await fetch('/api/models', { method: 'POST', body })
            if (res.ok) {
                const model: Model = await res.json()
                setModels(prev => [model, ...prev])
                form.reset()
            } else if (res.status === 413) {
                setUploadError('File is too large. Try a smaller file or upload directly via the server.')
            } else {
                const data = await res.json().catch(() => ({}))
                setUploadError(data.error ?? `Upload failed (${res.status})`)
            }
        } catch {
            setUploadError('Network error — upload could not be completed.')
        } finally {
            setUploading(false)
        }
    }

    function startEdit(model: Model) {
        setEditingId(model.id)
        setEditName(model.name)
        setEditCategory(model.category)
    }

    async function saveEdit(id: string) {
        const trimmedName = editName.trim()
        if (!trimmedName) return
        const res = await fetch(`/api/models/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: trimmedName, category: editCategory }),
        })
        if (res.ok) {
            const updated: Model = await res.json()
            setModels(prev => prev.map(m => m.id === id ? updated : m))
        }
        setEditingId(null)
    }

    async function confirmDelete() {
        if (!deleteTargetId) return
        const id = deleteTargetId
        setDeleteTargetId(null)
        const res = await fetch(`/api/models/${id}`, { method: 'DELETE' })
        if (res.ok) setModels(prev => prev.filter(m => m.id !== id))
    }

    async function handleCreateCategory(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const name = newCategoryName.trim()
        if (!name) return
        setCategoryError(null)
        const res = await fetch('/api/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        })
        if (res.ok) {
            const cat: Category = await res.json()
            setCategories(prev => [...prev, cat])
            setNewCategoryName('')
        } else {
            const data = await res.json().catch(() => ({}))
            setCategoryError(data.error ?? 'Failed to create category')
        }
    }

    function startEditCategory(cat: Category) {
        setEditingCategoryId(cat.id)
        setEditCategoryName(cat.name)
    }

    async function saveEditCategory(id: string) {
        const name = editCategoryName.trim()
        if (!name) return
        const res = await fetch(`/api/categories/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        })
        if (res.ok) {
            const updated: Category = await res.json()
            const old = categories.find(c => c.id === id)
            setCategories(prev => prev.map(c => c.id === id ? updated : c))
            if (old) {
                setModels(prev => prev.map(m =>
                    m.category === old.name ? { ...m, category: updated.name } : m
                ))
            }
        }
        setEditingCategoryId(null)
    }

    async function confirmDeleteCategory() {
        if (!deleteCategoryTargetId) return
        const id = deleteCategoryTargetId
        const cat = categories.find(c => c.id === id)
        setDeleteCategoryTargetId(null)
        const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' })
        if (res.ok) {
            setCategories(prev => prev.filter(c => c.id !== id))
            if (cat) {
                setModels(prev => prev.map(m =>
                    m.category === cat.name ? { ...m, category: 'uncategorised' } : m
                ))
            }
        }
    }

    const inputCls = 'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'
    const selectCls = 'flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer'

    return (
        <>
        <div className="flex flex-col gap-8">

            {/* Categories card */}
            <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
                <div className="flex flex-col gap-1 p-6 border-b border-border">
                    <h2 className="text-base font-semibold leading-none tracking-tight">Categories</h2>
                    <p className="text-sm text-muted-foreground">Manage categories for organising your models.</p>
                </div>
                <div className="p-6 flex flex-col gap-4">
                    <form onSubmit={handleCreateCategory} className="flex gap-2">
                        <input
                            value={newCategoryName}
                            onChange={e => setNewCategoryName(e.target.value)}
                            type="text"
                            placeholder="New category name"
                            className={`${inputCls} max-w-xs`}
                        />
                        <Button type="submit" size="sm">Add</Button>
                    </form>
                    {categoryError && <p className="text-sm text-destructive">{categoryError}</p>}

                    {categories.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No categories yet. Add one above.</p>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {categories.map(cat => (
                                <div key={cat.id} className="flex items-center gap-2">
                                    {editingCategoryId === cat.id ? (
                                        <>
                                            <input
                                                value={editCategoryName}
                                                onChange={e => setEditCategoryName(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') saveEditCategory(cat.id)
                                                    if (e.key === 'Escape') setEditingCategoryId(null)
                                                }}
                                                autoFocus
                                                className="flex h-7 max-w-xs rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                            />
                                            <Button onClick={() => saveEditCategory(cat.id)} size="sm" className="h-7 text-xs px-3">Save</Button>
                                            <Button onClick={() => setEditingCategoryId(null)} variant="outline" size="sm" className="h-7 text-xs px-3">Cancel</Button>
                                        </>
                                    ) : (
                                        <>
                                            <span className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground min-w-24">
                                                {cat.name}
                                            </span>
                                            <Button onClick={() => startEditCategory(cat)} variant="outline" size="sm" className="h-7 text-xs px-3">Rename</Button>
                                            <Button onClick={() => setDeleteCategoryTargetId(cat.id)} variant="destructive" size="sm" className="h-7 text-xs px-3">Delete</Button>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

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
                        className={`${inputCls} sm:max-w-xs`}
                    />
                    <select ref={categorySelectRef} className={`${selectCls} sm:max-w-44`}>
                        <option value="">No category</option>
                        {categories.map(cat => (
                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                    </select>
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".glb,.gltf,.obj"
                        required
                        className="flex h-9 w-full sm:flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm text-muted-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                    />
                    <Button type="submit" disabled={uploading} size="sm">
                        {uploading ? (
                            <>
                                <Spinner className="mr-2" />
                                Uploading…
                            </>
                        ) : 'Upload'}
                    </Button>
                </form>
                {uploadError && (
                    <div className="px-6 pb-4 text-sm text-destructive">{uploadError}</div>
                )}
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
                                                <select
                                                    value={editCategory}
                                                    onChange={e => setEditCategory(e.target.value)}
                                                    className="flex h-7 max-w-36 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                                                >
                                                    <option value="uncategorised">uncategorised</option>
                                                    {categories.map(cat => (
                                                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                                                    ))}
                                                </select>
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
                                                        <Button onClick={() => saveEdit(model.id)} size="sm" className="h-7 text-xs px-3">Save</Button>
                                                        <Button onClick={() => setEditingId(null)} variant="outline" size="sm" className="h-7 text-xs px-3">Cancel</Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Button onClick={() => startEdit(model)} variant="outline" size="sm" className="h-7 text-xs px-3">Edit</Button>
                                                        <Button onClick={() => setDeleteTargetId(model.id)} variant="destructive" size="sm" className="h-7 text-xs px-3">Delete</Button>
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

        {/* Delete model dialog */}
        <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => { if (!open) setDeleteTargetId(null) }}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        {deleteTargetId && (() => {
                            const target = models.find(m => m.id === deleteTargetId)!
                            return <>
                                This permanently deletes{' '}
                                <span className="font-medium text-foreground">{target.name}</span>
                                , uploaded on{' '}
                                <span className="font-medium text-foreground">
                                    {new Date(target.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                                </span>
                                . This action cannot be undone.
                            </>
                        })()}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDelete} className={buttonVariants({ variant: 'destructive' })}>Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        {/* Delete category dialog */}
        <AlertDialog open={!!deleteCategoryTargetId} onOpenChange={(open) => { if (!open) setDeleteCategoryTargetId(null) }}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete category?</AlertDialogTitle>
                    <AlertDialogDescription>
                        {deleteCategoryTargetId && (() => {
                            const target = categories.find(c => c.id === deleteCategoryTargetId)!
                            const affected = models.filter(m => m.category === target.name).length
                            return <>
                                This will delete{' '}
                                <span className="font-medium text-foreground">{target.name}</span>.
                                {affected > 0 && (
                                    <> {affected} {affected === 1 ? 'model' : 'models'} will be set to uncategorised.</>
                                )}
                            </>
                        })()}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDeleteCategory} className={buttonVariants({ variant: 'destructive' })}>Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    )
}
