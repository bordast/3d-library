import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Link from 'next/link'
import './globals.css'
import ThemeToggle from '@/components/ThemeToggle'
import NavLinks from '@/components/NavLinks'
import { SITE, LAYOUT } from '@/lib/config'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
    title: SITE.name,
    description: SITE.description,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
            <body className="min-h-screen bg-background font-sans antialiased">
                <header style={{ viewTransitionName: 'site-header' }} className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    <div className={`${LAYOUT.containerCls} flex ${LAYOUT.headerHeight} items-center gap-6`}>
                        <Link href="/" className="flex items-center gap-2 font-semibold text-foreground">
                            <BoxIcon />
                            <span>{SITE.name}</span>
                        </Link>
                        <NavLinks />
                        <div className="ml-auto">
                            <ThemeToggle />
                        </div>
                    </div>
                </header>
                <main className={`${LAYOUT.containerCls} ${LAYOUT.mainPy}`}>
                    {children}
                </main>
            </body>
        </html>
    )
}

function BoxIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
            <path d="m3.3 7 8.7 5 8.7-5" />
            <path d="M12 22V12" />
        </svg>
    )
}
