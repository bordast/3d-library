'use client'

import { useEffect, useMemo, Suspense, Component, ReactNode } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Box3, Vector3, PerspectiveCamera } from 'three'

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

function PreviewModel({ url }: { url: string }) {
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
        cam.position.set(maxDim * 0.8, maxDim * 0.6, maxDim * 0.5)
        cam.lookAt(0, 0, 0)
        cam.near = maxDim * 0.01
        cam.far = maxDim * 100
        cam.updateProjectionMatrix()
    }, [scene, camera])

    return <primitive object={scene} />
}

export default function ModelPreview({ url }: { url: string }) {
    // THREE 0.184 deprecated Clock; R3F 9.x still uses it internally — suppress until R3F updates.
    useEffect(() => {
        const original = console.warn
        console.warn = (...args: unknown[]) => {
            if (typeof args[0] === 'string' && args[0].includes('THREE.Clock')) return
            original(...args)
        }
        return () => { console.warn = original }
    }, [])

    return (
        <PreviewErrorBoundary>
            <Canvas camera={{ position: [0, 0, 5] }} style={{ width: '100%', height: '100%' }} gl={{ antialias: true }}>
                <ambientLight intensity={1.2} />
                <directionalLight position={[5, 5, 5]} intensity={1} />
                <directionalLight position={[-3, 2, -3]} intensity={0.4} />
                <Suspense fallback={null}>
                    <PreviewModel url={url} />
                </Suspense>
            </Canvas>
        </PreviewErrorBoundary>
    )
}
