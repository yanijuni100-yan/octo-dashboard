import { useMemo } from 'react'
import { hueOf } from '../lib/util'
import type { Profile } from '../lib/types'

/* Kunci klaster: brand → keluarga nama email (digit di akhir dibuang) → group */
function familyKey(p: Profile): string {
  if (p.brand) return p.brand
  if (p.gmail) {
    const local = p.gmail.email.split('@')[0]
    const fam = local.replace(/[0-9]+$/, '').replace(/[._-]+$/, '')
    return fam || local
  }
  return p.group || 'lainnya'
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5))

/* Jaringan organik: hub menyala per klaster + sebaran node pola sunflower. */
export default function GroupGraph({ profiles }: { profiles: Profile[] }): JSX.Element {
  const g = useMemo(() => {
    const W = 820
    const H = 480
    const CX = W / 2
    const CY = H / 2
    const map = new Map<string, number>()
    profiles.forEach((p) => {
      const k = familyKey(p)
      map.set(k, (map.get(k) || 0) + 1)
    })
    let clusters = [...map.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count)
    const MAXC = 9
    if (clusters.length > MAXC) {
      const head = clusters.slice(0, MAXC - 1)
      const restCount = clusters.slice(MAXC - 1).reduce((s, c) => s + c.count, 0)
      head.push({ key: 'lainnya', count: restCount })
      clusters = head
    }
    const n = clusters.length
    const rnd = (i: number): number => {
      const s = Math.sin(i * 12.9898) * 43758.5453
      return s - Math.floor(s)
    }
    // Batas dalam globe (ellipse) — titik tidak boleh keluar dari sini
    const RXm = W * 0.47 * 0.93
    const RYm = H * 0.46 * 0.93

    const links: { x1: number; y1: number; x2: number; y2: number; c: string; w: number }[] = []
    const nodes: { x: number; y: number; r: number; c: string }[] = []
    const hubs: { x: number; y: number; r: number; c: string; label: string }[] = []

    clusters.forEach((cl, ci) => {
      const hue = hueOf(cl.key)
      // Klaster terbesar (ci=0) di tengah; sisanya melingkar di sekitarnya.
      let hx = CX
      let hy = CY
      if (ci > 0) {
        const ang = ((ci - 1) / Math.max(1, n - 1)) * Math.PI * 2 - Math.PI / 2
        const ringR = Math.min(W, H) * 0.36
        hx = CX + Math.cos(ang) * ringR
        hy = CY + Math.sin(ang) * ringR * 0.92
      }
      const hubR = 7 + Math.min(13, Math.sqrt(cl.count) * 2.4)
      hubs.push({ x: hx, y: hy, r: hubR, c: `hsl(${hue},75%,62%)`, label: cl.key })

      // garis tipis antar hub ke pusat (kesan jaringan)
      if (ci > 0) links.push({ x1: CX, y1: CY, x2: hx, y2: hy, c: `hsla(${hue},75%,65%,.55)`, w: 1.6 })

      const draw = Math.min(cl.count, 46)
      const spread = (24 + Math.sqrt(cl.count) * 9) / Math.sqrt(draw + 1)
      for (let j = 0; j < draw; j++) {
        const rr = hubR + 6 + spread * Math.sqrt(j + 1) + rnd(ci * 31 + j) * 6
        const a = j * GOLDEN + ci * 1.7
        let x = hx + Math.cos(a) * rr
        let y = hy + Math.sin(a) * rr * 0.92
        // Jaga titik tetap di dalam globe: kalau di luar ellipse, tarik ke batas.
        const dd = Math.hypot((x - CX) / RXm, (y - CY) / RYm)
        if (dd > 1) {
          x = CX + (x - CX) / dd
          y = CY + (y - CY) / dd
        }
        nodes.push({ x, y, r: 2.4 + rnd(j * 3 + ci) * 2.6, c: `hsl(${hue},72%,${55 + (j % 5) * 6}%)` })
        links.push({ x1: hx, y1: hy, x2: x, y2: y, c: `hsla(${hue},72%,64%,.45)`, w: 1.1 })
      }
    })
    return { W, H, links, nodes, hubs, CX, CY }
  }, [profiles])

  if (!profiles.length) return <p className="muted">Belum ada akun.</p>

  return (
    <svg className="group-graph" viewBox={`0 0 ${g.W} ${g.H}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <pattern id="ggdots" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="rgba(124,108,242,0.10)" />
        </pattern>
        <filter id="ggglow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Latar bola dunia (globe wireframe) — jelas */}
      <rect x="0" y="0" width={g.W} height={g.H} fill="url(#ggdots)" />
      {(() => {
        const RX = g.W * 0.47
        const RY = g.H * 0.46
        const cx = g.CX
        const cy = g.CY
        const ell = (rx: number, ry: number): string =>
          `M ${(cx - rx).toFixed(1)} ${cy.toFixed(1)} a ${rx.toFixed(1)} ${ry.toFixed(1)} 0 1 0 ${(2 * rx).toFixed(1)} 0 a ${rx.toFixed(1)} ${ry.toFixed(1)} 0 1 0 ${(-2 * rx).toFixed(1)} 0`
        const rings = [
          { id: 'gp0', d: ell(RX, RY), dur: 16 },
          { id: 'gp1', d: ell(RX * 0.66, RY), dur: 12 },
          { id: 'gp2', d: ell(RX * 0.33, RY), dur: 9 },
          { id: 'gp3', d: ell(RX, RY * 0.66), dur: 13 },
          { id: 'gp4', d: ell(RX, RY * 0.33), dur: 10 }
        ]
        return (
          <g fill="none">
            <path id="gp0" d={ell(RX, RY)} stroke="rgba(150,160,255,0.40)" strokeWidth="1.8" />
            <g stroke="rgba(150,160,255,0.22)" strokeWidth="1.1">
              <path id="gp1" d={ell(RX * 0.66, RY)} />
              <path id="gp2" d={ell(RX * 0.33, RY)} />
              <path id="gp3" d={ell(RX, RY * 0.66)} />
              <path id="gp4" d={ell(RX, RY * 0.33)} />
              <line x1={cx} y1={cy - RY} x2={cx} y2={cy + RY} />
              <line x1={cx - RX} y1={cy} x2={cx + RX} y2={cy} />
            </g>
            {/* Titik bercahaya yang mengorbit di garis globe (terasa hidup) */}
            {rings.map((r) => (
              <circle key={'orb-' + r.id} r="3" fill="#a9c7ff" style={{ filter: 'drop-shadow(0 0 4px #8ab4ff)' }}>
                <animateMotion dur={r.dur + 's'} repeatCount="indefinite">
                  <mpath xlinkHref={'#' + r.id} />
                </animateMotion>
              </circle>
            ))}
            {rings.map((r, i) => (
              <circle key={'orb2-' + r.id} r="2.3" fill="#7affc8" style={{ filter: 'drop-shadow(0 0 4px #4fe0a0)' }}>
                <animateMotion dur={(r.dur * 1.35).toFixed(1) + 's'} begin={(-i * 2 - 1).toFixed(0) + 's'} repeatCount="indefinite">
                  <mpath xlinkHref={'#' + r.id} />
                </animateMotion>
              </circle>
            ))}
          </g>
        )
      })()}

      {g.links.map((l, i) => (
        <line
          key={'k' + i}
          className="gg-link"
          x1={l.x1.toFixed(1)}
          y1={l.y1.toFixed(1)}
          x2={l.x2.toFixed(1)}
          y2={l.y2.toFixed(1)}
          stroke={l.c}
          strokeWidth={l.w}
          style={{ animationDelay: ((i % 14) * 0.18).toFixed(2) + 's' }}
        />
      ))}
      {g.nodes.map((nd, i) => (
        <circle
          key={'n' + i}
          className="gg-node"
          cx={nd.x.toFixed(1)}
          cy={nd.y.toFixed(1)}
          r={nd.r.toFixed(1)}
          fill={nd.c}
          style={{ animationDelay: ((i % 12) * 0.25).toFixed(2) + 's' }}
        />
      ))}
      {g.hubs.map((h, i) => (
        <circle
          key={'halo' + i}
          className="gg-halo"
          cx={h.x.toFixed(1)}
          cy={h.y.toFixed(1)}
          r={(h.r * 1.8).toFixed(1)}
          fill={h.c}
          style={{ animationDelay: (i * 0.4).toFixed(2) + 's' }}
        />
      ))}
      {g.hubs.map((h, i) => (
        <circle key={'h' + i} cx={h.x.toFixed(1)} cy={h.y.toFixed(1)} r={h.r.toFixed(1)} fill={h.c} stroke="#0e0f17" strokeWidth="2.5" filter="url(#ggglow)" />
      ))}
      {g.hubs.map((h, i) => (
        <text key={'t' + i} x={h.x.toFixed(1)} y={(h.y - h.r - 6).toFixed(1)} textAnchor="middle" className="gg-label">
          {h.label}
        </text>
      ))}
    </svg>
  )
}
