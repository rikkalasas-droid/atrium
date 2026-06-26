import type { CSSProperties } from 'react'
import { hexA } from './theme'

// ---- UI "morphisms": pluggable surface styles for the board & tiles ----
export type MorphKey =
  | 'flat' | 'neu' | 'glass' | 'clay' | 'skeuo' | 'metal' | 'light' | 'squircle' | 'disco'

export const MORPHS: { key: MorphKey; label: string }[] = [
  { key: 'flat', label: 'Flat' },
  { key: 'neu', label: 'Neumorphism' },
  { key: 'glass', label: 'Glassmorphism' },
  { key: 'clay', label: 'Claymorphism' },
  { key: 'skeuo', label: 'Skeuomorphism' },
  { key: 'metal', label: 'Metal' },
  { key: 'light', label: 'Light' },
  { key: 'squircle', label: 'Squircle' },
  { key: 'disco', label: 'Disco' },
]

// Surface style for a single tile card. `accent`/`tint` let a morph pick up
// the tile's colour. Returns border/radius/background/shadow only — layout
// (position, padding) stays in Board's cardLayout.
export function morphCard(key: MorphKey, accent: string, tint?: string): CSSProperties {
  const surface = tint && tint !== 'none' ? tint : '#FFFFFF'
  switch (key) {
    case 'neu':
      return {
        background: '#E6E9EF', border: 'none', borderRadius: 20,
        boxShadow: '7px 7px 16px rgba(163,177,198,0.6), -7px -7px 16px rgba(255,255,255,0.9)',
      }
    case 'glass':
      return {
        background: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.6)', borderRadius: 18,
        boxShadow: '0 8px 30px rgba(31,38,135,0.14)',
        backdropFilter: 'blur(14px) saturate(150%)', WebkitBackdropFilter: 'blur(14px) saturate(150%)',
      }
    case 'clay':
      return {
        background: tint && tint !== 'none' ? tint : hexA(accent, 0.16), border: 'none', borderRadius: 28,
        boxShadow: `inset 6px 6px 12px rgba(255,255,255,0.7), inset -6px -6px 14px ${hexA(accent, 0.18)}, 14px 18px 36px -14px ${hexA(accent, 0.45)}`,
      }
    case 'skeuo':
      return {
        background: 'linear-gradient(180deg,#FDFDFD,#E4E6EC)', border: '1px solid #C8CCD6', borderRadius: 14,
        boxShadow: '0 2px 3px rgba(0,0,0,0.18), inset 0 1px 0 #FFFFFF, inset 0 -2px 4px rgba(0,0,0,0.06)',
      }
    case 'metal':
      return {
        background: 'linear-gradient(135deg,#C2C9D2 0%,#EEF2F5 30%,#AEB6C0 52%,#F4F7F9 70%,#B6BEC8 100%)',
        border: '1px solid #99A2AE', borderRadius: 14,
        boxShadow: '0 6px 16px -8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.7)',
      }
    case 'light':
      return {
        background: `radial-gradient(120% 130% at 0% 0%, ${hexA(accent, 0.22)}, transparent 45%), radial-gradient(120% 130% at 100% 100%, ${hexA(accent, 0.16)}, transparent 50%), #FFFFFF`,
        border: '1px solid rgba(255,255,255,0.85)', borderRadius: 18,
        boxShadow: `0 0 0 1px ${hexA(accent, 0.08)}, 0 18px 50px -18px ${hexA(accent, 0.5)}`,
      }
    case 'squircle':
      return {
        background: surface, border: '1px solid #ECECF3', borderRadius: 30,
        boxShadow: '0 1px 2px rgba(26,26,46,.04), 0 12px 30px -18px rgba(26,26,46,.22)',
      }
    case 'disco':
      // animated rainbow border is driven by the .morph-disco class (index.css);
      // keep the inner surface here so text stays readable.
      return { background: surface }
    default: // flat
      return {
        background: surface, border: '1px solid #ECECF3', borderRadius: 16,
        boxShadow: '0 1px 2px rgba(26,26,46,.04), 0 10px 26px -18px rgba(26,26,46,.18)',
      }
  }
}

// Backdrop painted behind the tiles (the canvas) for a board-level morph.
// '' means leave the default page gradient.
export function morphBoard(key: MorphKey): string {
  switch (key) {
    case 'neu': return '#E6E9EF'
    case 'glass': return 'linear-gradient(135deg,#a78bfa,#60a5fa 45%,#22d3ee 85%)'
    case 'clay': return 'linear-gradient(160deg,#FDF2F8,#EEF2FF)'
    case 'skeuo': return 'linear-gradient(180deg,#EDEEF2,#DCDEE6)'
    case 'metal': return 'linear-gradient(135deg,#D7DCE2,#B9C0CA)'
    case 'light': return 'radial-gradient(circle at 25% 12%, #20203a 0%, #0d0d18 65%)'
    case 'disco': return 'linear-gradient(135deg,#1a1a2e,#16213e)'
    default: return ''
  }
}
