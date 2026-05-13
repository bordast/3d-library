'use client'

import { useState, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'

const ModelCanvas = dynamic(() => import('@/components/ModelCanvas'), { ssr: false })

import type { Model as ModelType } from '@/lib/db'

function ThumbnailGenerator({ models, onDone }: {
    models: ModelType[]
    onDone: (id: string, url: string | null) => void
}) {
    const model = models[0]
    if (!model) return null

    const handleCapture = async (dataUrl: string) => {
        try {
            const res = await fetch(`/api/models/${model.id}/thumbnail`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dataUrl }),
            })
            if (res.ok) {
                const data = await res.json()
                onDone(model.id, data.thumbnailUrl)
                return
            }
        } catch {
            // skip on error
        }
        onDone(model.id, null)
    }

    return (
        <div aria-hidden style={{ position: 'fixed', left: '-9999px', top: 0, width: 256, height: 256, pointerEvents: 'none' }}>
            <ModelCanvas key={model.id} url={model.fileUrl} captureOnLoad={handleCapture} />
        </div>
    )
}
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
    initialMissingMtl,
}: {
    initialModels: Model[]
    initialCategories: Category[]
    initialMissingMtl: string[]
}) {
    const [models, setModels] = useState<Model[]>(initialModels)
    const [categories, setCategories] = useState<Category[]>(initialCategories)
    const [missingMtl, setMissingMtl] = useState(() => new Set(initialMissingMtl))
    // Thumbnail generation
    const [genQueue, setGenQueue] = useState<Model[]>([])
    const [genProgress, setGenProgress] = useState({ done: 0, total: 0 })

    const missingThumbnails = models.filter(m => !m.thumbnailUrl).length

    function startThumbnailGeneration() {
        const pending = models.filter(m => !m.thumbnailUrl)
        if (!pending.length) return
        setGenProgress({ done: 0, total: pending.length })
        setGenQueue(pending)
    }

    const handleGenDone = useCallback((id: string, url: string | null) => {
        if (url) setModels(prev => prev.map(m => m.id === id ? { ...m, thumbnailUrl: url } : m))
        setGenQueue(prev => prev.slice(1))
        setGenProgress(prev => ({ ...prev, done: prev.done + 1 }))
    }, [])

    const [connectingMtlId, setConnectingMtlId] = useState<string | null>(null)
    const [mtlUploading, setMtlUploading] = useState(false)
    const mtlInputRef = useRef<HTMLInputElement>(null)

    const [uploadingTexturesId, setUploadingTexturesId] = useState<string | null>(null)
    const texturesInputRef = useRef<HTMLInputElement>(null)

    // Upload state
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState<number | null>(null)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [mtlStatus, setMtlStatus] = useState<'success' | 'error' | null>(null)
    const [textureStatus, setTextureStatus] = useState<'success' | 'error' | null>(null)
    const nameRef = useRef<HTMLInputElement>(null)
    const categorySelectRef = useRef<HTMLSelectElement>(null)
    const fileRef = useRef<HTMLInputElement>(null)

    const MAX_FILE_SIZE = 200 * 1024 * 1024

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
    const [resetConfirm, setResetConfirm] = useState(false)

    function handleUpload(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const form = e.currentTarget
        const name = nameRef.current?.value.trim()
        const file = fileRef.current?.files?.[0]
        if (!name || !file) return

        if (file.size > MAX_FILE_SIZE) {
            setUploadError('File exceeds 200 MB limit.')
            return
        }
        const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
        if (!['.glb', '.gltf', '.obj'].includes(ext)) {
            setUploadError('Only .glb, .gltf, and .obj files are supported.')
            return
        }

        const body = new FormData()
        body.append('name', name)
        const cat = categorySelectRef.current?.value
        if (cat) body.append('category', cat)
        body.append('file', file)

        setUploading(true)
        setUploadProgress(0)
        setUploadError(null)

        const xhr = new XMLHttpRequest()
        xhr.open('POST', '/api/models')
        xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100))
        }
        xhr.onload = () => {
            setUploading(false)
            setUploadProgress(null)
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const model: Model = JSON.parse(xhr.responseText)
                    setModels(prev => [model, ...prev])
                    form.reset()
                } catch {
                    setUploadError('Unexpected server response.')
                }
            } else {
                try {
                    const data = JSON.parse(xhr.responseText)
                    setUploadError(data.error ?? `Upload failed (${xhr.status})`)
                } catch {
                    setUploadError(`Upload failed (${xhr.status})`)
                }
            }
        }
        xhr.onerror = () => {
            setUploading(false)
            setUploadProgress(null)
            setUploadError('Network error — upload could not be completed.')
        }
        xhr.send(body)
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

    function openMtlPicker(modelId: string) {
        setConnectingMtlId(modelId)
        mtlInputRef.current?.click()
    }

    async function handleMtlFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file || !connectingMtlId) return
        setMtlUploading(true)
        setMtlStatus(null)
        try {
            const body = new FormData()
            body.append('file', file)
            const res = await fetch(`/api/models/${connectingMtlId}/mtl`, { method: 'POST', body })
            if (res.ok) {
                const id = connectingMtlId
                setMissingMtl(prev => { const next = new Set(prev); next.delete(id); return next })
                setMtlStatus('success')
            } else {
                setMtlStatus('error')
            }
        } catch {
            setMtlStatus('error')
        } finally {
            setMtlUploading(false)
            setConnectingMtlId(null)
            if (mtlInputRef.current) mtlInputRef.current.value = ''
            setTimeout(() => setMtlStatus(null), 3000)
        }
    }

    function openTexturesPicker(modelId: string) {
        setUploadingTexturesId(modelId)
        texturesInputRef.current?.click()
    }

    async function handleTexturesChosen(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files
        if (!files?.length || !uploadingTexturesId) return
        const id = uploadingTexturesId
        setUploadingTexturesId(id + '-loading')
        setTextureStatus(null)
        try {
            const body = new FormData()
            Array.from(files).forEach(f => body.append('files', f))
            const res = await fetch(`/api/models/${id}/textures`, { method: 'POST', body })
            setTextureStatus(res.ok ? 'success' : 'error')
        } catch {
            setTextureStatus('error')
        } finally {
            setUploadingTexturesId(null)
            if (texturesInputRef.current) texturesInputRef.current.value = ''
            setTimeout(() => setTextureStatus(null), 3000)
        }
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

    async function handleReset() {
        const res = await fetch('/api/admin/reset', { method: 'POST' })
        if (res.ok) {
            setModels([])
            setCategories([])
            setMissingMtl(new Set())
            setGenQueue([])
            setGenProgress({ done: 0, total: 0 })
        }
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
        <ThumbnailGenerator models={genQueue} onDone={handleGenDone} />
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
                                {uploadProgress !== null && uploadProgress < 100
                                    ? `Uploading… ${uploadProgress}%`
                                    : 'Processing…'}
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
                    {missingThumbnails > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={startThumbnailGeneration}
                            disabled={genQueue.length > 0}
                        >
                            {genQueue.length > 0
                                ? `Generating… ${genProgress.done}/${genProgress.total}`
                                : `Generate thumbnails (${missingThumbnails})`}
                        </Button>
                    )}
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
                                            <div className="flex flex-col gap-1">
                                                <span className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                                    {model.format}
                                                </span>
                                                {missingMtl.has(model.id) && (
                                                    <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                                                        MTL missing·
                                                        <button
                                                            onClick={() => openMtlPicker(model.id)}
                                                            disabled={mtlUploading && connectingMtlId === model.id}
                                                            className="underline underline-offset-2 hover:no-underline disabled:opacity-50"
                                                        >
                                                            {mtlUploading && connectingMtlId === model.id ? 'Uploading…' : 'Connect'}
                                                        </button>
                                                    </span>
                                                )}
                                                {model.format === '.gltf' && model.fileUrl.split('/').length >= 5 && (
                                                    <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                                        <button
                                                            onClick={() => openTexturesPicker(model.id)}
                                                            disabled={uploadingTexturesId === model.id + '-loading'}
                                                            className="underline underline-offset-2 hover:no-underline disabled:opacity-50"
                                                        >
                                                            {uploadingTexturesId === model.id + '-loading' ? 'Uploading…' : 'Textures'}
                                                        </button>
                                                    </span>
                                                )}
                                            </div>
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

            {/* Danger zone */}
            <div className="rounded-lg border border-destructive/30 bg-card text-card-foreground shadow-sm">
                <div className="flex items-center justify-between p-6">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-base font-semibold leading-none tracking-tight text-destructive">Danger zone</h2>
                        <p className="text-sm text-muted-foreground">Permanently delete all models, uploads, and thumbnails.</p>
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => setResetConfirm(true)}>
                        Reset library
                    </Button>
                </div>
            </div>
        </div>

        <input ref={mtlInputRef} type="file" accept=".mtl" className="hidden" onChange={handleMtlFileChosen} />
        <input ref={texturesInputRef} type="file" accept=".webp,.png,.jpg,.jpeg,.gif,.bmp,.ktx2,.basis,.bin,.glb" multiple className="hidden" onChange={handleTexturesChosen} />

        {mtlStatus && (
            <div className={`fixed bottom-4 right-4 z-50 rounded-md border px-4 py-2 text-sm shadow-md ${mtlStatus === 'success' ? 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400' : 'border-destructive/40 bg-destructive/10 text-destructive'}`}>
                {mtlStatus === 'success' ? 'MTL file uploaded' : 'MTL upload failed'}
            </div>
        )}
        {textureStatus && (
            <div className={`fixed bottom-4 right-4 z-50 rounded-md border px-4 py-2 text-sm shadow-md ${textureStatus === 'success' ? 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400' : 'border-destructive/40 bg-destructive/10 text-destructive'}`}>
                {textureStatus === 'success' ? 'Textures uploaded' : 'Texture upload failed'}
            </div>
        )}

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

        {/* Reset library dialog */}
        <AlertDialog open={resetConfirm} onOpenChange={setResetConfirm}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Reset the entire library?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This permanently deletes all {models.length} {models.length === 1 ? 'model' : 'models'}, their uploaded files, all generated thumbnails, and all categories. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleReset} className={buttonVariants({ variant: 'destructive' })}>Reset everything</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    )
}
