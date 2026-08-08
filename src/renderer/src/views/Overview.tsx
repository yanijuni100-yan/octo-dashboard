import { useStore } from '../lib/store'
import { useUI } from '../lib/ui'
import { ageDays, hueOf, initialOf, timeAgo } from '../lib/util'
import type { Profile, ViewName } from '../lib/types'
import Sparkline from '../components/Sparkline'
import Donut from '../components/Donut'
import GroupGraph from '../components/GroupGraph'

const GREEN = '#3ddc97'
const ORANGE = '#ffb347'
const PURPLE = '#9b8cff'
const BLUE = '#5b8def'

const IC = {
  mail: (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7l8 5 8-5" />
      <rect x="3" y="5" width="18" height="14" rx="2" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
    </svg>
  ),
  sun: (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

export default function Overview({ onNav }: { onNav: (v: ViewName) => void }): JSX.Element {
  const profiles = useStore((s) => s.profiles)
  const deleteProfile = useStore((s) => s.deleteProfile)
  const toast = useStore((s) => s.toast)
  const requestOpen = useUI((s) => s.requestOpen)

  const startOfDay = new Date().setHours(0, 0, 0, 0)
  const stTotal = profiles.length
  const stMasuk = profiles.filter((p) => p.verified).length
  const stBelum = stTotal - stMasuk
  const stBrand = new Set(profiles.map((p) => p.brand).filter(Boolean)).size
  const stToday = profiles.filter((p) => p.lastActive >= startOfDay).length
  const withBrand = profiles.filter((p) => p.brand).length
  const masukPct = stTotal ? Math.round((stMasuk / stTotal) * 100) : 0
  const newThisWeek = profiles.filter((p) => ageDays(p) < 7).length

  const brandCount: Record<string, number> = {}
  profiles.forEach((p) => {
    if (p.brand) brandCount[p.brand] = (brandCount[p.brand] || 0) + 1
  })
  const topBrands = Object.entries(brandCount).sort((a, b) => b[1] - a[1])
  const recent = [...profiles].sort((a, b) => b.lastActive - a.lastActive).slice(0, 6)

  const openActivity = (p: Profile): void => {
    if (!p.gmail) return
    onNav('profiles')
    requestOpen({ mode: 'single', uuids: [p.uuid] })
  }

  return (
    <section className="view">
      <div className="stats">
        {/* Akun Gmail */}
        <div className="stat stat--rich" onClick={() => onNav('profiles')}>
          <span className="stat-corner" style={{ color: PURPLE }}>{IC.mail}</span>
          <div className="stat-head">
            <div className="stat-ic" style={{ background: 'linear-gradient(135deg,rgba(124,108,242,.4),rgba(124,108,242,.1))', color: PURPLE }}>{IC.mail}</div>
            <div>
              <div className="stat-numrow">
                <div className="stat-num">{stTotal}</div>
                {newThisWeek > 0 ? <span className="stat-trend">+{newThisWeek} minggu ini</span> : null}
              </div>
              <div className="stat-lbl">Akun Gmail</div>
            </div>
          </div>
          <Sparkline color={PURPLE} seed={4231} />
          <div className="stat-foot">
            <Donut size={50} thickness={9} segments={[{ value: stMasuk, color: GREEN }, { value: stBelum, color: ORANGE }]} />
            <div className="stat-legend">
              <div className="lg-item"><span className="lg-dot" style={{ background: GREEN }} />Sudah masuk <b>{stMasuk}</b></div>
              <div className="lg-item"><span className="lg-dot" style={{ background: ORANGE }} />Belum <b>{stBelum}</b></div>
            </div>
          </div>
        </div>

        {/* Sudah Masuk — donut besar */}
        <div className="stat stat--rich stat--center" onClick={() => onNav('profiles')}>
          <span className="stat-corner" style={{ color: GREEN }}>{IC.check}</span>
          <div className="stat-lbl">Sudah Masuk</div>
          <Donut size={118} thickness={14} segments={[{ value: stMasuk, color: GREEN }, { value: stBelum, color: ORANGE }]}>
            <div className="gauge-c-num">{stMasuk}</div>
            <div className="gauge-c-sub">/ {stTotal}</div>
          </Donut>
          <div className="stat-foot-txt">{masukPct}% sudah masuk · {stBelum} belum</div>
        </div>

        {/* Brand Aktif */}
        <div className="stat stat--rich" onClick={() => onNav('profiles')}>
          <span className="stat-corner" style={{ color: '#ff9faf' }}>{IC.star}</span>
          <div className="stat-head">
            <div className="stat-ic" style={{ background: 'linear-gradient(135deg,rgba(255,107,129,.4),rgba(255,107,129,.1))', color: '#ff9faf' }}>{IC.star}</div>
            <div><div className="stat-num">{stBrand}</div><div className="stat-lbl">Brand Aktif</div></div>
          </div>
          <div className="stat-foot">
            <Donut size={50} thickness={9} segments={[{ value: withBrand, color: PURPLE }, { value: Math.max(0, stTotal - withBrand), color: 'rgba(255,255,255,.07)' }]}>
              <span className="donut-mini">{stBrand}</span>
            </Donut>
            <div className="stat-legend">
              <div className="lg-cap">TOP BRAND</div>
              {topBrands.length ? (
                topBrands.slice(0, 2).map(([b, n]) => (
                  <div className="lg-item" key={b}>{b} <b>{n}</b></div>
                ))
              ) : (
                <div className="lg-item muted">— belum ada</div>
              )}
            </div>
          </div>
        </div>

        {/* Aktif Hari Ini */}
        <div className="stat stat--rich" onClick={() => onNav('profiles')}>
          <span className="stat-corner" style={{ color: '#7aa2ff' }}>{IC.sun}</span>
          <div className="stat-head">
            <div className="stat-ic" style={{ background: 'linear-gradient(135deg,rgba(91,141,239,.4),rgba(91,141,239,.1))', color: '#7aa2ff' }}>{IC.sun}</div>
            <div><div className="stat-num">{stToday}</div><div className="stat-lbl">Aktif Hari Ini</div></div>
          </div>
          <Sparkline color={BLUE} seed={2027} />
        </div>
      </div>

      <div className="ov-grid">
        {/* Sebaran Group — grafik jaringan */}
        <div className="card">
          <div className="card-head"><h3>Sebaran Group</h3></div>
          <GroupGraph profiles={profiles} />
        </div>

        {/* Aktivitas Terbaru */}
        <div className="card">
          <div className="card-head"><h3>Aktivitas Terbaru</h3></div>
          <ul className="activity">
            {recent.length ? (
              recent.map((p) => {
                const email = p.gmail ? p.gmail.email : p.title
                const hue = hueOf(email)
                return (
                  <li key={p.uuid} onClick={() => openActivity(p)}>
                    <span className="avatar" style={{ background: `hsl(${hue},62%,52%)` }}>{initialOf(email)}</span>
                    <div className="a-info">
                      <div className="a-mail">{email}</div>
                      <span className={'a-pill ' + (p.verified ? 'ok' : 'warn')}>{p.verified ? '● Siap' : '● Peringatan'}</span>
                    </div>
                    <span className="a-time">{timeAgo(p.lastActive)}</span>
                    <span className="a-acts" onClick={(e) => e.stopPropagation()}>
                      <button className="a-act" title="Edit di Profil" onClick={() => onNav('profiles')}>✎</button>
                      <button
                        className="a-act"
                        title="Hapus"
                        onClick={() => {
                          if (confirm('Hapus profil "' + email + '"?')) {
                            deleteProfile(p.uuid)
                            toast('Profil dihapus')
                          }
                        }}
                      >
                        🗑
                      </button>
                    </span>
                  </li>
                )
              })
            ) : (
              <li className="muted">Belum ada aktivitas.</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  )
}
