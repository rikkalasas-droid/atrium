// Migration: turn HTML (SharePoint / any .NET site) or CSV into Atrium tiles.
import { ACCENTS } from './theme'
import type { Tile, Element as AtElement } from './tiles'

const rid = () => (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2))
const pick = () => ACCENTS[Math.floor(Math.random() * ACCENTS.length)]

function safeUrl(u?: string | null, base?: string): string | undefined {
  if (!u) return undefined
  try { return base ? new URL(u, base).href : new URL(u).href }
  catch { return /^https?:\/\//i.test(u) ? u : undefined }
}

function bannerTile(title: string, subtitle: string): Tile {
  return { uid: rid(), kind: 'banner', w: 2, h: 1, accent: pick(), data: { title, subtitle } }
}
function customTile(elements: AtElement[], heading = ''): Tile {
  const h = Math.max(2, Math.min(8, Math.ceil(elements.length / 3) + 1))
  return { uid: rid(), kind: 'custom', w: 3, h, accent: pick(), data: { heading, elements } }
}

// ---- HTML ----
export function parseHtml(html: string, sourceUrl?: string): { title: string; tiles: Tile[] } {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const title = (doc.querySelector('title')?.textContent
    || doc.querySelector('h1')?.textContent || 'Imported page').replace(/\s+/g, ' ').trim().slice(0, 120)

  // prefer a real content region (handles SharePoint modern/classic + generic sites)
  const root = doc.querySelector(
    'main, article, [role="main"], .CanvasZone, #contentBox, .ms-rte-layoutzone-outer, #DeltaPlaceHolderMain',
  ) || doc.body || doc.documentElement

  let host = ''
  try { if (sourceUrl) host = new URL(sourceUrl).host } catch { /* ignore */ }
  const base = sourceUrl

  const els: AtElement[] = []
  const nodes = root.querySelectorAll('h1,h2,h3,h4,p,li,img,hr,blockquote')
  nodes.forEach((n: any) => {
    const tag = n.tagName.toLowerCase()
    if (tag === 'hr') { els.push({ id: rid(), t: 'divider' }); return }
    if (tag === 'img') {
      const src = safeUrl(n.getAttribute('src'), base)
      if (src) els.push({ id: rid(), t: 'image', url: src })
      return
    }
    const anchors = n.querySelectorAll('a[href]')
    const text = (n.textContent || '').replace(/\s+/g, ' ').trim()
    if (!text && anchors.length === 0) return
    // a list item / paragraph that's basically one link -> a real link element
    if ((tag === 'li' || tag === 'p') && anchors.length === 1) {
      const a = anchors[0]
      const atext = (a.textContent || '').replace(/\s+/g, ' ').trim()
      if (atext.length >= text.length - 2) {
        const href = safeUrl(a.getAttribute('href'), base)
        els.push({ id: rid(), t: 'link', text: atext || href || 'link', url: href || '#' })
        return
      }
    }
    if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') els.push({ id: rid(), t: 'heading', text })
    else if (tag === 'li') els.push({ id: rid(), t: 'text', text: '• ' + text })
    else els.push({ id: rid(), t: 'text', text })
  })

  const clean = els
    .filter((e) => e.t === 'divider' || e.t === 'image' || (e.text && e.text.length > 0))
    .slice(0, 200)

  const subtitle = host ? `Imported from ${host}` : 'Imported content — edit it like any page.'
  const body = clean.length ? clean : [{ id: rid(), t: 'text' as const, text: 'No readable content was found on that page.' }]
  return { title, tiles: [bannerTile(title, subtitle), customTile(body)] }
}

// ---- CSV (SharePoint list / Excel export) ----
function csvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else q = false }
      else cell += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some((x) => x.length)) rows.push(row)
      row = []
    } else cell += c
  }
  if (cell.length || row.length) { row.push(cell); if (row.some((x) => x.length)) rows.push(row) }
  return rows
}

export function parseCsv(text: string, name = 'Imported list'): { title: string; tiles: Tile[] } {
  const rows = csvRows(text)
  if (rows.length === 0) return { title: name, tiles: [bannerTile(name, 'Imported (empty file)')] }
  const header = rows[0]
  const els: AtElement[] = [{ id: rid(), t: 'heading', text: header.join('   ·   ') }, { id: rid(), t: 'divider' }]
  rows.slice(1, 300).forEach((r) => els.push({ id: rid(), t: 'text', text: r.join('   ·   ') }))
  const subtitle = `${Math.max(0, rows.length - 1)} rows imported`
  return { title: name, tiles: [bannerTile(name, subtitle), customTile(els)] }
}
