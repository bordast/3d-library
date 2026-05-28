import { getVideos } from '@/lib/videodb'
import VideosClient from './VideosClient'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function VideosPage() {
    const videos = await getVideos()

    return (
        <div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Videos</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {videos.length} {videos.length === 1 ? 'video' : 'videos'} in your library
                    </p>
                </div>
                <Link
                    href="/admin"
                    className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-medium h-9 px-4 shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                    Add video
                </Link>
            </div>

            {videos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center border border-dashed border-border rounded-lg">
                    <p className="text-muted-foreground text-sm">No videos yet.</p>
                    <Link href="/admin" className="mt-3 text-sm font-medium text-foreground underline underline-offset-4">
                        Add your first video
                    </Link>
                </div>
            ) : (
                <VideosClient videos={videos} />
            )}
        </div>
    )
}
