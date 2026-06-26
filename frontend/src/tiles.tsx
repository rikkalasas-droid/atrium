import {
  Sparkles, Link2, StickyNote, BarChart3, Calendar, Users,
  MousePointerClick, Clock, Plus, X, Shapes,
  Type, Image as ImageIcon, Code2, Minus, ExternalLink,
} from 'lucide-react'
import { C, ACCENTS, DISPLAY, UI, hexA } from './theme'
import type { ApiBlock, BlockInput } from './api'

export type TileKind =
  | 'banner' | 'links' | 'note' | 'metric' | 'events' | 'people' | 'button' | 'timeline' | 'custom'

export type FontCfg = { family?: FontKey; weight?: number; scale?: number }

export type Tile = {
  uid: string
  kind: TileKind
  w: number
  h: number
  x?: number
  y?: number
  accent: string
  tint?: string
  font?: FontCfg
  data: any
}

// ---- free-placement grid + style options ----
export const COLS = 6

export const FONTS = {
  Sans: UI,
  Display: DISPLAY,
  Serif: 'Georgia, "Times New Roman", serif',
  Mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
} as const
export type FontKey = keyof typeof FONTS

export const TINTS = ['none', '#EEF2FF', '#F5F3FF', '#EFF6FF', '#ECFEFF', '#FDF2F8', '#FFF7ED', '#FEF2F2']

export const fontStyle = (f?: FontCfg) => ({
  fontFamily: FONTS[f?.family ?? 'Sans'],
  fontWeight: f?.weight,
  fontSize: f?.scale ? `${Math.round(14 * f.scale)}px` : undefined,
} as const)

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
  button: { label: 'Buttons', Icon: MousePointerClick },
  timeline: { label: 'Timeline', Icon: Clock },
  custom: { label: 'Custom', Icon: Shapes },
}

// ---- freeform elements (can be added to ANY tile) ----
export type ElKind = 'heading' | 'text' | 'image' | 'embed' | 'link' | 'button' | 'divider'
export type Element = {
  id: string
  t: ElKind
  text?: string                     // heading/text content, link/button label
  url?: string                      // image src, embed src, link/button href
  variant?: 'filled' | 'outline'    // button style
}

export const ELEMENT_KINDS: { t: ElKind; label: string; Icon: any }[] = [
  { t: 'heading', label: 'Heading', Icon: Type },
  { t: 'text', label: 'Text', Icon: StickyNote },
  { t: 'image', label: 'Image', Icon: ImageIcon },
  { t: 'embed', label: 'Embed', Icon: Code2 },
  { t: 'link', label: 'Link', Icon: Link2 },
  { t: 'button', label: 'Button', Icon: MousePointerClick },
  { t: 'divider', label: 'Divider', Icon: Minus },
]

const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2))

export function blankEl(t: ElKind): Element {
  switch (t) {
    case 'heading': return { id: uid(), t, text: 'Heading' }
    case 'text': return { id: uid(), t, text: 'Some text…' }
    case 'image': return { id: uid(), t, url: '' }
    case 'embed': return { id: uid(), t, url: '' }
    case 'link': return { id: uid(), t, text: 'Visit link', url: 'https://' }
    case 'button': return { id: uid(), t, text: 'Button', url: '#', variant: 'filled' }
    case 'divider': return { id: uid(), t }
  }
}

export function blockToTile(b: ApiBlock): Tile {
  let cfg: any = {}
  try { cfg = b.contentJson ? JSON.parse(b.contentJson) : {} } catch { cfg = {} }
  return {
    uid: uid(),
    kind: (cfg.kind as TileKind) ?? 'note',
    w: cfg.w ?? 1, h: cfg.h ?? 1, x: cfg.x, y: cfg.y,
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
    case 'button': return { heading: 'Actions', buttons: [{ label: 'Open', url: '#' }] }
    case 'timeline': return { heading: 'Timeline', items: [['Kickoff', 'Step 1'], ['In progress', 'Step 2'], ['Done', 'Step 3']] }
    case 'custom': return { heading: 'Custom', elements: [{ id: uid(), t: 'text', text: 'Add anything you like — text, images, embeds, buttons…' }] }
  }
}

