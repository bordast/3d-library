import { getVideo } from '@/lib/videodb'
import VideoPlayer from '@/components/VideoPlayer'
import Link from 'next/link'

type Props = { params: Promise<{ id: string }> }

export default async function VideoPage({ params }: Props) {
    const { id } = await params
    const video = await getVideo(id)

    if (!video) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <p className="text-lg font-semibold text-foreground">Video not found</p>
                <Link href="/videos" className="mt-3 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
                    Back to videos
                </Link>
            </div>
        )
    }

    return (
        <div className="max-w-3xl mx-auto flex flex-col gap-4">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">{video.name}</h1>
                <p className="text-sm text-muted-foreground mt-1">{video.category}</p>
            </div>
            <VideoPlayer video={video} />
            <Link href="/videos" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground w-fit">
                ← Back to videos
            </Link>
        </div>
    )
}
