import Link from 'next/link'

export default function HomePage() {
    return (
        <div className="flex flex-col items-center justify-center py-12 sm:py-24 text-center gap-6">
            <div className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                Open source · Free to use
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                Your 3D Model Library
            </h1>
            <p className="max-w-md text-muted-foreground text-lg leading-relaxed">
                Upload, organise, and preview 3D models in your browser. Supports GLB, GLTF and OBJ formats.
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row">
                <Link
                    href="/models"
                    className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-medium h-10 px-6 shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                    Browse Models
                </Link>
                <Link
                    href="/admin"
                    className="inline-flex items-center justify-center rounded-md border border-border bg-background text-foreground text-sm font-medium h-10 px-6 shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                    Upload a Model
                </Link>
            </div>
        </div>
    )
}