export function newTile(kind: TileKind): Tile {
  const size = kind === 'banner' ? { w: 2, h: 1 }
    : kind === 'custom' ? { w: 2, h: 2 }
      : kind === 'links' || kind === 'events' || kind === 'timeline' ? { w: 1, h: 2 }
        : { w: 1, h: 1 }
  const accent = ACCENTS[Math.floor(Math.random() * ACCENTS.length)]
  return { uid: uid(), kind, ...size, accent, data: defaultData(kind) }
}

export const STARTER_TILES: Tile[] = [
  { uid: uid(), kind: 'banner', w: 2, h: 1, accent: '#4F46E5',
    data: { title: 'Welcome to Atrium', subtitle: 'Your team’s home base — build it tile by tile.' } },
  { uid: uid(), kind: 'links', w: 1, h: 2, accent: '#7C3AED',
    data: { items: ['Payroll', 'IT Help Desk', 'Brand Kit', 'Travel', 'Org Chart'] } },
  { uid: uid(), kind: 'metric', w: 1, h: 1, accent: '#2563EB',
    data: { value: '14', label: 'Open roles', delta: '+3 this week' } },
  { uid: uid(), kind: 'button', w: 1, h: 1, accent: '#4F46E5',
    data: { heading: 'Quick actions', buttons: [{ label: 'New request', url: '#' }, { label: 'Book a room', url: '#' }] } },
  { uid: uid(), kind: 'timeline', w: 2, h: 2, accent: '#0EA5E9',
    data: { heading: 'Onboarding', items: [['Sign offer', 'Day 0'], ['Setup laptop', 'Day 1'], ['Meet the team', 'Week 1'], ['First ship', 'Week 2']] } },
  { uid: uid(), kind: 'note', w: 1, h: 1, accent: '#D97706',
    data: { text: 'Reminder: submit timesheets by Friday 🙂' } },
]

