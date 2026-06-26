import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  LayoutGrid, Plus, Trash2, Palette, Maximize2, Check, X,
} from 'lucide-react'
import { C, ACCENTS, DISPLAY, hexA } from './theme'
import { api } from './api'
import {
  Tile, TileKind, TileBody, KIND_META, blockToTile, tileToBlock, newTile,
} from './tiles'

const SIZE_CYCLE: [number, number][] = [[1, 1], [2, 1], [1, 2], [2, 2]]

export default function Board({ itemId, spaceName }: { itemId: string; spaceName: string }) {
  const [tiles, setTiles] = useState<Tile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [arrange, setArrange] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [colorFor, setColorFor] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  // drag state
  const [draggingUid, setDraggingUid] = useState<string | null>(null)
  const [ptr, setPtr] = useState({ x: 0, y: 0 })
  const drag = useRef<{ uid: string; offX: number; offY: number; w: number; h: number } | null>(null)
  const els = useRef(new Map<string, HTMLElement>())

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const item = await api.getItem(itemId)
      const t = (item.blocks ?? [])
        .filter((b) => b.type === 'Tile')
        .sort((a, b) => a.position - b.position)
        .map(blockToTile)
      setTiles(t); setVersion(item.currentVersion); setDirty(false)
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }, [itemId])

  useEffect(() => { load() }, [load])

  const save = useCallback(async () => {
    setSaving('saving')
    try {
      const blocks = tiles.map((t, i) => tileToBlock(t, i))
      const res = await api.replaceBlocks(itemId, blocks)
      setVersion(res.currentVersion); setDirty(false); setSaving('saved')
      setTimeout(() => setSaving('idle'), 1600)
    } catch { setSaving('error') }
  }, [itemId, tiles])

  const mutate = (fn: (t: Tile[]) => Tile[]) => { setTiles((prev) => fn(prev)); setDirty(true) }

  // ---- tile ops ----
  const setAccent = (uid: string, a: string) =>
    mutate((ts) => ts.map((t) => (t.uid === uid ? { ...t, accent: a } : t)))
  const cycleSize = (uid: string) =>
    mutate((ts) => ts.map((t) => {
      if (t.uid !== uid) return t
      const idx = SIZE_CYCLE.findIndex(([w, h]) => w === t.w && h === t.h)
      const [w, h] = SIZE_CYCLE[(idx + 1) % SIZE_CYCLE.length]
      return { ...t, w, h }
    }))
  const del = (uid: string) => mutate((ts) => ts.filter((t) => t.uid !== uid))
  const editData = (uid: string, patch: any) =>
    mutate((ts) => ts.map((t) => (t.uid === uid ? { ...t, data: { ...t.data, ...patch } } : t)))
  const addTile = (kind: TileKind) => { mutate((ts) => [...ts, newTile(kind)]); setAddOpen(false) }

  // ---- pointer drag ----
  const findUnder = (x: number, y: number, skip: string) => {
    for (const [uid, el] of els.current) {
      if (uid === skip || !el) continue
      const r = el.getBoundingClientRect()
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return uid
    }
    return null
  }
  const onDown = (e: React.PointerEvent, tile: Tile) => {
    if (!arrange) return
    if ((e.target as HTMLElement).closest('[data-control]')) return
    e.preventDefault()
    const el = els.current.get(tile.uid)!
    const r = el.getBoundingClientRect()
    drag.current = { uid: tile.uid, offX: e.clientX - r.left, offY: e.clientY - r.top, w: r.width, h: r.height }
    try { el.setPointerCapture(e.pointerId) } catch { /* noop */ }
    setPtr({ x: e.clientX, y: e.clientY }); setColorFor(null); setDraggingUid(tile.uid)
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return
    setPtr({ x: e.clientX, y: e.clientY })
    const over = findUnder(e.clientX, e.clientY, d.uid)
    if (over) {
      mutate((ts) => {
        const from = ts.findIndex((t) => t.uid === d.uid)
        const to = ts.findIndex((t) => t.uid === over)
        if (from < 0 || to < 0 || from === to) return ts
        const next = ts.slice(); const [m] = next.splice(from, 1); next.splice(to, 0, m); return next
      })
    }
  }
  const onUp = () => { if (!drag.current) return; drag.current = null; setDraggingUid(null) }

  const dragTile = draggingUid ? tiles.find((t) => t.uid === draggingUid) : null
  const cardBase: React.CSSProperties = {
    position: 'relative', background: C.surface, border: `1px solid ${C.line}`,
    borderRadius: 16, padding: 16, overflow: 'hidden',
    boxShadow: '0 1px 2px rgba(26,26,46,.04), 0 10px 26px -18px rgba(26,26,46,.18)',
  }

  const ctrl: React.CSSProperties = {
    width: 28, height: 28, borderRadius: 8, background: '#fff', border: `1px solid ${C.line}`,
    boxShadow: '0 1px 2px rgba(26,26,46,.06)', display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', cursor: 'pointer',
  }

  const saveLabel = saving === 'saving' ? 'Saving…' : saving === 'saved' ? 'Saved ✓'
    : saving === 'error' ? 'Save failed' : dirty ? 'Save' : 'Saved'

  return (
    <div style={{ minHeight: '100%', userSelect: draggingUid ? 'none' : 'auto' }}>
      {/* top bar */}
      <header style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(255,255,255,.82)',
        backdropFilter: 'blur(10px)', borderBottom: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 1320, margin: '0 auto', padding: '11px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, flex: '0 0 auto',
            background: `linear-gradient(150deg, ${C.indigoLt}, ${C.indigoDk})`, display: 'grid', placeItems: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path d="M9 9 H39 L30 19 H18 Z" fill="#fff" fillOpacity=".95" />
              <path d="M39 9 V39 L30 30 V19 Z" fill="#fff" fillOpacity=".4" />
              <path d="M9 39 H39 L30 30 H18 Z" fill="#fff" fillOpacity=".2" />
              <path d="M9 9 V39 L18 30 V19 Z" fill="#fff" fillOpacity=".6" />
              <rect x="18" y="19" width="12" height="11" rx="2" fill="#fff" />
            </svg>
          </span>
          <div style={{ fontFamily: DISPLAY, fontSize: 19, fontWeight: 700, letterSpacing: -0.4 }}>Atrium</div>
          <span style={{ color: C.faint }}>·</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.soft }}>{spaceName}</span>
          <span style={{ fontSize: 11.5, color: C.faint }}>v{version}</span>

          <div style={{ flex: 1 }} />

          {(dirty || saving !== 'idle') && (
            <button onClick={save} disabled={saving === 'saving'} style={{
              display: 'flex', alignItems: 'center', gap: 6, borderRadius: 10, padding: '8px 13px', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, border: `1px solid ${C.line}`,
              background: saving === 'saved' ? C.okSoft : '#fff', color: saving === 'saved' ? C.ok : C.ink,
            }}>
              {saving === 'saved' ? <Check size={15} /> : null}{saveLabel}
            </button>
          )}

          <button onClick={() => { if (arrange && dirty) save(); setArrange((v) => !v); setColorFor(null); setAddOpen(false) }}
            style={{ display: 'flex', alignItems: 'center', gap: 7, borderRadius: 10, padding: '8px 13px', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, border: arrange ? 'none' : `1px solid ${C.line}`,
              background: arrange ? C.indigo : '#fff', color: arrange ? '#fff' : C.ink }}>
            <LayoutGrid size={15} />{arrange ? 'Done' : 'Arrange'}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1320, margin: '0 auto', padding: 18 }}>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontFamily: DISPLAY, fontSize: 27, fontWeight: 700, letterSpacing: -0.6, margin: 0 }}>{spaceName}</h1>
          <p style={{ fontSize: 14, color: C.soft, margin: '6px 0 0' }}>
            {arrange ? 'Drag tiles to rearrange · recolor, resize, add or remove · changes save to your workspace.'
              : 'Your live dashboard — tiles persist and version on every save.'}
          </p>
        </div>

        {loading && <div style={{ color: C.faint, fontSize: 14, padding: 24 }}>Loading your board…</div>}
        {error && <div style={{ color: '#DC2626', fontSize: 13.5, padding: 16, background: '#FEF2F2',
          border: '1px solid #FECACA', borderRadius: 12 }}>Couldn’t load the board: {error}</div>}

        {!loading && !error && (
          <div className="atr-grid">
            {tiles.map((tile) => {
              const isDrag = tile.uid === draggingUid
              return (
                <div key={tile.uid}
                  ref={(el) => { if (el) els.current.set(tile.uid, el); else els.current.delete(tile.uid) }}
                  onPointerDown={(e) => onDown(e, tile)}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={onUp}
                  className={`atr-tile ${arrange ? '' : 'canhover'}`}
                  style={{
                    gridColumn: `span ${tile.w}`, gridRow: `span ${tile.h}`,
                    touchAction: arrange ? 'none' : 'auto',
                    cursor: arrange ? (isDrag ? 'grabbing' : 'grab') : 'default',
                    ...(isDrag
                      ? { background: hexA(tile.accent, 0.05), border: `2px dashed ${hexA(tile.accent, 0.4)}`, borderRadius: 16 }
                      : cardBase),
                  }}>
                  {isDrag ? null : (
                    <>
                      <div style={{ position: 'absolute', left: 0, top: 14, width: 3, height: 22, borderRadius: 3, background: tile.accent }} />
                      <TileBody tile={tile} editable={arrange} onEdit={(p) => editData(tile.uid, p)} />
                      {arrange && (
                        <div data-control style={{ position: 'absolute', top: 9, right: 9, display: 'flex', gap: 4 }}>
                          <button style={ctrl} title="Color" onClick={() => setColorFor(colorFor === tile.uid ? null : tile.uid)}>
                            <Palette size={14} color={C.soft} />
                          </button>
                          <button style={ctrl} title="Resize" onClick={() => cycleSize(tile.uid)}>
                            <Maximize2 size={14} color={C.soft} />
                          </button>
                          <button style={ctrl} title="Remove" onClick={() => del(tile.uid)}>
                            <Trash2 size={14} color="#DC2626" />
                          </button>
                        </div>
                      )}
                      {colorFor === tile.uid && (
                        <div data-control style={{ position: 'absolute', top: 42, right: 9, zIndex: 12, background: '#fff',
                          border: `1px solid ${C.line}`, borderRadius: 12, padding: 10, boxShadow: '0 10px 30px -10px rgba(26,26,46,.3)',
                          display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 7 }}>
                          {ACCENTS.map((a) => (
                            <button key={a} onClick={() => { setAccent(tile.uid, a); setColorFor(null) }}
                              style={{ width: 24, height: 24, borderRadius: 999, background: a, cursor: 'pointer',
                                border: tile.accent === a ? `2px solid ${C.ink}` : '2px solid #fff', outline: `1px solid ${C.line}` }} />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}

            {arrange && (
              <button onClick={() => setAddOpen(true)} style={{ gridColumn: 'span 1', gridRow: 'span 1',
                border: `2px dashed ${C.line}`, borderRadius: 16, background: 'transparent', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7, color: C.soft }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, background: C.isoft, display: 'grid', placeItems: 'center' }}>
                  <Plus size={18} />
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>Add tile</span>
              </button>
            )}
          </div>
        )}
      </main>

      {/* drag ghost */}
      {dragTile && drag.current && (
        <div style={{ position: 'fixed', left: ptr.x - drag.current.offX, top: ptr.y - drag.current.offY,
          width: drag.current.w, height: drag.current.h, zIndex: 60, pointerEvents: 'none',
          transform: 'scale(1.03)', ...cardBase,
          boxShadow: '0 18px 50px -12px rgba(26,26,46,.4), 0 0 0 1px rgba(26,26,46,.04)' }}>
          <div style={{ position: 'absolute', left: 0, top: 14, width: 3, height: 22, borderRadius: 3, background: dragTile.accent }} />
          <TileBody tile={dragTile} editable={false} onEdit={() => { /* noop */ }} />
        </div>
      )}

      {/* add-tile sheet */}
      {addOpen && (
        <div onClick={() => setAddOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 80,
          background: 'rgba(26,26,46,.4)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: 18 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(460px,100%)', background: '#fff',
            borderRadius: 18, padding: 22, border: `1px solid ${C.line}`, boxShadow: '0 30px 80px -20px rgba(26,26,46,.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <h3 style={{ fontFamily: DISPLAY, fontSize: 19, fontWeight: 700, margin: 0 }}>Add a tile</h3>
              <button onClick={() => setAddOpen(false)} style={{ ...ctrl, width: 32, height: 32 }}><X size={17} color={C.soft} /></button>
            </div>
            <p style={{ fontSize: 13, color: C.soft, margin: '0 0 16px' }}>Pick what to drop onto your board.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
              {(Object.keys(KIND_META) as TileKind[]).map((kind) => {
                const m = KIND_META[kind]
                return (
                  <button key={kind} onClick={() => addTile(kind)}
                    style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 13px', borderRadius: 12,
                      border: `1px solid ${C.line}`, background: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ width: 36, height: 36, borderRadius: 9, background: C.isoft, color: C.indigo,
                      display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
                      <m.Icon size={17} />
                    </span>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>{m.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
