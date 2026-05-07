'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
    { href: '/models', label: 'Models' },
    { href: '/admin', label: 'Admin' },
]

export default function NavLinks() {
    const pathname = usePathname()

    return (
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
            {links.map(({ href, label }) => {
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
