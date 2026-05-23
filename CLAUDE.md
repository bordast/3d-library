# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

# 3D Library

A Next.js 16 app for browsing, uploading, and managing 3D model files (.glb, .gltf) with an interactive WebGL viewer.

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
npm run start    # serve a production build
npm run lint     # eslint
```

## Project structure

```
app/
  layout.tsx          # root layout: sticky header, nav, theme toggle, Geist fonts
  page.tsx            # home page
  models/
    page.tsx          # model grid (server component)
    ModelsClient.tsx  # search/filter UI + card grid ('use client')
    [id]/page.tsx     # individual model viewer (server component + dynamic Viewer)
  admin/
    page.tsx          # admin shell (server component)
    AdminClient.tsx   # upload / rename / delete / thumbnail generation ('use client')
  api/models/
    route.ts          # GET list, POST upload (multipart; .glb and .gltf only)
    [id]/route.ts     # PUT rename, DELETE (removes file/folder)
    [id]/textures/    # POST — upload texture/binary files for a GLTF model
    [id]/thumbnail/   # POST — save a base64 WebP thumbnail, update model record
  api/texture/
    [...path]/route.ts  # GET — serve textures with webp-first fallback
  api/categories/
    route.ts          # GET list, POST create
    [id]/route.ts     # PUT rename, DELETE
  api/admin/
    reset/route.ts    # POST — wipe all models, uploads, and thumbnails
components/
  ModelCanvas.tsx     # unified 3D canvas (ssr:false); used by Viewer and thumbnail generator
  ModelCard.tsx       # card with static thumbnail image + ViewTransition morph, links to /models/[id]
  Viewer.tsx          # full viewer shell: solid/wireframe/UV/PBR-debug modes, animated camera presets, auto-captures thumbnail
  ThemeToggle.tsx     # dark/light toggle (reads/writes .dark class on <html>)
lib/
  db.ts               # CRUD over data/models.json; Model and Category types exported here
data/
  models.json         # source of truth for all model records
public/uploads/       # uploaded model files served statically
  glb/                # flat: <timestamp>-<name>.glb
  gltf/               # folder-per-model: <stem>/<timestamp>-<name>.gltf + textures + .bin
public/thumbnails/    # auto-generated WebP thumbnails: <model-id>.webp
public/textures/      # static textures used by the viewer (uv_checker.png)
scripts/
  migrate-uploads.mjs # one-time migration: reorganises flat uploads into format-segregated folders
```

## Key conventions

### Data layer
`lib/db.ts` is the only place that reads or writes `data/models.json`. IDs are slugs derived from the model name (e.g. "Arrow Solid" → `arrow-solid`). Never bypass `lib/db.ts` to touch the JSON directly.

`lib/db.ts` also exports `resetDb()`, which wipes `data/models.json` to `{ categories: [], models: [] }`. It is called exclusively by `POST /api/admin/reset`, which also purges the filesystem.

The `Model` type:
```ts
type Model = {
  id: string
  name: string
  category: string
  format: string       // '.glb' | '.gltf'
  fileUrl: string      // relative path from /public root
  createdAt: string    // ISO date string
  thumbnailUrl?: string // relative path, e.g. /thumbnails/<id>.webp
}
```

### File storage layout
- **GLB**: flat file at `/uploads/glb/<timestamp>-<name>.glb`
- **GLTF**: folder at `/uploads/gltf/<stem>/` containing the `.gltf` file, any referenced `.bin` buffers, and texture images. `fileUrl` is `/uploads/gltf/<stem>/<file>.gltf`.

Deletion removes the entire folder for GLTF models. Detection: `model.format === '.gltf' && fileUrl.split('/').length >= 5`.

### API routes
Route handlers live under `app/api/`. They import from `@/lib/db`.

- `POST /api/models` — multipart upload. Accepts `.glb` and `.gltf` (200 MB limit). Stores files under `public/uploads/` according to the format layout above.
- `PUT /api/models/[id]` — rename and/or recategorise.
- `DELETE /api/models/[id]` — removes the model record and its file(s)/folder.
- `POST /api/models/[id]/textures` — uploads one or more texture/binary files (`.webp`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.bmp`, `.ktx2`, `.basis`, `.bin`, `.glb`) into the GLTF model's folder.
- `POST /api/models/[id]/thumbnail` — receives `{ dataUrl: string }` (base64 WebP), writes to `public/thumbnails/<id>.webp`, updates `thumbnailUrl` in the model record.
- `GET /api/texture/[...path]` — proxies a texture file with format fallback: tries `.webp` first, then the originally requested extension, then `.png` / `.jpg` / `.jpeg` etc. Used by the GLTF loader.
- `POST /api/admin/reset` — deletes all model records (`resetDb()`), removes and recreates `public/uploads/{glb,gltf}` and `public/thumbnails/`. Used by the "Reset library" button in the admin danger zone.

