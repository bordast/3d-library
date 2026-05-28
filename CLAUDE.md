# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

# 3D Library

A Next.js 16 app for browsing, uploading, and managing 3D model files (.glb, .gltf) with an interactive WebGL viewer, plus a video gallery for YouTube, Vimeo, and uploaded MP4/WebM files.

## Stack

- **Next.js 16.2.4** with App Router and React Compiler (`reactCompiler: true`)
- **React 19** — use `'use client'` only when browser APIs or interactivity are required
- **Three.js 0.184 / @react-three/fiber v9 / @react-three/drei v10** for 3D rendering
- **Tailwind CSS v4** — configured via `@import "tailwindcss"` in [app/globals.css](app/globals.css), no `tailwind.config`
- **TypeScript 5** — strict, path alias `@/` maps to project root
- No database — model data lives in [data/models.json](data/models.json) via [lib/db.ts](lib/db.ts); video data lives in [data/videos.json](data/videos.json) via [lib/videodb.ts](lib/videodb.ts). Each JSON file is a standalone store — never mix them.

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
  videos/
    page.tsx          # video grid (server component)
    VideosClient.tsx  # search/filter UI + card grid ('use client')
    [id]/page.tsx     # video detail/player page (server component)
  admin/
    page.tsx          # admin shell — fetches models+categories+videos+videoCategories in parallel
    AdminClient.tsx   # Models/Videos tab switcher; model upload modal; video add modal; CRUD for both ('use client')
  api/models/
    route.ts          # GET list, POST upload (multipart; .glb and .gltf only)
    [id]/route.ts     # PUT rename, DELETE (removes file/folder)
    [id]/textures/    # POST — upload texture/binary files for a GLTF model
    [id]/thumbnail/   # POST — save a base64 WebP thumbnail, update model record
  api/videos/
    route.ts          # GET list, POST create (JSON URL or multipart file upload)
    [id]/route.ts     # PUT rename/recategorise, DELETE (removes file if sourceType=upload)
    categories/
      route.ts        # GET list, POST create
      [id]/route.ts   # PUT rename (cascades to videos), DELETE (resets videos to uncategorised)
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
  VideoCard.tsx       # card with thumbnail or play-icon placeholder + source-type badge, links to /videos/[id]
  VideoPlayer.tsx     # renders YouTube iframe / Vimeo iframe / HTML5 <video> based on sourceType ('use client')
  Viewer.tsx          # full viewer shell: solid/wireframe/UV/PBR-debug modes, animated camera presets, material color editor
  ThemeToggle.tsx     # dark/light toggle (reads/writes .dark class on <html>)
  NavLinks.tsx        # active-aware nav links (models / videos / admin) ('use client')
lib/
  db.ts               # CRUD over data/models.json; Model and Category types exported here
  videodb.ts          # CRUD over data/videos.json; Video and VideoCategory types exported here
data/
  models.json         # source of truth for all model records
  videos.json         # source of truth for all video records (separate store)
