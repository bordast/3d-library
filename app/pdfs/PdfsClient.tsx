'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import PdfCard from '@/components/PdfCard'
import type { Pdf } from '@/lib/pdfdb'
import { GRID, SEARCH } from '@/lib/config'

export default function PdfsClient({ pdfs }: { pdfs: Pdf[] }) {
    const [nameQuery, setNameQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('')
    const [nameOpen, setNameOpen] = useState(false)
    const [catOpen, setCatOpen] = useState(false)
    const [focusedIdx, setFocusedIdx] = useState(-1)
    const nameRef = useRef<HTMLDivElement>(null)
    const catRef = useRef<HTMLDivElement>(null)

    const categories = useMemo(() => {
        const seen = new Set<string>()
        const result: string[] = []
        for (const p of pdfs) {
            if (!seen.has(p.category)) {
                seen.add(p.category)
                result.push(p.category)
            }
        }
        return result.sort()
    }, [pdfs])

    const nq = nameQuery.trim().toLowerCase()

    const nameSuggestions: string[] = useMemo(() => {
        if (nq.length === 0) return []
        const seen = new Set<string>()
        const result: string[] = []
        for (const p of pdfs) {
            if (!seen.has(p.name) && p.name.toLowerCase().includes(nq)) {
                seen.add(p.name)
                result.push(p.name)
            }
        }
        return result.slice(0, SEARCH.maxSuggestions)
    }, [pdfs, nq])

    const filtered = useMemo(() => pdfs.filter(p => {
        const nameMatch = nq.length === 0 || p.name.toLowerCase().includes(nq)
        const catMatch = selectedCategory === '' || p.category === selectedCategory
        return nameMatch && catMatch
    }), [pdfs, nq, selectedCategory])

    useEffect(() => {
        function onPointerDown(e: PointerEvent) {
            if (nameRef.current && !nameRef.current.contains(e.target as Node)) setNameOpen(false)
            if (catRef.current && !catRef.current.contains(e.target as Node)) setCatOpen(false)
        }
        document.addEventListener('pointerdown', onPointerDown)
        return () => document.removeEventListener('pointerdown', onPointerDown)
    }, [])

    function selectName(name: string) {
        setNameQuery(name)
        setNameOpen(false)
        setFocusedIdx(-1)
    }

    function selectCategory(cat: string) {
        setSelectedCategory(cat)
        setCatOpen(false)
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setNameOpen(true)
            setFocusedIdx(i => Math.min(i + 1, nameSuggestions.length - 1))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setFocusedIdx(i => Math.max(i - 1, -1))
        } else if (e.key === 'Enter' && focusedIdx >= 0) {
            e.preventDefault()
            selectName(nameSuggestions[focusedIdx])
        } else if (e.key === 'Escape') {
            setNameOpen(false)
            setFocusedIdx(-1)
        }
    }

    const catOptions = [{ value: '', label: 'All categories' }, ...categories.map(c => ({ value: c, label: c }))]
    const catLabel = selectedCategory || 'All categories'

    return (
        <>
            {/* Search controls */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">

                {/* Name search */}
                <div ref={nameRef} className="relative flex-1">
                    <div className="relative">
                        <svg
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
                            xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                            stroke="currentColor" strokeWidth={2}
                        >
                            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                        </svg>
                        <input
                            type="text"
                            value={nameQuery}
                            onChange={e => { setNameQuery(e.target.value); setNameOpen(true); setFocusedIdx(-1) }}
                            onFocus={() => { if (nq.length > 0) setNameOpen(true) }}
                            onKeyDown={handleKeyDown}
                            placeholder="Search by name…"
                            className="flex h-10 w-full rounded-md border border-input bg-transparent pl-9 pr-9 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                        {nameQuery && (
                            <button
                                onClick={() => { setNameQuery(''); setNameOpen(false) }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                aria-label="Clear"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="size-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>

                    {nameOpen && nameSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-md border border-border bg-card shadow-md overflow-hidden">
                            {nameSuggestions.map((name, i) => (
                                <button
                                    key={name}
                                    onPointerDown={e => { e.preventDefault(); selectName(name) }}
                                    className={[
                                        'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors',
                                        i === focusedIdx
                                            ? 'bg-accent text-accent-foreground'
                                            : 'hover:bg-accent hover:text-accent-foreground',
                                    ].join(' ')}
                                >
                                    <svg className="shrink-0 size-3.5 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                                    </svg>
                                    {name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Category dropdown */}
                <div ref={catRef} className="relative sm:w-52 shrink-0">
                    <button
                        onClick={() => setCatOpen(o => !o)}
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors hover:bg-accent/50"
                    >
                        <span className={selectedCategory ? 'text-foreground' : 'text-muted-foreground'}>
                            {catLabel}
                        </span>
                        <svg
                            xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                            stroke="currentColor" strokeWidth={2}
                            className={['size-4 text-muted-foreground transition-transform', catOpen ? 'rotate-180' : ''].join(' ')}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                        </svg>
                    </button>

                    {catOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-md border border-border bg-card shadow-md overflow-hidden">
                            {catOptions.map(({ value, label }) => (
                                <button
                                    key={value || '__all__'}
                                    onPointerDown={e => { e.preventDefault(); selectCategory(value) }}
                                    className={[
                                        'w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors',
                                        value === selectedCategory
                                            ? 'bg-accent text-accent-foreground'
                                            : 'hover:bg-accent hover:text-accent-foreground',
                                    ].join(' ')}
                                >
                                    {label}
                                    {value === selectedCategory && (
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} className="size-3.5 shrink-0">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                        </svg>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Grid / empty state */}
            {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center border border-dashed border-border rounded-lg">
                    <p className="text-muted-foreground text-sm">No PDFs match your filters.</p>
                    <button
                        onClick={() => { setNameQuery(''); setSelectedCategory('') }}
                        className="mt-3 text-sm font-medium text-foreground underline underline-offset-4"
                    >
                        Clear filters
                    </button>
                </div>
            ) : (
                <div className={GRID.cards}>
                    {filtered.map(pdf => (
                        <PdfCard key={pdf.id} pdf={pdf} />
                    ))}
                </div>
            )}
        </>
    )
}
