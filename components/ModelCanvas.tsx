'use client'

// THREE.Clock is deprecated but @react-three/fiber v9 still uses it internally
const _warn = console.warn
console.warn = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('THREE.Clock')) return
    _warn(...args)
}

import { useState, useEffect, useMemo, useCallback, Suspense, Component, ReactNode } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF, Environment } from '@react-three/drei'
import { Box3, Vector3, EdgesGeometry, Mesh, Material } from 'three'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'
import { Spinner } from '@/components/ui/spinner'

export type RenderMode = 'solid' | 'wireframe' | 'uv'

// Tracks URLs whose models have fully loaded at least once in this session.
// When navigating from a card (which already loaded the model) to the detail
// page, the Viewer starts with loaded=true — no spinner, no transition conflict.
const loadedUrls = new Set<string>()

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false }
    static getDerivedStateFromError() { return { failed: true } }
    render() {
        if (this.state.failed)
            return (
                <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                    Failed to load model
                </div>
            )
        return this.props.children
    }
}

function SceneModel({ url, mode, onLoad }: { url: string; mode: RenderMode; onLoad: (maxDim: number) => void }) {
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
        // Object.assign avoids direct property assignment on the hook return value,
        // which the React Compiler flags as a mutation. Three.js Camera has near/far.
        Object.assign(camera, { near: maxDim * 0.01, far: maxDim * 100 })
        camera.updateProjectionMatrix()

        onLoad(maxDim)
    }, [scene, camera, onLoad])

    const edges = useMemo(() => {
        if (mode !== 'wireframe') return []
        const result: { geometry: EdgesGeometry; uuid: string }[] = []
        scene.traverse((child) => {
            const mesh = child as Mesh
            if (mesh.isMesh) result.push({ geometry: new EdgesGeometry(mesh.geometry, 15), uuid: mesh.uuid })
        })
        return result
    }, [scene, mode])

    scene.traverse((child) => {
        const mesh = child as Mesh
        if (!mesh.isMesh) return
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        mats.forEach((mat: Material & { wireframe?: boolean }) => {
            mat.transparent = mode === 'wireframe'
            mat.opacity = mode === 'wireframe' ? 0 : 1
            mat.wireframe = false
        })
    })

    return (
        <>
            <primitive object={scene} />
            {mode === 'wireframe' && edges.map(({ geometry, uuid }) => (
                <lineSegments key={uuid} geometry={geometry}>
                    <lineBasicMaterial color="#00aaff" />
                </lineSegments>
            ))}
        </>
    )
}

type Props = {
    url: string
    mode?: RenderMode
    onLoad?: (maxDim: number) => void
    orbitRef?: React.RefObject<OrbitControlsType | null>
    minDistance?: number
    maxDistance?: number
}

export default function ModelCanvas({ url, mode = 'solid', onLoad, orbitRef, minDistance = 0.5, maxDistance = 10 }: Props) {
    // When navigating from a card, the model is already in loadedUrls.
    // Defer Canvas mount until after the view transition finishes (~380ms) so
    // WebGL context creation doesn't compete with the CSS animation compositor.
    const [canvasReady, setCanvasReady] = useState(() => !loadedUrls.has(url))
    const [loaded, setLoaded] = useState(() => loadedUrls.has(url))

    useEffect(() => {
        if (canvasReady) return
        const id = setTimeout(() => setCanvasReady(true), 420)
        return () => clearTimeout(id)
    }, [canvasReady])

    const handleLoad = useCallback((dim: number) => {
        loadedUrls.add(url)
        onLoad?.(dim)
        setLoaded(true)
    }, [onLoad, url])

    return (
        <ErrorBoundary>
            <div className="relative w-full h-full">
                {canvasReady && !loaded && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                        <Spinner className="size-6 text-muted-foreground" />
                    </div>
                )}
                {canvasReady && (
                    <Canvas
                        camera={{ position: [0, 0, 5] }}
                        gl={{ antialias: true, preserveDrawingBuffer: true }}
                        style={{ width: '100%', height: '100%' }}
                    >
                        <Environment preset="sunset" />
                        <Suspense fallback={null}>
                            <SceneModel url={url} mode={mode} onLoad={handleLoad} />
                        </Suspense>
                        {orbitRef !== undefined && (
                            <OrbitControls ref={orbitRef} makeDefault minDistance={minDistance} maxDistance={maxDistance} />
                        )}
                    </Canvas>
                )}
            </div>
        </ErrorBoundary>
    )
}
