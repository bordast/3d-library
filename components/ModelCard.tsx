import Link from 'next/link'

type Model = {
    id: string
    name: string
    format: string
}

export default function ModelCard({ model }: { model: Model }) {
    return (
        <Link href={`/models/${model.id}`} className="group block rounded-lg border border-border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md">
            <div className="flex items-center justify-center h-40 rounded-t-lg bg-muted text-muted-foreground">
                <BoxIcon />
            </div>
            <div className="p-4 flex items-start justify-between gap-2">
                <p className="font-medium text-sm truncate">{model.name}</p>
                <span className="shrink-0 inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {model.format}
                </span>
            </div>
        </Link>
    )
}

function BoxIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
            <path d="m3.3 7 8.7 5 8.7-5" />
            <path d="M12 22V12" />
        </svg>
    )
}
