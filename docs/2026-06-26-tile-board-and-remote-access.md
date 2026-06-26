# Atrium — Work Log: 2026-06-26

Tile-board editor enhancements + a remote-access assessment of the Spark host.
Branch: `feat/tile-board` (not yet merged to `main` — pending a browser test).

---

## 1. Tile board — what shipped today

All changes live on `feat/tile-board` and are built, deployed to the Spark
stack, and verified by an API round-trip (drag/resize/visual UX still needs a
browser test before merge). No backend or DB schema changes — every new field
rides inside a tile's `ContentJson.data`.

### a. Fractional resize  (commit `6a2ac86`)
- Tiles resize in **0.1 increments** (1.1, 1.2, …) instead of whole cells.
- The board moved off CSS grid to **absolute pixel positioning** computed from
  the fractional `w`/`h`:
  - `index.css`: `.atr-grid` is now `position: relative` (no grid).
  - `Board.tsx`: measures grid width (`gw`) on mount/resize, derives column
    width `CW`, and positions each tile via `px(tile)` (`left/top/width/height`);
    `contentH` sizes the canvas to the lowest tile.
  - Resize drag and the inspector W/H steppers both step by `0.1`
    (`Stepper step={0.1}`, value shown to one decimal).

### b. "Add anything" — freeform elements on any tile  (commit `6a2ac86`)
- New **Custom** tile kind in the add palette.
- A reusable **Elements** system that works on *every* tile. Element kinds:
  `heading`, `text`, `image`, `embed` (iframe), `link`,
  `button` (filled / outline variants), `divider`.
- Add / edit / remove inline in Arrange mode. Stored in
  `tile.data.elements: Element[]`.
- `tiles.tsx`: `Element` type, `ELEMENT_KINDS`, `blankEl()`, `renderEl()`,
  `ElEditor`, `Elements`. `TileBody` now wraps `KindBody` (kind-specific body)
  + `Elements` in a scroll container.

### c. Icons + timeline connectors  (commit `ac6b1c8`)
- **Icon library** (`ICONS`, ~22 lucide glyphs) with an inline `IconPicker`
  (click an icon to set, click again to clear).
- **Per-step icons** on timeline & event tiles — each step/event has its own
  icon picker. Steps render as **node circles** (icon, or a dot if none).
- **Connector lines** — timeline steps are joined by a continuous vertical line
  through the nodes (flex rail: node + `flex:1` line, with a `paddingBottom`
  gap on the content column).
- **Icon element** — a new freeform element kind (icon badge + optional label),
  droppable on any tile.
- Back-compatible data: step icon is the optional 3rd tuple slot
  `[title, when, icon?]`; element icon is `el.icon`.

### d. Style system — UI "morphisms"  (commit pending)
- New `morph.ts`: a `MorphKey` set + `MORPHS` registry + `morphCard()`
  (per-tile surface CSS) + `morphBoard()` (canvas backdrop).
- Styles: **Flat, Neumorphism, Glassmorphism, Claymorphism, Skeuomorphism,
  Metal, Light, Squircle, Disco** (disco = animated rainbow border via the
  `.morph-disco` class in `index.css`; all surfaces stay light so text is
  readable).
- Applied at three scopes:
  - **Screen style** — a board-level morph that paints the canvas behind the
    tiles and is the default for every tile.
  - **Tile style** — per-tile override with an **Auto** option that inherits
    the screen style.
  - **Element style** — each freeform element (heading, text, icon, image,
    embed, link, button) can opt into its own morph "surface" via a
    `Surface: …` dropdown in the element editor (default = none/transparent).
    `renderEl` wraps the element in a padded `morphCard` box when set.
- Persistence: per-tile morph rides in the tile's `ContentJson` (`morph`);
  the board-level morph is a dedicated `Board`-type block at position 0.
- Backend: added `Board` to the `BlockType` enum (`Domain/Enums.cs`) so the
  config block passes type validation. Stored as a string column (no
  migration needed — appending an enum member is backward-compatible).

### e. Pages — navigation & internal links  (commit pending)
- The workspace is now multi-page. A "page" = an Item (type `Page`) in the
  space; the backend already supported create / rename (`PATCH /items/{id}`) /
  soft-delete (`DELETE /items/{id}`), so this was frontend-only.
- `App.tsx` rewritten to load all pages, hold `currentId`, and create / rename /
  delete pages. `Board` is keyed by `currentId` so switching remounts cleanly.
- **Navigation bar** in the header: a tab per page (active highlighted) plus a
  `+ Page` button. Inspector gains a **Page** section (rename field, New page,
  Delete page — delete disabled when only one page remains).
