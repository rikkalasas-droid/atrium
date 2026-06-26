import { useState } from 'react'
import {
  Sparkles, Link2, StickyNote, BarChart3, Calendar, Users,
  MousePointerClick, Clock, Plus, X, Shapes,
  Type, Image as ImageIcon, Code2, Minus, ExternalLink, FileText,
  Star, Heart, Flag, CheckCircle2, Rocket, Zap, Bell, Mail,
  MapPin, Briefcase, Award, Target, Coffee, Lightbulb, Smile, Phone,
  ClipboardList, Workflow as WorkflowIcon, Circle, Check, ChevronRight,
  Paperclip, Download, Upload as UploadIcon, File as FileIcon,
} from 'lucide-react'
import { C, ACCENTS, DISPLAY, UI, hexA } from './theme'
import { MorphKey, MORPHS, morphCard } from './morph'
import { api } from './api'
import type { ApiBlock, BlockInput } from './api'

export type TileKind =
  | 'banner' | 'links' | 'note' | 'metric' | 'events' | 'people' | 'button' | 'timeline'
  | 'form' | 'workflow' | 'files' | 'custom'

export type FontCfg = { family?: FontKey; weight?: number; scale?: number }

// a page in the current space (used for navigation + internal links)
export type PageRef = { id: string; title: string }
// nav context threaded into tiles so link/button elements can jump between pages
export type NavCtx = { pages: PageRef[]; onNavigate: (id: string) => void }

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
  morph?: MorphKey          // surface style; undefined = inherit the board's
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
  form: { label: 'Form', Icon: ClipboardList },
  workflow: { label: 'Workflow', Icon: WorkflowIcon },
  files: { label: 'Files', Icon: Paperclip },
  custom: { label: 'Custom', Icon: Shapes },
}

// form field kinds (the "smart" inputs a builder can drop into a form)
export type FieldKind = 'short' | 'long' | 'email' | 'number' | 'date' | 'select' | 'checkbox'
export const FIELD_KINDS: { t: FieldKind; label: string }[] = [
  { t: 'short', label: 'Short text' },
  { t: 'long', label: 'Paragraph' },
  { t: 'email', label: 'Email' },
  { t: 'number', label: 'Number' },
  { t: 'date', label: 'Date' },
  { t: 'select', label: 'Dropdown' },
  { t: 'checkbox', label: 'Checkbox' },
]

// ---- icon library (per-step timeline/event icons + icon element) ----
export const ICONS = {
  Sparkles, Star, Heart, Flag, CheckCircle2, Rocket, Zap, Bell,
  Mail, Phone, MapPin, Briefcase, Award, Target, Calendar, Clock,
  Users, BarChart3, Lightbulb, Coffee, Smile, Link2,
} as const
export type IconKey = keyof typeof ICONS

// ---- freeform elements (can be added to ANY tile) ----
export type ElKind = 'heading' | 'text' | 'image' | 'embed' | 'link' | 'button' | 'divider' | 'icon'
export type Element = {
  id: string
  t: ElKind
  text?: string                     // heading/text content, link/button label
  url?: string                      // image src, embed src, link/button href
  variant?: 'filled' | 'outline'    // button style
  icon?: IconKey                    // icon element / per-step icon
  morph?: MorphKey                  // optional surface style around this element
  pageId?: string                   // link/button: navigate to this page instead of a URL
}

export const ELEMENT_KINDS: { t: ElKind; label: string; Icon: any }[] = [
  { t: 'heading', label: 'Heading', Icon: Type },
  { t: 'text', label: 'Text', Icon: StickyNote },
  { t: 'icon', label: 'Icon', Icon: Sparkles },
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
    case 'icon': return { id: uid(), t, icon: 'Star', text: '' }
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
    morph: cfg.morph,
    data: cfg.data ?? {},
  }
}

