import { useEffect, useState } from 'react'

type Info = { name: string; tagline: string; version: string }

// Minimal placeholder that proves frontend -> backend wiring.
// The real Atrium tile-builder app replaces this.
export default function App() {
  const [info, setInfo] = useState<Info | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/info')
      .then((r) => r.json())
      .then(setInfo)
      .catch((e) => setError(String(e)))
  }, [])

  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center',
      fontFamily: 'system-ui, sans-serif',
      background: 'linear-gradient(160deg,#F4F4FA,#ECECF6)', color: '#1A1A2E',
    }}>
      <div style={{
        background: '#fff', border: '1px solid #E6E6F0', borderRadius: 18,
        padding: '34px 40px', textAlign: 'center',
        boxShadow: '0 20px 44px -26px rgba(79,70,229,.4)',
      }}>
        <div style={{
          width: 52, height: 52, margin: '0 auto 16px', borderRadius: 14,
          background: 'linear-gradient(150deg,#6366F1,#4338CA)',
        }} />
        <h1 style={{ margin: 0, fontSize: 28 }}>{info?.name ?? 'Atrium'}</h1>
        <p style={{ color: '#5A5B73', marginTop: 6 }}>
          {info?.tagline ?? 'Everything, under one roof.'}
        </p>
        <p style={{ fontSize: 12, color: '#9596AD', marginTop: 14 }}>
          {error
            ? `API not reachable: ${error}`
            : info
              ? `connected to atrium-api · v${info.version}`
              : 'connecting to atrium-api…'}
        </p>
      </div>
    </div>
  )
}
