import {
  Sparkles, Link2, StickyNote, BarChart3, Calendar, Users,
} from 'lucide-react'
import { C, ACCENTS, DISPLAY, UI, hexA } from './theme'
import type { ApiBlock, BlockInput } from './api'

export type TileKind = 'banner' | 'links' | 'note' | 'metric' | 'events' | 'people'

export type FontCfg = { family?: FontKey; weight?: number; scale?: number }

export type Tile = {
  uid: string            // local identity for keys + drag
  kind: TileKind
  w: number              // grid columns (>=1, free)
  h: number              // grid rows (>=1, free)
  x?: number             // grid column (1-based); undefined = unplaced
  y?: number             // grid row (1-based)
  accent: string
  tint?: string          // card background tint ('none' or hex)
  font?: FontCfg
  data: any
}

// ---- free-placement grid + style options ----
export const COLS = 6   // free-placement grid width (matches .atr-grid)

export const FONTS = {
  Sans: UI,
  Display: DISPLAY,
  Serif: 'Georgia, "Times New Roman", serif',
  Mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
} as const
export type FontKey = keyof typeof FONTS

// light tints (pair with the accent palette); 'none' = white card
export const TINTS = ['none', '#EEF2FF', '#F5F3FF', '#EFF6FF', '#ECFEFF', '#FDF2F8', '#FFF7ED', '#FEF2F2']

export const fontStyle = (f?: FontCfg) => ({
  fontFamily: FONTS[f?.family ?? 'Sans'],
  fontWeight: f?.weight,
  fontSize: f?.scale ? `${Math.round(14 * f.scale)}px` : undefined,
} as const)

// Assign x,y to tiles lacking a placement (first free cell, row by row).
export function packLayout(tiles: Tile[]): Tile[] {
  const occ = new Set<string>()
  const placed = (t: Tile) => !!(t.x && t.y && t.x >= 1 && t.y >= 1)
  const fits = (c: number, r: number, w: number, h: number) => {
    if (c < 1 || c + w - 1 > COLS || r < 1) return false
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) if (occ.has(`${c + i},${r + j}`)) return false
    return true
  }
  const mark = (c: number, r: number, w: number, h: number) => {
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) occ.add(`${c + i},${r + j}`)
  }
  for (const t of tiles) if (placed(t)) mark(t.x!, t.y!, Math.min(t.w, COLS), t.h)
  return tiles.map((t) => {
    if (placed(t)) return t
    const w = Math.min(t.w, COLS)
    for (let r = 1; ; r++) for (let c = 1; c <= COLS; c++) {
      if (fits(c, r, w, t.h)) { mark(c, r, w, t.h); return { ...t, x: c, y: r } }
    }
  })
}

export const KIND_META: Record<TileKind, { label: string; Icon: any }> = {
  banner: { label: 'Welcome banner', Icon: Sparkles },
  links: { label: 'Quick links', Icon: Link2 },
  note: { label: 'Note', Icon: StickyNote },
  metric: { label: 'Metric', Icon: BarChart3 },
  events: { label: 'Events', Icon: Calendar },
  people: { label: 'People', Icon: Users },
}

const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2))

// ---- mapping: API Block (type=Tile, contentJson) <-> Tile ----
export function blockToTile(b: ApiBlock): Tile {
  let cfg: any = {}
  try { cfg = b.contentJson ? JSON.parse(b.contentJson) : {} } catch { cfg = {} }
  return {
    uid: uid(),
    kind: (cfg.kind as TileKind) ?? 'note',
    w: cfg.w ?? 1,
    h: cfg.h ?? 1,
    x: cfg.x, y: cfg.y,
    accent: cfg.accent ?? ACCENTS[0],
    tint: cfg.tint ?? 'none',
    font: cfg.font,
    data: cfg.data ?? {},
  }
}

export function tileToBlock(t: Tile, index: number): BlockInput {
  return {
    type: 'Tile',
    position: index,
    contentJson: JSON.stringify({
      kind: t.kind, w: t.w, h: t.h, x: t.x, y: t.y,
      accent: t.accent, tint: t.tint, font: t.font, data: t.data,
    }),
  }
}

export function defaultData(kind: TileKind): any {
  switch (kind) {
    case 'banner': return { title: 'New section', subtitle: 'Tell your team what this is about.' }
    case 'links': return { items: ['Add a link', 'Add a link', 'Add a link'] }
    case 'note': return { text: 'Type a note…' }
    case 'metric': return { value: '0', label: 'Metric', delta: '—' }
    case 'events': return { items: [['New event', 'Soon'], ['New event', 'Soon']] }
    case 'people': return { heading: 'People', members: [{ name: 'Add a person', role: '' }] }
  }
}

export function newTile(kind: TileKind): Tile {
  const size = kind === 'banner' ? { w: 2, h: 1 }
    : kind === 'links' || kind === 'events' ? { w: 1, h: 2 }
      : { w: 1, h: 1 }
  const accent = ACCENTS[Math.floor(Math.random() * ACCENTS.length)]
  return { uid: uid(), kind, ...size, accent, data: defaultData(kind) }
}

