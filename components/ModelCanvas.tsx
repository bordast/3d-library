'use client'

// THREE.Clock is deprecated but @react-three/fiber v9 still uses it internally
const _warn = console.warn
console.warn = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('THREE.Clock')) return
    _warn(...args)
}

import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef, Suspense, Component, ReactNode, ErrorInfo } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF, Environment, useTexture } from '@react-three/drei'
import { Box3, Vector3, WireframeGeometry, LineSegments, LineBasicMaterial, Mesh, Material, Group, LoadingManager, DoubleSide, MeshBasicMaterial, MeshStandardMaterial } from 'three'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'
import { Spinner } from '@/components/ui/spinner'

export type RenderMode = 'solid' | 'wireframe' | 'uv' | 'albedo' | 'normal' | 'roughness' | 'emission'
export type MaterialEntry = { id: string; name: string; color: string }

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

function SceneContent({ scene, mode, onLoad, onMaterials, materialColors }: {
    scene: Group; mode: RenderMode; onLoad: (maxDim: number) => void
    onMaterials?: (mats: MaterialEntry[]) => void
    materialColors?: Record<string, string>
}) {
    const { camera } = useThree()
    const onMaterialsRef = useRef(onMaterials)
    useLayoutEffect(() => { onMaterialsRef.current = onMaterials }, [onMaterials])

    // Load the UV checker texture. This will suspend the component until the texture is loaded.
    // You should add a `uv_checker.png` file to your `/public/textures/` directory.
    const uvCheckerTexture = useTexture('/textures/uv_checker.png')

    // Memoize the material so it's not recreated on every render
    const uvMaterial = useMemo(() => {
        uvCheckerTexture.flipY = false // GLTF models often require this
        return new MeshBasicMaterial({ map: uvCheckerTexture, side: DoubleSide })
    }, [uvCheckerTexture])

    useEffect(() => {
        const box = new Box3().setFromObject(scene)
        const size = new Vector3()
        const center = new Vector3()
        box.getSize(size)
        box.getCenter(center)
        scene.position.sub(center)

        const maxDim = Math.max(size.x, size.y, size.z)
        camera.position.set(0, maxDim * 0.5, maxDim * 1)
        camera.lookAt(0, 0, 0)
        // Object.assign avoids direct property assignment on the hook return value,
        // which the React Compiler flags as a mutation. Three.js Camera has near/far.
        Object.assign(camera, { near: maxDim * 0.01, far: maxDim * 100 })
        camera.updateProjectionMatrix()

        onLoad(maxDim)

        // Collect unique materials by UUID and report them to the parent
        const seen = new Map<string, MaterialEntry>()
        scene.traverse((child) => {
            const mesh = child as Mesh
            if (!mesh.isMesh) return
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
            mats.forEach((mat: any, i) => {
                if (seen.has(mat.uuid)) return
                const name = mat.name || (mats.length > 1 ? `Material ${i + 1}` : 'Material')
                const color = mat.color ? '#' + mat.color.getHexString() : '#ffffff'
                seen.set(mat.uuid, { id: mat.uuid, name, color })
            })
        })
        onMaterialsRef.current?.(Array.from(seen.values()))
    }, [scene, camera, onLoad])

    useLayoutEffect(() => {
        // Remove stale wireframe overlays before applying the new mode
        scene.traverse((child) => {
            const toRemove = child.children.filter(c => c.userData.wireframeOverlay)
            toRemove.forEach(c => {
                child.remove(c)
                const lines = c as LineSegments
                lines.geometry.dispose();
                (Array.isArray(lines.material) ? lines.material : [lines.material]).forEach(m => m.dispose())
            })
        })

        scene.traverse((child) => {
            const mesh = child as Mesh
            if (!mesh.isMesh) return

            if (!mesh.userData.originalMaterial) {
                mesh.userData.originalMaterial = mesh.material

                // Extract the first material if it's an array
                const orig = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material as any

                // Pre-generate unlit debug materials for each texture map to avoid memory leaks on swap
                mesh.userData.debugMaterials = {
                    albedo: new MeshBasicMaterial({ map: orig.map || null, color: orig.color || 0xffffff }),
                    normal: new MeshBasicMaterial({ map: orig.normalMap || null, color: orig.normalMap ? 0xffffff : 0x8080ff }),
                    roughness: new MeshBasicMaterial({ map: orig.roughnessMap || null, color: orig.roughnessMap ? 0xffffff : 0x808080 }),
                    emission: new MeshBasicMaterial({ map: orig.emissiveMap || null, color: orig.emissive || 0x000000 }),
                }
            }

            if (mode === 'uv') {
                mesh.material = uvMaterial
            } else if (['albedo', 'normal', 'roughness', 'emission'].includes(mode)) {
                mesh.material = mesh.userData.debugMaterials[mode]
            } else {
                if (mesh.userData.originalMaterial) {
                    mesh.material = mesh.userData.originalMaterial
                }
                const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
                mats.forEach((mat: Material & { wireframe?: boolean }) => {
                    mat.transparent = mode === 'wireframe'
                    mat.opacity = mode === 'wireframe' ? 0 : 1
                    if (mode !== 'wireframe') mat.depthWrite = true
                    mat.wireframe = false
                    mat.needsUpdate = true
                })
                if (mode === 'wireframe') {
                    // Add overlay as a child of the mesh so it inherits all transforms.
                    // Rendering it at scene root would offset it by scene.position.
                    const overlay = new LineSegments(new WireframeGeometry(mesh.geometry), new LineBasicMaterial())
                    overlay.userData.wireframeOverlay = true
                    mesh.add(overlay)
                }
            }
        })
    }, [scene, mode, uvMaterial])

    // Capture original material colors on mount so we can restore them on unmount.
    // useGLTF caches scene objects globally — without restoration, color mutations
    // persist in the cache and reappear the next time the same model is opened.
    useEffect(() => {
        const origColors: Record<string, string> = {}
        scene.traverse((child) => {
            const mesh = child as Mesh
            if (!mesh.isMesh) return
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
            mats.forEach((mat: any) => {
                if (mat?.color && !origColors[mat.uuid]) {
                    origColors[mat.uuid] = '#' + mat.color.getHexString()
                }
            })
        })
        return () => {
            scene.traverse((child) => {
                const mesh = child as Mesh
                if (!mesh.isMesh) return
                const restore = (mat: any) => {
                    if (mat?.color && origColors[mat.uuid]) {
                        mat.color.set(origColors[mat.uuid])
                        mat.needsUpdate = true
                    }
                }
                const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
                mats.forEach(restore)
                const orig = mesh.userData.originalMaterial
                if (orig) {
                    const origMats = Array.isArray(orig) ? orig : [orig]
                    origMats.forEach(restore)
                }
            })
        }
    }, [scene])

    useLayoutEffect(() => {
        if (!materialColors || Object.keys(materialColors).length === 0) return
        scene.traverse((child) => {
            const mesh = child as Mesh
            if (!mesh.isMesh) return
            const applyColor = (mat: any) => {
                if (!mat?.color || !materialColors[mat.uuid]) return
                mat.color.set(materialColors[mat.uuid])
                mat.needsUpdate = true
            }
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
            mats.forEach(applyColor)
            // Also apply to stored original so mode-switching doesn't revert the color
            const orig = mesh.userData.originalMaterial
            if (orig) {
                const origMats = Array.isArray(orig) ? orig : [orig]
                origMats.forEach(applyColor)
            }
        })
    }, [scene, materialColors])

    return <primitive object={scene} />
}