public/uploads/       # uploaded model files served statically
  glb/                # flat: <timestamp>-<name>.glb
  gltf/               # folder-per-model: <stem>/<timestamp>-<name>.gltf + textures + .bin
  videos/             # flat: <timestamp>-<name>.mp4 / .webm
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
- **`MaterialEntry`** is `{ id: string; name: string; color: string }`, also exported from `ModelCanvas.tsx`. `id` is the Three.js material UUID (stable within a session). After the scene loads, `SceneContent` traverses all meshes, collects unique materials by UUID, and calls `onMaterials?.()`. `ModelCanvas` accepts `onMaterials?: (mats: MaterialEntry[]) => void` and `materialColors?: Record<string, string>`. When `materialColors` is provided, a `useLayoutEffect` applies each color to both the active mesh material and `mesh.userData.originalMaterial` so render-mode switching doesn't revert user changes. A separate `useEffect` snapshots every material's original hex color on mount and restores them on unmount — required because `useGLTF` caches scenes globally and color mutations would otherwise persist to the next session.
- **Wireframe mode** adds a `LineSegments(WireframeGeometry, LineBasicMaterial)` as a child of each mesh (`userData.wireframeOverlay = true`) so the overlay inherits all mesh transforms. Stale overlays are removed before applying any mode change. The original mesh materials are made fully transparent (`opacity: 0`) so only the wireframe overlay is visible.
- **UV mode** replaces each mesh's material with a shared `MeshBasicMaterial({ map: uvCheckerTexture, side: DoubleSide })` loaded from `/public/textures/uv_checker.png`. `uvCheckerTexture.flipY = false` is set because GLTF models bake UVs with Y-down convention.
- **PBR debug modes** (`albedo`, `normal`, `roughness`, `emission`) replace each mesh's material with a pre-generated `MeshBasicMaterial` that isolates one texture channel. These are created once on first encounter and stored in `mesh.userData.debugMaterials` to avoid memory leaks on repeated swaps. Original materials are saved in `mesh.userData.originalMaterial` on first use and restored when returning to `solid` or `wireframe`.
- `SceneContent` positions the camera at `(0, maxDim * 0.5, maxDim * 1)` after centering the model. The Canvas default camera starts at `[0, 0.5, 1]`.
- `Viewer` accepts `{ url, name?, category?, format? }`. It does not auto-capture thumbnails; thumbnail generation is triggered manually from the admin panel only.
- `Viewer` has a **desktop right panel** (fixed, `right-4 sm:right-8`, `w-64`) and a **mobile bottom sheet** that slides in from below and can be swiped down (>60 px swipe) or tapped-outside to close. A circular toggle button (`bottom-6 right-4`) is shown on mobile to open/close the sheet. `viewOffsetX={panelOpen && !isMobile ? 144 : 0}` is passed to `ModelCanvas` — offset is only applied when the panel is visible on desktop.
- `Viewer` has a **Materials** section in the panel that appears once `onMaterials` fires. Each entry shows the material name and a native `<input type="color">` that drives `materialColors` state. `handleMaterials` seeds initial colors from the model on first load without overwriting any existing overrides. The `url` change effect resets both `materials` and `materialColors` to empty.
- `Viewer` camera presets (Front/Back/Left/Right/Top/Bottom) and Reset all call `moveTo(x, y, z)`. `moveTo` animates the camera over 500 ms using spherical coordinate interpolation with cubic ease-out via `requestAnimationFrame`. It takes the shortest angular path by clamping the theta delta to ±π. Reset target: `moveTo(0, maxDim * 0.5, maxDim * 1)` — matches `SceneContent` initial position.
- Three.js `OrbitControls` comes from `@react-three/drei`, typed as `OrbitControlsType` from `three-stdlib`.
- The `THREE.Clock` deprecation warning is suppressed at the module level in `ModelCanvas.tsx`. This is necessary because `@react-three/fiber` v9 still uses the deprecated API. Do not remove the `console.warn` patch.

### GLTF texture loading
GLTF files with external textures use a module-level `gltfTextureManager` (`THREE.LoadingManager`) set on the `GLTFLoader` via `useGLTF`'s `extendLoader` callback. Its URL modifier intercepts image URLs under `/uploads/gltf/` and rewrites them to `/api/texture/uploads/gltf/...`, which applies the webp-first fallback. Non-image assets (`.bin` buffers) are not rewritten and load directly from `/uploads/`.

### Video gallery

`lib/videodb.ts` is the only place that reads or writes `data/videos.json`. It is a direct structural mirror of `lib/db.ts` with its own private `toSlug`/`uniqueSlug` helpers (not shared). Never add video logic to `db.ts` or model logic to `videodb.ts`.

The `Video` type:
```ts
type Video = {
  id: string           // slug derived from name
  name: string
  category: string     // video category name, or 'uncategorised'
  sourceType: 'youtube' | 'vimeo' | 'upload'
  sourceUrl: string    // original YouTube/Vimeo URL, or /uploads/videos/<file>
  thumbnailUrl?: string // YouTube: https://img.youtube.com/vi/{id}/hqdefault.jpg; others: absent
  createdAt: string
}
```

