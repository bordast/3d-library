'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'
import type { RenderMode } from './ModelCanvas'

const ModelCanvas = dynamic(() => import('./ModelCanvas'), { ssr: false })

export default function Viewer({
    url,
    modelId,
    hasThumbnail,
    name,
    format
}: {
    url: string
    modelId?: string
    hasThumbnail?: boolean
    name?: string
    format?: string
}) {
    const [mode, setMode] = useState<RenderMode>('solid')
    const [maxDim, setMaxDim] = useState(1)
    const controlsRef = useRef<OrbitControlsType | null>(null)
    const capturedRef = useRef(false)

    const handleLoad = useCallback((dim: number) => {
        setMaxDim(dim)
        // Offset the controls target slightly to the left to balance the right sidebar
        setTimeout(() => {
            const controls = controlsRef.current
            if (controls) {
                const offsetX = dim * 0.2
                controls.target.set(offsetX, 0, 0)
                controls.object.position.set(offsetX, dim * 0.5, dim * 1)
                controls.update()
            }
        }, 50)
    }, [])

    const handleCapture = useCallback(async (dataUrl: string) => {
        if (!modelId || hasThumbnail || capturedRef.current) return
        capturedRef.current = true
        try {
            await fetch(`/api/models/${modelId}/thumbnail`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dataUrl }),
            })
        } catch {
            // Non-critical: thumbnail will be generated on next load or via admin
            capturedRef.current = false
        }
    }, [modelId, hasThumbnail])

    useEffect(() => { capturedRef.current = false }, [url])

    const moveTo = (x: number, y: number, z: number) => {
        const controls = controlsRef.current
        if (!controls) return
        const offsetX = maxDim * 0.2
        controls.object.position.set(x + offsetX, y, z)
        controls.target.set(offsetX, 0, 0)
        controls.update()
    }

    const d = maxDim

    const PRESETS = [
        { label: 'Front', position: [0, 0, d] as [number, number, number] },
        { label: 'Back', position: [0, 0, -d] as [number, number, number] },
        { label: 'Left', position: [-d, 0, 0] as [number, number, number] },
        { label: 'Right', position: [d, 0, 0] as [number, number, number] },
        { label: 'Top', position: [0, d, 0] as [number, number, number] },
        { label: 'Bottom', position: [0, -d, 0] as [number, number, number] },
    ]

    const MODEL_MODES: { value: RenderMode; label: string }[] = [
        { value: 'solid', label: 'Solid' },
        { value: 'wireframe', label: 'Wireframe' },
        { value: 'uv', label: 'UV' },
    ]

    const TEXTURE_MODES: { value: RenderMode; label: string }[] = [
        { value: 'albedo', label: 'Albedo (Base)' },
        { value: 'normal', label: 'Normal Map' },
        { value: 'roughness', label: 'Roughness' },
        { value: 'metalness', label: 'Metalness' },
        { value: 'emission', label: 'Emission' },
    ]

    return (
        <div className="fixed inset-0 z-0">
            <div className="absolute inset-0">
                <ModelCanvas
                    url={url}
                    mode={mode}
                    onLoad={handleLoad}
                    orbitRef={controlsRef}
                    minDistance={maxDim * 0.5}
                    maxDistance={maxDim * 10}
                    captureOnLoad={modelId && !hasThumbnail ? handleCapture : undefined}
                />
            </div>

            <div className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 w-64 max-h-[85vh] shrink-0 rounded-xl border border-border bg-card/80 backdrop-blur-md shadow-xl flex flex-col gap-6 p-5 overflow-y-auto z-10">
                {(name || format) && (
                    <div className="flex flex-col gap-2 pb-4 border-b border-border/50">
                        {name && <h2 className="text-base font-semibold leading-tight line-clamp-2 break-words" title={name}>{name}</h2>}
                        {format && <span className="inline-flex items-center w-fit rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">{format}</span>}
                    </div>
                )}

                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Model</p>
                    <div className="flex flex-col gap-1">
                        {MODEL_MODES.map(({ value, label }) => (
                            <button
                                key={value}
                                onClick={() => setMode(value)}
                                className={[
                                    'w-full rounded-md px-3 py-1.5 text-sm font-medium text-left transition-colors',
                                    mode === value
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-foreground hover:bg-accent hover:text-accent-foreground',
                                ].join(' ')}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Textures</p>
                    <div className="flex flex-col gap-1">
                        {TEXTURE_MODES.map(({ value, label }) => (
                            <button
                                key={value}
                                onClick={() => setMode(value)}
                                className={[
                                    'w-full rounded-md px-3 py-1.5 text-sm font-medium text-left transition-colors',
                                    mode === value
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-foreground hover:bg-accent hover:text-accent-foreground',
                                ].join(' ')}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Camera</p>
                    <div className="grid grid-cols-2 gap-1">
                        {PRESETS.map(({ label, position }) => (
                            <button
                                key={label}
                                onClick={() => moveTo(...position)}
                                className="rounded-md px-2 py-1.5 text-xs font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => moveTo(0, maxDim * 0.5, maxDim * 1)}
                        className="mt-1 w-full rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                        Reset
                    </button>
                </div>
            </div>
        </div>
    )
}
