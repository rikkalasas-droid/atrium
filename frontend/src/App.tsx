import { useEffect, useRef, useState } from 'react'
import Board from './Board'
import { api } from './api'
import { STARTER_TILES, tileToBlock, newTile, type PageRef } from './tiles'
import { C, DISPLAY } from './theme'

export default function App() {
  const [spaceName, setSpaceName] = useState('')
  const [spaceId, setSpaceId] = useState('')
  const [pages, setPages] = useState<PageRef[]>([])
  const [currentId, setCurrentId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)   // guard against StrictMode double-run

  useEffect(() => {
    if (started.current) return
    started.current = true
    ;(async () => {
      try {
        const spaces = await api.listSpaces()
        const space = spaces[0] ?? await api.createSpace({ name: 'Company Home', icon: 'home' })
        setSpaceName(space.name); setSpaceId(space.id)

        const items = await api.listItems(space.id)
        let list: PageRef[] = items
          .filter((i: any) => (i.type ?? 'Page') === 'Page')
          .map((i: any) => ({ id: i.id, title: i.title }))

        if (list.length === 0) {
          const dash = await api.createItem(space.id, {
            title: 'Dashboard', type: 'Page', fieldsJson: '{"kind":"dashboard"}',
            blocks: STARTER_TILES.map((t, i) => tileToBlock(t, i + 1)),
          })
          list = [{ id: dash.id, title: dash.title }]
        }
        setPages(list); setCurrentId(list[0].id)
      } catch (e) { setError(String(e)) }
    })()
  }, [])

  const newPage = async () => {
    try {
      const banner = newTile('banner')
      const created = await api.createItem(spaceId, {
        title: 'New page', type: 'Page', fieldsJson: '{"kind":"page"}',
        blocks: [tileToBlock(banner, 1)],
      })
      setPages((p) => [...p, { id: created.id, title: created.title }])
      setCurrentId(created.id)
    } catch (e) { setError(String(e)) }
  }
  const renamePage = async (id: string, title: string) => {
    setPages((p) => p.map((x) => (x.id === id ? { ...x, title } : x)))   // optimistic
    try { await api.updateItem(id, { title }) } catch (e) { setError(String(e)) }
  }
  const deletePage = async (id: string) => {
    const rest = pages.filter((p) => p.id !== id)
    if (rest.length === 0) return                 // never delete the last page
    setPages(rest)
    if (currentId === id) setCurrentId(rest[0].id)
    try { await api.deleteItem(id) } catch (e) { setError(String(e)) }
  }

  if (error) {
    return (
      <Center>
        <div style={{ color: '#DC2626', fontSize: 14 }}>Couldn’t reach the API: {error}</div>
        <div style={{ color: C.faint, fontSize: 12.5, marginTop: 8 }}>
          Is the backend up and the <code>/api</code> proxy working?
        </div>
      </Center>
    )
  }
  if (!currentId) {
    return (
      <Center>
        <div style={{ width: 44, height: 44, borderRadius: 12, marginBottom: 14,
          background: `linear-gradient(150deg, ${C.indigoLt}, ${C.indigoDk})` }} />
        <div style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 700 }}>Atrium</div>
        <div style={{ color: C.faint, fontSize: 13, marginTop: 6 }}>Setting up your workspace…</div>
      </Center>
    )
  }

  return (
    <Board key={currentId} itemId={currentId} spaceName={spaceName}
      pages={pages} currentId={currentId}
      onNavigate={setCurrentId} onNewPage={newPage}
      onRenamePage={renamePage} onDeletePage={deletePage} />
  )
}

function Center({ children }: { children: any }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24 }}>
      <div>{children}</div>
    </div>
  )
}
