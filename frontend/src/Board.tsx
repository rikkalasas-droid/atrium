import React, { useEffect, useRef, useState, useCallback } from 'react'
import { LayoutGrid, Trash2, Check, Move, Plus, FileText, Upload } from 'lucide-react'
import { C, ACCENTS, DISPLAY, hexA } from './theme'
import { api } from './api'
import Importer from './Importer'
import {
  Tile, TileKind, TileBody, KIND_META, blockToTile, tileToBlock, newTile,
  packLayout, fontStyle, COLS, TINTS, FONTS, FontKey, PageRef,
} from './tiles'
import { MorphKey, MORPHS, morphCard, morphBoard } from './morph'

type BoardProps = {
  itemId: string; spaceName: string
  pages: PageRef[]; currentId: string
  onNavigate: (id: string) => void
  onNewPage: () => void
  onRenamePage: (id: string, title: string) => void
  onDeletePage: (id: string) => void
  onImport: (title: string, tiles: Tile[]) => void
}

const GAP = 14
const CELL_H = 110

export default function Board({ itemId, spaceName, pages, currentId,
  onNavigate, onNewPage, onRenamePage, onDeletePage, onImport }: BoardProps) {
  const [importing, setImporting] = useState(false)
  const [tiles, setTiles] = useState<Tile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [arrange, setArrange] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [selectedUid, setSelectedUid] = useState<string | null>(null)
  const [active, setActive] = useState<string | null>(null)   // tile being dragged/resized (raised)
  const [boardMorph, setBoardMorph] = useState<MorphKey>('flat')   // whole-screen style

  const gridRef = useRef<HTMLDivElement>(null)
  const els = useRef(new Map<string, HTMLElement>())
  const drag = useRef<{ uid: string; offX: number; offY: number } | null>(null)
  const rsz = useRef<{ uid: string; startX: number; startY: number; w: number; h: number; cellW: number } | null>(null)
  const [gw, setGw] = useState(0)   // measured canvas width -> cell size for fractional tiles
  useEffect(() => {
    const m = () => { if (gridRef.current) setGw(gridRef.current.clientWidth) }
    m(); const id = setTimeout(m, 0)
    window.addEventListener('resize', m)
    return () => { window.removeEventListener('resize', m); clearTimeout(id) }
  }, [loading, arrange])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const item = await api.getItem(itemId)
      const blocks = item.blocks ?? []
      const cfg = blocks.find((b) => b.type === 'Board')
      try { setBoardMorph((cfg?.contentJson ? JSON.parse(cfg.contentJson).morph : 'flat') ?? 'flat') }
      catch { setBoardMorph('flat') }
      const t = blocks
        .filter((b) => b.type === 'Tile')
        .sort((a, b) => a.position - b.position)
        .map(blockToTile)
      setTiles(packLayout(t)); setVersion(item.currentVersion); setDirty(false)
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }, [itemId])
  useEffect(() => { load() }, [load])

  const pushBlocks = useCallback(async (nextTiles: Tile[]) => {
    const boardBlock = { type: 'Board', position: 0, contentJson: JSON.stringify({ morph: boardMorph }) }
    const blocks = [boardBlock, ...nextTiles.map((t, i) => tileToBlock(t, i + 1))]
    const res = await api.replaceBlocks(itemId, blocks)
    setVersion(res.currentVersion)
    return res
  }, [itemId, boardMorph])

  const save = useCallback(async () => {
    setSaving('saving')
    try { await pushBlocks(tiles); setDirty(false); setSaving('saved'); setTimeout(() => setSaving('idle'), 1600) }
    catch { setSaving('error') }
  }, [pushBlocks, tiles])

  // immediate persist for live interactions (form submit, workflow advance)
  const submitData = useCallback(async (uid: string, patch: any) => {
    const next = tiles.map((t) => (t.uid === uid ? { ...t, data: { ...t.data, ...patch } } : t))
    setTiles(next)
    try { await pushBlocks(next) } catch { /* surfaced via next save */ }
  }, [tiles, pushBlocks])

  const setBoard = (m: MorphKey) => { setBoardMorph(m); setDirty(true) }

  const mutate = (fn: (t: Tile[]) => Tile[]) => { setTiles((prev) => fn(prev)); setDirty(true) }
  const patch = (uid: string, p: Partial<Tile>) => mutate((ts) => ts.map((t) => (t.uid === uid ? { ...t, ...p } : t)))
  const patchFont = (uid: string, p: Partial<NonNullable<Tile['font']>>) =>
    mutate((ts) => ts.map((t) => (t.uid === uid ? { ...t, font: { ...t.font, ...p } } : t)))
  const del = (uid: string) => { mutate((ts) => ts.filter((t) => t.uid !== uid)); setSelectedUid(null) }
  const editData = (uid: string, p: any) =>
    mutate((ts) => ts.map((t) => (t.uid === uid ? { ...t, data: { ...t.data, ...p } } : t)))
  const addTile = (kind: TileKind) => {
    const t = newTile(kind)
    mutate((ts) => packLayout([...ts, t])); setSelectedUid(t.uid)
  }

  const cellW = () => {
    const g = gridRef.current?.getBoundingClientRect()
    return g ? (g.width - GAP * (COLS - 1)) / COLS : 140
  }

  // ---- move (drag tile to any cell) ----
  const onDown = (e: React.PointerEvent, tile: Tile) => {
    if (!arrange) return
    if ((e.target as HTMLElement).closest('[data-control]')) return
    e.preventDefault()
    setSelectedUid(tile.uid)
    const el = els.current.get(tile.uid)!; const r = el.getBoundingClientRect()
    drag.current = { uid: tile.uid, offX: e.clientX - r.left, offY: e.clientY - r.top }
    try { el.setPointerCapture(e.pointerId) } catch { /* noop */ }
    setActive(tile.uid)
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; const g = gridRef.current?.getBoundingClientRect(); if (!d || !g) return
    const cw = (g.width - GAP * (COLS - 1)) / COLS
    const t = tiles.find((x) => x.uid === d.uid); if (!t) return
    let col = Math.round((e.clientX - g.left - d.offX) / (cw + GAP)) + 1
    let row = Math.round((e.clientY - g.top - d.offY) / (CELL_H + GAP)) + 1
    col = Math.max(1, Math.min(col, COLS - t.w + 1)); row = Math.max(1, row)
    if (col !== t.x || row !== t.y) patch(d.uid, { x: col, y: row })
  }
  const onUp = () => { if (drag.current) { drag.current = null; setActive(null) } }

  // ---- resize (drag corner to any size) ----
  const onResizeDown = (e: React.PointerEvent, tile: Tile) => {
    e.preventDefault(); e.stopPropagation()
    rsz.current = { uid: tile.uid, startX: e.clientX, startY: e.clientY, w: tile.w, h: tile.h, cellW: cellW() }
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* noop */ }
    setSelectedUid(tile.uid); setActive(tile.uid)
  }
  const onResizeMove = (e: React.PointerEvent) => {
    const r = rsz.current; if (!r) return
    const t = tiles.find((x) => x.uid === r.uid); if (!t) return
    const dw = (e.clientX - r.startX) / (r.cellW + GAP)
    const dh = (e.clientY - r.startY) / (CELL_H + GAP)
    const maxW = COLS - ((t.x ?? 1) - 1)
    const w = Math.max(1, Math.min(Math.round((r.w + dw) * 10) / 10, maxW))   // 0.1 steps
    const h = Math.max(1, Math.round((r.h + dh) * 10) / 10)
    if (w !== t.w || h !== t.h) patch(r.uid, { w, h })
  }
  const onResizeUp = () => { if (rsz.current) { rsz.current = null; setActive(null) } }

  const selected = tiles.find((t) => t.uid === selectedUid) || null
  const curPage = pages.find((p) => p.id === currentId) || null

  // fractional layout: cell width from measured canvas; tiles sized in px
  const CW = gw > 0 ? (gw - GAP * (COLS - 1)) / COLS : 150
  const px = (t: Tile) => ({
    left: ((t.x ?? 1) - 1) * (CW + GAP),
    top: ((t.y ?? 1) - 1) * (CELL_H + GAP),
    width: t.w * CW + (t.w - 1) * GAP,
    height: t.h * CELL_H + (t.h - 1) * GAP,
  })
  const contentH = Math.max(320, ...tiles.map((t) =>
    ((t.y ?? 1) - 1) * (CELL_H + GAP) + t.h * CELL_H + (t.h - 1) * GAP)) + GAP

  const cardLayout: React.CSSProperties = { position: 'relative', padding: 16, overflow: 'hidden' }
  const boardBg = morphBoard(boardMorph)
  const ctrl: React.CSSProperties = {
    width: 28, height: 28, borderRadius: 8, background: '#fff', border: `1px solid ${C.line}`,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  }
  const saveLabel = saving === 'saving' ? 'Saving…' : saving === 'saved' ? 'Saved ✓'
    : saving === 'error' ? 'Save failed' : dirty ? 'Save' : 'Saved'

  return (
    <div style={{ minHeight: '100%', userSelect: active ? 'none' : 'auto', display: 'flex' }}>
      {/* ---- left menu / inspector (arrange mode) ---- */}
      {arrange && (
        <aside style={{ width: 268, flex: '0 0 auto', position: 'sticky', top: 0, alignSelf: 'flex-start',
          height: '100vh', overflowY: 'auto', background: '#fff', borderRight: `1px solid ${C.line}`, padding: 16 }}>
          <div style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Build</div>
          <div style={{ fontSize: 12, color: C.faint, marginBottom: 14 }}>Add tiles, then move, resize & style.</div>

          <Section label="Page">
            <input value={curPage?.title ?? ''} placeholder="Page name"
              onChange={(e) => curPage && onRenamePage(curPage.id, e.target.value)}
              style={{ width: '100%', border: `1px solid ${C.line}`, borderRadius: 8, padding: '7px 9px',
                fontSize: 13, fontWeight: 600, color: C.ink, outline: 'none', marginBottom: 8 }} />
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={onNewPage} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 6, padding: '8px', borderRadius: 9, border: `1px solid ${C.line}`, background: '#fff',
                cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: C.ink }}>
                <Plus size={14} /> New page
              </button>
              <button onClick={() => curPage && onDeletePage(curPage.id)} disabled={pages.length <= 1}
                title={pages.length <= 1 ? 'Keep at least one page' : 'Delete this page'}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 11px',
                  borderRadius: 9, border: '1px solid #FECACA', background: '#FEF2F2',
                  color: pages.length <= 1 ? '#FCA5A5' : '#DC2626',
                  cursor: pages.length <= 1 ? 'not-allowed' : 'pointer' }}>
                <Trash2 size={15} />
              </button>
            </div>
          </Section>

          <Section label="Add a tile">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
              {(Object.keys(KIND_META) as TileKind[]).map((kind) => {
                const m = KIND_META[kind]
                return (
                  <button key={kind} onClick={() => addTile(kind)} style={{ display: 'flex', alignItems: 'center', gap: 8,
                    padding: '9px 10px', borderRadius: 10, border: `1px solid ${C.line}`, background: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                    <m.Icon size={15} color={C.indigo} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{m.label.split(' ')[0]}</span>
                  </button>
                )
              })}
            </div>
          </Section>

          <Section label="Screen style">
            <MorphPicker value={boardMorph} onPick={(m) => setBoard(m ?? 'flat')} />
          </Section>

          {selected ? (
            <>
              <Section label="Tile style">
                <MorphPicker value={selected.morph} allowInherit
                  onPick={(m) => patch(selected.uid, { morph: m })} />
              </Section>
              <Section label="Tint">
                <Swatches values={TINTS} current={selected.tint ?? 'none'}
                  onPick={(v) => patch(selected.uid, { tint: v })} renderNone />
              </Section>
              <Section label="Accent">
                <Swatches values={ACCENTS} current={selected.accent} onPick={(v) => patch(selected.uid, { accent: v })} />
              </Section>
              <Section label="Font">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 6, marginBottom: 8 }}>
                  {(Object.keys(FONTS) as FontKey[]).map((f) => (
                    <button key={f} onClick={() => patchFont(selected.uid, { family: f })}
                      style={{ ...pill(selected.font?.family === f || (!selected.font?.family && f === 'Sans')),
                        fontFamily: FONTS[f] }}>{f}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  {([['S', 0.85], ['M', 1], ['L', 1.25], ['XL', 1.6]] as [string, number][]).map(([lbl, s]) => (
                    <button key={lbl} onClick={() => patchFont(selected.uid, { scale: s })}
                      style={{ ...pill((selected.font?.scale ?? 1) === s), flex: 1 }}>{lbl}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {([['Regular', 400], ['Bold', 700]] as [string, number][]).map(([lbl, w]) => (
                    <button key={lbl} onClick={() => patchFont(selected.uid, { weight: w })}
                      style={{ ...pill((selected.font?.weight ?? 400) === w), flex: 1, fontWeight: w }}>{lbl}</button>
                  ))}
                </div>
              </Section>
              <Section label="Size">
                <div style={{ display: 'flex', gap: 14 }}>
                  <Stepper label="W" value={selected.w} min={1} max={COLS - (selected.x ?? 1) + 1} step={0.1}
                    onChange={(v) => patch(selected.uid, { w: v })} />
                  <Stepper label="H" value={selected.h} min={1} max={8} step={0.1} onChange={(v) => patch(selected.uid, { h: v })} />
                </div>
              </Section>
              <button onClick={() => del(selected.uid)} style={{ marginTop: 8, width: '100%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 7, padding: '9px', borderRadius: 10, border: '1px solid #FECACA',
                background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <Trash2 size={15} /> Remove tile
              </button>
            </>
          ) : (
            <div style={{ fontSize: 12.5, color: C.faint, marginTop: 6 }}>Select a tile to style it.</div>
          )}
        </aside>
      )}

      {/* ---- main ---- */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(255,255,255,.82)',
          backdropFilter: 'blur(10px)', borderBottom: `1px solid ${C.line}` }}>
          <div style={{ maxWidth: 1320, margin: '0 auto', padding: '11px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, flex: '0 0 auto',
              background: `linear-gradient(150deg, ${C.indigoLt}, ${C.indigoDk})`, display: 'grid', placeItems: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path d="M9 9 H39 L30 19 H18 Z" fill="#fff" fillOpacity=".95" />
                <rect x="18" y="19" width="12" height="11" rx="2" fill="#fff" />
              </svg>
            </span>
            <div style={{ fontFamily: DISPLAY, fontSize: 19, fontWeight: 700, letterSpacing: -0.4 }}>Atrium</div>
            <span style={{ color: C.faint }}>·</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.soft }}>{spaceName}</span>
            <span style={{ fontSize: 11.5, color: C.faint }}>v{version}</span>
            <div style={{ flex: 1 }} />
            {(dirty || saving !== 'idle') && (
              <button onClick={save} disabled={saving === 'saving'} style={{ display: 'flex', alignItems: 'center', gap: 6,
                borderRadius: 10, padding: '8px 13px', cursor: 'pointer', fontSize: 13, fontWeight: 600, border: `1px solid ${C.line}`,
                background: saving === 'saved' ? C.okSoft : '#fff', color: saving === 'saved' ? C.ok : C.ink }}>
                {saving === 'saved' ? <Check size={15} /> : null}{saveLabel}
              </button>
            )}
            <button onClick={() => { if (arrange && dirty) save(); setArrange((v) => !v); setSelectedUid(null) }}
              style={{ display: 'flex', alignItems: 'center', gap: 7, borderRadius: 10, padding: '8px 13px', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, border: arrange ? 'none' : `1px solid ${C.line}`,
                background: arrange ? C.indigo : '#fff', color: arrange ? '#fff' : C.ink }}>
              <LayoutGrid size={15} />{arrange ? 'Done' : 'Arrange'}
            </button>
          </div>

          {/* ---- page navigation ---- */}
          <nav style={{ maxWidth: 1320, margin: '0 auto', padding: '0 18px 9px', display: 'flex',
            alignItems: 'center', gap: 6, overflowX: 'auto' }}>
            {pages.map((p) => {
              const on = p.id === currentId
              return (
                <button key={p.id} onClick={() => onNavigate(p.id)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: '0 0 auto',
                    border: `1px solid ${on ? C.indigo : C.line}`, background: on ? C.isoft : '#fff',
                    color: on ? C.indigoDk : C.soft, borderRadius: 9, padding: '6px 11px',
                    fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                  <FileText size={13} /> {p.title || 'Untitled'}
                </button>
              )
            })}
            <button onClick={onNewPage} title="New page"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flex: '0 0 auto',
                border: `1px dashed ${C.line}`, background: '#fff', color: C.soft, borderRadius: 9,
                padding: '6px 10px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
              <Plus size={13} /> Page
            </button>
            <div style={{ flex: 1 }} />
            <button onClick={() => setImporting(true)} title="Import from SharePoint or any site"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: '0 0 auto',
                border: `1px solid ${C.line}`, background: '#fff', color: C.soft, borderRadius: 9,
                padding: '6px 11px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
              <Upload size={13} /> Import
            </button>
          </nav>
        </header>

        <main style={{ maxWidth: 1320, margin: '0 auto', padding: 18 }}>
          <div style={{ marginBottom: 16 }}>
            <h1 style={{ fontFamily: DISPLAY, fontSize: 27, fontWeight: 700, letterSpacing: -0.6, margin: 0 }}>{spaceName}</h1>
            <p style={{ fontSize: 14, color: C.soft, margin: '6px 0 0' }}>
              {arrange ? 'Drag tiles anywhere · drag the corner to resize · style them in the left panel.'
                : 'Your live dashboard — tiles persist and version on every save.'}
            </p>
          </div>

          {loading && <div style={{ color: C.faint, fontSize: 14, padding: 24 }}>Loading your board…</div>}
          {error && <div style={{ color: '#DC2626', fontSize: 13.5, padding: 16, background: '#FEF2F2',
            border: '1px solid #FECACA', borderRadius: 12 }}>Couldn’t load the board: {error}</div>}

          {!loading && !error && (
            <div style={{ background: boardBg || undefined, borderRadius: boardBg ? 22 : 0, padding: boardBg ? 16 : 0 }}>
            <div className="atr-grid" ref={gridRef} style={{ height: contentH }}>
              {tiles.map((tile) => {
                const isActive = tile.uid === active
                const isSel = tile.uid === selectedUid && arrange
                const eff = tile.morph ?? boardMorph
                const surface = tile.tint && tile.tint !== 'none' ? tile.tint : '#FFFFFF'
                return (
                  <div key={tile.uid}
                    ref={(el) => { if (el) els.current.set(tile.uid, el); else els.current.delete(tile.uid) }}
                    onPointerDown={(e) => onDown(e, tile)}
                    onPointerMove={onMove}
                    onPointerUp={onUp}
                    onPointerCancel={onUp}
                    className={`atr-tile ${arrange ? '' : 'canhover'} ${eff === 'disco' ? 'morph-disco' : ''}`}
                    style={{
                      ...cardLayout, position: 'absolute', ...px(tile),
                      ...morphCard(eff, tile.accent, tile.tint),
                      ...({ ['--disco-surface' as any]: surface }),
                      touchAction: arrange ? 'none' : 'auto',
                      cursor: arrange ? (isActive ? 'grabbing' : 'grab') : 'default',
                      ...(isSel ? { border: `2px solid ${tile.accent}` } : {}),
                      ...(isActive ? { zIndex: 50, boxShadow: '0 18px 50px -12px rgba(26,26,46,.4)' } : {}),
                    }}>
                    <div style={{ position: 'absolute', left: 0, top: 14, width: 3, height: 22, borderRadius: 3, background: tile.accent }} />
                    <div style={{ height: '100%', ...fontStyle(tile.font) }}>
                      <TileBody tile={tile} editable={arrange} onEdit={(p) => editData(tile.uid, p)}
                        nav={{ pages, onNavigate }} onSubmit={(p) => submitData(tile.uid, p)} />
                    </div>
                    {arrange && (
                      <>
                        <div data-control title="Drag to move" style={{ position: 'absolute', top: 9, left: 9, color: C.faint }}>
                          <Move size={13} />
                        </div>
                        {/* resize handle */}
                        <div data-control onPointerDown={(e) => onResizeDown(e, tile)}
                          onPointerMove={onResizeMove} onPointerUp={onResizeUp} onPointerCancel={onResizeUp}
                          title="Drag to resize" style={{ position: 'absolute', right: 3, bottom: 3, width: 18, height: 18,
                            cursor: 'nwse-resize', borderRight: `2px solid ${hexA(tile.accent, 0.6)}`,
                            borderBottom: `2px solid ${hexA(tile.accent, 0.6)}`, borderBottomRightRadius: 6 }} />
                      </>
                    )}
                  </div>
                )
              })}
            </div>
            </div>
          )}
        </main>
      </div>

      {importing && (
        <Importer onClose={() => setImporting(false)}
          onImport={(title, tiles) => { onImport(title, tiles); setImporting(false) }} />
      )}
    </div>
  )
}

// ---- small UI helpers ----
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: C.faint, marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  )
}
function Swatches({ values, current, onPick, renderNone }:
  { values: string[]; current: string; onPick: (v: string) => void; renderNone?: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: 6 }}>
      {values.map((v) => {
        const none = v === 'none'
        return (
          <button key={v} onClick={() => onPick(v)} title={v}
            style={{ width: 22, height: 22, borderRadius: 999, cursor: 'pointer',
              background: none ? '#fff' : v, backgroundImage: none && renderNone ? 'linear-gradient(45deg,transparent 45%,#DC2626 45%,#DC2626 55%,transparent 55%)' : undefined,
              border: current === v ? `2px solid ${C.ink}` : '2px solid #fff', outline: `1px solid ${C.line}` }} />
        )
      })}
    </div>
  )
}
function MorphPicker({ value, onPick, allowInherit }:
  { value: MorphKey | undefined; onPick: (m: MorphKey | undefined) => void; allowInherit?: boolean }) {
  const opts: { key: MorphKey | undefined; label: string }[] =
    allowInherit ? [{ key: undefined, label: 'Auto' }, ...MORPHS] : MORPHS
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 6 }}>
      {opts.map((o) => {
        const sel = value === o.key
        const swatch: React.CSSProperties = o.key
          ? { ...morphCard(o.key, C.indigo), boxShadow: 'none' }
          : { background: '#fff', border: `1px dashed ${C.line}` }
        return (
          <button key={o.label} onClick={() => onPick(o.key)} title={o.label}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 10,
              cursor: 'pointer', textAlign: 'left', border: `1px solid ${sel ? C.indigo : C.line}`,
              background: sel ? C.isoft : '#fff' }}>
            <span className={o.key === 'disco' ? 'morph-disco' : ''}
              style={{ width: 22, height: 22, borderRadius: 7, flex: '0 0 auto', ...swatch }} />
            <span style={{ fontSize: 11.5, fontWeight: 600, color: C.ink }}>{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
function pill(activeOn: boolean): React.CSSProperties {
  return { padding: '7px 8px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
    border: `1px solid ${activeOn ? C.indigo : C.line}`, background: activeOn ? C.isoft : '#fff',
    color: activeOn ? C.indigoDk : C.ink }
}
function Stepper({ label, value, min, max, step = 1, onChange }:
  { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  const set = (d: number) => onChange(Math.max(min, Math.min(max, Math.round((value + d) * 10) / 10)))
  const b: React.CSSProperties = { width: 26, height: 26, borderRadius: 7, border: `1px solid ${C.line}`,
    background: '#fff', cursor: 'pointer', fontSize: 15, lineHeight: 1, color: C.ink }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <span style={{ fontSize: 12, color: C.soft, width: 12 }}>{label}</span>
      <button style={b} onClick={() => set(-step)}>−</button>
      <span style={{ fontSize: 13, fontWeight: 600, width: 24, textAlign: 'center' }}>
        {Number.isInteger(value) ? value : value.toFixed(1)}</span>
      <button style={b} onClick={() => set(step)}>+</button>
    </div>
  )
}
