import { useState } from 'react'
import { X, Globe, Code2, Table, Upload, ArrowRight, Loader2 } from 'lucide-react'
import { C, DISPLAY } from './theme'
import { api } from './api'
import { parseHtml, parseCsv } from './importer'
import type { Tile } from './tiles'

type Mode = 'url' | 'html' | 'csv'
type Result = { title: string; tiles: Tile[] }

export default function Importer({ onClose, onImport }:
  { onClose: () => void; onImport: (title: string, tiles: Tile[]) => void }) {
  const [mode, setMode] = useState<Mode>('url')
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  const run = async () => {
    setBusy(true); setError(null); setResult(null)
    try {
      if (mode === 'url') {
        if (!/^https?:\/\//i.test(url.trim())) throw new Error('Enter a full http(s) URL.')
        const res = await api.importUrl(url.trim())
        setResult(parseHtml(res.html, res.finalUrl))
      } else if (mode === 'html') {
        if (!text.trim()) throw new Error('Paste the page HTML first.')
        setResult(parseHtml(text))
      } else {
        if (!text.trim()) throw new Error('Paste or upload a CSV first.')
        setResult(parseCsv(text, fileName.replace(/\.csv$/i, '') || 'Imported list'))
      }
    } catch (e: any) { setError(String(e.message || e)) }
    finally { setBusy(false) }
  }

  const onFile = (f: File | undefined) => {
    if (!f) return
    setFileName(f.name)
    const r = new FileReader()
    r.onload = () => { setText(String(r.result || '')); setResult(null) }
    r.readAsText(f)
  }

  const tabs: { m: Mode; label: string; Icon: any; hint: string }[] = [
    { m: 'url', label: 'From URL', Icon: Globe, hint: 'Fetch a public page (SharePoint, .NET site, anything).' },
    { m: 'html', label: 'Paste HTML', Icon: Code2, hint: 'For pages behind a login: open it, View Source, paste here.' },
    { m: 'csv', label: 'CSV / List', Icon: Table, hint: 'Export a SharePoint list or Excel sheet to CSV, then import.' },
  ]
  const cur = tabs.find((t) => t.m === mode)!

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(20,20,40,.45)',
      backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(620px,100%)', maxHeight: '88vh', overflowY: 'auto',
        background: '#fff', borderRadius: 18, boxShadow: '0 30px 80px -20px rgba(20,20,40,.5)', padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center',
            background: `linear-gradient(150deg, ${C.indigoLt}, ${C.indigoDk})`, color: '#fff' }}><Upload size={17} /></span>
          <div style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 700, flex: 1 }}>Import / migrate content</div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: C.faint }}><X size={20} /></button>
        </div>
        <div style={{ fontSize: 12.5, color: C.faint, marginBottom: 14 }}>
          Bring a page over from SharePoint or any .NET site. It becomes a new, fully editable Atrium page.
        </div>

        {/* mode tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {tabs.map((t) => {
            const on = t.m === mode
            return (
              <button key={t.m} onClick={() => { setMode(t.m); setResult(null); setError(null) }}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px',
                  borderRadius: 10, cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
                  border: `1px solid ${on ? C.indigo : C.line}`, background: on ? C.isoft : '#fff', color: on ? C.indigoDk : C.soft }}>
                <t.Icon size={15} /> {t.label}
              </button>
            )
          })}
        </div>
        <div style={{ fontSize: 12, color: C.soft, marginBottom: 10 }}>{cur.hint}</div>

        {/* input */}
        {mode === 'url' ? (
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://contoso.sharepoint.com/sites/team/Pages/Home.aspx"
            style={{ width: '100%', border: `1px solid ${C.line}`, borderRadius: 10, padding: '11px 12px', fontSize: 13.5,
              outline: 'none', fontFamily: 'inherit' }} />
        ) : (
          <>
            <textarea value={text} onChange={(e) => { setText(e.target.value); setResult(null) }}
              placeholder={mode === 'html' ? 'Paste the full page HTML…' : 'Paste CSV rows, or upload a file below…'}
              style={{ width: '100%', minHeight: 150, resize: 'vertical', border: `1px solid ${C.line}`, borderRadius: 10,
                padding: 12, fontSize: 12.5, fontFamily: 'ui-monospace, Menlo, monospace', outline: 'none' }} />
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 8, fontSize: 12.5,
              color: C.indigoDk, fontWeight: 600, cursor: 'pointer' }}>
              <Upload size={14} /> Upload a {mode === 'csv' ? '.csv' : '.html'} file
              <input type="file" accept={mode === 'csv' ? '.csv,text/csv' : '.html,.htm,text/html'} hidden
                onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            {fileName && <span style={{ fontSize: 12, color: C.faint, marginLeft: 8 }}>{fileName}</span>}
          </>
        )}

        {error && <div style={{ marginTop: 12, fontSize: 13, color: '#DC2626', background: '#FEF2F2',
          border: '1px solid #FECACA', borderRadius: 10, padding: '9px 12px' }}>{error}</div>}

        {result && (
          <div style={{ marginTop: 14, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, background: C.canvasA }}>
            <div style={{ fontSize: 12, color: C.faint, marginBottom: 4 }}>Preview</div>
            <div style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{result.title}</div>
            <div style={{ fontSize: 12.5, color: C.soft }}>
              {result.tiles.length} tile{result.tiles.length === 1 ? '' : 's'} ·{' '}
              {result.tiles.reduce((n, t) => n + (t.data?.elements?.length ?? 0), 0)} content blocks ready to edit.
            </div>
          </div>
        )}

        {/* actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button onClick={onClose} style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.line}`,
            background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.ink }}>Cancel</button>
          {result ? (
            <button onClick={() => onImport(result.title, result.tiles)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: 10,
                border: 'none', background: C.indigo, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              Create page <ArrowRight size={15} />
            </button>
          ) : (
            <button onClick={run} disabled={busy}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: 10,
                border: 'none', background: C.indigo, color: '#fff', cursor: busy ? 'wait' : 'pointer', fontSize: 13, fontWeight: 700,
                opacity: busy ? 0.7 : 1 }}>
              {busy ? <Loader2 size={15} /> : null} {busy ? 'Reading…' : 'Preview import'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