export function tileToBlock(t: Tile, index: number): BlockInput {
  return {
    type: 'Tile',
    position: index,
    contentJson: JSON.stringify({
      kind: t.kind, w: t.w, h: t.h, x: t.x, y: t.y,
      accent: t.accent, tint: t.tint, font: t.font, morph: t.morph, data: t.data,
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
    case 'form': return {
      heading: 'Request form', submitLabel: 'Submit',
      fields: [
        { id: uid(), t: 'short', label: 'Your name', required: true },
        { id: uid(), t: 'email', label: 'Email', required: true },
        { id: uid(), t: 'select', label: 'Type of request', options: ['Question', 'Bug', 'Idea'] },
        { id: uid(), t: 'long', label: 'Details' },
      ],
      responses: [],
    }
    case 'workflow': return {
      heading: 'Approval workflow',
      steps: [{ id: uid(), label: 'Submitted' }, { id: uid(), label: 'In review' }, { id: uid(), label: 'Approved' }],
      current: 0,
    }
    case 'files': return { heading: 'Files', files: [] }
    case 'custom': return { heading: 'Custom', elements: [{ id: uid(), t: 'text', text: 'Add anything you like — text, images, embeds, buttons…' }] }
  }
}

export function newTile(kind: TileKind): Tile {
  const size = kind === 'banner' ? { w: 2, h: 1 }
    : kind === 'form' ? { w: 2, h: 3 }
      : kind === 'custom' || kind === 'workflow' || kind === 'files' ? { w: 2, h: 2 }
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
function IconPicker({ value, onPick }: { value?: string; onPick: (k: string) => void }) {
  return (
    <div data-control onPointerDown={(e) => e.stopPropagation()} style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {(Object.keys(ICONS) as IconKey[]).map((k) => {
        const I = ICONS[k]
        const sel = value === k
        return (
          <button key={k} data-control title={k} onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onPick(sel ? '' : k)}
            style={{ border: `1px solid ${sel ? C.ink : C.line}`, background: sel ? hexA(C.ink, 0.06) : '#fff',
              borderRadius: 7, padding: 5, cursor: 'pointer', lineHeight: 0 }}>
            <I size={15} color={sel ? C.ink : C.soft} />
          </button>
        )
      })}
    </div>
  )
}

// ---- kind-specific content for a tile ----
function KindBody({ tile, editable, onEdit, onSubmit }:
  { tile: Tile; editable: boolean; onEdit: (patch: any) => void; onSubmit?: (patch: any) => void }) {
  const a = tile.accent
  const { Icon } = KIND_META[tile.kind]
  const d = tile.data ?? {}

  if (tile.kind === 'form') return <FormBody tile={tile} editable={editable} onEdit={onEdit} onSubmit={onSubmit} />
  if (tile.kind === 'workflow') return <WorkflowBody tile={tile} editable={editable} onEdit={onEdit} onSubmit={onSubmit} />
  if (tile.kind === 'files') return <FilesBody tile={tile} editable={editable} onEdit={onEdit} onSubmit={onSubmit} />

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
    const items: [string, string, IconKey?][] = d.items ?? []
    const setText = (i: number, k: 0 | 1, v: string) =>
      onEdit({ items: items.map((row, j) => (j === i ? (k === 0 ? [v, row[1], row[2]] : [row[0], v, row[2]]) : row)) })
    const setIcon = (i: number, ic: string) =>
      onEdit({ items: items.map((row, j) => (j === i ? [row[0], row[1], (ic || undefined) as IconKey | undefined] : row)) })
    const isTl = tile.kind === 'timeline'
    return (
      <div style={{ height: '100%' }}>
        <Header>{d.heading ?? (isTl ? 'Timeline' : 'Upcoming')}</Header>
        <div style={{ display: 'flex', flexDirection: 'column', gap: editable ? 10 : 0 }}>
          {items.map((ev, i) => {
            const StepIcon = ev[2] ? ICONS[ev[2]] : null
            const last = i === items.length - 1
            if (editable) {
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 7, border: `1px solid ${C.line}`,
                  borderRadius: 9, padding: 8, background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Inp value={ev[0]} onChange={(v) => setText(i, 0, v)} />
                    <div style={{ width: 90 }}><Inp value={ev[1]} ph="when" onChange={(v) => setText(i, 1, v)} /></div>
                    <RemoveX onClick={() => onEdit({ items: items.filter((_, j) => j !== i) })} />
                  </div>
                  <IconPicker value={ev[2]} onPick={(ic) => setIcon(i, ic)} />
                </div>
              )
            }
            const Node = (
              <span style={{ position: 'relative', zIndex: 1, width: 28, height: 28, borderRadius: 999,
                background: hexA(a, 0.14), color: a, display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
                {StepIcon ? <StepIcon size={15} strokeWidth={2.2} />
                  : <span style={{ width: 9, height: 9, borderRadius: 999, background: a }} />}
              </span>
            )
            return (
              <div key={i} style={{ display: 'flex', gap: 11 }}>
                <div style={{ width: 28, flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {Node}
                  {isTl && !last && <span style={{ width: 2, flex: 1, minHeight: 14, background: hexA(a, 0.22) }} />}
                </div>
                <div style={{ flex: 1, paddingBottom: last ? 0 : 14, paddingTop: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{ev[0]}</div>
                  <div style={{ fontSize: 11.5, color: C.faint }}>{ev[1]}</div>
                </div>
              </div>
            )
          })}
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

// shared header for interactive tiles (icon badge + title)
function TileHead({ a, Icon, editable, value, onChange }:
  { a: string; Icon: any; editable: boolean; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
      <span style={{ width: 28, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center',
        background: hexA(a, 0.14), color: a, flex: '0 0 auto' }}><Icon size={16} strokeWidth={2.2} /></span>
      {editable ? <Inp value={value} bold onChange={onChange} />
        : <span style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 700, color: C.ink }}>{value}</span>}
    </div>
  )
}

// ---- Form tile: builder (Arrange) + live fill that remembers responses ----
function FormBody({ tile, editable, onEdit, onSubmit }:
  { tile: Tile; editable: boolean; onEdit: (patch: any) => void; onSubmit?: (patch: any) => void }) {
  const a = tile.accent
  const d = tile.data ?? {}
  const fields: any[] = d.fields ?? []
  const responses: any[] = d.responses ?? []
  const [vals, setVals] = useState<Record<string, any>>({})
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [showResp, setShowResp] = useState(false)
  const sel: any = { border: `1px solid ${C.line}`, borderRadius: 6, padding: '4px 7px', fontSize: 11.5,
    color: C.soft, background: '#fff', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }
  const inputStyle: any = { width: '100%', border: `1px solid ${C.line}`, borderRadius: 8, padding: '8px 10px',
    fontSize: 13, color: C.ink, outline: 'none', fontFamily: 'inherit', background: '#fff' }
  const setField = (i: number, patch: any) => onEdit({ fields: fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) })
  const addField = (t: FieldKind) => onEdit({ fields: [...fields, { id: uid(), t,
    label: FIELD_KINDS.find((k) => k.t === t)!.label, ...(t === 'select' ? { options: ['Option 1', 'Option 2'] } : {}) }] })

  if (editable) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <TileHead a={a} Icon={ClipboardList} editable value={d.heading ?? 'Form'} onChange={(v) => onEdit({ heading: v })} />
        {fields.map((f, i) => (
          <div key={f.id} style={{ border: `1px solid ${C.line}`, borderRadius: 9, padding: 8, background: '#fff',
            display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Inp value={f.label ?? ''} ph="Question" onChange={(v) => setField(i, { label: v })} />
              <RemoveX onClick={() => onEdit({ fields: fields.filter((_, j) => j !== i) })} />
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <select data-control value={f.t} onPointerDown={(e) => e.stopPropagation()}
                onChange={(e) => setField(i, { t: e.target.value })} style={sel}>
                {FIELD_KINDS.map((k) => <option key={k.t} value={k.t}>{k.label}</option>)}
              </select>
              <MiniBtn onClick={() => setField(i, { required: !f.required })}>
                <span style={{ fontWeight: f.required ? 700 : 500, color: f.required ? a : C.soft }}>
                  {f.required ? 'Required' : 'Optional'}</span>
              </MiniBtn>
            </div>
            {f.t === 'select' && (
              <Inp value={(f.options ?? []).join(', ')} ph="Option 1, Option 2, …"
                onChange={(v) => setField(i, { options: v.split(',').map((s) => s.trim()).filter(Boolean) })} />
            )}
          </div>
        ))}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {FIELD_KINDS.map((k) => <MiniBtn key={k.t} onClick={() => addField(k.t)}><Plus size={12} /> {k.label}</MiniBtn>)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11.5, color: C.soft }}>Button</span>
          <Inp value={d.submitLabel ?? 'Submit'} onChange={(v) => onEdit({ submitLabel: v })} />
        </div>
        <div>
          <MiniBtn onClick={() => setShowResp((s) => !s)}>
            <ClipboardList size={12} /> {responses.length} response{responses.length === 1 ? '' : 's'}
          </MiniBtn>
          {showResp && responses.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {responses.slice().reverse().map((r) => (
                <div key={r.id} style={{ border: `1px solid ${C.line}`, borderRadius: 8, padding: 8, fontSize: 12 }}>
                  <div style={{ color: C.faint, fontSize: 11, marginBottom: 4 }}>{new Date(r.at).toLocaleString()}</div>
                  {fields.map((f) => (
                    <div key={f.id} style={{ display: 'flex', gap: 6 }}>
                      <span style={{ color: C.soft, fontWeight: 600 }}>{f.label}:</span>
                      <span style={{ color: C.ink }}>{String(r.values?.[f.id] ?? '—')}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ---- live fill ----
  if (sent) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 9, padding: '6px 0' }}>
        <span style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center',
          background: hexA(a, 0.14), color: a }}><Check size={22} /></span>
        <div style={{ fontFamily: DISPLAY, fontSize: 17, fontWeight: 700, color: C.ink }}>Thanks — saved!</div>
        <div style={{ fontSize: 13, color: C.soft }}>Your response was recorded.</div>
        <MiniBtn onClick={() => setSent(false)}><Plus size={12} /> Submit another</MiniBtn>
      </div>
    )
  }
  const renderField = (f: any) => {
    const v = vals[f.id] ?? (f.t === 'checkbox' ? false : '')
    const set = (val: any) => setVals((s) => ({ ...s, [f.id]: val }))
    switch (f.t) {
      case 'long': return <textarea value={v} onChange={(e) => set(e.target.value)} style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }} />
      case 'select': return (
        <select value={v} onChange={(e) => set(e.target.value)} style={inputStyle}>
          <option value="">Choose…</option>
          {(f.options ?? []).map((o: string, i: number) => <option key={i} value={o}>{o}</option>)}
        </select>
      )
      case 'checkbox': return (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.ink, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!v} onChange={(e) => set(e.target.checked)} /> {f.label}
        </label>
      )
      case 'email': return <input type="email" value={v} onChange={(e) => set(e.target.value)} placeholder="name@email.com" style={inputStyle} />
      case 'number': return <input type="number" value={v} onChange={(e) => set(e.target.value)} style={inputStyle} />
      case 'date': return <input type="date" value={v} onChange={(e) => set(e.target.value)} style={inputStyle} />
      default: return <input value={v} onChange={(e) => set(e.target.value)} style={inputStyle} />
    }
  }
  const submit = () => {
    for (const f of fields) {
      if (!f.required) continue
      const v = vals[f.id]
      const empty = f.t === 'checkbox' ? !v : !String(v ?? '').trim()
      if (empty) { setErr(`“${f.label}” is required`); return }
    }
    setErr(null)
    const response = { id: uid(), at: new Date().toISOString(), values: vals }
    onSubmit?.({ responses: [...responses, response] })
    setVals({}); setSent(true)
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <TileHead a={a} Icon={ClipboardList} editable={false} value={d.heading ?? 'Form'} onChange={() => {}} />
      {fields.map((f) => (
        <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {f.t !== 'checkbox' && (
            <label style={{ fontSize: 12.5, fontWeight: 600, color: C.soft }}>
              {f.label}{f.required ? <span style={{ color: '#DC2626' }}> *</span> : null}
            </label>
          )}
          {renderField(f)}
        </div>
      ))}
      {err && <div style={{ fontSize: 12.5, color: '#DC2626' }}>{err}</div>}
      <button onClick={submit} style={{ alignSelf: 'flex-start', background: a, color: '#fff', border: 'none',
        borderRadius: 10, padding: '10px 16px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
        {d.submitLabel ?? 'Submit'}
      </button>
    </div>
  )
}

// ---- Workflow tile: builder + live stage tracker that remembers progress ----
function WorkflowBody({ tile, editable, onEdit, onSubmit }:
  { tile: Tile; editable: boolean; onEdit: (patch: any) => void; onSubmit?: (patch: any) => void }) {
  const a = tile.accent
  const d = tile.data ?? {}
  const steps: any[] = d.steps ?? []
  const current: number = d.current ?? 0
  const total = steps.length
  const setStep = (i: number, patch: any) => onEdit({ steps: steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) })

  if (editable) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <TileHead a={a} Icon={WorkflowIcon} editable value={d.heading ?? 'Workflow'} onChange={(v) => onEdit({ heading: v })} />
        {steps.map((s, i) => (
          <div key={s.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ width: 22, height: 22, borderRadius: 999, flex: '0 0 auto', display: 'grid', placeItems: 'center',
              background: hexA(a, 0.14), color: a, fontSize: 11, fontWeight: 700 }}>{i + 1}</span>
            <Inp value={s.label ?? ''} ph="Step name" onChange={(v) => setStep(i, { label: v })} />
            <RemoveX onClick={() => onEdit({ steps: steps.filter((_, j) => j !== i) })} />
          </div>
        ))}
        <MiniBtn onClick={() => onEdit({ steps: [...steps, { id: uid(), label: 'New step' }] })}><Plus size={12} /> Add step</MiniBtn>
      </div>
    )
  }

  // ---- live tracker ----
  const done = current >= total
  return (
    <div>
      <TileHead a={a} Icon={WorkflowIcon} editable={false} value={d.heading ?? 'Workflow'} onChange={() => {}} />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {steps.map((s, i) => {
          const st = i < current ? 'done' : i === current ? 'active' : 'todo'
          const last = i === total - 1
          return (
            <div key={s.id} onClick={() => onSubmit?.({ current: i })}
              style={{ display: 'flex', gap: 11, cursor: 'pointer', paddingBottom: last ? 0 : 14 }}>
              <div style={{ width: 28, flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ width: 28, height: 28, borderRadius: 999, display: 'grid', placeItems: 'center', flex: '0 0 auto',
                  background: st === 'done' ? a : st === 'active' ? hexA(a, 0.14) : '#fff',
                  border: st === 'todo' ? `1.5px solid ${C.line}` : 'none', color: st === 'done' ? '#fff' : a }}>
                  {st === 'done' ? <Check size={15} /> : st === 'active' ? <span style={{ width: 9, height: 9, borderRadius: 999, background: a }} /> : <Circle size={9} color={C.faint} />}
                </span>
                {!last && <span style={{ width: 2, flex: 1, minHeight: 14, background: i < current ? a : hexA(a, 0.2) }} />}
              </div>
              <div style={{ paddingTop: 4 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: st === 'todo' ? C.faint : C.ink }}>{s.label}</div>
                <div style={{ fontSize: 11, color: st === 'active' ? a : C.faint, fontWeight: st === 'active' ? 600 : 400 }}>
                  {st === 'done' ? 'Done' : st === 'active' ? 'In progress' : 'Pending'}</div>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <MiniBtn onClick={() => onSubmit?.({ current: Math.max(0, current - 1) })}>← Back</MiniBtn>
        {done ? (
          <span style={{ fontSize: 13, fontWeight: 700, color: a }}>Completed 🎉</span>
        ) : (
          <button onClick={() => onSubmit?.({ current: current + 1 })}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: a, color: '#fff', border: 'none',
              borderRadius: 9, padding: '8px 13px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Advance <ChevronRight size={15} />
          </button>
        )}
      </div>
    </div>
  )
}

// ---- Files tile: upload (server-mediated) + download, remembers the list ----
function fileSize(n: number): string {
  if (!n) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0; let x = n
  while (x >= 1024 && i < u.length - 1) { x /= 1024; i++ }
  return `${i === 0 ? x : x.toFixed(1)} ${u[i]}`
}
function FilesBody({ tile, editable, onEdit, onSubmit }:
  { tile: Tile; editable: boolean; onEdit: (patch: any) => void; onSubmit?: (patch: any) => void }) {
  const a = tile.accent
  const d = tile.data ?? {}
  const files: any[] = d.files ?? []
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const onPick = async (list: FileList | null) => {
    if (!list || !list.length) return
    setBusy(true); setErr(null)
    try {
      const added: any[] = []
      for (const f of Array.from(list)) {
        const r = await api.uploadFile(f)
        added.push({ id: r.id, name: r.fileName, size: r.size, contentType: r.contentType })
      }
      onSubmit?.({ files: [...files, ...added] })
    } catch (e: any) { setErr(String(e.message || e)) }
    finally { setBusy(false) }
  }
  const remove = async (id: string) => {
    try { await api.deleteFile(id) } catch { /* drop from list regardless */ }
    onSubmit?.({ files: files.filter((f) => f.id !== id) })
  }

  return (
    <div>
      <TileHead a={a} Icon={Paperclip} editable={editable} value={d.heading ?? 'Files'} onChange={(v) => onEdit({ heading: v })} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {files.length === 0 && <div style={{ fontSize: 12.5, color: C.faint }}>No files yet — upload below.</div>}
        {files.map((f) => (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px',
            border: `1px solid ${C.line}`, borderRadius: 9, background: '#fff' }}>
            <span style={{ width: 26, height: 26, borderRadius: 7, flex: '0 0 auto', display: 'grid', placeItems: 'center',
              background: hexA(a, 0.13), color: a }}><FileIcon size={14} /></span>
            <a href={api.fileRawUrl(f.id)} download style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.ink,
              textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</a>
            <span style={{ fontSize: 11.5, color: C.faint, flex: '0 0 auto' }}>{fileSize(f.size)}</span>
            <a href={api.fileRawUrl(f.id)} download title="Download" style={{ color: C.soft, lineHeight: 0 }}><Download size={15} /></a>
            {editable && <RemoveX onClick={() => remove(f.id)} />}
          </div>
        ))}
      </div>
      {err && <div style={{ fontSize: 12, color: '#DC2626', marginTop: 6 }}>{err}</div>}
      <label data-control onPointerDown={(e) => e.stopPropagation()}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 10, padding: '8px 13px',
          borderRadius: 10, border: `1px dashed ${C.line}`, background: '#fff', color: busy ? C.faint : C.indigoDk,
          fontSize: 12.5, fontWeight: 600, cursor: busy ? 'wait' : 'pointer' }}>
        <UploadIcon size={14} /> {busy ? 'Uploading…' : 'Upload files'}
        <input type="file" multiple hidden disabled={busy} onChange={(e) => onPick(e.target.files)} />
      </label>
    </div>
  )
}

// ---- render one freeform element (optionally wrapped in a morph surface) ----
function renderEl(el: Element, a: string, nav?: NavCtx) {
  const inner = elContent(el, a, nav)
  if (!el.morph) return inner
  return (
    <div className={el.morph === 'disco' ? 'morph-disco' : ''}
      style={{ padding: 12, ...morphCard(el.morph, a), ...({ ['--disco-surface' as any]: '#FFFFFF' }) }}>
      {inner}
    </div>
  )
}
function elContent(el: Element, a: string, nav?: NavCtx) {
  // link/button can target a page (internal nav) instead of a URL
  const page = el.pageId ? nav?.pages.find((p) => p.id === el.pageId) : undefined
  const goPage = (e: { preventDefault: () => void }) => { e.preventDefault(); if (el.pageId) nav?.onNavigate(el.pageId) }
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
        <a href={page ? '#' : (el.url || '#')} onClick={page ? goPage : undefined}
          target={page ? undefined : '_blank'} rel="noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: a, fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}>
          {page ? <FileText size={14} /> : <ExternalLink size={14} />} {el.text || page?.title || el.url}
        </a>
      )
    case 'button': {
      const outline = el.variant === 'outline'
      return (
        <a href={page ? '#' : (el.url || '#')} onClick={page ? goPage : undefined}
          target={page ? undefined : '_blank'} rel="noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, textDecoration: 'none',
            background: outline ? 'transparent' : a, color: outline ? a : '#fff',
            border: outline ? `1.5px solid ${a}` : '1.5px solid transparent',
            borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 600 }}>
          {page ? <FileText size={14} /> : <MousePointerClick size={14} />} {el.text || page?.title || 'Button'}
        </a>
      )
    }
    case 'icon': {
      const I = el.icon ? ICONS[el.icon] : Sparkles
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: a }}>
          <span style={{ width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', background: hexA(a, 0.13) }}>
            <I size={20} strokeWidth={2} />
          </span>
          {el.text ? <span style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>{el.text}</span> : null}
        </div>
      )
    }
    case 'divider':
      return <hr style={{ border: 'none', borderTop: `1px solid ${C.line}`, margin: '2px 0' }} />
  }
}

