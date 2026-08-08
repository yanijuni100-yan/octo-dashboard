import type { ReactNode } from 'react'

export interface DonutSeg {
  value: number
  color: string
}

/* Donut multi-segmen dengan konten di tengah (opsional) */
export default function Donut({
  segments,
  size = 120,
  thickness = 14,
  children
}: {
  segments: DonutSeg[]
  size?: number
  thickness?: number
  children?: ReactNode
}): JSX.Element {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const cx = size / 2
  let offset = 0

  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={thickness} />
        {segments.map((seg, i) => {
          const len = (seg.value / total) * c
          const el = (
            <circle
              key={i}
              cx={cx}
              cy={cx}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={thickness}
              strokeDasharray={`${len.toFixed(2)} ${(c - len).toFixed(2)}`}
              strokeDashoffset={(-offset).toFixed(2)}
              transform={`rotate(-90 ${cx} ${cx})`}
            />
          )
          offset += len
          return el
        })}
      </svg>
      {children ? <div className="donut-center">{children}</div> : null}
    </div>
  )
}
