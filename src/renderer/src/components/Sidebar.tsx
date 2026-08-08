import { useStore } from '../lib/store'
import { useUI } from '../lib/ui'
import type { ViewName } from '../lib/types'

const NAV: { view: ViewName; label: string; icon: JSX.Element }[] = [
  {
    view: 'overview',
    label: 'Ringkasan',
    icon: (
      <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    )
  },
  {
    view: 'profiles',
    label: 'Profil',
    icon: (
      <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    )
  },
  {
    view: 'automation',
    label: 'Buka Massal',
    icon: (
      <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="13 2 13 10 21 10" />
        <path d="M21 14V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8" />
        <circle cx="17" cy="18" r="3" />
      </svg>
    )
  },
  {
    view: 'settings',
    label: 'Pengaturan',
    icon: (
      <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </svg>
    )
  }
]

function miniBars(counts: Record<string, number>): JSX.Element {
  const entries = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
  if (!entries.length) return <div className="side-empty">— belum ada</div>
  const max = Math.max(...entries.map(([, n]) => n))
  return (
    <>
      {entries.map(([k, n]) => (
        <div className="side-mini-row" key={k}>
          <span className="side-mini-lbl" title={k}>
            {k}
          </span>
          <span className="side-mini-bar">
            <span className="side-mini-fill" style={{ width: (n / max) * 100 + '%' }} />
          </span>
          <span className="side-mini-n">{n}</span>
        </div>
      ))}
    </>
  )
}

export default function Sidebar({
  view,
  onNav
}: {
  view: ViewName
  onNav: (v: ViewName) => void
}): JSX.Element {
  const profiles = useStore((s) => s.profiles)
  const activeOpen = useUI((s) => s.activeOpen)
  const requestOpen = useUI((s) => s.requestOpen)

  const total = profiles.length
  const active = activeOpen.size
  const groupCount: Record<string, number> = {}
  const brandCount: Record<string, number> = {}
  profiles.forEach((p) => {
    if (p.group) groupCount[p.group] = (groupCount[p.group] || 0) + 1
    if (p.brand) brandCount[p.brand] = (brandCount[p.brand] || 0) + 1
  })

  const openTop4 = (): void => {
    const top4 = profiles
      .filter((p) => p.gmail)
      .slice(0, 4)
      .map((p) => p.uuid)
    if (!top4.length) return
    requestOpen({ mode: 'grid', uuids: top4 })
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-logo">
          <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <defs>
              <linearGradient id="octo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b7dff" />
                <stop offset="100%" stopColor="#1633b8" />
              </linearGradient>
            </defs>
            <g fill="url(#octo)">
              <circle cx="11" cy="34" r="4" />
              <circle cx="19" cy="36.5" r="4" />
              <circle cx="29" cy="36.5" r="4" />
              <circle cx="37" cy="34" r="4" />
            </g>
            <path d="M24 7 C34 7 41 14 41 25 L41 31 C41 33 7 33 7 31 L7 25 C7 14 14 7 24 7Z" fill="url(#octo)" />
            <ellipse cx="18.5" cy="21" rx="5" ry="5.5" fill="#fff" />
            <ellipse cx="29.5" cy="21" rx="5" ry="5.5" fill="#fff" />
            <circle cx="19.5" cy="22" r="2.5" fill="#10205c" />
            <circle cx="28.5" cy="22" r="2.5" fill="#10205c" />
          </svg>
        </div>
        <div className="brand-text">
          <strong>
            <span className="oc-accent">octo</span> browser
          </strong>
        </div>
      </div>

      <nav className="nav">
        <div className="nav-label">Menu</div>
        {NAV.map((n) => (
          <button
            key={n.view}
            className={'nav-item' + (view === n.view ? ' active' : '')}
            onClick={() => onNav(n.view)}
          >
            {n.icon}
            <span className="lbl">{n.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-extras">
        <div className="side-card">
          <div className="side-card-head">
            <span className="dot-live" /> Akun Aktif
          </div>
          <div className="side-active-num">
            <span>{active}</span>
            <span className="slash">/</span>
            <span>{total}</span>
          </div>
          <div className="side-card-sub">
            {active === 0
              ? 'Tidak ada yang dibuka'
              : active === 1
                ? '1 akun sedang dibuka'
                : active + ' akun sedang dibuka'}
          </div>
        </div>
        <div className="side-card">
          <div className="side-card-head">⚡ Aksi Cepat</div>
          <button className="side-act-btn side-act-primary" onClick={openTop4}>
            🌐 Buka 4 teratas
          </button>
        </div>
        <div className="side-card">
          <div className="side-card-head">📊 Distribusi</div>
          <div className="side-dist-lbl">Group</div>
          <div className="side-dist-bars">{miniBars(groupCount)}</div>
          <div className="side-dist-lbl">Brand</div>
          <div className="side-dist-bars">{miniBars(brandCount)}</div>
        </div>
      </div>

      <div className="sidebar-foot">
        <div className="side-stat">
          <div className="side-stat-num">{total}</div>
          <div className="side-stat-lbl">Akun tersimpan</div>
        </div>
      </div>
    </aside>
  )
}
