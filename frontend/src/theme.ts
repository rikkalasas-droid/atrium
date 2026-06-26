export const C = {
  indigo: '#4F46E5', indigoLt: '#6366F1', indigoDk: '#4338CA',
  ink: '#1A1A2E', soft: '#5A5B73', faint: '#9596AD',
  line: '#E6E6F0', lineSoft: '#EFEFF7', canvasA: '#F4F4FA', canvasB: '#ECECF6',
  surface: '#FFFFFF', isoft: '#EEEDFC', ok: '#16A34A', okSoft: '#E7F6ED',
}

// Tile accent palette (no green, per brand)
export const ACCENTS = [
  '#4F46E5', '#7C3AED', '#2563EB', '#0EA5E9',
  '#DB2777', '#D97706', '#DC2626', '#475569',
]

export const DISPLAY = "'Bricolage Grotesque', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
export const UI = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"

export const hexA = (hex: string, a: number) => {
  const n = hex.replace('#', '')
  const r = parseInt(n.slice(0, 2), 16)
  const g = parseInt(n.slice(2, 4), 16)
  const b = parseInt(n.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}
