import { useMemo } from 'react'
import type * as React from 'react'

/* Latar: 3 orb + taburan bintang statis (ringan) */
export default function BgOrbs(): JSX.Element {
  const stars = useMemo(() => {
    return Array.from({ length: 70 }, () => {
      const size = (Math.random() * 1.8 + 0.5).toFixed(2)
      return {
        top: (Math.random() * 100).toFixed(2) + 'vh',
        left: (Math.random() * 100).toFixed(2) + 'vw',
        width: size + 'px',
        height: size + 'px',
        opacity: (Math.random() * 0.65 + 0.25).toFixed(2)
      } as React.CSSProperties
    })
  }, [])

  return (
    <div className="bg-orbs" aria-hidden="true">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
      {stars.map((s, i) => (
        <span key={i} className="star" style={s} />
      ))}
    </div>
  )
}