// ---- inline edit primitives ----
function Inp({ value, onChange, bold, big, ph }:
  { value: string; onChange: (v: string) => void; bold?: boolean; big?: boolean; ph?: string }) {
  return (
    <input data-control value={value} placeholder={ph}
      onChange={(e) => onChange(e.target.value)} onPointerDown={(e) => e.stopPropagation()}
      style={{ border: `1px solid ${C.line}`, borderRadius: 6, padding: '4px 7px', width: '100%',
        fontSize: big ? 20 : 13, fontWeight: bold ? 700 : 500, color: C.ink, outline: 'none',
        fontFamily: 'inherit', background: '#fff' }} />
  )
}
function MiniBtn({ onClick, children, danger }: { onClick: () => void; children: any; danger?: boolean }) {
  return (
    <button data-control onClick={onClick} onPointerDown={(e) => e.stopPropagation()}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px dashed ${danger ? '#FECACA' : C.line}`,
        background: danger ? '#FEF2F2' : '#fff', color: danger ? '#DC2626' : C.soft, borderRadius: 6,
        padding: '3px 7px', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}>
      {children}
    </button>
  )
}
const RemoveX = ({ onClick }: { onClick: () => void }) => (
  <button data-control onClick={onClick} onPointerDown={(e) => e.stopPropagation()} title="Remove"
    style={{ border: 'none', background: 'transparent', color: C.faint, cursor: 'pointer', padding: 2, lineHeight: 0 }}>
    <X size={13} />
  </button>
)

// ---- kind-specific content for a tile ----
function KindBody({ tile, editable, onEdit }:
  { tile: Tile; editable: boolean; onEdit: (patch: any) => void }) {
  const a = tile.accent
  const { Icon } = KIND_META[tile.kind]
  const d = tile.data ?? {}

  if (tile.kind === 'custom') {
    if (editable) return <Inp value={d.heading ?? ''} bold ph="Title (optional)" onChange={(v) => onEdit({ heading: v })} />
    return d.heading ? <div style={{ fontSize: 13, fontWeight: 600, color: C.soft, marginBottom: 4 }}>{d.heading}</div> : null
  }

  const Header = ({ children }: { children: any }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
      <span style={{ width: 26, height: 26, borderRadius: 8, display: 'grid', placeItems: 'center',
        background: hexA(a, 0.13), color: a, flex: '0 0 auto' }}>
        <Icon size={15} strokeWidth={2.2} />
      </span>
      {editable
        ? <Inp value={children ?? ''} bold onChange={(v) => onEdit({ heading: v })} />
        : <span style={{ fontSize: 12.5, fontWeight: 600, color: C.soft }}>{children}</span>}
    </div>
  )

  if (tile.kind === 'banner') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', gap: 6 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center',
          background: hexA(a, 0.14), color: a, marginBottom: 6 }}>
          <Sparkles size={18} />
        </div>
        {editable ? <Inp value={d.title ?? ''} big bold onChange={(v) => onEdit({ title: v })} /> : (
          <div style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 700, color: C.ink, lineHeight: 1.1, letterSpacing: -0.3 }}>{d.title}</div>
        )}
        {editable ? <Inp value={d.subtitle ?? ''} ph="Subtitle" onChange={(v) => onEdit({ subtitle: v })} /> : (
          <div style={{ fontSize: 13.5, color: C.soft, maxWidth: 440, lineHeight: 1.5 }}>{d.subtitle}</div>
        )}
      </div>
    )
  }

  if (tile.kind === 'links') {
    const items: string[] = d.items ?? []
    const set = (i: number, v: string) => onEdit({ items: items.map((x, j) => (j === i ? v : x)) })
    return (
      <div style={{ height: '100%' }}>
        <Header>{d.heading ?? 'Quick links'}</Header>
        <div style={{ display: 'flex', flexDirection: 'column', gap: editable ? 6 : 2 }}>
          {items.map((t, i) => (
            <div key={i} className={editable ? '' : 'atr-row'} style={{ display: 'flex', alignItems: 'center', gap: 9,
              padding: editable ? 0 : '7px 8px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: C.ink }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: a, flex: '0 0 auto' }} />
              {editable ? <><Inp value={t} onChange={(v) => set(i, v)} /><RemoveX onClick={() => onEdit({ items: items.filter((_, j) => j !== i) })} /></>
                : <span style={{ flex: 1 }}>{t}</span>}
            </div>
          ))}
          {editable && <MiniBtn onClick={() => onEdit({ items: [...items, 'New link'] })}><Plus size={12} /> Add link</MiniBtn>}
        </div>
      </div>
    )
  }

  if (tile.kind === 'note') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
          <StickyNote size={15} color={a} /><span style={{ fontSize: 12, fontWeight: 600, color: C.soft }}>Note</span>
        </div>
        {editable ? (
          <textarea value={d.text ?? ''} data-control onPointerDown={(e) => e.stopPropagation()}
            onChange={(e) => onEdit({ text: e.target.value })}
            style={{ flex: 1, minHeight: 60, resize: 'none', border: `1px solid ${C.line}`, borderRadius: 8, padding: 8,
              fontSize: 13, color: C.ink, lineHeight: 1.5, outline: 'none', fontFamily: 'inherit', background: hexA(a, 0.05) }} />
        ) : <div style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{d.text}</div>}
      </div>
    )
  }

  if (tile.kind === 'metric') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 24, height: 24, borderRadius: 7, background: hexA(a, 0.13), color: a, display: 'grid', placeItems: 'center' }}>
            <BarChart3 size={14} />
          </span>
          {editable ? <Inp value={d.label ?? ''} onChange={(v) => onEdit({ label: v })} />
            : <span style={{ fontSize: 12, fontWeight: 600, color: C.soft }}>{d.label}</span>}
        </div>
        {editable ? <Inp value={d.value ?? ''} big bold onChange={(v) => onEdit({ value: v })} /> : (
          <div style={{ fontFamily: DISPLAY, fontSize: 38, fontWeight: 700, color: C.ink, lineHeight: 1, letterSpacing: -1 }}>{d.value}</div>
        )}
        {editable ? <Inp value={d.delta ?? ''} ph="+3 this week" onChange={(v) => onEdit({ delta: v })} />
          : <div style={{ fontSize: 11.5, color: a, fontWeight: 600 }}>{d.delta}</div>}
      </div>
    )
  }

  if (tile.kind === 'events' || tile.kind === 'timeline') {
    const items: [string, string][] = d.items ?? []
    const set = (i: number, k: 0 | 1, v: string) =>
      onEdit({ items: items.map((row, j) => (j === i ? (k === 0 ? [v, row[1]] : [row[0], v]) : row)) })
    const isTl = tile.kind === 'timeline'
    return (
      <div style={{ height: '100%' }}>
        <Header>{d.heading ?? (isTl ? 'Timeline' : 'Upcoming')}</Header>
        <div style={{ display: 'flex', flexDirection: 'column', gap: editable ? 8 : 10,
          ...(isTl && !editable ? { borderLeft: `2px solid ${hexA(a, 0.25)}`, marginLeft: 4, paddingLeft: 12 } : {}) }}>
          {items.map((ev, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
              <span style={{ width: isTl ? 9 : 8, height: isTl ? 9 : 8, borderRadius: 999, background: a, flex: '0 0 auto',
                ...(isTl && !editable ? { position: 'absolute', left: -18 } : {}) }} />
              {editable ? (
                <>
                  <div style={{ flex: 1, display: 'flex', gap: 6 }}>
                    <Inp value={ev[0]} onChange={(v) => set(i, 0, v)} />
                    <div style={{ width: 90 }}><Inp value={ev[1]} ph="when" onChange={(v) => set(i, 1, v)} /></div>
                  </div>
                  <RemoveX onClick={() => onEdit({ items: items.filter((_, j) => j !== i) })} />
                </>
              ) : (
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{ev[0]}</div>
                  <div style={{ fontSize: 11.5, color: C.faint }}>{ev[1]}</div>
                </div>
              )}
            </div>
          ))}
          {editable && <MiniBtn onClick={() => onEdit({ items: [...items, ['New', '']] })}><Plus size={12} /> Add {isTl ? 'step' : 'event'}</MiniBtn>}
        </div>
      </div>
    )
  }

  if (tile.kind === 'button') {
    const btns: { label: string; url: string }[] = d.buttons ?? []
    const set = (i: number, k: 'label' | 'url', v: string) =>
      onEdit({ buttons: btns.map((b, j) => (j === i ? { ...b, [k]: v } : b)) })
    return (
      <div style={{ height: '100%' }}>
        <Header>{d.heading ?? 'Actions'}</Header>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {btns.map((b, i) => editable ? (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Inp value={b.label} ph="Label" onChange={(v) => set(i, 'label', v)} />
              <div style={{ width: 110 }}><Inp value={b.url} ph="https://" onChange={(v) => set(i, 'url', v)} /></div>
              <RemoveX onClick={() => onEdit({ buttons: btns.filter((_, j) => j !== i) })} />
            </div>
          ) : (
            <a key={i} href={b.url || '#'} target="_blank" rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, textDecoration: 'none',
                background: a, color: '#fff', borderRadius: 10, padding: '9px 13px', fontSize: 13, fontWeight: 600 }}>
              <MousePointerClick size={14} /> {b.label}
            </a>
          ))}
          {editable && <MiniBtn onClick={() => onEdit({ buttons: [...btns, { label: 'Button', url: '#' }] })}><Plus size={12} /> Add button</MiniBtn>}
        </div>
      </div>
    )
  }

  // people
  const members: any[] = d.members ?? []
  const setM = (i: number, k: string, v: string) =>
    onEdit({ members: members.map((m, j) => (j === i ? { ...m, [k]: v } : m)) })
  return (
    <div style={{ height: '100%' }}>
      <Header>{d.heading ?? 'People'}</Header>
      <div style={{ display: 'flex', flexDirection: editable ? 'column' : 'row', flexWrap: 'wrap', gap: editable ? 8 : 14 }}>
        {members.map((p, i) => editable ? (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Inp value={p.name ?? ''} ph="Name" onChange={(v) => setM(i, 'name', v)} />
            <div style={{ width: 110 }}><Inp value={p.role ?? ''} ph="Role" onChange={(v) => setM(i, 'role', v)} /></div>
            <RemoveX onClick={() => onEdit({ members: members.filter((_, j) => j !== i) })} />
          </div>
        ) : (
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
        {editable && <MiniBtn onClick={() => onEdit({ members: [...members, { name: 'New person', role: '' }] })}><Plus size={12} /> Add person</MiniBtn>}
      </div>
    </div>
  )
}

// ---- render one freeform element ----
function renderEl(el: Element, a: string) {
  switch (el.t) {
    case 'heading':
      return <div style={{ fontFamily: DISPLAY, fontSize: 17, fontWeight: 700, color: C.ink, letterSpacing: -0.2 }}>{el.text}</div>
    case 'text':
      return <div style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{el.text}</div>
    case 'image':
      return el.url
        ? <img src={el.url} alt="" style={{ width: '100%', borderRadius: 10, display: 'block', objectFit: 'cover' }} />
        : <div style={{ border: `1px dashed ${C.line}`, borderRadius: 10, padding: 16, fontSize: 12, color: C.faint, textAlign: 'center' }}>No image URL</div>
    case 'embed':
      return el.url
        ? <iframe src={el.url} style={{ width: '100%', height: 200, border: `1px solid ${C.line}`, borderRadius: 10 }} allowFullScreen />
        : <div style={{ border: `1px dashed ${C.line}`, borderRadius: 10, padding: 16, fontSize: 12, color: C.faint, textAlign: 'center' }}>No embed URL</div>
    case 'link':
      return (
        <a href={el.url || '#'} target="_blank" rel="noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: a, fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}>
          <ExternalLink size={14} /> {el.text || el.url}
        </a>
      )
    case 'button': {
      const outline = el.variant === 'outline'
      return (
        <a href={el.url || '#'} target="_blank" rel="noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, textDecoration: 'none',
            background: outline ? 'transparent' : a, color: outline ? a : '#fff',
            border: outline ? `1.5px solid ${a}` : '1.5px solid transparent',
            borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 600 }}>
          <MousePointerClick size={14} /> {el.text}
        </a>
      )
    }
    case 'divider':
      return <hr style={{ border: 'none', borderTop: `1px solid ${C.line}`, margin: '2px 0' }} />
  }
}

// ---- editor row for one element ----
function ElEditor({ el, onChange, onRemove }:
  { el: Element; onChange: (patch: Partial<Element>) => void; onRemove: () => void }) {
  const { Icon, label } = ELEMENT_KINDS.find((k) => k.t === el.t)!
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 9, padding: 8, background: '#fff', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <Icon size={13} color={C.soft} />
        <span style={{ fontSize: 11.5, fontWeight: 600, color: C.soft, flex: 1 }}>{label}</span>
        <RemoveX onClick={onRemove} />
      </div>
      {(el.t === 'heading' || el.t === 'text') && (
        <Inp value={el.text ?? ''} ph="Content" onChange={(v) => onChange({ text: v })} />
      )}
      {(el.t === 'image' || el.t === 'embed') && (
        <Inp value={el.url ?? ''} ph="https://…" onChange={(v) => onChange({ url: v })} />
      )}
      {(el.t === 'link' || el.t === 'button') && (
        <div style={{ display: 'flex', gap: 6 }}>
          <Inp value={el.text ?? ''} ph="Label" onChange={(v) => onChange({ text: v })} />
          <div style={{ flex: 1 }}><Inp value={el.url ?? ''} ph="https://…" onChange={(v) => onChange({ url: v })} /></div>
        </div>
      )}
      {el.t === 'button' && (
        <div style={{ display: 'flex', gap: 6 }}>
          {(['filled', 'outline'] as const).map((v) => (
            <MiniBtn key={v} onClick={() => onChange({ variant: v })}>
              <span style={{ fontWeight: (el.variant ?? 'filled') === v ? 700 : 500,
                color: (el.variant ?? 'filled') === v ? C.ink : C.soft }}>{v}</span>
            </MiniBtn>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- freeform elements section (under every tile) ----
function Elements({ tile, editable, onEdit }:
  { tile: Tile; editable: boolean; onEdit: (patch: any) => void }) {
  const els: Element[] = tile.data?.elements ?? []
  const setEls = (next: Element[]) => onEdit({ elements: next })
  if (!editable && els.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: editable ? 8 : 10,
      marginTop: tile.kind === 'custom' ? 0 : (els.length || editable ? 12 : 0) }}>
      {els.map((el, i) => editable ? (
        <ElEditor key={el.id} el={el}
          onChange={(patch) => setEls(els.map((x, j) => (j === i ? { ...x, ...patch } : x)))}
          onRemove={() => setEls(els.filter((_, j) => j !== i))} />
      ) : (
        <div key={el.id}>{renderEl(el, tile.accent)}</div>
      ))}
      {editable && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ELEMENT_KINDS.map(({ t, label, Icon }) => (
            <MiniBtn key={t} onClick={() => setEls([...els, blankEl(t)])}>
              <Icon size={12} /> {label}
            </MiniBtn>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- full tile body: kind content + freeform elements ----
export function TileBody({ tile, editable, onEdit }:
  { tile: Tile; editable: boolean; onEdit: (patch: any) => void }) {
  return (
    <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <KindBody tile={tile} editable={editable} onEdit={onEdit} />
      <Elements tile={tile} editable={editable} onEdit={onEdit} />
    </div>
  )
}