Video and model categories are **completely independent** — `VideoCategory` lives only in `data/videos.json` and is managed by `/api/videos/categories`.

**API routes** (`app/api/videos/`):
- `POST /api/videos` with JSON body `{ name, url, category? }` — URL path: parses YouTube ID (handles `watch?v=`, `youtu.be/`, `/shorts/`, `/embed/`) or Vimeo ID; rejects unrecognised URLs; auto-sets `thumbnailUrl` from YouTube's `hqdefault.jpg`.
- `POST /api/videos` with `multipart/form-data` — upload path: validates `.mp4`/`.webm`, 500 MB limit, stores flat at `public/uploads/videos/<timestamp>-<name>.ext`.
- `DELETE /api/videos/[id]` — removes the JSON record; additionally `unlink`s the file if `sourceType === 'upload'`.

**`VideoPlayer`** derives the embed URL from `sourceUrl` at render time (no stored embed URL) — same parsing logic as the API route, duplicated in the component intentionally to keep each boundary self-contained.

**`VideoCard`** has no `ViewTransition` wrapper — view transitions are specific to the 3D model preview flow and are not used for videos.

### Admin panel
- **The admin page has a Models/Videos tab switcher** at the top. Models tab contains the existing upload flow + categories + table + danger zone. Videos tab contains video categories + videos table + add video modal. State for each tab is fully isolated — no shared state variables.
- **Upload flow** is a **3-step modal**: step 1 uploads the model file via `XMLHttpRequest` (for real-time progress — button shows `"Uploading… 42%"` then `"Processing…"`); step 2 uploads textures/`.bin` (required for GLTF, skippable for GLB); step 3 triggers thumbnail generation. Client-side validation (200 MB limit, `.glb`/`.gltf` only) runs before the XHR is sent.
- After step 1 succeeds, `pendingModel` state and `pendingModelRef` (a ref) are set to the new model. `pendingModelRef` is used inside callbacks (`handleGenDone`, texture upload handler) to avoid stale closures.
- **Texture uploads** (step 2 and the per-row "Upload textures & .bin" button) post to `POST /api/models/[id]/textures` and show a fixed-position toast notification (success or error, auto-dismissed after 3 s). `uploadedTexturesIds: Set<string>` (session state) tracks which models have had textures uploaded so the table can switch from "Upload textures & .bin" to "Render" without requiring a page reload.
- Per-model thumbnail column logic: if generating → spinner; if GLTF folder-based with no thumbnail and no session textures upload → "Upload textures & .bin" button; otherwise → "Render" (no thumbnail) or "Regenerate" (has thumbnail).
- **Video add modal** is a **2-step modal**: step 1 is a source-type picker (YouTube URL / Vimeo URL / Upload file); step 2 shows either a URL form (JSON `POST /api/videos`) or a file upload form (XHR with progress, same pattern as the model upload). Uses separate `ref`s from the model upload form to avoid collisions.
- **Danger zone** — a "Reset library" button at the bottom of the Models tab opens a confirmation dialog, then calls `POST /api/admin/reset` to wipe all models, files, and thumbnails. Video data is unaffected by this reset.

### Thumbnails
- `ModelCard` shows a static `<img src={model.thumbnailUrl}>` when a thumbnail exists, or a placeholder cube icon when not.
- Thumbnails are generated on demand per model from the admin table (Render / Regenerate buttons). They are processed one at a time through a hidden off-screen `ThumbnailGenerator` component (`position: fixed; left: -9999px`, 256×256) that renders a `ModelCanvas` and fires `captureOnLoad`. Only one WebGL context is live at a time. `genQueue: Model[]` drives the queue; `handleGenDone` slices the first item after each completion. Each result is saved via `POST /api/models/[id]/thumbnail`.
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