// ---- editor row for one element ----
function ElEditor({ el, onChange, onRemove, pages }:
  { el: Element; onChange: (patch: Partial<Element>) => void; onRemove: () => void; pages: PageRef[] }) {
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
      {el.t === 'icon' && (
        <>
          <Inp value={el.text ?? ''} ph="Label (optional)" onChange={(v) => onChange({ text: v })} />
          <IconPicker value={el.icon} onPick={(ic) => onChange({ icon: (ic || undefined) as IconKey | undefined })} />
        </>
      )}
      {(el.t === 'link' || el.t === 'button') && (
        <>
          <Inp value={el.text ?? ''} ph="Label" onChange={(v) => onChange({ text: v })} />
          {pages.length > 0 && (
            <select data-control value={el.pageId ?? ''} onPointerDown={(e) => e.stopPropagation()}
              onChange={(e) => onChange({ pageId: e.target.value || undefined })}
              style={{ border: `1px solid ${C.line}`, borderRadius: 6, padding: '4px 7px', fontSize: 11.5,
                color: C.soft, background: '#fff', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}>
              <option value="">Link to: a URL</option>
              {pages.map((p) => <option key={p.id} value={p.id}>Go to page: {p.title}</option>)}
            </select>
          )}
          {!el.pageId && <Inp value={el.url ?? ''} ph="https://…" onChange={(v) => onChange({ url: v })} />}
        </>
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
      {el.t !== 'divider' && <ElMorph value={el.morph} onChange={(m) => onChange({ morph: m })} />}
    </div>
  )
}
function ElMorph({ value, onChange }: { value?: MorphKey; onChange: (m: MorphKey | undefined) => void }) {
  return (
    <select data-control value={value ?? ''} onPointerDown={(e) => e.stopPropagation()}
      onChange={(e) => onChange((e.target.value || undefined) as MorphKey | undefined)}
      style={{ border: `1px solid ${C.line}`, borderRadius: 6, padding: '4px 7px', fontSize: 11.5,
        color: C.soft, background: '#fff', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}>
      <option value="">Surface: none</option>
      {MORPHS.map((m) => <option key={m.key} value={m.key}>Surface: {m.label}</option>)}
    </select>
  )
}

// ---- freeform elements section (under every tile) ----
function Elements({ tile, editable, onEdit, nav }:
  { tile: Tile; editable: boolean; onEdit: (patch: any) => void; nav?: NavCtx }) {
  const els: Element[] = tile.data?.elements ?? []
  const setEls = (next: Element[]) => onEdit({ elements: next })
  if (!editable && els.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: editable ? 8 : 10,
      marginTop: tile.kind === 'custom' ? 0 : (els.length || editable ? 12 : 0) }}>
      {els.map((el, i) => editable ? (
        <ElEditor key={el.id} el={el} pages={nav?.pages ?? []}
          onChange={(patch) => setEls(els.map((x, j) => (j === i ? { ...x, ...patch } : x)))}
          onRemove={() => setEls(els.filter((_, j) => j !== i))} />
      ) : (
        <div key={el.id}>{renderEl(el, tile.accent, nav)}</div>
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
export function TileBody({ tile, editable, onEdit, nav, onSubmit }:
  { tile: Tile; editable: boolean; onEdit: (patch: any) => void; nav?: NavCtx; onSubmit?: (patch: any) => void }) {
  return (
    <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <KindBody tile={tile} editable={editable} onEdit={onEdit} onSubmit={onSubmit} />
      <Elements tile={tile} editable={editable} onEdit={onEdit} nav={nav} />
    </div>
  )
}
