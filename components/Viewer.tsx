'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'
import type { RenderMode } from './ModelCanvas'

const ModelCanvas = dynamic(() => import('./ModelCanvas'), { ssr: false })

export default function Viewer({ url, modelId, hasThumbnail }: { url: string; modelId?: string; hasThumbnail?: boolean }) {
    const [mode, setMode] = useState<RenderMode>('solid')
    const [maxDim, setMaxDim] = useState(1)
    const controlsRef = useRef<OrbitControlsType | null>(null)
    const capturedRef = useRef(false)

    const handleLoad = useCallback((dim: number) => { setMaxDim(dim) }, [])

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
        controls.object.position.set(x, y, z)
        controls.object.lookAt(0, 0, 0)
        controls.update()
    }

    const d = maxDim

    const PRESETS = [
        { label: 'Front',  position: [0,  0,  d] as [number, number, number] },
        { label: 'Back',   position: [0,  0, -d] as [number, number, number] },
        { label: 'Left',   position: [-d, 0,  0] as [number, number, number] },
        { label: 'Right',  position: [d,  0,  0] as [number, number, number] },
        { label: 'Top',    position: [0,  d,  0] as [number, number, number] },
        { label: 'Bottom', position: [0, -d,  0] as [number, number, number] },
    ]

    const RENDER_MODES: { value: RenderMode; label: string }[] = [
        { value: 'solid',     label: 'Solid' },
        { value: 'wireframe', label: 'Wireframe' },
        { value: 'uv',        label: 'UV' },
        { value: 'albedo',    label: 'Albedo (Base)' },
        { value: 'normal',    label: 'Normal Map' },
        { value: 'roughness', label: 'Roughness' },
        { value: 'emission',  label: 'Emission' },
    ]

    return (
        <div className="flex h-[520px]">
            <div className="flex-1 min-w-0">
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

            <div className="w-44 shrink-0 border-l border-border bg-card flex flex-col gap-5 p-4 overflow-y-auto">
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Display</p>
                    <div className="flex flex-col gap-1">
                        {RENDER_MODES.map(({ value, label }) => (
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