const GLTF_IMAGE_EXTS = new Set(['webp', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ktx2', 'basis', 'bin'])

// Shared manager: only rewrites image URLs through the fallback API (webp-first).
// Non-image assets like .bin buffers are fetched directly from /uploads/.
const gltfTextureManager = new LoadingManager()
gltfTextureManager.setURLModifier((url) => {
    let decoded = url
    try {
        decoded = decodeURI(url)
    } catch {
        // ignore
    }

    if (decoded.startsWith('/uploads/gltf/')) {
        const ext = decoded.split('.').pop()?.toLowerCase() ?? ''
        if (GLTF_IMAGE_EXTS.has(ext)) return '/api/texture' + decoded
    }
    return decoded
})

function SceneModel({ url, mode, onLoad, onMaterials, materialColors }: {
    url: string; mode: RenderMode; onLoad: (maxDim: number) => void
    onMaterials?: (mats: MaterialEntry[]) => void
    materialColors?: Record<string, string>
}) {
    const { scene } = useGLTF(url, undefined, undefined, (loader) => {
        loader.manager = gltfTextureManager
    })
    return <SceneContent scene={scene as Group} mode={mode} onLoad={onLoad} onMaterials={onMaterials} materialColors={materialColors} />
}

function CameraOffset({ viewOffsetX }: { viewOffsetX: number }) {
    const { camera, size } = useThree()

    useEffect(() => {
        const activeOffset = size.width < 640 ? 0 : viewOffsetX
        if (activeOffset !== 0 && (camera as any).setViewOffset) {
            // A positive xOffset shifts the camera's view to the right,
            // which visually moves the scene content to the left.
            (camera as any).setViewOffset(size.width, size.height, activeOffset, 0, size.width, size.height)
        } else if ((camera as any).clearViewOffset) {
            (camera as any).clearViewOffset()
        }
        camera.updateProjectionMatrix()
    }, [camera, size, viewOffsetX])

    return null
}

function CaptureOnLoad({ onCapture }: { onCapture: (dataUrl: string) => void }) {
    const { gl, scene, camera } = useThree()
    const framesRef = useRef(0)
    const capturedRef = useRef(false)
    // Wait 3 R3F frames: camera is repositioned in a useEffect, so we need at least one subsequent render before reading the canvas.
    useFrame(() => {
        if (capturedRef.current) return
        if (++framesRef.current < 3) return
        capturedRef.current = true

        // Temporarily strip the HDRI background for a transparent capture
        const oldBg = scene.background
        scene.background = null
        gl.render(scene, camera) // Synchronously render the transparent frame

        try { onCapture(gl.domElement.toDataURL('image/webp', 0.95)) } catch { /* tainted or unsupported */ }

        // Restore the HDRI background so the user never sees a flicker
        scene.background = oldBg
    })
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
    viewOffsetX?: number
    onMaterials?: (mats: MaterialEntry[]) => void
    materialColors?: Record<string, string>
}

export default function ModelCanvas({ url, mode = 'solid', onLoad, orbitRef, minDistance = 0.5, maxDistance = 10, captureOnLoad, viewOffsetX = 0, onMaterials, materialColors }: Props) {
    const [canvasReady, setCanvasReady] = useState(false)
    const [loaded, setLoaded] = useState(() => loadedUrls.has(url))
    const [timedOut, setTimedOut] = useState(false)
    const [contextLost, setContextLost] = useState(false)
    const [retryKey, setRetryKey] = useState(0)
    // Tracks whether we already did a silent auto-retry for context loss.
    // First loss → silent remount (handles Strict Mode & transient GPU issues).
    // Second loss → show the error UI.
    const autoRetriedRef = useRef(false)

    // Always delay canvas mount so WebGL context creation doesn't race with the
    // view-transition animation — even on first load when url isn't in loadedUrls yet.
    // Using [canvasReady] as deps: when handleRetry resets canvasReady to false,
    // this effect re-fires and queues a fresh 420 ms delay for the remount.
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

    const handleRetry = useCallback(() => {
        setTimedOut(false)
        setContextLost(false)
        setLoaded(false)
        setCanvasReady(false)
        autoRetriedRef.current = false
        setRetryKey(k => k + 1)
    }, [])

    const handleContextLost = useCallback(() => {
        if (!autoRetriedRef.current) {
            // First loss: silent remount — covers Strict Mode double-invoke and
            // transient GPU resets without showing an error to the user.
            autoRetriedRef.current = true
            setLoaded(false)
            setCanvasReady(false)
            setRetryKey(k => k + 1)
        } else {
            setContextLost(true)
        }
    }, [])

    const handleLoaderError = useCallback(() => setTimedOut(true), [])

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
                        <span>{contextLost ? 'WebGL context lost' : 'Failed to load model'}</span>
                        <button
                            onClick={handleRetry}
                            className="rounded-md px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                )}
                {canvasReady && (
                    <Canvas
                        key={retryKey}
                        camera={{ position: [0, 0.5, 1] }}
                        gl={{ antialias: true, preserveDrawingBuffer: true, alpha: true }}
                        style={{ width: '100%', height: '100%' }}
                    >
                        <Environment preset="sunset" background backgroundIntensity={0.1} backgroundBlurriness={0.8} />
                        <CameraOffset viewOffsetX={viewOffsetX} />
                        <ErrorBoundary inline onError={handleLoaderError}>
                            <Suspense fallback={null}>
                                <SceneModel url={url} mode={mode} onLoad={handleLoad} onMaterials={onMaterials} materialColors={materialColors} />
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
