import { useStore } from '../lib/store'
import type { ViewName } from '../lib/types'

const TITLES: Record<ViewName, [string, string]> = {
  overview: ['Ringkasan', 'Pantauan cepat seluruh profil Anda'],
  profiles: ['Profil', 'Kelola, jalankan, dan edit profil browser'],
  proxies: ['Proxy', 'Daftar proxy yang dipakai profil'],
  automation: ['Buka Massal', 'Buka & login banyak akun sekaligus'],
  settings: ['Pengaturan', 'Koneksi Octo Browser dan data']
}

export default function Topbar({ view, onNav }: { view: ViewName; onNav: (v: ViewName) => void }): JSX.Element {
  const live = useStore((s) => s.cfg.live)
  const setLive = useStore((s) => s.setLive)
  const loadProfiles = useStore((s) => s.loadProfiles)
  const cloudPull = useStore((s) => s.cloudPull)
  const toast = useStore((s) => s.toast)
  const profiles = useStore((s) => s.profiles)
  const cloudEmail = useStore((s) => s.cloudEmail)
  const [title, sub] = TITLES[view]
  const warn = profiles.filter((p) => !p.verified).length

  return (
    <header className="topbar">
      <div>
        <h1>{title}</h1>
        <p className="muted">{sub}</p>
      </div>
      <div className="topbar-actions">
        <label className="switch" title="Sumber data">
          <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
          <span className="track" />
          <span className="switch-label">Live API</span>
        </label>

        <button
          className="tb-icon"
          title={warn ? `${warn} akun belum masuk` : 'Semua akun sudah masuk'}
          onClick={() => toast(warn ? `🔔 ${warn} akun belum masuk (perlu login)` : '✓ Semua akun sudah masuk')}
        >
          🔔
          {warn > 0 ? <span className="tb-badge">{warn > 99 ? '99+' : warn}</span> : null}
        </button>

        <button
          className="tb-icon"
          title={cloudEmail ? 'Cloud: ' + cloudEmail : 'Belum login cloud — klik untuk atur'}
          onClick={() => onNav('settings')}
        >
          {cloudEmail ? '☁️' : '👤'}
        </button>

        <button
          className="btn"
          onClick={async () => {
            // Kalau login cloud: tarik data terbaru dari cloud (perubahan rekan ikut masuk).
            // Kalau belum login cloud: cukup muat ulang tampilan lokal.
            if (cloudEmail) await cloudPull(false)
            else toast('Disegarkan')
            loadProfiles()
          }}
        >
          ↻ Segarkan
        </button>
      </div>
    </header>
  )
}
