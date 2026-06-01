'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_LINKS } from '@/lib/config'

export default function NavLinks() {
    const pathname = usePathname()

    return (
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
            {NAV_LINKS.map(({ href, label }) => {
                const active = pathname === href || pathname.startsWith(href + '/')
                return (
                    <Link
                        key={href}
                        href={href}
                        className={`px-3 py-1.5 rounded-md transition-colors hover:text-foreground hover:bg-accent ${
                            active ? 'text-foreground bg-accent' : ''
                        }`}
                    >
                        {label}
                    </Link>
                )
            })}
        </nav>
    )
}