- **Internal links:** link & button elements gain an optional `pageId`. In the
  element editor a "Go to page: …" dropdown targets another page; in live mode
  clicking navigates in-app (via a `NavCtx` threaded through TileBody →
  Elements → renderEl) instead of opening a URL. Falls back to URL when no
  page is chosen.

### f. Forms & Workflows — interactive tiles that remember  (commit pending)
- Two new tile kinds, both with a **builder** (Arrange mode) and a **live**
  mode, and both persist their state.
- **Form tile** (`ClipboardList`): the builder adds fields — Short text,
  Paragraph, Email, Number, Date, Dropdown, Checkbox — each with a label,
  required toggle, and (for dropdowns) comma-separated options; plus an
  editable submit-button label. In live mode it renders a real fillable form
  with validation of required fields; on submit the response is appended to
  `data.responses` and **saved immediately**, then a "Thanks — saved!"
  confirmation shows ("Submit another" resets). The builder shows an
  "N responses" viewer listing every submission (timestamp + values).
- **Workflow tile** (`Workflow`): the builder edits an ordered list of named
  steps. In live mode it's a stage tracker — past steps show a check, the
  current step is highlighted "In progress", later steps are "Pending";
  click a step to jump, or use Back / Advance. Progress (`data.current`) is
  remembered. Shows "Completed 🎉" at the end.
