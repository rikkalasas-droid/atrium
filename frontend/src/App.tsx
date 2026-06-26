import { useEffect, useRef, useState } from 'react'
import Board from './Board'
import { api } from './api'
import { STARTER_TILES, tileToBlock } from './tiles'
import { C, DISPLAY } from './theme'

type Ready = { itemId: string; spaceName: string }

export default function App() {
  const [ready, setReady] = useState<Ready | null>(null)
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)   // guard against StrictMode double-run

  useEffect(() => {
    if (started.current) return
    started.current = true

    ;(async () => {
      try {
        // 1) resolve (or create) a space
        const spaces = await api.listSpaces()
        const space = spaces[0] ?? await api.createSpace({ name: 'Company Home', icon: 'home' })

        // 2) find (or create) the dashboard page for that space
        const items = await api.listItems(space.id)
        let dash = items.find((i: any) => i.title === 'Dashboard')
        if (!dash) {
          dash = await api.createItem(space.id, {
            title: 'Dashboard',
            type: 'Page',
            fieldsJson: '{"kind":"dashboard"}',
            blocks: STARTER_TILES.map((t, i) => tileToBlock(t, i)),
          })
        }

        setReady({ itemId: dash.id, spaceName: space.name })
      } catch (e) {
        setError(String(e))
      }
    })()
  }, [])

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

  if (!ready) {
    return (
      <Center>
        <div style={{ width: 44, height: 44, borderRadius: 12, marginBottom: 14,
          background: `linear-gradient(150deg, ${C.indigoLt}, ${C.indigoDk})` }} />
        <div style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 700 }}>Atrium</div>
        <div style={{ color: C.faint, fontSize: 13, marginTop: 6 }}>Setting up your workspace…</div>
      </Center>
    )
  }

  return <Board itemId={ready.itemId} spaceName={ready.spaceName} />
}

function Center({ children }: { children: any }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24 }}>
      <div>{children}</div>
    </div>
  )
}
