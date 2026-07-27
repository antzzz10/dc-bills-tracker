import { useId } from 'react'

/**
 * Five-pointed star, one point rendered as a diagonal hatch instead of a
 * flat fill. Texture (not color alone) carries the "incomplete
 * representation" meaning so it survives colorblindness and single-ink
 * print. Spec: reference/brand/RepresentDC Logo Style Guide.dc.html
 */
const STAR_PATH = 'M32,10 L37.29,24.72 L52.92,25.20 L40.56,34.78 L44.93,49.80 L32,41 L19.07,49.80 L23.44,34.78 L11.08,25.20 L26.71,24.72 Z'
const ACCENT_POINT_PATH = 'M23.44,34.78 L11.08,25.20 L26.71,24.72 Z'

const VARIANTS = {
  color:    { star: 'var(--navy)',  hatchFill: 'var(--dc-red)', hatchLine: 'var(--white)' },
  reversed: { star: 'var(--white)', hatchFill: 'var(--gold)',   hatchLine: 'var(--navy)' },
  mono:     { star: 'var(--navy)',  hatchFill: 'var(--navy)',   hatchLine: 'var(--white)' },
}

export function Logo({ variant = 'color', size = 26 }) {
  const patternId = useId()
  const { star, hatchFill, hatchLine } = VARIANTS[variant]
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <pattern id={patternId} width="4" height="4" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill={hatchFill} />
          <line x1="0" y1="0" x2="0" y2="4" stroke={hatchLine} strokeWidth="1.6" />
        </pattern>
      </defs>
      <path d={STAR_PATH} fill={star} />
      <path d={ACCENT_POINT_PATH} fill={`url(#${patternId})`} />
    </svg>
  )
}

/** "RepresentDC" is always one word. "DC" carries a thin underline tying it to the star's accent color — never drop it. */
export function Wordmark({ variant = 'color', size = 15 }) {
  const dcColor = variant === 'reversed' ? 'var(--gold)' : 'var(--dc-red)'
  const wordColor = variant === 'reversed' ? 'var(--white)' : 'var(--navy)'
  return (
    <span style={{ font: `800 ${size}px/1 var(--font-sans)`, letterSpacing: '-0.03em', color: wordColor }}>
      Represent
      <span style={{ color: dcColor, borderBottom: '0.16em solid currentColor', paddingBottom: '0.03em' }}>DC</span>
    </span>
  )
}
