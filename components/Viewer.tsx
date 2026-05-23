'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Vector3, Spherical, MathUtils } from 'three'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'
import type { RenderMode, MaterialEntry } from './ModelCanvas'

const ModelCanvas = dynamic(() => import('./ModelCanvas'), { ssr: false })

export default function Viewer({
    url,
    name,
    category,
    format
}: {
    url: string
    name?: string
    category?: string
    format?: string
}) {
    const [mode, setMode] = useState<RenderMode>('solid')
    const [maxDim, setMaxDim] = useState(1)
    const controlsRef = useRef<OrbitControlsType | null>(null)
    const animationRef = useRef<number>(null)
    const [isMobile, setIsMobile] = useState(false)
    const [panelOpen, setPanelOpen] = useState(true)
    const touchStartY = useRef(0)
    const [materials, setMaterials] = useState<MaterialEntry[]>([])
    const [materialColors, setMaterialColors] = useState<Record<string, string>>({})

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

    useEffect(() => {
        return () => {
            if (animationRef.current !== null) {
                cancelAnimationFrame(animationRef.current)
            }
        }
    }, [url])

    // Reset material state when the model URL changes
    useEffect(() => {
        setMaterials([])
        setMaterialColors({})
    }, [url])

    const handleMaterials = useCallback((mats: MaterialEntry[]) => {
        setMaterials(mats)
        // Seed colors from the model's own material colors (first load)
        setMaterialColors(prev => {
            const next = { ...prev }
            mats.forEach(m => { if (!next[m.id]) next[m.id] = m.color })
            return next
        })
    }, [])

    useEffect(() => {
        const mq = window.matchMedia('(max-width: 639px)')
        const handler = (e: MediaQueryListEvent) => {
            setIsMobile(e.matches)
            if (e.matches) setPanelOpen(false)
        }
        setIsMobile(mq.matches)
        if (mq.matches) setPanelOpen(false)
        mq.addEventListener('change', handler)
        return () => mq.removeEventListener('change', handler)
    }, [])

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

        const startSpherical = new Spherical().setFromVector3(startPos.clone().sub(startTarget))
        const endSpherical = new Spherical().setFromVector3(endPos.clone().sub(endTarget))

        const thetaDiff = endSpherical.theta - startSpherical.theta
        if (thetaDiff > Math.PI) endSpherical.theta -= 2 * Math.PI
        if (thetaDiff < -Math.PI) endSpherical.theta += 2 * Math.PI

        const duration = 500
        let startTime: number | null = null

        const animate = (time: number) => {
            if (startTime === null) startTime = time
            const elapsed = time - startTime
            const t = Math.min(elapsed / duration, 1)
            const easeT = 1 - Math.pow(1 - t, 3)

            const r = MathUtils.lerp(startSpherical.radius, endSpherical.radius, easeT)
            const phi = MathUtils.lerp(startSpherical.phi, endSpherical.phi, easeT)
            const theta = MathUtils.lerp(startSpherical.theta, endSpherical.theta, easeT)

            const currentSpherical = new Spherical(r, phi, theta)

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

    const handleModeSelect = useCallback((value: RenderMode) => {
        setMode(value)
        if (isMobile) setPanelOpen(false)
    }, [isMobile])

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
        { value: 'emission', label: 'Emission' },
    ]

    const panelContent = (
        <>
            {(name || format) && (
                <div className="flex flex-col gap-2 pb-4 border-b border-border/50">
                    {name && <h2 className="text-xl font-bold leading-tight line-clamp-2 break-words" title={name}>{name}</h2>}
                    {format && <span className="inline-flex items-center w-fit rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">{format}</span>}
                </div>
            )}

            <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Model</p>
                <div className="flex flex-col gap-1">
                    {MODEL_MODES.map(({ value, label }) => (
                        <button
                            key={value}
                            onClick={() => handleModeSelect(value)}
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
                            onClick={() => handleModeSelect(value)}
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

            {materials.length > 0 && (
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Materials</p>
                    <div className="flex flex-col gap-1.5">
                        {materials.map((mat) => (
                            <label key={mat.id} className="flex items-center justify-between gap-2 text-sm text-foreground">
                                <span className="truncate min-w-0">{mat.name}</span>
                                <input
                                    type="color"
                                    value={materialColors[mat.id] ?? mat.color}
                                    onChange={(e) => setMaterialColors(prev => ({ ...prev, [mat.id]: e.target.value }))}
                                    className="w-7 h-7 rounded cursor-pointer border border-border bg-transparent p-0.5 shrink-0"
                                />
                            </label>
                        ))}
                    </div>
                </div>
            )}

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
        </>
    )

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
                    viewOffsetX={panelOpen && !isMobile ? 144 : 0}
                    onMaterials={handleMaterials}
                    materialColors={materialColors}
                />
            </div>

            {/* Floating model info — top left, below header */}
            {(name || category || format) && (
                <div className="sm:hidden absolute top-[72px] left-0 z-10 pl-4 pr-16 py-3">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col gap-0.5 min-w-0">
                            {name && (
                                <p className="text-base sm:text-lg font-bold text-white leading-tight drop-shadow" title={name}>
                                    {name}
                                </p>
                            )}
                            {category && (
                                <p className="text-xs text-white/70 drop-shadow">{category}</p>
                            )}
                        </div>
                        {format && (
                            <span className="text-[10px] font-semibold text-white/60 uppercase tracking-wide shrink-0 mt-0.5 drop-shadow">
                                {format}
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Desktop side panel — hidden on mobile */}
            <div className="hidden sm:flex absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 w-64 max-h-[85vh] shrink-0 rounded-xl border border-border bg-card/80 backdrop-blur-md shadow-xl flex-col gap-6 p-5 overflow-y-auto z-10">
                {panelContent}
            </div>

            {/* Click-outside backdrop — closes mobile sheet */}
            {panelOpen && (
                <div
                    className="sm:hidden fixed inset-0 z-[19]"
                    onClick={() => setPanelOpen(false)}
                />
            )}

            {/* Mobile bottom sheet — hidden on desktop */}
            <div
                className={[
                    'sm:hidden fixed bottom-0 left-0 right-0 z-20',
                    'rounded-t-2xl border-t border-border bg-card/90 backdrop-blur-md shadow-2xl',
                    'flex flex-col gap-6 p-5 overflow-y-auto max-h-[75vh]',
                    'transition-transform duration-300 ease-in-out',
                    panelOpen ? 'translate-y-0' : 'translate-y-full pointer-events-none',
                ].join(' ')}
                onTouchStart={(e) => { touchStartY.current = e.touches[0].clientY }}
                onTouchEnd={(e) => {
                    if (e.changedTouches[0].clientY - touchStartY.current > 60) setPanelOpen(false)
                }}
            >
                {panelContent}
            </div>

            {/* Floating toggle button — mobile only */}
            <button
                className="sm:hidden fixed bottom-6 right-4 z-30 flex items-center justify-center w-12 h-12 rounded-full bg-card/90 backdrop-blur-md border border-border shadow-lg text-foreground transition-colors hover:bg-accent active:scale-95"
                onClick={() => setPanelOpen(o => !o)}
                aria-label={panelOpen ? 'Hide controls' : 'Show controls'}
            >
                {panelOpen ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="size-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="size-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
                    </svg>
                )}
            </button>
        </div>
    )
}