### 3D components
- `ModelCanvas` is the single WebGL canvas. Must be dynamically imported with `ssr: false` everywhere it is used.
- `ModelCanvas` accepts an optional `captureOnLoad?: (dataUrl: string) => void` prop. When provided, a `CaptureOnLoad` component renders inside the Canvas after the model loads, waits **3 R3F frames** (via `useFrame`) before capturing. Three frames are needed because `SceneContent` repositions the camera in a `useEffect`, which only takes effect after the first post-effect render. Before calling `toDataURL`, `CaptureOnLoad` temporarily sets `scene.background = null` to strip the HDRI, issues a synchronous `gl.render()` to produce a transparent frame, then restores the background — so the user never sees a flicker and thumbnails have a transparent background. This requires `preserveDrawingBuffer: true` and `alpha: true` on the Canvas, which are already set.
- `ModelCanvas` accepts an optional `viewOffsetX?: number` prop (default `0`). A `CameraOffset` component inside the Canvas calls `camera.setViewOffset` to shift the render viewport horizontally, visually nudging the model away from the floating sidebar. On viewports narrower than 640 px the offset is cleared so the model stays centred.
- `ModelCanvas` always delays Canvas mount by 420ms (`canvasReady` starts `false`) so WebGL context creation never races the view-transition animation — even on first load.
- `ModelCanvas` manages a module-level `loadedUrls` Set. When the Viewer mounts for an already-loaded URL it initialises `loaded=true` to suppress the spinner.
- `ModelCanvas` has WebGL context loss recovery via a `ContextLossDetector` component that listens for `webglcontextlost` on the canvas element. The first context loss triggers a silent remount (covers React Strict Mode double-invoke and transient GPU resets). A second loss shows an error UI with a **Retry** button. The `retryKey` state is incremented on each retry and passed as `key` to `<Canvas>` to force a full WebGL remount.
- `ModelCanvas` has a 10-second load timeout: if the model hasn't emitted `onLoad` within 10s of the canvas becoming ready, it shows "Failed to load model" with a **Retry** button.
- The inner `ErrorBoundary` (wrapping `Suspense` inside the Canvas) accepts `inline` and `onError` props. With `inline=true` it renders `null` instead of the error card, and calls `onError` to surface the failure to `ModelCanvas` without crashing the surrounding canvas UI.
- **`RenderMode`** is `'solid' | 'wireframe' | 'uv' | 'albedo' | 'normal' | 'roughness' | 'emission'`. It is exported from `ModelCanvas.tsx` and consumed by `Viewer.tsx`.
- **Wireframe mode** adds a `LineSegments(WireframeGeometry, LineBasicMaterial)` as a child of each mesh (`userData.wireframeOverlay = true`) so the overlay inherits all mesh transforms. Stale overlays are removed before applying any mode change. The original mesh materials are made fully transparent (`opacity: 0`) so only the wireframe overlay is visible.
- **UV mode** replaces each mesh's material with a shared `MeshBasicMaterial({ map: uvCheckerTexture, side: DoubleSide })` loaded from `/public/textures/uv_checker.png`. `uvCheckerTexture.flipY = false` is set because GLTF models bake UVs with Y-down convention.
- **PBR debug modes** (`albedo`, `normal`, `roughness`, `emission`) replace each mesh's material with a pre-generated `MeshBasicMaterial` that isolates one texture channel. These are created once on first encounter and stored in `mesh.userData.debugMaterials` to avoid memory leaks on repeated swaps. Original materials are saved in `mesh.userData.originalMaterial` on first use and restored when returning to `solid` or `wireframe`.
- `SceneContent` positions the camera at `(0, maxDim * 0.5, maxDim * 1)` after centering the model. The Canvas default camera starts at `[0, 0.5, 1]`.
- `Viewer` accepts `modelId?: string` and `hasThumbnail?: boolean`. When `modelId` is provided and `hasThumbnail` is false, it passes a `captureOnLoad` callback to `ModelCanvas` that POSTs the screenshot to `/api/models/[id]/thumbnail`. Capture fires only once per `url` (guarded by `capturedRef`); on network error `capturedRef` is reset so the next page load retries.
- `Viewer` has a **desktop right panel** (fixed, `right-4 sm:right-8`, `w-64`) and a **mobile bottom sheet** that slides in from below and can be swiped down (>60 px swipe) or tapped-outside to close. A circular toggle button (`bottom-6 right-4`) is shown on mobile to open/close the sheet. `viewOffsetX={panelOpen && !isMobile ? 144 : 0}` is passed to `ModelCanvas` — offset is only applied when the panel is visible on desktop.
- `Viewer` camera presets (Front/Back/Left/Right/Top/Bottom) and Reset all call `moveTo(x, y, z)`. `moveTo` animates the camera over 500 ms using spherical coordinate interpolation with cubic ease-out via `requestAnimationFrame`. It takes the shortest angular path by clamping the theta delta to ±π. Reset target: `moveTo(0, maxDim * 0.5, maxDim * 1)` — matches `SceneContent` initial position.
- Three.js `OrbitControls` comes from `@react-three/drei`, typed as `OrbitControlsType` from `three-stdlib`.
- The `THREE.Clock` deprecation warning is suppressed at the module level in `ModelCanvas.tsx`. This is necessary because `@react-three/fiber` v9 still uses the deprecated API. Do not remove the `console.warn` patch.

