'use client'

// THREE.Clock is deprecated but @react-three/fiber v9 still uses it internally
const _warn = console.warn
console.warn = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('THREE.Clock')) return
    _warn(...args)
}

import { useState, useEffect, useMemo, useCallback, Suspense, Component, ReactNode } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { useGLTF, Environment } from '@react-three/drei'
import { Box3, Vector3, PerspectiveCamera } from 'three'
import { Loader2 } from 'lucide-react'
import { Spinner } from './ui/spinner'

class PreviewErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false }
    static getDerivedStateFromError() { return { failed: true } }
    render() {
        if (this.state.failed)
            return (
                <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                    Failed to load preview
                </div>
            )
        return this.props.children
    }
}

function PreviewModel({ url, onLoad }: { url: string; onLoad: () => void }) {
    const { scene: rawScene } = useGLTF(url)
    const scene = useMemo(() => rawScene.clone(true), [rawScene])
    const { camera } = useThree()

    useEffect(() => {
        const cam = camera as PerspectiveCamera
        scene.position.set(0, 0, 0)

        const box = new Box3().setFromObject(scene)
        const size = new Vector3()
        const center = new Vector3()
        box.getSize(size)
        box.getCenter(center)
        scene.position.sub(center)

        const maxDim = Math.max(size.x, size.y, size.z)
        cam.position.set(maxDim * 0.5, maxDim * 0.3, maxDim * .3)
        cam.lookAt(0, 0, 0)
        cam.near = maxDim * 0.01
        cam.far = maxDim * 100
        cam.updateProjectionMatrix()

        onLoad()
    }, [scene, camera, onLoad])

    return <primitive object={scene} />
}

export default function ModelPreview({ url }: { url: string }) {
    const [loaded, setLoaded] = useState(false)

    useEffect(() => { setLoaded(false) }, [url])

    const handleLoad = useCallback(() => setLoaded(true), [])

    return (
        <PreviewErrorBoundary>
            <div className="relative w-full h-full">
                {!loaded && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                        <Spinner className="size-6 text-muted-foreground" />
                    </div>
                )}
                <Canvas camera={{ position: [0, 0, 5] }} style={{ width: '100%', height: '100%' }} gl={{ antialias: true }}>
                    <Environment preset="sunset" />
                    <Suspense fallback={null}>
                        <PreviewModel url={url} onLoad={handleLoad} />
                    </Suspense>
                </Canvas>
            </div>
        </PreviewErrorBoundary>
    )
}
