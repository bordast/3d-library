'use client'

// THREE.Clock is deprecated but @react-three/fiber v9 still uses it internally
const _warn = console.warn
console.warn = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('THREE.Clock')) return
    _warn(...args)
}

import { useState, useRef, useEffect, useMemo, useCallback, Suspense } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF, Environment } from '@react-three/drei'
import { Box3, Vector3, EdgesGeometry } from 'three'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'
import { Loader2 } from 'lucide-react'

type RenderMode = 'solid' | 'wireframe' | 'uv'

function Model({ url, mode, onLoad }: { url: string; mode: RenderMode; onLoad: (maxDim: number) => void }) {
    const { scene } = useGLTF(url)
    const { camera } = useThree()

    useEffect(() => {
        const box = new Box3().setFromObject(scene)
        const size = new Vector3()
        const center = new Vector3()
        box.getSize(size)
        box.getCenter(center)

        scene.position.sub(center)

        const maxDim = Math.max(size.x, size.y, size.z)
        camera.position.set(0, maxDim * 1, maxDim * 1)
        camera.lookAt(0, 0, 0)
        camera.near = maxDim * 0.01
        camera.far = maxDim * 100
        camera.updateProjectionMatrix()

        onLoad(maxDim)
    }, [scene, camera, onLoad])

    const edges = useMemo(() => {
        const result: { geometry: EdgesGeometry; uuid: string }[] = []
        scene.traverse((child: any) => {
            if (child.isMesh) {
                result.push({ geometry: new EdgesGeometry(child.geometry, 15), uuid: child.uuid })
            }
        })
        return result
    }, [scene])

    scene.traverse((child: any) => {
        if (child.isMesh) {
            child.material.transparent = mode === 'wireframe'
            child.material.opacity = mode === 'wireframe' ? 0 : 1
            child.material.wireframe = false
        }
    })

    return (
        <>
            <primitive object={scene} />
            {mode === 'wireframe' &&
                edges.map(({ geometry, uuid }) => (
                    <lineSegments key={uuid} geometry={geometry}>
                        <lineBasicMaterial color="#00aaff" />
                    </lineSegments>
                ))}
        </>
    )
}

function CameraController({ controlsRef, minDistance, maxDistance }: {
    controlsRef: React.RefObject<OrbitControlsType | null>
    minDistance: number
    maxDistance: number
}) {
    return <OrbitControls ref={controlsRef} makeDefault minDistance={minDistance} maxDistance={maxDistance} />
}

export default function Viewer({ url }: { url: string }) {
    const [mode, setMode] = useState<RenderMode>('solid')
    const [maxDim, setMaxDim] = useState(1)
    const [loaded, setLoaded] = useState(false)
    const controlsRef = useRef<OrbitControlsType | null>(null)

    useEffect(() => { setLoaded(false) }, [url])

    const handleLoad = useCallback((dim: number) => {
        setMaxDim(dim)
        setLoaded(true)
    }, [])

    const moveTo = (x: number, y: number, z: number) => {
        const controls = controlsRef.current
        if (!controls) return
        controls.object.position.set(x, y, z)
        controls.object.lookAt(0, 0, 0)
        controls.update()
    }

    const d = maxDim * 2

    const PRESETS = [
        { label: 'Front', position: [0, 0, d] as [number, number, number] },
        { label: 'Back', position: [0, 0, -d] as [number, number, number] },
        { label: 'Left', position: [-d, 0, 0] as [number, number, number] },
        { label: 'Right', position: [d, 0, 0] as [number, number, number] },
        { label: 'Top', position: [0, d, 0] as [number, number, number] },
        { label: 'Bottom', position: [0, -d, 0] as [number, number, number] },
    ]

    const RENDER_MODES: { value: RenderMode; label: string }[] = [
        { value: 'solid', label: 'Solid' },
        { value: 'wireframe', label: 'Wireframe' },
        { value: 'uv', label: 'UV' },
    ]

    return (
        <div className="flex h-[520px]">
            <div className="flex-1 min-w-0 relative">
                {!loaded && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                )}
                <Canvas camera={{ position: [0, 0, 5] }}>
                    <Environment preset="sunset" />
                    <Suspense fallback={null}>
                        <Model url={url} mode={mode} onLoad={handleLoad} />
                    </Suspense>
                    <CameraController controlsRef={controlsRef} minDistance={maxDim * 0.5} maxDistance={maxDim * 10} />
                </Canvas>
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
                        onClick={() => moveTo(0, maxDim * 0.3, maxDim * 0.5)}
                        className="mt-1 w-full rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                        Reset
                    </button>
                </div>
            </div>
        </div>
    )
}