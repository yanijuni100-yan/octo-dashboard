import { useMemo } from 'react'

/* Grafik mini dekoratif (smooth, deterministik berdasarkan seed) */
export default function Sparkline({ color, seed }: { color: string; seed: number }): JSX.Element {
  const d = useMemo(() => {
    let s = seed
    const rand = (): number => {
      s = (s * 9301 + 49297) % 233280
      return s / 233280
    }
    const n = 18
    const W = 300
    const H = 46
    const vals = Array.from({ length: n }, () => rand())
    const max = Math.max(...vals)
    const min = Math.min(...vals)
    const norm = vals.map((v) => (v - min) / (max - min || 1))
    const pts = norm.map((v, i) => [(i / (n - 1)) * W, H - 5 - v * (H - 12)])
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
    const area = `${line} L${W},${H} L0,${H} Z`
    return { W, H, line, area }
  }, [seed])

  const gid = 'spark' + seed
  return (
    <svg className="stat-spark" viewBox={`0 0 ${d.W} ${d.H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={d.area} fill={`url(#${gid})`} />
      <path d={d.line} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