- **Persistence mechanism:** the board previously only saved in Arrange mode.
  Added `pushBlocks(nextTiles)` (save an explicit tile array) and
  `submitData(uid, patch)` (merge into a tile's data and persist immediately),
  wired to a new `onSubmit` prop threaded `Board → TileBody → KindBody →
  Form/WorkflowBody`. Frontend-only — responses/progress live in the tile's
  `ContentJson.data`.

### g. Migration / import — SharePoint & any .NET site  (commit pending)
- An **Import** button (page-nav bar) opens a modal with three modes; each
  produces a new, fully editable Atrium page (reuses the multi-page system):
  - **From URL** — server fetches the page (bypasses browser CORS), client
    parses it. Works for public SharePoint / .NET / any site.
  - **Paste HTML** — for pages behind a login: View Source → paste. Also file
    upload (.html).
  - **CSV / List** — export a SharePoint list or Excel sheet to CSV, paste or
    upload; rows become content.
- **Parser** (`importer.ts`, client-side via DOMParser): finds a content root
  (handles SharePoint `.CanvasZone`/classic zones + generic `main`/`article`),
  maps h1–h4 → headings, p/blockquote → text, li → bullets, single-link
  li/p → link elements, img → image elements (relative URLs resolved), hr →
  divider. Output: a banner tile (title + "Imported from <host>") + a custom
  tile of those elements. CSV → heading + a text row per record.
- **Backend** (`ImportEndpoints.cs`, `POST /api/import/url`): server-side fetch
  with an **SSRF guard** — http/https only, DNS-resolves the host and rejects
  loopback / private (10/172.16-31/192.168) / link-local / IPv6 ULA, caps the
  body at 4 MB, 15s timeout. Registered in `Program.cs`.
- Note: authenticated SharePoint pages can't be fetched anonymously by the URL
  mode — the Paste-HTML / CSV paths cover those.

### h. BYO object storage — files live in the customer's cloud  (commit pending)
- Applied the storage-service overlay: `Storage/` with `IStorageProvider`
  (put/get/delete/exists/sign-upload/sign-download), adapters for **S3, MinIO,
  Azure, GCS**, `StorageOptions` (env-bound `Storage__*`), and
  `StorageRegistration` (one DI `switch` = the only place a backend is chosen).
- `FileEndpoints.cs`: `POST /api/files/upload-url` (presigned PUT) → `POST
  /api/files` (confirm + record StoredFile) → `GET /api/files/{id}/download-url`
  (presigned GET) → `DELETE /api/files/{id}`, plus `GET /api/admin/storage` and
  `POST /api/admin/storage/test` (live put→exists→get→delete self-test).
- Bytes go **browser ↔ cloud directly** via short-lived signed URLs; the server
  only signs and tracks metadata.
- **StoredFile aligned** (the flagged mismatch): added `FileName`, `Status`,
  nullable `ItemId`, `BlockId`; kept existing `SizeBytes`/`Checksum` (endpoints
  edited to match). New EF migration `StoredFileFilesService`.
- **Config:** `infra/app/docker-compose.yml` gained a `Storage__*` block pointed
  at the in-stack MinIO (`minio:9000`, bucket `atrium-dev`, reusing
  `${MINIO_PASSWORD}` — no new secret). Switching clouds later = change
  `Storage__Provider` + that provider's keys, restart. NuGet: AWSSDK.S3,
  Azure.Storage.Blobs, Google.Cloud.Storage.V1.
- **Verified on real MinIO:** `/api/admin/storage` reports provider `s3`/bucket
  `atrium-dev`; the self-test returns `ok:true` with all five steps green;
  `upload-url` mints a valid presigned PUT.
- Caveats (honest): the **GCS adapter** was patched to compile against
  Google.Cloud.Storage.V1 4.15 (its `SignAsync` content-headers overload
  differs) — it no longer binds Content-Type into the signature and is still an
  **unverified draft** (so are Azure/GCS generally). The presigned host on dev
  is the internal `minio:9000` (and SDK defaults to https) — fine for the
  server self-test, but **browser** uploads need a browser-reachable MinIO
  endpoint; production clouds are public HTTPS so this is dev-only. No in-UI
  admin panel wired yet (StorageSettings.tsx skipped — needs routing); use curl.

### Verification done (headless, server-side)
- Frontend build clean each time (`tsc -b && vite build`, ~190 KB bundle).
- Deployed via `~/atrium_deploy.sh` (build+push to `localhost:5000`, compose up
  in `/opt/atrium/app`). `atrium-app-web-1` recreated and running on `:8081`.
- API round-trips through `PUT /api/items/{id}/blocks` → `GET /api/items/{id}`:
  - Custom tile with all element kinds + font + tint + button variant survives.
  - Timeline step icons `[Rocket, Briefcase, CheckCircle2]` and an `Award`
    icon element survive.
  - Board-level morph (`Board` block, `glass`) + a per-tile morph (`clay`)
    + an inheriting tile (no morph) all round-trip.
  - Import URL endpoint: example.com fetched (200); SSRF guard blocks
    10.x / 192.168 / localhost / `file://`.

### Still open
- **Browser test by the user** — drag, resize, the left inspector, element
  editing, and the new timeline connectors/icons can't be confirmed headless.
- After that confirms: merge `feat/tile-board` → `main` with `--no-ff`.

### Commits today
```
ac6b1c8 feat(tiles): per-step timeline icons, connector lines, icon element
6a2ac86 feat(tiles): fractional resize + freeform elements on any tile
```
(Both pushed to `git@github.com:rikkalasas-droid/atrium.git`.)

---

## 2. Remote access assessment of Spark

Question: *can Spark be reached from anywhere?* — **Not today.** Everything is
behind home NAT, and the app is localhost-bound.

### Current state (observed on the box)
| Thing | State | Reachable from |
|-------|-------|----------------|
| Network | WiFi `wlP9s9` = `192.168.68.59/22`, gateway `192.168.68.1`, NAT public IP `174.160.79.249` | — |
| SSH (`:22`) | listening on `0.0.0.0` | same LAN only (no router port-forward) |
| WireGuard `wg0` (`10.10.10.2/24`) | up; peer Thor `10.10.10.1`, endpoint `192.168.68.54:51820`, recent handshake | LAN-only mesh |
| Atrium app | api `127.0.0.1:8080`, web `127.0.0.1:8081` | the box itself only |

Notable: Spark and Thor share the same public IP `174.160.79.249` — they're on
the **same home network**, which is why the WireGuard peer endpoint is a private
`192.168.68.x` address (the tunnel runs over the LAN, not the internet).

### Two blockers to "from anywhere"
1. Spark sits behind home NAT with no inbound port forwarding.
2. The Atrium app binds to `127.0.0.1`, so it isn't reachable even on the LAN /
   VPN — it would need to bind to the VPN interface or sit behind a reverse proxy.

### Options (not yet actioned — awaiting a decision)
1. **Tailscale (recommended)** — mesh VPN, punches through NAT with no router
   config; Spark gets a stable `100.x` address reachable from laptop/phone
   anywhere. One browser login to authorize the box. Best for SSH + app.
2. **Extend the existing WireGuard mesh** — port-forward UDP `51820` on the
   router to Spark; add laptop/phone as peers pointing at
   `174.160.79.249:51820`. No new software, but needs router access.
3. **Cloudflare Tunnel** — expose the web UI over public HTTPS, no open ports.
   App only, not general SSH.
4. **Router port-forward + DDNS** — forward `22`/`443` directly; simplest but
   largest attack surface, not recommended for SSH.

Whichever method: the app must also be exposed on the VPN/Tailscale interface
(or fronted by a reverse proxy) before it's reachable off-box.
