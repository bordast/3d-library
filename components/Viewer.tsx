'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Vector3, Spherical, MathUtils } from 'three'
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
    const animationRef = useRef<number>(null)

    const handleLoad = useCallback((dim: number) => {
        setMaxDim(dim)
        setTimeout(() => {
            const controls = controlsRef.current
            if (controls) {
                controls.target.set(0, 0, 0)
                controls.object.position.set(0, dim * 0.5, dim * 1)
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

    useEffect(() => {
        capturedRef.current = false
        return () => {
            if (animationRef.current !== null) {
                cancelAnimationFrame(animationRef.current)
            }
        }
    }, [url])

    const moveTo = useCallback((x: number, y: number, z: number) => {
        const controls = controlsRef.current
        if (!controls) return

        if (animationRef.current !== null) {
            cancelAnimationFrame(animationRef.current)
        }

        const startPos = controls.object.position.clone()
        const endPos = new Vector3(x, y, z)
        const startTarget = controls.target.clone()
        const endTarget = new Vector3(0, 0, 0)
        
        // Convert positions to spherical coordinates relative to their targets
        const startSpherical = new Spherical().setFromVector3(startPos.clone().sub(startTarget))
        const endSpherical = new Spherical().setFromVector3(endPos.clone().sub(endTarget))
        
        // Shortest path for theta
        const thetaDiff = endSpherical.theta - startSpherical.theta
        if (thetaDiff > Math.PI) endSpherical.theta -= 2 * Math.PI
        if (thetaDiff < -Math.PI) endSpherical.theta += 2 * Math.PI

        const duration = 500 // 500ms
        let startTime: number | null = null
        
        const animate = (time: number) => {
            if (startTime === null) startTime = time
            const elapsed = time - startTime
            const t = Math.min(elapsed / duration, 1)
            // Ease out cubic
            const easeT = 1 - Math.pow(1 - t, 3)
            
            // Interpolate spherical coordinates
            const r = MathUtils.lerp(startSpherical.radius, endSpherical.radius, easeT)
            const phi = MathUtils.lerp(startSpherical.phi, endSpherical.phi, easeT)
            const theta = MathUtils.lerp(startSpherical.theta, endSpherical.theta, easeT)
            
            const currentSpherical = new Spherical(r, phi, theta)
            
            // Apply new position and target
            controls.target.lerpVectors(startTarget, endTarget, easeT)
            controls.object.position.setFromSpherical(currentSpherical).add(controls.target)
            controls.update()
            
            if (t < 1) {
                animationRef.current = requestAnimationFrame(animate)
            } else {
                animationRef.current = null
            }
        }
        
        animationRef.current = requestAnimationFrame(animate)
    }, [])

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
                    viewOffsetX={144}
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
