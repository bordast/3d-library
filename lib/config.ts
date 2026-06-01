export const SITE = {
    name: '3D Library',
    description: 'A curated collection of 3D models.',
}

export const NAV_LINKS = [
    { href: '/models', label: 'Models' },
    { href: '/videos', label: 'Videos' },
    { href: '/pdfs',   label: 'PDFs'   },
    { href: '/admin',  label: 'Admin'  },
]

export const LAYOUT = {
    containerCls: 'mx-auto max-w-screen-xl px-4',
    headerHeight: 'h-14',
    mainPy: 'py-8',
}

export const GRID = {
    cards: 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4',
}

export const CARD = {
    thumbnailClass: 'h-40',
}

export const UPLOAD = {
    model: {
        maxBytes: 200 * 1024 * 1024,
        accept: ['.glb', '.gltf'],
    },
    video: {
        maxBytes: 500 * 1024 * 1024,
        accept: ['.mp4', '.webm'],
    },
    pdf: {
        maxBytes: 100 * 1024 * 1024,
        accept: ['.pdf'],
    },
}

export const SEARCH = {
    maxSuggestions: 6,
}
