'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
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

const FRAME_POINTS = [0.1, 0.5, 0.9]

function VideoThumbnailCapture({ video, onDone, onCancel }: {
    video: Video
    onDone: (id: string, url: string | null) => void
    onCancel: () => void
}) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const captureIdxRef = useRef(0)
    const [frames, setFrames] = useState<string[]>([])
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        const vid = videoRef.current
        const canvas = canvasRef.current
        if (!vid || !canvas) return

        function grabFrame(): string {
            const ctx = canvas!.getContext('2d')!
            const vw = vid!.videoWidth, vh = vid!.videoHeight
            const size = Math.min(vw, vh)
            const sx = (vw - size) / 2, sy = (vh - size) / 2
            ctx.drawImage(vid!, sx, sy, size, size, 0, 0, 256, 256)
            return canvas!.toDataURL('image/webp', 0.85)
        }

        function onSeeked() {
            const idx = captureIdxRef.current
            const frame = grabFrame()
            setFrames(prev => [...prev, frame])
            const next = idx + 1
            captureIdxRef.current = next
            if (next < FRAME_POINTS.length) {
                vid!.currentTime = vid!.duration * FRAME_POINTS[next]
            }
        }

        function onLoaded() {
            captureIdxRef.current = 0
            setFrames([])
            vid!.currentTime = vid!.duration * FRAME_POINTS[0]
        }

        vid.addEventListener('loadedmetadata', onLoaded)
        vid.addEventListener('seeked', onSeeked)
        return () => {
            vid.removeEventListener('loadedmetadata', onLoaded)
            vid.removeEventListener('seeked', onSeeked)
        }
    }, [video.id])

    async function selectFrame(dataUrl: string) {
        setSaving(true)
        try {
            const res = await fetch(`/api/videos/${video.id}/thumbnail`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dataUrl }),
            })
            if (res.ok) {
                const data = await res.json()
                onDone(video.id, data.thumbnailUrl)
                return
            }
        } catch { /* fall through */ }
        setSaving(false)
        onDone(video.id, null)
    }

    const capturing = frames.length < FRAME_POINTS.length

    return (
        <>
            {/* Hidden video + canvas for frame extraction */}
            <div aria-hidden style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none' }}>
                <video ref={videoRef} src={video.sourceUrl} muted playsInline preload="metadata" style={{ width: 256, height: 256 }} />
                <canvas ref={canvasRef} width={256} height={256} />
            </div>

            {/* Frame picker modal */}
            <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={!saving ? onCancel : undefined} />
                <div className="relative z-10 w-full sm:max-w-lg sm:rounded-xl border-t sm:border border-border bg-card shadow-2xl flex flex-col overflow-hidden">

                    <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0">
                        <div>
                            <h2 className="text-base font-semibold">Choose a thumbnail</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">{video.name}</p>
                        </div>
                        <button
                            onClick={onCancel}
                            disabled={saving}
                            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40"
                            aria-label="Close"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                                <path d="M18 6 6 18M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="border-t border-border" />

                    {capturing ? (
                        <div className="flex flex-col items-center justify-center gap-3 py-12 text-sm text-muted-foreground">
                            <Spinner className="size-5" />
                            Capturing frames… {frames.length}/{FRAME_POINTS.length}
                        </div>
                    ) : (
                        <div className="p-6 flex flex-col gap-4">
                            <p className="text-sm text-muted-foreground">Click a frame to use it as the thumbnail.</p>
                            <div className="grid grid-cols-3 gap-3">
                                {frames.map((frame, i) => (
                                    <button
                                        key={i}
                                        onClick={() => !saving && selectFrame(frame)}
                                        disabled={saving}
                                        className="relative rounded-lg overflow-hidden border-2 border-transparent hover:border-primary focus-visible:border-primary transition-colors aspect-square disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <img src={frame} alt={`Frame ${i + 1}`} className="w-full h-full object-cover" />
                                        <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                                            {Math.round(FRAME_POINTS[i] * 100)}%
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-end px-6 py-4 border-t border-border">
                        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>Cancel</Button>
                    </div>
                </div>
            </div>
        </>
    )
}

import { Spinner } from '@/components/ui/spinner'
import type { Model, Category } from '@/lib/db'
import type { Video, VideoCategory } from '@/lib/videodb'
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
    initialVideos,
    initialVideoCategories,
}: {
    initialModels: Model[]
    initialCategories: Category[]
    initialVideos: Video[]
    initialVideoCategories: VideoCategory[]
}) {
    // ─── Tab ───────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState<'models' | 'videos'>('models')

    // ─── Models state ──────────────────────────────────────
    const [models, setModels] = useState<Model[]>(initialModels)
    const [categories, setCategories] = useState<Category[]>(initialCategories)

    const [genQueue, setGenQueue] = useState<Model[]>([])
    const generatingIds = new Set(genQueue.map(m => m.id))

    const [uploadOpen, setUploadOpen] = useState(false)
    const [modalStep, setModalStep] = useState<1 | 2 | 3>(1)
    const [pendingModel, setPendingModel] = useState<Model | null>(null)
    const pendingModelRef = useRef<Model | null>(null)
    const [modalThumbnailDone, setModalThumbnailDone] = useState(false)
    const [modalThumbnailRendering, setModalThumbnailRendering] = useState(false)

    function queueThumbnail(model: Model) {
        if (generatingIds.has(model.id)) return
        setGenQueue(prev => [...prev, model])
    }

    const handleGenDone = useCallback((id: string, url: string | null) => {
        if (url) setModels(prev => prev.map(m => m.id === id ? { ...m, thumbnailUrl: url } : m))
        setGenQueue(prev => prev.slice(1))
        if (pendingModelRef.current?.id === id) {
            setModalThumbnailDone(true)
            setModalThumbnailRendering(false)
        }
    }, [])

    const [uploadingTexturesId, setUploadingTexturesId] = useState<string | null>(null)
    const texturesInputRef = useRef<HTMLInputElement>(null)

    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState<number | null>(null)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [textureStatus, setTextureStatus] = useState<'success' | 'error' | null>(null)
    const [uploadedTexturesIds, setUploadedTexturesIds] = useState<Set<string>>(new Set())
    const nameRef = useRef<HTMLInputElement>(null)
    const categorySelectRef = useRef<HTMLSelectElement>(null)
    const fileRef = useRef<HTMLInputElement>(null)

    const MAX_FILE_SIZE = 200 * 1024 * 1024

    const [editingId, setEditingId] = useState<string | null>(null)
    const [editName, setEditName] = useState('')
    const [editCategory, setEditCategory] = useState('')
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

    const [newCategoryName, setNewCategoryName] = useState('')
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
    const [editCategoryName, setEditCategoryName] = useState('')
    const [deleteCategoryTargetId, setDeleteCategoryTargetId] = useState<string | null>(null)
    const [categoryError, setCategoryError] = useState<string | null>(null)
    const [resetConfirm, setResetConfirm] = useState(false)

    // ─── Videos state ──────────────────────────────────────
    const [videos, setVideos] = useState<Video[]>(initialVideos)
    const [videoCategories, setVideoCategories] = useState<VideoCategory[]>(initialVideoCategories)

    const [videoModalOpen, setVideoModalOpen] = useState(false)
    const [videoModalStep, setVideoModalStep] = useState<1 | 2>(1)
    const [videoModalSourceType, setVideoModalSourceType] = useState<'youtube' | 'vimeo' | 'upload' | null>(null)
    const [videoUploading, setVideoUploading] = useState(false)
    const [videoUploadProgress, setVideoUploadProgress] = useState<number | null>(null)
    const [videoUploadError, setVideoUploadError] = useState<string | null>(null)

    const [editingVideoId, setEditingVideoId] = useState<string | null>(null)
    const [editVideoName, setEditVideoName] = useState('')
    const [editVideoCategory, setEditVideoCategory] = useState('')
    const [deleteVideoTargetId, setDeleteVideoTargetId] = useState<string | null>(null)

    const [newVideoCategoryName, setNewVideoCategoryName] = useState('')
    const [editingVideoCategoryId, setEditingVideoCategoryId] = useState<string | null>(null)
    const [editVideoCategoryName, setEditVideoCategoryName] = useState('')
    const [deleteVideoCategoryTargetId, setDeleteVideoCategoryTargetId] = useState<string | null>(null)
    const [videoCategoryError, setVideoCategoryError] = useState<string | null>(null)

    const videoNameRef = useRef<HTMLInputElement>(null)
    const videoUrlRef = useRef<HTMLInputElement>(null)
    const videoCategorySelectRef = useRef<HTMLSelectElement>(null)
    const videoFileRef = useRef<HTMLInputElement>(null)
    const videoFileNameRef = useRef<HTMLInputElement>(null)
    const videoFileCategorySelectRef = useRef<HTMLSelectElement>(null)

    // Single video being captured at a time (user must pick a frame before starting another)
    const [capturingVideo, setCapturingVideo] = useState<Video | null>(null)

    const handleVideoCaptureDone = useCallback((id: string, url: string | null) => {
        if (url) setVideos(prev => prev.map(v => v.id === id ? { ...v, thumbnailUrl: url } : v))
        setCapturingVideo(null)
    }, [])

    // ─── Model handlers ────────────────────────────────────

    function openUploadModal() {
        setUploadOpen(true)
        setModalStep(1)
        setPendingModel(null)
        pendingModelRef.current = null
        setModalThumbnailDone(false)
        setModalThumbnailRendering(false)
        setUploadError(null)
    }

    function closeUploadModal() {
        setUploadOpen(false)
    }

    function startModalThumbnail() {
        if (!pendingModel || modalThumbnailRendering || modalThumbnailDone) return
        setModalThumbnailRendering(true)
        setGenQueue(prev => [...prev, pendingModel])
    }

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
        if (!['.glb', '.gltf'].includes(ext)) {
            setUploadError('Only .glb and .gltf files are supported.')
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
                    setPendingModel(model)
                    pendingModelRef.current = model
                    setModalStep(model.format === '.gltf' ? 2 : 3)
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
            if (res.ok) {
                setTextureStatus('success')
                setUploadedTexturesIds(prev => new Set(prev).add(id))
                if (pendingModelRef.current?.id === id) {
                    setModalStep(3)
                }
            } else {
                setTextureStatus('error')
            }
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
            setGenQueue([])
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

    // ─── Video handlers ────────────────────────────────────

    function openVideoModal() {
        setVideoModalOpen(true)
        setVideoModalStep(1)
        setVideoModalSourceType(null)
        setVideoUploadError(null)
        setVideoUploading(false)
        setVideoUploadProgress(null)
    }

    function closeVideoModal() {
        setVideoModalOpen(false)
    }

    async function handleVideoUrlSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const name = videoNameRef.current?.value.trim()
        const url = videoUrlRef.current?.value.trim()
        const category = videoCategorySelectRef.current?.value || undefined
        if (!name || !url) return
        setVideoUploadError(null)
        setVideoUploading(true)
        try {
            const res = await fetch('/api/videos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, url, category }),
            })
            if (res.ok) {
                const video: Video = await res.json()
                setVideos(prev => [video, ...prev])
                closeVideoModal()
            } else {
                const data = await res.json().catch(() => ({}))
                setVideoUploadError(data.error ?? 'Failed to add video')
            }
        } catch {
            setVideoUploadError('Network error')
        } finally {
            setVideoUploading(false)
        }
    }

    function handleVideoFileUpload(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const name = videoFileNameRef.current?.value.trim()
        const file = videoFileRef.current?.files?.[0]
        if (!name || !file) return

        const MAX_VIDEO_SIZE = 500 * 1024 * 1024
        if (file.size > MAX_VIDEO_SIZE) {
            setVideoUploadError('File exceeds 500 MB limit.')
            return
        }
        const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
        if (!['.mp4', '.webm'].includes(ext)) {
            setVideoUploadError('Only .mp4 and .webm files are allowed.')
            return
        }

        const body = new FormData()
        body.append('name', name)
        const cat = videoFileCategorySelectRef.current?.value
        if (cat) body.append('category', cat)
        body.append('file', file)

        setVideoUploading(true)
        setVideoUploadProgress(0)
        setVideoUploadError(null)

        const xhr = new XMLHttpRequest()
        xhr.open('POST', '/api/videos')
        xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable) setVideoUploadProgress(Math.round((ev.loaded / ev.total) * 100))
        }
        xhr.onload = () => {
            setVideoUploading(false)
            setVideoUploadProgress(null)
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const video: Video = JSON.parse(xhr.responseText)
                    setVideos(prev => [video, ...prev])
                    closeVideoModal()
                } catch {
                    setVideoUploadError('Unexpected server response.')
                }
            } else {
                try {
                    const data = JSON.parse(xhr.responseText)
                    setVideoUploadError(data.error ?? `Upload failed (${xhr.status})`)
                } catch {
                    setVideoUploadError(`Upload failed (${xhr.status})`)
                }
            }
        }
        xhr.onerror = () => {
            setVideoUploading(false)
            setVideoUploadProgress(null)
            setVideoUploadError('Network error — upload could not be completed.')
        }
        xhr.send(body)
    }

    function startEditVideo(video: Video) {
        setEditingVideoId(video.id)
        setEditVideoName(video.name)
        setEditVideoCategory(video.category)
    }

    async function saveEditVideo(id: string) {
        const trimmedName = editVideoName.trim()
        if (!trimmedName) return
        const res = await fetch(`/api/videos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: trimmedName, category: editVideoCategory }),
        })
        if (res.ok) {
            const updated: Video = await res.json()
            setVideos(prev => prev.map(v => v.id === id ? updated : v))
        }
        setEditingVideoId(null)
    }

    async function confirmDeleteVideo() {
        if (!deleteVideoTargetId) return
        const id = deleteVideoTargetId
        setDeleteVideoTargetId(null)
        const res = await fetch(`/api/videos/${id}`, { method: 'DELETE' })
        if (res.ok) setVideos(prev => prev.filter(v => v.id !== id))
    }

    async function handleCreateVideoCategory(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const name = newVideoCategoryName.trim()
        if (!name) return
        setVideoCategoryError(null)
        const res = await fetch('/api/videos/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        })
        if (res.ok) {
            const cat: VideoCategory = await res.json()
            setVideoCategories(prev => [...prev, cat])
            setNewVideoCategoryName('')
        } else {
            const data = await res.json().catch(() => ({}))
            setVideoCategoryError(data.error ?? 'Failed to create category')
        }
    }

    function startEditVideoCategory(cat: VideoCategory) {
        setEditingVideoCategoryId(cat.id)
        setEditVideoCategoryName(cat.name)
    }

    async function saveEditVideoCategory(id: string) {
        const name = editVideoCategoryName.trim()
        if (!name) return
        const res = await fetch(`/api/videos/categories/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        })
        if (res.ok) {
            const updated: VideoCategory = await res.json()
            const old = videoCategories.find(c => c.id === id)
            setVideoCategories(prev => prev.map(c => c.id === id ? updated : c))
            if (old) {
                setVideos(prev => prev.map(v =>
                    v.category === old.name ? { ...v, category: updated.name } : v
                ))
            }
        }
        setEditingVideoCategoryId(null)
    }

    async function confirmDeleteVideoCategory() {
        if (!deleteVideoCategoryTargetId) return
        const id = deleteVideoCategoryTargetId
        const cat = videoCategories.find(c => c.id === id)
        setDeleteVideoCategoryTargetId(null)
        const res = await fetch(`/api/videos/categories/${id}`, { method: 'DELETE' })
        if (res.ok) {
            setVideoCategories(prev => prev.filter(c => c.id !== id))
            if (cat) {
                setVideos(prev => prev.map(v =>
                    v.category === cat.name ? { ...v, category: 'uncategorised' } : v
                ))
            }
        }
    }

    // ─── Shared styles ─────────────────────────────────────
    const inputCls = 'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'
    const selectCls = 'flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer'

    const STEPS = [
        { n: 1 as const, label: 'Model file' },
        { n: 2 as const, label: 'Textures' },
        { n: 3 as const, label: 'Thumbnail' },
    ]

    const currentThumbnailUrl = models.find(m => m.id === pendingModel?.id)?.thumbnailUrl

    const SOURCE_TYPE_LABELS: Record<Video['sourceType'], string> = {
        youtube: 'YouTube',
        vimeo: 'Vimeo',
        upload: 'Upload',
    }

    return (
        <>
            <ThumbnailGenerator models={genQueue} onDone={handleGenDone} />
            {capturingVideo && (
                <VideoThumbnailCapture
                    video={capturingVideo}
                    onDone={handleVideoCaptureDone}
                    onCancel={() => setCapturingVideo(null)}
                />
            )}

            {/* ─── Model upload modal ──────────────────────────── */}
            {uploadOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={!uploading && !modalThumbnailRendering ? closeUploadModal : undefined} />
                    <div className="relative z-10 w-full sm:max-w-md sm:rounded-xl border-t sm:border border-border bg-card shadow-2xl flex flex-col overflow-hidden">

                        <div className="flex items-center justify-between px-6 pt-5 pb-0 shrink-0">
                            <h2 className="text-base font-semibold">Upload model</h2>
                            <button
                                onClick={closeUploadModal}
                                disabled={uploading || modalThumbnailRendering || uploadingTexturesId?.endsWith('-loading')}
                                className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:pointer-events-none"
                                aria-label="Close"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                                    <path d="M18 6 6 18M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="flex items-start px-6 pt-5 pb-4 gap-0">
                            {STEPS.map((step, i) => (
                                <div key={step.n} className="flex items-center flex-1 last:flex-none">
                                    <div className="flex flex-col items-center gap-1 shrink-0">
                                        <div className={[
                                            'size-6 rounded-full text-[11px] font-semibold flex items-center justify-center transition-colors',
                                            modalStep === step.n
                                                ? 'bg-primary text-primary-foreground'
                                                : modalStep > step.n
                                                    ? 'bg-primary/20 text-primary'
                                                    : 'bg-muted text-muted-foreground',
                                        ].join(' ')}>
                                            {modalStep > step.n ? '✓' : step.n}
                                        </div>
                                        <span className={[
                                            'text-[10px] font-medium whitespace-nowrap',
                                            modalStep === step.n ? 'text-foreground' : 'text-muted-foreground',
                                        ].join(' ')}>{step.label}</span>
                                    </div>
                                    {i < STEPS.length - 1 && (
                                        <div className={[
                                            'flex-1 h-px mx-2 mb-4 transition-colors',
                                            modalStep > step.n ? 'bg-primary/40' : 'bg-border',
                                        ].join(' ')} />
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="border-t border-border" />

                        {modalStep === 1 && (
                            <form onSubmit={handleUpload} className="flex flex-col">
                                <div className="flex flex-col gap-4 p-6">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-medium">Name</label>
                                        <input ref={nameRef} type="text" placeholder="Model name" required className={inputCls} />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-medium">Category</label>
                                        <select ref={categorySelectRef} className={`${selectCls} w-full`}>
                                            <option value="">No category</option>
                                            {categories.map(cat => (
                                                <option key={cat.id} value={cat.name}>{cat.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-medium">
                                            File <span className="text-muted-foreground font-normal">.glb, .gltf</span>
                                        </label>
                                        <input
                                            ref={fileRef}
                                            type="file"
                                            accept=".glb,.gltf"
                                            required
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm text-muted-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                                        />
                                    </div>
                                    {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
                                </div>
                                <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
                                    <Button type="button" variant="ghost" onClick={closeUploadModal} disabled={uploading}>Cancel</Button>
                                    <Button type="submit" disabled={uploading}>
                                        {uploading ? (
                                            <>
                                                <Spinner className="mr-2 size-3.5" />
                                                {uploadProgress !== null && uploadProgress < 100 ? `Uploading… ${uploadProgress}%` : 'Processing…'}
                                            </>
                                        ) : 'Upload'}
                                    </Button>
                                </div>
                            </form>
                        )}

                        {modalStep === 2 && pendingModel && (
                            <div className="flex flex-col">
                                <div className="flex flex-col gap-3 p-6">
                                    <p className="text-sm text-muted-foreground">
                                        Upload the texture images and{' '}
                                        <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">.bin</code>{' '}
                                        buffer files referenced by <span className="font-medium text-foreground">{pendingModel.name}</span>.
                                    </p>
                                    {textureStatus === 'error' && (
                                        <p className="text-sm text-destructive">Upload failed. Please try again.</p>
                                    )}
                                </div>
                                <div className="flex items-center justify-end px-6 py-4 border-t border-border">
                                    <Button
                                        onClick={() => openTexturesPicker(pendingModel.id)}
                                        disabled={uploadingTexturesId === pendingModel.id + '-loading'}
                                    >
                                        {uploadingTexturesId === pendingModel.id + '-loading' ? (
                                            <><Spinner className="mr-2 size-3.5" />Uploading…</>
                                        ) : 'Choose files'}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {modalStep === 3 && pendingModel && (
                            <div className="flex flex-col">
                                {modalThumbnailDone ? (
                                    <>
                                        <div className="flex items-center gap-3 p-6">
                                            {currentThumbnailUrl && (
                                                <img
                                                    src={currentThumbnailUrl}
                                                    alt=""
                                                    className="size-14 rounded-lg border border-border object-cover shrink-0"
                                                />
                                            )}
                                            <p className="text-sm">
                                                <span className="font-medium">{pendingModel.name}</span>
                                                <span className="text-muted-foreground"> is ready.</span>
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-end px-6 py-4 border-t border-border">
                                            <Button onClick={closeUploadModal}>Done</Button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex flex-col gap-3 p-6">
                                            <div className="flex justify-end">
                                                <button
                                                    onClick={closeUploadModal}
                                                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                                >
                                                    Skip
                                                </button>
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                Render a thumbnail for <span className="font-medium text-foreground">{pendingModel.name}</span>.
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-end px-6 py-4 border-t border-border">
                                            <Button onClick={startModalThumbnail} disabled={modalThumbnailRendering}>
                                                {modalThumbnailRendering ? (
                                                    <><Spinner className="mr-2 size-3.5" />Rendering…</>
                                                ) : 'Render thumbnail'}
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ─── Video add modal ─────────────────────────────── */}
            {videoModalOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={!videoUploading ? closeVideoModal : undefined} />
                    <div className="relative z-10 w-full sm:max-w-md sm:rounded-xl border-t sm:border border-border bg-card shadow-2xl flex flex-col overflow-hidden">

                        <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0">
                            <h2 className="text-base font-semibold">Add video</h2>
                            <button
                                onClick={closeVideoModal}
                                disabled={videoUploading}
                                className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:pointer-events-none"
                                aria-label="Close"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                                    <path d="M18 6 6 18M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="border-t border-border" />

                        {/* Step 1: source type picker */}
                        {videoModalStep === 1 && (
                            <div className="flex flex-col gap-3 p-6">
                                <p className="text-sm text-muted-foreground">Choose how you want to add a video.</p>
                                <div className="flex flex-col gap-2">
                                    {([
                                        { type: 'youtube' as const, label: 'YouTube URL', desc: 'Paste a youtube.com or youtu.be link' },
                                        { type: 'vimeo' as const, label: 'Vimeo URL', desc: 'Paste a vimeo.com link' },
                                        { type: 'upload' as const, label: 'Upload file', desc: 'Upload an .mp4 or .webm file (max 500 MB)' },
                                    ]).map(({ type, label, desc }) => (
                                        <button
                                            key={type}
                                            onClick={() => { setVideoModalSourceType(type); setVideoModalStep(2); setVideoUploadError(null) }}
                                            className="flex items-start gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:bg-accent/50"
                                        >
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-sm font-medium">{label}</span>
                                                <span className="text-xs text-muted-foreground">{desc}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Step 2: URL form */}
                        {videoModalStep === 2 && (videoModalSourceType === 'youtube' || videoModalSourceType === 'vimeo') && (
                            <form onSubmit={handleVideoUrlSubmit} className="flex flex-col">
                                <div className="flex flex-col gap-4 p-6">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-medium">Name</label>
                                        <input ref={videoNameRef} type="text" placeholder="Video name" required className={inputCls} />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-medium">
                                            {videoModalSourceType === 'youtube' ? 'YouTube' : 'Vimeo'} URL
                                        </label>
                                        <input
                                            ref={videoUrlRef}
                                            type="url"
                                            placeholder={videoModalSourceType === 'youtube' ? 'https://www.youtube.com/watch?v=…' : 'https://vimeo.com/…'}
                                            required
                                            className={inputCls}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-medium">Category</label>
                                        <select ref={videoCategorySelectRef} className={`${selectCls} w-full`}>
                                            <option value="">No category</option>
                                            {videoCategories.map(cat => (
                                                <option key={cat.id} value={cat.name}>{cat.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {videoUploadError && <p className="text-sm text-destructive">{videoUploadError}</p>}
                                </div>
                                <div className="flex items-center justify-between px-6 py-4 border-t border-border">
                                    <button type="button" onClick={() => setVideoModalStep(1)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Back</button>
                                    <div className="flex gap-2">
                                        <Button type="button" variant="ghost" onClick={closeVideoModal} disabled={videoUploading}>Cancel</Button>
                                        <Button type="submit" disabled={videoUploading}>
                                            {videoUploading ? <><Spinner className="mr-2 size-3.5" />Adding…</> : 'Add video'}
                                        </Button>
                                    </div>
                                </div>
                            </form>
                        )}

                        {/* Step 2: file upload form */}
                        {videoModalStep === 2 && videoModalSourceType === 'upload' && (
                            <form onSubmit={handleVideoFileUpload} className="flex flex-col">
                                <div className="flex flex-col gap-4 p-6">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-medium">Name</label>
                                        <input ref={videoFileNameRef} type="text" placeholder="Video name" required className={inputCls} />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-medium">Category</label>
                                        <select ref={videoFileCategorySelectRef} className={`${selectCls} w-full`}>
                                            <option value="">No category</option>
                                            {videoCategories.map(cat => (
                                                <option key={cat.id} value={cat.name}>{cat.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-sm font-medium">
                                            File <span className="text-muted-foreground font-normal">.mp4, .webm</span>
                                        </label>
                                        <input
                                            ref={videoFileRef}
                                            type="file"
                                            accept=".mp4,.webm"
                                            required
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm text-muted-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                                        />
                                    </div>
                                    {videoUploadError && <p className="text-sm text-destructive">{videoUploadError}</p>}
                                </div>
                                <div className="flex items-center justify-between px-6 py-4 border-t border-border">
                                    <button type="button" onClick={() => setVideoModalStep(1)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Back</button>
                                    <div className="flex gap-2">
                                        <Button type="button" variant="ghost" onClick={closeVideoModal} disabled={videoUploading}>Cancel</Button>
                                        <Button type="submit" disabled={videoUploading}>
                                            {videoUploading ? (
                                                <>
                                                    <Spinner className="mr-2 size-3.5" />
                                                    {videoUploadProgress !== null && videoUploadProgress < 100 ? `Uploading… ${videoUploadProgress}%` : 'Processing…'}
                                                </>
                                            ) : 'Upload'}
                                        </Button>
                                    </div>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* ─── Tab switcher ─────────────────────────────────── */}
            <div className="flex gap-1 mb-8 border-b border-border">
                {(['models', 'videos'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={[
                            'px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px',
                            activeTab === tab
                                ? 'border-primary text-foreground'
                                : 'border-transparent text-muted-foreground hover:text-foreground',
                        ].join(' ')}
                    >
                        {tab === 'models' ? 'Models' : 'Videos'}
                    </button>
                ))}
            </div>

            {/* ─── Models tab ───────────────────────────────────── */}
            {activeTab === 'models' && (
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

                    {/* Models table card */}
                    <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
                        <div className="flex items-center justify-between p-6 border-b border-border">
                            <div className="flex flex-col gap-1">
                                <h2 className="text-base font-semibold leading-none tracking-tight">Models</h2>
                                <p className="text-sm text-muted-foreground">{models.length} {models.length === 1 ? 'model' : 'models'} total</p>
                            </div>
                            <Button size="sm" onClick={openUploadModal}>Upload model</Button>
                        </div>

                        {models.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
                                <span>No models yet.</span>
                                <Button size="sm" variant="outline" onClick={openUploadModal}>Upload your first model</Button>
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
                                            <th className="h-10 px-4 text-left font-medium text-muted-foreground">Thumbnail</th>
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
                                                        {model.format === '.gltf' && model.fileUrl.split('/').length >= 5 && (
                                                            <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                                                <button
                                                                    onClick={() => openTexturesPicker(model.id)}
                                                                    disabled={uploadingTexturesId === model.id + '-loading'}
                                                                    className="underline underline-offset-2 hover:no-underline disabled:opacity-50"
                                                                >
                                                                    {uploadingTexturesId === model.id + '-loading' ? 'Uploading…' : 'Textures & .bin'}
                                                                </button>
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {new Date(model.createdAt).toLocaleDateString()}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        {model.thumbnailUrl ? (
                                                            <img
                                                                src={model.thumbnailUrl}
                                                                alt=""
                                                                className="size-8 rounded object-cover shrink-0 border border-border"
                                                            />
                                                        ) : (
                                                            <div className="size-8 rounded bg-muted shrink-0 border border-border" />
                                                        )}
                                                        {generatingIds.has(model.id) ? (
                                                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                                                <Spinner className="size-3 shrink-0" />
                                                                Rendering…
                                                            </span>
                                                        ) : model.format === '.gltf' && model.fileUrl.split('/').length >= 5 && !model.thumbnailUrl && !uploadedTexturesIds.has(model.id) ? (
                                                            <button
                                                                onClick={() => openTexturesPicker(model.id)}
                                                                disabled={uploadingTexturesId === model.id + '-loading'}
                                                                className="text-xs text-muted-foreground underline underline-offset-2 hover:no-underline hover:text-foreground transition-colors disabled:opacity-50"
                                                            >
                                                                {uploadingTexturesId === model.id + '-loading' ? 'Uploading…' : 'Upload textures & .bin'}
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => queueThumbnail(model)}
                                                                className="text-xs text-muted-foreground underline underline-offset-2 hover:no-underline hover:text-foreground transition-colors"
                                                            >
                                                                {model.thumbnailUrl ? 'Regenerate' : 'Render'}
                                                            </button>
                                                        )}
                                                    </div>
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
            )}

            {/* ─── Videos tab ───────────────────────────────────── */}
            {activeTab === 'videos' && (
                <div className="flex flex-col gap-8">

                    {/* Video categories card */}
                    <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
                        <div className="flex flex-col gap-1 p-6 border-b border-border">
                            <h2 className="text-base font-semibold leading-none tracking-tight">Categories</h2>
                            <p className="text-sm text-muted-foreground">Manage categories for organising your videos.</p>
                        </div>
                        <div className="p-6 flex flex-col gap-4">
                            <form onSubmit={handleCreateVideoCategory} className="flex gap-2">
                                <input
                                    value={newVideoCategoryName}
                                    onChange={e => setNewVideoCategoryName(e.target.value)}
                                    type="text"
                                    placeholder="New category name"
                                    className={`${inputCls} max-w-xs`}
                                />
                                <Button type="submit" size="sm">Add</Button>
                            </form>
                            {videoCategoryError && <p className="text-sm text-destructive">{videoCategoryError}</p>}

                            {videoCategories.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No categories yet. Add one above.</p>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {videoCategories.map(cat => (
                                        <div key={cat.id} className="flex items-center gap-2">
                                            {editingVideoCategoryId === cat.id ? (
                                                <>
                                                    <input
                                                        value={editVideoCategoryName}
                                                        onChange={e => setEditVideoCategoryName(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') saveEditVideoCategory(cat.id)
                                                            if (e.key === 'Escape') setEditingVideoCategoryId(null)
                                                        }}
                                                        autoFocus
                                                        className="flex h-7 max-w-xs rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                    />
                                                    <Button onClick={() => saveEditVideoCategory(cat.id)} size="sm" className="h-7 text-xs px-3">Save</Button>
                                                    <Button onClick={() => setEditingVideoCategoryId(null)} variant="outline" size="sm" className="h-7 text-xs px-3">Cancel</Button>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground min-w-24">
                                                        {cat.name}
                                                    </span>
                                                    <Button onClick={() => startEditVideoCategory(cat)} variant="outline" size="sm" className="h-7 text-xs px-3">Rename</Button>
                                                    <Button onClick={() => setDeleteVideoCategoryTargetId(cat.id)} variant="destructive" size="sm" className="h-7 text-xs px-3">Delete</Button>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Videos table card */}
                    <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
                        <div className="flex items-center justify-between p-6 border-b border-border">
                            <div className="flex flex-col gap-1">
                                <h2 className="text-base font-semibold leading-none tracking-tight">Videos</h2>
                                <p className="text-sm text-muted-foreground">{videos.length} {videos.length === 1 ? 'video' : 'videos'} total</p>
                            </div>
                            <Button size="sm" onClick={openVideoModal}>Add video</Button>
                        </div>

                        {videos.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
                                <span>No videos yet.</span>
                                <Button size="sm" variant="outline" onClick={openVideoModal}>Add your first video</Button>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border bg-muted/50">
                                            <th className="h-10 px-6 text-left font-medium text-muted-foreground">Name</th>
                                            <th className="h-10 px-4 text-left font-medium text-muted-foreground">Category</th>
                                            <th className="h-10 px-4 text-left font-medium text-muted-foreground">Source</th>
                                            <th className="h-10 px-4 text-left font-medium text-muted-foreground">URL / Path</th>
                                            <th className="h-10 px-4 text-left font-medium text-muted-foreground">Thumbnail</th>
                                            <th className="h-10 px-4 text-left font-medium text-muted-foreground">Added</th>
                                            <th className="h-10 px-6 text-right font-medium text-muted-foreground">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {videos.map(video => (
                                            <tr key={video.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                                                <td className="px-6 py-3">
                                                    {editingVideoId === video.id ? (
                                                        <input
                                                            value={editVideoName}
                                                            onChange={e => setEditVideoName(e.target.value)}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') saveEditVideo(video.id)
                                                                if (e.key === 'Escape') setEditingVideoId(null)
                                                            }}
                                                            autoFocus
                                                            className="flex h-7 w-full max-w-xs rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                        />
                                                    ) : (
                                                        <span className="font-medium">{video.name}</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {editingVideoId === video.id ? (
                                                        <select
                                                            value={editVideoCategory}
                                                            onChange={e => setEditVideoCategory(e.target.value)}
                                                            className="flex h-7 max-w-36 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                                                        >
                                                            <option value="uncategorised">uncategorised</option>
                                                            {videoCategories.map(cat => (
                                                                <option key={cat.id} value={cat.name}>{cat.name}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <span className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                                            {video.category}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                                        {SOURCE_TYPE_LABELS[video.sourceType]}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground max-w-48">
                                                    <span className="truncate block text-xs" title={video.sourceUrl}>
                                                        {video.sourceUrl.length > 40 ? video.sourceUrl.slice(0, 40) + '…' : video.sourceUrl}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        {video.thumbnailUrl ? (
                                                            <img
                                                                src={video.thumbnailUrl}
                                                                alt=""
                                                                className="size-8 rounded object-cover shrink-0 border border-border"
                                                            />
                                                        ) : (
                                                            <div className="size-8 rounded bg-muted shrink-0 border border-border" />
                                                        )}
                                                        {video.sourceType === 'upload' && (
                                                            <button
                                                                onClick={() => setCapturingVideo(video)}
                                                                disabled={capturingVideo !== null}
                                                                className="text-xs text-muted-foreground underline underline-offset-2 hover:no-underline hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none"
                                                            >
                                                                {video.thumbnailUrl ? 'Recapture' : 'Capture'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {new Date(video.createdAt).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-3">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {editingVideoId === video.id ? (
                                                            <>
                                                                <Button onClick={() => saveEditVideo(video.id)} size="sm" className="h-7 text-xs px-3">Save</Button>
                                                                <Button onClick={() => setEditingVideoId(null)} variant="outline" size="sm" className="h-7 text-xs px-3">Cancel</Button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Button onClick={() => startEditVideo(video)} variant="outline" size="sm" className="h-7 text-xs px-3">Edit</Button>
                                                                <Button onClick={() => setDeleteVideoTargetId(video.id)} variant="destructive" size="sm" className="h-7 text-xs px-3">Delete</Button>
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
            )}

            <input ref={texturesInputRef} type="file" accept=".webp,.png,.jpg,.jpeg,.gif,.bmp,.ktx2,.basis,.bin,.glb" multiple className="hidden" onChange={handleTexturesChosen} />

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

            {/* Delete video dialog */}
            <AlertDialog open={!!deleteVideoTargetId} onOpenChange={(open) => { if (!open) setDeleteVideoTargetId(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleteVideoTargetId && (() => {
                                const target = videos.find(v => v.id === deleteVideoTargetId)!
                                return <>
                                    This permanently deletes{' '}
                                    <span className="font-medium text-foreground">{target.name}</span>
                                    {target.sourceType === 'upload' && ', including the uploaded file'}.
                                    {' '}This action cannot be undone.
                                </>
                            })()}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteVideo} className={buttonVariants({ variant: 'destructive' })}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete video category dialog */}
            <AlertDialog open={!!deleteVideoCategoryTargetId} onOpenChange={(open) => { if (!open) setDeleteVideoCategoryTargetId(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete category?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleteVideoCategoryTargetId && (() => {
                                const target = videoCategories.find(c => c.id === deleteVideoCategoryTargetId)!
                                const affected = videos.filter(v => v.category === target.name).length
                                return <>
                                    This will delete{' '}
                                    <span className="font-medium text-foreground">{target.name}</span>.
                                    {affected > 0 && (
                                        <> {affected} {affected === 1 ? 'video' : 'videos'} will be set to uncategorised.</>
                                    )}
                                </>
                            })()}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteVideoCategory} className={buttonVariants({ variant: 'destructive' })}>Delete</AlertDialogAction>
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
