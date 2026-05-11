@AGENTS.md

# 3D Library

A Next.js 16 app for browsing, uploading, and managing 3D model files (.glb, .gltf, .obj) with an interactive WebGL viewer.

## Stack

- **Next.js 16.2.4** with App Router and React Compiler (`reactCompiler: true`)
- **React 19** — use `'use client'` only when browser APIs or interactivity are required
- **Three.js 0.184 / @react-three/fiber v9 / @react-three/drei v10** for 3D rendering
- **Tailwind CSS v4** — configured via `@import "tailwindcss"` in [app/globals.css](app/globals.css), no `tailwind.config`
- **TypeScript 5** — strict, path alias `@/` maps to project root
- No database — data lives in [data/models.json](data/models.json); all reads/writes go through [lib/db.ts](lib/db.ts)

## Commands

```bash
npm run dev      # start dev server (port 3000)
npm run build    # production build
npm run lint     # eslint
```

## Project structure

```
app/
  layout.tsx          # root layout: sticky header, nav, theme toggle, Geist fonts
  page.tsx            # home page
  models/
    page.tsx          # model grid (server component)
    [id]/page.tsx     # individual model viewer (server component + dynamic Viewer)
  admin/
    page.tsx          # admin shell (server)
    AdminClient.tsx   # upload / rename / delete UI ('use client')
  api/models/
    route.ts          # GET list, POST upload (multipart)
    [id]/route.ts     # PUT rename, DELETE (also unlinks file)
components/
  ModelCanvas.tsx     # unified 3D canvas (ssr:false); used by both ModelCard and Viewer
  ModelCard.tsx       # card with live 3D preview + ViewTransition morph, links to /models/[id]
  Viewer.tsx          # full viewer shell: solid/wireframe/UV modes, camera presets
  ThemeToggle.tsx     # dark/light toggle (reads/writes .dark class on <html>)
lib/
  db.ts               # CRUD over data/models.json; Model type exported here
data/
  models.json         # source of truth for all model records
public/uploads/       # uploaded model files served statically
```

## Key conventions

### Data layer
`lib/db.ts` is the only place that reads or writes `data/models.json`. IDs are slugs derived from the model name (e.g. "Arrow Solid" → `arrow-solid`). Never bypass `lib/db.ts` to touch the JSON directly.

### API routes
Route handlers live under `app/api/`. They import from `@/lib/db`. File uploads write to `public/uploads/` and the relative path (`/uploads/<filename>`) is stored in `fileUrl`.

### 3D components
- `ModelCanvas` is the single WebGL canvas used everywhere. It must be dynamically imported with `ssr: false`. Both `ModelCard` and `Viewer` import it this way.
- `Viewer` is a thin shell that wraps `ModelCanvas` and adds the display-mode buttons and camera-preset sidebar.
- `ModelCanvas` manages a module-level `loadedUrls` Set. When a model URL is first rendered in a card, it's added to the Set. When the Viewer mounts for the same URL, it initializes `loaded=true` (no spinner) and defers Canvas mount by 420ms so WebGL context creation doesn't compete with the view-transition animation.
- Three.js `OrbitControls` comes from `@react-three/drei`, typed as `OrbitControlsType` from `three-stdlib`.
- The `THREE.Clock` deprecation warning is suppressed at the module level in `ModelCanvas.tsx`. This is necessary because `@react-three/fiber` v9 still uses the deprecated API. Do not remove the `console.warn` patch.

### View transitions
- `experimental.viewTransition: true` is set in `next.config.ts` to enable React 19's `<ViewTransition>` during route navigation.
- `ModelCard` wraps its canvas div in `<ViewTransition name={`model-preview-${id}`} share="morph">`. The detail page wraps the `Viewer` container in a matching `<ViewTransition name={`model-preview-${id}`} share="morph">`. The matching names trigger a shared-element morph between the two.
- `<Link>` elements use `transitionTypes={['nav-forward']}` (card) and `transitionTypes={['nav-back']}` (back link) to tag navigation direction.
- The header uses `style={{ viewTransitionName: 'site-header' }}` so it stays fixed during transitions.
- Transition timing and the `via-blur` keyframe are defined in `globals.css` under `::view-transition-group(.morph)`.
- `preserveDrawingBuffer: true` on the WebGL Canvas allows the browser to snapshot the rendered 3D frame for the transition.

### Styling
Design tokens are CSS custom properties defined in `globals.css` (shadcn/ui-style palette). Tailwind v4 picks them up via `@theme inline`. Use semantic tokens (`bg-background`, `text-muted-foreground`, `border-border`, etc.) — never raw hex or hardcoded colors. Dark mode uses the `.dark` class on `<html>`.

### Supported file formats
`.glb`, `.gltf`, `.obj` only. Validation is enforced in both the API route and the admin upload form.

## Next.js 16 notes
This is **Next.js 16** — it may differ significantly from earlier versions. Before writing routing, caching, or server/client component code, consult `node_modules/next/dist/docs/` (especially `01-app/`).