// Starter board seeded the first time a dashboard is created.
export const STARTER_TILES: Tile[] = [
  { uid: uid(), kind: 'banner', w: 2, h: 1, accent: '#4F46E5',
    data: { title: 'Welcome to Atrium', subtitle: 'Your team’s home base — build it tile by tile.' } },
  { uid: uid(), kind: 'links', w: 1, h: 2, accent: '#7C3AED',
    data: { items: ['Payroll', 'IT Help Desk', 'Brand Kit', 'Travel', 'Org Chart'] } },
  { uid: uid(), kind: 'metric', w: 1, h: 1, accent: '#2563EB',
    data: { value: '14', label: 'Open roles', delta: '+3 this week' } },
  { uid: uid(), kind: 'events', w: 1, h: 2, accent: '#0EA5E9',
    data: { items: [['All-hands', 'Thu · 10:00'], ['Design crit', 'Fri · 14:00'], ['Benefits webinar', 'Mon · 11:00']] } },
  { uid: uid(), kind: 'people', w: 2, h: 1, accent: '#DB2777',
    data: { heading: 'New this month', members: [
      { name: 'Maya Okonkwo', role: 'Product' }, { name: 'Theo Park', role: 'Design' },
      { name: 'Sana Iqbal', role: 'Engineering' }, { name: 'Diego Ruiz', role: 'Marketing' }] } },
  { uid: uid(), kind: 'note', w: 1, h: 1, accent: '#D97706',
    data: { text: 'Reminder: submit timesheets by Friday 🙂' } },
]

// ---- visual content for a tile, by kind ----
export function TileBody({ tile, editable, onEdit }:
  { tile: Tile; editable: boolean; onEdit: (patch: any) => void }) {
  const a = tile.accent
  const { Icon } = KIND_META[tile.kind]

  const Header = ({ children }: { children: any }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
      <span style={{ width: 26, height: 26, borderRadius: 8, display: 'grid', placeItems: 'center',
        background: hexA(a, 0.13), color: a, flex: '0 0 auto' }}>
        <Icon size={15} strokeWidth={2.2} />
      </span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: C.soft }}>{children}</span>
    </div>
  )

  if (tile.kind === 'banner') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center' }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center',
          background: hexA(a, 0.14), color: a, marginBottom: 12 }}>
          <Sparkles size={18} />
        </div>
        <div style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 700, color: C.ink, lineHeight: 1.1, letterSpacing: -0.3 }}>
          {tile.data.title}
        </div>
        <div style={{ fontSize: 13.5, color: C.soft, marginTop: 7, maxWidth: 440, lineHeight: 1.5 }}>
          {tile.data.subtitle}
        </div>
      </div>
    )
  }

  if (tile.kind === 'links') {
    return (
      <div style={{ height: '100%' }}>
        <Header>Quick links</Header>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {(tile.data.items ?? []).map((t: string, i: number) => (
            <div key={i} className="atr-row" style={{ display: 'flex', alignItems: 'center', gap: 9,
              padding: '7px 8px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: C.ink }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: a, flex: '0 0 auto' }} />
              <span style={{ flex: 1 }}>{t}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (tile.kind === 'note') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
          <StickyNote size={15} color={a} />
          <span style={{ fontSize: 12, fontWeight: 600, color: C.soft }}>Note</span>
        </div>
        {editable ? (
          <textarea
            value={tile.data.text ?? ''}
            data-control
            onChange={(e) => onEdit({ text: e.target.value })}
            style={{ flex: 1, resize: 'none', border: `1px solid ${C.line}`, borderRadius: 8, padding: 8,
              fontSize: 13, color: C.ink, lineHeight: 1.5, outline: 'none', fontFamily: 'inherit',
              background: hexA(a, 0.05) }}
          />
        ) : (
          <div style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.5 }}>{tile.data.text}</div>
        )}
      </div>
    )
  }

  if (tile.kind === 'metric') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ width: 24, height: 24, borderRadius: 7, background: hexA(a, 0.13), color: a,
            display: 'grid', placeItems: 'center' }}>
            <BarChart3 size={14} />
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.soft }}>{tile.data.label}</span>
        </div>
        <div style={{ fontFamily: DISPLAY, fontSize: 38, fontWeight: 700, color: C.ink, lineHeight: 1, letterSpacing: -1 }}>
          {tile.data.value}
        </div>
        <div style={{ fontSize: 11.5, color: a, fontWeight: 600, marginTop: 6 }}>{tile.data.delta}</div>
      </div>
    )
  }

  if (tile.kind === 'events') {
    return (
      <div style={{ height: '100%' }}>
        <Header>Upcoming</Header>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(tile.data.items ?? []).map((ev: [string, string], i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: a, flex: '0 0 auto' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{ev[0]}</div>
                <div style={{ fontSize: 11.5, color: C.faint }}>{ev[1]}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // people
  return (
    <div style={{ height: '100%' }}>
      <Header>{tile.data.heading ?? 'People'}</Header>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        {(tile.data.members ?? []).map((p: any, i: number) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 34, height: 34, borderRadius: 999, background: a, color: '#fff',
              display: 'grid', placeItems: 'center', fontSize: 12.5, fontWeight: 700 }}>
              {String(p.name || '?').split(' ').map((x: string) => x[0]).join('').slice(0, 2)}
            </span>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: C.ink }}>{p.name}</div>
              {p.role ? <div style={{ fontSize: 11, color: C.faint }}>{p.role}</div> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
