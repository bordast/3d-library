'use client'

// THREE.Clock is deprecated but @react-three/fiber v9 still uses it internally.
// THREE.WebGLTextures warns when texture unit usage hits the GPU maximum (16),
// even though rendering succeeds — the Environment HDR map consumes units that
// push textured models to the limit.
const _warn = console.warn
console.warn = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && (
        args[0].includes('THREE.Clock') ||
        args[0].includes('THREE.WebGLTextures')
    )) return
    _warn(...args)
}

import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef, Suspense, Component, ReactNode, ErrorInfo } from 'react'
import { Canvas, useThree, useLoader } from '@react-three/fiber'
import { OrbitControls, useGLTF, Environment } from '@react-three/drei'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js'
import { Box3, Vector3, EdgesGeometry, Mesh, Material, DoubleSide, Group, Loader, LoadingManager } from 'three'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'
import { Spinner } from '@/components/ui/spinner'

export type RenderMode = 'solid' | 'wireframe' | 'uv'

// Tracks URLs whose models have fully loaded at least once in this session.
// When navigating from a card (which already loaded the model) to the detail
// page, the Viewer starts with loaded=true — no spinner, no transition conflict.
const loadedUrls = new Set<string>()

type ErrorBoundaryProps = { children: ReactNode; onError?: () => void; inline?: boolean }
class ErrorBoundary extends Component<ErrorBoundaryProps, { failed: boolean }> {
    state = { failed: false }
    static getDerivedStateFromError() { return { failed: true } }
    componentDidCatch(_: Error, __: ErrorInfo) { this.props.onError?.() }
    render() {
        if (this.state.failed) {
            if (this.props.inline) return null
            return (
                <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                    Failed to load model
                </div>
            )
        }
        return this.props.children
    }
}

// Loads the companion .mtl file (same path, .obj → .mtl) then sets materials on
// OBJLoader before parsing. Falls back to no-material load if MTL is absent.
class OBJWithMTLLoader extends Loader<Group> {
    load(
        url: string,
        onLoad: (data: Group) => void,
        onProgress?: (event: ProgressEvent) => void,
        onError?: (err: unknown) => void,
    ) {
        const mtlUrl = url.replace(/\.obj(\?.*)?$/i, '.mtl')
        const loadObj = (materials?: MTLLoader.MaterialCreator) => {
            const objLoader = new OBJLoader(this.manager)
            if (materials) objLoader.setMaterials(materials)
            objLoader.load(url, onLoad, onProgress, onError)
        }
        const mtlLoader = new MTLLoader(this.manager)
        mtlLoader.load(
            mtlUrl,
            (materials) => { materials.preload(); loadObj(materials) },
            undefined,
            () => loadObj(),
        )
    }
}

function SceneContent({ scene, mode, onLoad }: { scene: Group; mode: RenderMode; onLoad: (maxDim: number) => void }) {
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
            if (mesh.isMesh) result.push({ geometry: new EdgesGeometry(mesh.geometry), uuid: mesh.uuid })
        })
        return result
    }, [scene, mode])

    useLayoutEffect(() => {
        scene.traverse((child) => {
            const mesh = child as Mesh
            if (!mesh.isMesh) return
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
            mats.forEach((mat: Material & { wireframe?: boolean }) => {
                mat.side = DoubleSide
                mat.transparent = mode === 'wireframe'
                mat.opacity = mode === 'wireframe' ? 0 : 1
                mat.wireframe = false
                mat.needsUpdate = true
            })
        })
    }, [scene, mode])

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

