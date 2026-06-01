'use client'

import { useEffect, useRef, useState } from 'react'
import HTMLFlipBook from 'react-pageflip'
import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'

// Worker served locally from public/ — same-origin avoids cross-origin module-worker CORS restrictions
// that cause pdfjs to silently fall back to fake-worker mode (which can't decode image XObjects).
// Run: cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/ after upgrading pdfjs-dist.
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

// Max display dimensions per page.
// Portrait always shows as a double spread (2 × 420 = 840 px).
// Landscape shows as a double spread too but narrower (2 × 480 = 960 px) to stay within viewports.
const PORTRAIT_MAX = { w: 420, h: 594 }
const LANDSCAPE_MAX = { w: 480, h: 340 }

type PageSize = { width: number; height: number; isLandscape: boolean }

function calcPageSize(pdfW: number, pdfH: number): PageSize {
    const isLandscape = pdfW > pdfH
    const max = isLandscape ? LANDSCAPE_MAX : PORTRAIT_MAX
    const scale = Math.min(max.w / pdfW, max.h / pdfH)
    return { width: Math.round(pdfW * scale), height: Math.round(pdfH * scale), isLandscape }
}

function PdfPage({
    pdf,
    pageNumber,
    shouldRender,
    width,
    height,
}: {
    pdf: PDFDocumentProxy | null
    pageNumber: number
    shouldRender: boolean
    width: number
    height: number
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [rendered, setRendered] = useState(false)

    useEffect(() => {
        if (!pdf || !shouldRender) return
        let cancelled = false

        async function render() {
            try {
                const page = await pdf!.getPage(pageNumber)
                if (cancelled || !canvasRef.current) return
                const canvas = canvasRef.current
                const ctx = canvas.getContext('2d')!
                const unscaled = page.getViewport({ scale: 1 })
                const scale = Math.min(width / unscaled.width, height / unscaled.height)
                const viewport = page.getViewport({ scale })
                canvas.width = viewport.width
                canvas.height = viewport.height
                await page.render({ canvas: null, canvasContext: ctx, viewport }).promise
                if (!cancelled) setRendered(true)
            } catch {
                // render cancelled on unmount or page unavailable
            }
        }

        render()
        return () => { cancelled = true }
    }, [pdf, pageNumber, shouldRender, width, height])

    return (
        <div
            style={{
                width,
                height,
                background: 'white',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
            }}
        >
            <canvas
                ref={canvasRef}
                style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }}
            />
            {!rendered && shouldRender && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'white',
                    }}
                >
                    <div className="size-5 animate-spin rounded-full border-2 border-border border-t-muted-foreground" />
                </div>
            )}
        </div>
    )
}

export default function PdfViewer({ url }: { url: string }) {
    const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
    const [numPages, setNumPages] = useState(0)
    const [currentPage, setCurrentPage] = useState(0)
    const [pageSize, setPageSize] = useState<PageSize>({ ...PORTRAIT_MAX, isLandscape: false })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bookRef = useRef<any>(null)

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        setError(null)
        setPdf(null)
        setNumPages(0)
        setCurrentPage(0)
        setPageSize({ ...PORTRAIT_MAX, isLandscape: false })

        const task = pdfjsLib.getDocument({ url })
        task.promise
            .then(async doc => {
                if (cancelled) return
                // Detect page orientation from page 1 before showing the book.
                const page1 = await doc.getPage(1)
                if (cancelled) return
                const vp = page1.getViewport({ scale: 1 })
                setPageSize(calcPageSize(vp.width, vp.height))
                setPdf(doc)
                setNumPages(doc.numPages)
                setLoading(false)
            })
            .catch((err) => {
                if (cancelled) return
                console.error('PdfViewer: failed to load', url, err)
                setError('Failed to load PDF.')
                setLoading(false)
            })

        return () => {
            cancelled = true
            task.destroy()
        }
    }, [url])

    function prevPage() {
        bookRef.current?.pageFlip().flipPrev()
    }

    function nextPage() {
        bookRef.current?.pageFlip().flipNext()
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center gap-3 py-24 text-muted-foreground">
                <div className="size-5 animate-spin rounded-full border-2 border-border border-t-muted-foreground" />
                <span className="text-sm">Loading PDF…</span>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-24">
                <p className="text-sm text-muted-foreground">{error}</p>
            </div>
        )
    }

    const { width, height, isLandscape } = pageSize

    return (
        <div className="flex flex-col items-center gap-6 py-4">
            <div className="w-full overflow-x-auto flex justify-center">
                <HTMLFlipBook
                    ref={bookRef}
                    className=""
                    style={{}}
                    width={width}
                    height={height}
                    size="fixed"
                    minWidth={width}
                    maxWidth={width}
                    minHeight={height}
                    maxHeight={height}
                    drawShadow
                    flippingTime={700}
                    usePortrait={false}
                    startZIndex={20}
                    autoSize={false}
                    maxShadowOpacity={0.5}
                    showCover={false}
                    mobileScrollSupport
                    clickEventForward
                    useMouseEvents
                    swipeDistance={30}
                    showPageCorners
                    disableFlipByClick={false}
                    startPage={0}
                    onFlip={(e: { data: number }) => setCurrentPage(e.data)}
                >
                    {Array.from({ length: numPages }, (_, i) => (
                        <div key={i}>
                            <PdfPage
                                pdf={pdf}
                                pageNumber={i + 1}
                                shouldRender={Math.abs(i - currentPage) <= 3}
                                width={width}
                                height={height}
                            />
                        </div>
                    ))}
                </HTMLFlipBook>
            </div>

            <div className="flex items-center gap-4">
                <button
                    onClick={prevPage}
                    disabled={currentPage === 0}
                    className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 h-9 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:pointer-events-none"
                >
                    ← Previous
                </button>
                <span className="text-sm text-muted-foreground tabular-nums min-w-28 text-center">
                    Page {currentPage + 1} of {numPages}
                </span>
                <button
                    onClick={nextPage}
                    disabled={currentPage >= numPages - 1}
                    className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 h-9 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:pointer-events-none"
                >
                    Next →
                </button>
            </div>
        </div>
    )
}
