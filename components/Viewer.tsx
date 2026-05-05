'use client'

// THREE.Clock is deprecated but @react-three/fiber v9 still uses it internally
const _warn = console.warn
console.warn = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('THREE.Clock')) return
    _warn(...args)
}

import { useState, useRef, useEffect, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { Box3, Vector3, EdgesGeometry } from 'three'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'

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
        camera.position.set(0, maxDim * 0.5, maxDim * 2)
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
    const controlsRef = useRef<OrbitControlsType | null>(null)

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

    return (
        <div>
            <div style={{ marginBottom: '8px', display: 'flex', gap: '8px' }}>
                <button onClick={() => setMode('solid')}>Solid</button>
                <button onClick={() => setMode('wireframe')}>Wireframe</button>
                <button onClick={() => setMode('uv')}>UV</button>
            </div>

            <div style={{ marginBottom: '8px', display: 'flex', gap: '8px' }}>
                {PRESETS.map(({ label, position }) => (
                    <button key={label} onClick={() => moveTo(...position)}>{label}</button>
                ))}
                <button onClick={() => moveTo(0, maxDim * 0.5, maxDim * 2)}>Reset</button>
            </div>

            <div style={{ width: '100%', height: '500px' }}>
                <Canvas camera={{ position: [0, 0, 5] }}>
                    <ambientLight intensity={1} />
                    <directionalLight position={[5, 5, 5]} intensity={1} />
                    <Model url={url} mode={mode} onLoad={setMaxDim} />
                    <CameraController controlsRef={controlsRef} minDistance={maxDim * 0.5} maxDistance={maxDim * 10} />
                </Canvas>
            </div>
        </div>
    )
}