const GLTF_IMAGE_EXTS = new Set(['webp', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ktx2', 'basis'])

// Shared manager: only rewrites image URLs through the fallback API (webp-first).
// Non-image assets like .bin buffers are fetched directly from /uploads/.
const gltfTextureManager = new LoadingManager()
gltfTextureManager.setURLModifier((url) => {
    if (url.startsWith('/uploads/gltf/')) {
        const ext = url.split('.').pop()?.toLowerCase() ?? ''
        if (GLTF_IMAGE_EXTS.has(ext)) return '/api/texture' + url
    }
    return url
})

function GltfModel({ url, mode, onLoad }: { url: string; mode: RenderMode; onLoad: (maxDim: number) => void }) {
    const { scene } = useGLTF(url, undefined, undefined, (loader) => {
        loader.manager = gltfTextureManager
    })
    return <SceneContent scene={scene as Group} mode={mode} onLoad={onLoad} />
}

function ObjModel({ url, mode, onLoad }: { url: string; mode: RenderMode; onLoad: (maxDim: number) => void }) {
    const obj = useLoader(OBJWithMTLLoader, url)
    return <SceneContent scene={obj} mode={mode} onLoad={onLoad} />
}

function SceneModel({ url, mode, onLoad }: { url: string; mode: RenderMode; onLoad: (maxDim: number) => void }) {
    return url.toLowerCase().endsWith('.obj')
        ? <ObjModel url={url} mode={mode} onLoad={onLoad} />
        : <GltfModel url={url} mode={mode} onLoad={onLoad} />
}

function CaptureOnLoad({ onCapture }: { onCapture: (dataUrl: string) => void }) {
    const { gl } = useThree()
    const done = useRef(false)
    useEffect(() => {
        if (done.current) return
        done.current = true
        requestAnimationFrame(() => {
            try { onCapture(gl.domElement.toDataURL('image/webp')) } catch { /* tainted or unsupported */ }
        })
    }, [gl, onCapture])
    return null
}

function ContextLossDetector({ onContextLost }: { onContextLost: () => void }) {
    const { gl } = useThree()
    useEffect(() => {
        const canvas = gl.domElement
        canvas.addEventListener('webglcontextlost', onContextLost)
        return () => canvas.removeEventListener('webglcontextlost', onContextLost)
    }, [gl, onContextLost])
    return null
}

type Props = {
    url: string
    mode?: RenderMode
    onLoad?: (maxDim: number) => void
    orbitRef?: React.RefObject<OrbitControlsType | null>
    minDistance?: number
    maxDistance?: number
    captureOnLoad?: (dataUrl: string) => void
}

export default function ModelCanvas({ url, mode = 'solid', onLoad, orbitRef, minDistance = 0.5, maxDistance = 10, captureOnLoad }: Props) {
    // When navigating from a card, the model is already in loadedUrls.
    // Defer Canvas mount until after the view transition finishes (~380ms) so
    // WebGL context creation doesn't compete with the CSS animation compositor.
    const [canvasReady, setCanvasReady] = useState(() => !loadedUrls.has(url))
    const [loaded, setLoaded] = useState(() => loadedUrls.has(url))
    const [timedOut, setTimedOut] = useState(false)
    const [contextLost, setContextLost] = useState(false)
    const [retryKey, setRetryKey] = useState(0)

    useEffect(() => {
        if (canvasReady) return
        const id = setTimeout(() => setCanvasReady(true), 420)
        return () => clearTimeout(id)
    }, [canvasReady])

    // If the model hasn't loaded within 10s, show a retry option
    useEffect(() => {
        if (!canvasReady || loaded) return
        setTimedOut(false)
        const id = setTimeout(() => setTimedOut(true), 10_000)
        return () => clearTimeout(id)
    }, [canvasReady, loaded, retryKey])

    const handleLoad = useCallback((dim: number) => {
        loadedUrls.add(url)
        onLoad?.(dim)
        setLoaded(true)
    }, [onLoad, url])

    const handleContextLost = useCallback(() => setContextLost(true), [])

    const handleLoaderError = useCallback(() => setTimedOut(true), [])

    const handleRetry = useCallback(() => {
        setTimedOut(false)
        setContextLost(false)
        setLoaded(false)
        setRetryKey(k => k + 1)
    }, [])

    const showError = timedOut || contextLost

    return (
        <ErrorBoundary>
            <div className="relative w-full h-full">
                {canvasReady && !loaded && !showError && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                        <Spinner className="size-6 text-muted-foreground" />
                    </div>
                )}
                {showError && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/60 text-sm text-muted-foreground">
                        <span>{contextLost ? 'WebGL context lost — reload the page' : 'Failed to load model'}</span>
                        {!contextLost && (
                            <button
                                onClick={handleRetry}
                                className="rounded-md px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                            >
                                Retry
                            </button>
                        )}
                    </div>
                )}
                {canvasReady && (
                    <Canvas
                        key={retryKey}
                        camera={{ position: [0, 0, 5] }}
                        gl={{ antialias: true, preserveDrawingBuffer: true }}
                        style={{ width: '100%', height: '100%' }}
                    >
                        <Environment preset="sunset" />
                        <ErrorBoundary inline onError={handleLoaderError}>
                            <Suspense fallback={null}>
                                <SceneModel url={url} mode={mode} onLoad={handleLoad} />
                                {captureOnLoad && <CaptureOnLoad onCapture={captureOnLoad} />}
                            </Suspense>
                        </ErrorBoundary>
                        {orbitRef !== undefined && (
                            <OrbitControls ref={orbitRef} makeDefault minDistance={minDistance} maxDistance={maxDistance} />
                        )}
                        <ContextLossDetector onContextLost={handleContextLost} />
                    </Canvas>
                )}
            </div>
        </ErrorBoundary>
    )
}