### GLTF texture loading
GLTF files with external textures use a module-level `gltfTextureManager` (`THREE.LoadingManager`) set on the `GLTFLoader` via `useGLTF`'s `extendLoader` callback. Its URL modifier intercepts image URLs under `/uploads/gltf/` and rewrites them to `/api/texture/uploads/gltf/...`, which applies the webp-first fallback. Non-image assets (`.bin` buffers) are not rewritten and load directly from `/uploads/`.

### Admin panel
- **Upload** uses `XMLHttpRequest` (not `fetch`) to get real-time progress via `xhr.upload.onprogress`. The button label shows `"Uploading… 42%"` while transferring and `"Processing…"` once the server is handling the file. Client-side validation (200 MB limit, `.glb`/`.gltf` only) runs before the request is sent. After a successful upload, the new model is automatically queued for thumbnail generation.
- **Texture uploads** (for GLTF models with a folder layout) show a fixed-position toast notification (success or error, auto-dismissed after 3 s).
- **Danger zone** — a "Reset library" button at the bottom of the admin page opens a confirmation dialog, then calls `POST /api/admin/reset` to wipe all models, files, and thumbnails.

### Thumbnails
- `ModelCard` shows a static `<img src={model.thumbnailUrl}>` when a thumbnail exists, or a placeholder cube icon when not.
- Thumbnails are generated on demand from the admin panel: the "Generate thumbnails (N)" button in the Models card header queues all models missing a thumbnail and processes them one at a time through a hidden off-screen `ModelCanvas` (256×256, `position: fixed; left: -9999px`). Only one WebGL context is live at a time. Progress is shown as `"Generating… 2/5"`. Each result is saved via `POST /api/models/[id]/thumbnail`.
- The `ViewTransition` morph from card (`<img>`) to detail (`<canvas>`) still works because both are wrapped in matching `<ViewTransition name={`model-preview-${id}`} share="morph">` elements.

### View transitions
- `experimental.viewTransition: true` is set in `next.config.ts` to enable React 19's `<ViewTransition>` during route navigation.
- `ModelCard` wraps its thumbnail div in `<ViewTransition name={`model-preview-${id}`} share="morph">`. The detail page wraps the `Viewer` container in a matching `<ViewTransition name={`model-preview-${id}`} share="morph">`. The matching names trigger a shared-element morph between the two.
- `<Link>` elements use `transitionTypes={['nav-forward']}` (card) and `transitionTypes={['nav-back']}` (back link) to tag navigation direction.
- The header uses `style={{ viewTransitionName: 'site-header' }}` so it stays fixed during transitions.
- Transition timing and the `via-blur` keyframe are defined in `globals.css` under `::view-transition-group(.morph)`.
- `preserveDrawingBuffer: true` on the WebGL Canvas allows the browser to snapshot the rendered 3D frame for the transition.

### Styling
Design tokens are CSS custom properties defined in `globals.css` (shadcn/ui-style palette). Tailwind v4 picks them up via `@theme inline`. Use semantic tokens (`bg-background`, `text-muted-foreground`, `border-border`, etc.) — never raw hex or hardcoded colors. Dark mode uses the `.dark` class on `<html>`.

### Supported file formats
`.glb` and `.gltf` only. Validation is enforced in both the API route (`app/api/models/route.ts`) and the admin upload form.

### LAN development
`next.config.ts` auto-detects local network IPs via `os.networkInterfaces()` and adds them to `allowedDevOrigins`, so the dev server is reachable on the local network (e.g. from a phone) without CORS errors.

## Commit message convention

Every commit message starts with a capitalised **verb prefix**, followed by a short imperative sentence. No trailing period.

| Prefix | When to use |
|--------|-------------|
| `Add` | New file, component, route, dependency, or feature added from scratch |
| `Remove` | File, component, dependency, or dead code deleted |
| `Feat` | New user-facing capability that spans multiple files / isn't just one addition |
| `Update` | Change to existing behaviour, content, or config (not a bug fix) |
| `Fix` | Bug fix — something was broken and now it isn't |
| `Refactor` | Code restructured without changing behaviour |
| `Style` | CSS / Tailwind / visual-only changes, no logic touched |
| `Docs` | README, CLAUDE.md, comments, or other documentation only |
| `Chore` | Tooling, scripts, CI, dependency bumps, or housekeeping |

**Format:** `<Prefix> <what and where, ≤72 chars>`

```
Add ModelCard skeleton loading state
Fix Viewer wireframe mode not toggling on first click
Update admin upload form to accept .gltf files
Remove unused ThemeContext provider
Refactor db.ts slug generation into a shared utility
```

Rules:
- Imperative mood — "Add X", not "Added X" or "Adds X"
- First word is always the prefix from the table above
- No issue/ticket numbers in the subject line
- If more context is needed, add a blank line then a body paragraph

## Next.js 16 notes
This is **Next.js 16** — it may differ significantly from earlier versions. Before writing routing, caching, or server/client component code, consult `node_modules/next/dist/docs/` (especially `01-app/`).
