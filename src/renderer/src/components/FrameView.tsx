import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import WebviewPane, { type WebviewHandle } from './WebviewPane'
import MailReader from './MailReader'
import { accountChooserUrl, hueOf, initialOf, isGoogleBlockedUrl, isLoggedInUrl, siteFor } from '../lib/util'
import type { Profile } from '../lib/types'

function buildFilterOptions(gmails: Profile[]): {
  groups: [string, number][]
  brands: [string, number][]
  tags: [string, number][]
} {
  const g: Record<string, number> = {}
  const b: Record<string, number> = {}
  const t: Record<string, number> = {}
  gmails.forEach((p) => {
    if (p.group) g[p.group] = (g[p.group] || 0) + 1
    if (p.brand) b[p.brand] = (b[p.brand] || 0) + 1
    p.tags.forEach((tag) => {
      if (tag !== 'gmail') t[tag] = (t[tag] || 0) + 1
    })
  })
  const sort = (o: Record<string, number>): [string, number][] => Object.entries(o).sort((x, y) => x[0].localeCompare(y[0]))
  return { groups: sort(g), brands: sort(b), tags: sort(t) }
}

export default function FrameView({
  uuid,
  onClose,
  onSwitch
}: {
  uuid: string
  onClose: () => void
  onSwitch: (uuid: string) => void
}): JSX.Element {
  const profiles = useStore((s) => s.profiles)
  const selected = useStore((s) => s.selected)
  const toggleSelected = useStore((s) => s.toggleSelected)
  const markVerified = useStore((s) => s.markVerified)
  const restoreSession = useStore((s) => s.restoreSession)
  const saveSession = useStore((s) => s.saveSession)
  const resetSession = useStore((s) => s.resetSession)
  const toast = useStore((s) => s.toast)

  const p = profiles.find((x) => x.uuid === uuid)
  const initialUrl = p ? siteFor(p) : 'about:blank'

  const [nav, setNav] = useState('about:blank')
  const [urlValue, setUrlValue] = useState(initialUrl)
  const [zoom, setZoom] = useState(1)
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [booting, setBooting] = useState(true)
  const [showMail, setShowMail] = useState(false)
  // Panel bantuan login. helpAuto = muncul sendiri karena Google menolak
  // (layar "browser may not be secure"); false = dibuka sendiri lewat tombol.
  const [helpOpen, setHelpOpen] = useState(false)
  const [helpAuto, setHelpAuto] = useState(false)
  const savedRef = useRef(false)
  const paneRef = useRef<WebviewHandle>(null)

  // Pulihkan cookie sesi dari cloud dulu, baru buka situsnya.
  // Batas waktu 8 detik: kalau restoreSession menggantung (jaringan buruk), webview tetap
  // dimunculkan supaya layar tidak mentok selamanya di "Memuat halaman…".
  useEffect(() => {
    let alive = true
    setHelpOpen(false) // pindah akun = mulai bersih, panel bantuan disembunyikan
    ;(async () => {
      const timeout = new Promise((r) => setTimeout(r, 8000))
      await Promise.race([restoreSession(uuid), timeout])
      if (alive) {
        setNav(initialUrl)
        setBooting(false)
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uuid])

  const gmails = useMemo(() => profiles.filter((x) => x.gmail), [profiles])
  const { groups, brands, tags } = useMemo(() => buildFilterOptions(gmails), [gmails])

  if (!p) return <div className="empty">Akun tidak ditemukan.</div>

  const host = nav.replace(/^https?:\/\//, '').split('/')[0]

  // Buka alamat tertentu di Google Chrome ASLI, memakai folder profil khusus akun ini
  // (login sekali → Chrome selalu ingat). Dipakai tombol header + panel penolakan Google.
  // withDebug = Chrome dibuka supaya sesi loginnya nanti bisa DIPINDAHKAN ke dashboard.
  const bukaDiChrome = async (target: string, withDebug = false): Promise<void> => {
    const openChrome = window.electronAPI?.openInChrome
    if (!openChrome) {
      toast('Fitur ini hanya tersedia di aplikasi (bukan mode web).')
      return
    }
    toast('🌐 Membuka di Google Chrome asli…')
    const res = await openChrome(target, p.uuid, p.title, withDebug)
    if (!res.ok) {
      toast(res.error || 'Gagal membuka Chrome. Pastikan Google Chrome terpasang di komputer ini.')
    }
  }

  // Langkah 1 (login mudah): buka Chrome asli dengan EMAIL sudah terisi, dan SALIN password
  // ke clipboard supaya tinggal Ctrl+V. Google tidak mengizinkan password lewat URL / diisi
  // otomatis (itu memicu blokir + melanggar aturan), jadi ini cara aman yang tetap cepat.
  const loginDiChromeAsli = (): void => {
    const em = p.gmail?.email || ''
    const pwd = p.gmail?.password || ''
    const url = em ? accountChooserUrl(em, initialUrl) : initialUrl
    if (pwd) {
      navigator.clipboard
        .writeText(pwd)
        .then(() => toast('📋 Password disalin — di Chrome: klik Next lalu tekan Ctrl+V di kolom sandi.'))
        .catch(() => toast('🌐 Membuka Chrome… (password tidak bisa disalin otomatis)'))
    }
    bukaDiChrome(url, false)
  }

  // Pindahkan sesi login dari Chrome asli akun ini ke jendela akun di dashboard.
  // Sesudah berhasil sekali, akun ini langsung masuk tanpa halaman login lagi.
  const ambilSesiDariChrome = async (): Promise<void> => {
    const pull = window.electronAPI?.pullChromeSession
    if (!pull) {
      toast('Fitur ini hanya tersedia di aplikasi (bukan mode web).')
      return
    }
    toast('⏳ Mengambil sesi login dari Chrome…')
    const res = await pull(p.uuid, 'persist:profile-' + p.uuid)
    if (!res.ok) {
      toast(res.error || 'Gagal mengambil sesi dari Chrome.')
      return
    }
    if (!res.set) {
      toast('Chrome menjawab, tapi belum ada sesi login yang bisa diambil — login dulu di Chrome.')
      return
    }
    // PENTING: simpan segera ke cloud. Saat akun dibuka lagi, aplikasi memulihkan
    // cookie dari cloud — kalau cloud masih berisi sesi LAMA, sesi baru dari Chrome
    // ini akan tertimpa dan login hilang lagi.
    await saveSession(p.uuid).catch(() => false)
    savedRef.current = false // biarkan tersimpan lagi begitu terdeteksi sudah masuk
    toast(`✅ ${res.set} kunci sesi diambil dari Chrome — memuat ulang halaman…`)
    cobaLagiDiSini()
  }

  // Muat ulang BERSIH dari halaman awal akun (pasang ulang jendela = memuat dari nol).
  const cobaLagiDiSini = (): void => {
    setHelpOpen(false)
    setBooting(true)
    setNav(initialUrl)
    setUrlValue(initialUrl)
    setTimeout(() => setBooting(false), 50)
  }

  // 🔧 PERBAIKI COOKIE (sekali klik): bersihkan cookie rusak akun ini, lalu ambil sesi BERSIH
  // dari profil Chrome akun (kalau Chrome-nya sudah pernah login). Kalau Chrome belum login,
  // arahkan ke Sesi Chrome. Ini menggabungkan "Reset login" + "Ambil sesi" jadi satu tombol.
  const perbaikiCookie = async (): Promise<void> => {
    const fix = window.electronAPI?.cookies?.fixMismatch
    const pull = window.electronAPI?.pullChromeSession
    if (!fix) {
      toast('Fitur ini hanya tersedia di aplikasi (bukan mode web).')
      return
    }
    toast('🔧 Memperbaiki cookie (TANPA mengeluarkan akun)…')
    // 1) Buang cookie konsistensi/pelacak yang bikin mismatch (cookie LOGIN tidak disentuh).
    const r1 = await fix('persist:profile-' + p.uuid)
    // 2) Kalau akun ini sudah login di Chrome, ambil sesi SEHAT-nya → menimpa yang basi.
    //    Ini juga TIDAK mengeluarkan akun (hanya menambah/menyegarkan cookie login yang valid).
    let pulled = 0
    if (pull) {
      const r2 = await pull(p.uuid, 'persist:profile-' + p.uuid)
      if (r2.ok && r2.set) {
        pulled = r2.set
        await saveSession(p.uuid).catch(() => false)
        savedRef.current = false
      }
    }
    if (pulled) {
      toast(`✅ Cookie diperbaiki + sesi disegarkan dari Chrome (${pulled} kunci) — memuat ulang.`)
    } else {
      toast(
        `🔧 ${r1.removed || 0} cookie tak-penting dibuang — memuat ulang. Kalau MASIH error, berarti sesi login habis: login sekali via 🔑 Sesi Chrome (akun tidak dikeluarkan paksa).`
      )
    }
    cobaLagiDiSini()
  }

  const onUrl = (u: string): void => {
    if (u) setUrlValue(u)
    // Google menolak login ("browser not secure") ATAU error cookie (CookieMismatch/CheckCookie)
    // → munculkan panduan pemulihan otomatis supaya pemakai tidak mentok di halaman error.
    if (u && (isGoogleBlockedUrl(u) || /accounts\.google\.com\/(CookieMismatch|CheckCookie)/i.test(u))) {
      setHelpAuto(true)
      setHelpOpen(true)
    } else if (u && helpAuto) {
      // Sudah pindah ke halaman normal → panduan otomatis tidak perlu lagi
      setHelpAuto(false)
      setHelpOpen(false)
    }
    if (u && isLoggedInUrl(u)) {
      if (!p.verified) markVerified(p.uuid)
      // Sudah login → simpan cookie sesi ke cloud (sekali per buka)
      if (!savedRef.current) {
        savedRef.current = true
        saveSession(p.uuid).then((ok) => ok && toast('💾 Sesi disimpan ke cloud'))
      }
    }
  }

  const navigate = (u: string): void => {
    const raw = u.trim()
    if (!raw) return
    let url: string
    if (/^https?:\/\//i.test(raw)) {
      // Sudah alamat lengkap (mis. https://...)
      url = raw
    } else if (/^localhost(:\d+)?(\/|$)/i.test(raw)) {
      // Alamat lokal (mis. localhost:3000)
      url = 'http://' + raw
    } else if (!/\s/.test(raw) && /\.[a-z]{2,}($|[/:?#])/i.test(raw)) {
      // Tak ada spasi + ada titik-domain (mis. "youtube.com", "detik.com/berita") → buka situs
      url = 'https://' + raw
    } else {
      // Selain itu → cari di Google (mirip kotak alamat Chrome: "Search Google or type a URL")
      url = 'https://www.google.com/search?q=' + encodeURIComponent(raw)
    }
    setNav(url)
    setUrlValue(url)
  }

  const goService = (target: string): void => {
    // Langsung ke layanan (tanpa AccountChooser). Cookie akun ada di partition-nya sendiri.
    setNav(target)
    setUrlValue(target)
  }

  let list = gmails
  if (filter.startsWith('tag:')) list = gmails.filter((x) => x.tags.includes(filter.slice(4)))
  else if (filter.startsWith('brand:')) list = gmails.filter((x) => x.brand === filter.slice(6))
  else if (filter.startsWith('group:')) list = gmails.filter((x) => x.group === filter.slice(6))
  const query = q.toLowerCase().trim()
  if (query)
    list = list.filter(
      (x) =>
        x.gmail!.email.toLowerCase().includes(query) ||
        x.tags.some((tg) => tg.toLowerCase().includes(query)) ||
        (x.brand && x.brand.toLowerCase().includes(query)) ||
        (x.group && x.group.toLowerCase().includes(query))
    )

  return (
    <section className="iframe-view">
      <aside className="if-side">
        <div className="if-side-head">Akun</div>
        <input
          className="if-search"
          type="search"
          placeholder="Cari email / brand / group…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="if-filters">
          <select className="if-filter-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">★ SEMUA · {gmails.length}</option>
            {groups.length ? (
              <optgroup label="GROUP">
                {groups.map(([k, n]) => (
                  <option key={'g' + k} value={'group:' + k}>
                    {k} · {n}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {brands.length ? (
              <optgroup label="BRAND">
                {brands.map(([k, n]) => (
                  <option key={'b' + k} value={'brand:' + k}>
                    {k} · {n}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {tags.length ? (
              <optgroup label="GMAIL TAG">
                {tags.map(([k, n]) => (
                  <option key={'t' + k} value={'tag:' + k}>
                    {k} · {n}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </div>
        <div className="if-list">
          {list.length ? (
            list.map((x) => {
              const email = x.gmail!.email
              const name = email.split('@')[0] || email
              return (
                <div
                  className={'if-item' + (x.uuid === uuid ? ' active' : '') + (x.uuid === uuid ? ' in-use' : '')}
                  key={x.uuid}
                  onClick={() => onSwitch(x.uuid)}
                >
                  <label className="if-check-wrap" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="if-check"
                      checked={selected.has(x.uuid)}
                      onChange={(e) => toggleSelected(x.uuid, e.target.checked)}
                    />
                  </label>
                  <span className="if-avatar" style={{ background: `hsl(${hueOf(email)},62%,52%)` }}>
                    {initialOf(email)}
                  </span>
                  <div className="if-info">
                    <div className="if-item-name">{name}</div>
                    <div className="if-item-email">{email}</div>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="muted" style={{ padding: 14, textAlign: 'center', fontSize: 11 }}>
              Tidak ada akun
            </div>
          )}
        </div>
      </aside>

      <div className="if-main">
        <div className="iframe-head">
          <span>
            <strong>{p.title}</strong> &nbsp;·&nbsp;{' '}
            <span className="muted">{booting ? 'memulihkan sesi…' : host}</span>
          </span>
          <div className="nav-ctrl">
            <button className="nav-btn" title="Kembali (halaman sebelumnya)" onClick={() => paneRef.current?.goBack()}>
              ◀
            </button>
            <button className="nav-btn" title="Maju (halaman berikutnya)" onClick={() => paneRef.current?.goForward()}>
              ▶
            </button>
            <button className="nav-btn" title="Muat ulang halaman" onClick={() => paneRef.current?.reload()}>
              ⟳
            </button>
          </div>
          <input
            type="text"
            className="if-url"
            spellCheck={false}
            placeholder="Cari di Google atau ketik alamat situs…"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && navigate(urlValue)}
          />
          <div className="zoom-ctrl">
            <button className="zoom-btn" onClick={() => setZoom((z) => Math.max(0.3, Math.round((z - 0.1) * 10) / 10))}>
              −
            </button>
            <span className="zoom-label">{Math.round(zoom * 100)}%</span>
            <button className="zoom-btn" onClick={() => setZoom((z) => Math.min(2, Math.round((z + 0.1) * 10) / 10))}>
              +
            </button>
          </div>
          <button className="btn small gmail-btn" onClick={() => goService('https://mail.google.com/mail/u/0/')}>
            ✉ Gmail
          </button>
          <button
            className="btn small"
            title="Baca email verifikasi (Cloudflare/OTP) langsung di dashboard, tanpa buka Gmail — pakai App Password"
            onClick={() => setShowMail(true)}
          >
            📧 Kode
          </button>
          <button
            className="btn small chrome-btn"
            title="Buka akun ini di Google Chrome ASLI (Google percaya Chrome asli → login berhasil, tidak diblokir 'browser not secure'). Folder profil tetap per akun: login sekali, sesudah itu diingat."
            onClick={() =>
              // Bawa halaman yang sedang dibuka ke Chrome asli; kalau bukan alamat http, default ke Gmail.
              bukaDiChrome(
                /^https?:\/\//i.test(urlValue)
                  ? urlValue
                  : /^https?:\/\//i.test(nav)
                    ? nav
                    : 'https://mail.google.com/mail/u/0/'
              )
            }
          >
            🌐 Buka di Chrome
          </button>
          <button
            className="btn small"
            title="Login sekali di Chrome asli, lalu pindahkan sesinya ke sini — sesudah itu akun ini langsung masuk tanpa halaman login"
            onClick={() => {
              setHelpAuto(false)
              setHelpOpen(true)
            }}
          >
            🔑 Sesi Chrome
          </button>
          <button
            className="btn small"
            style={{ background: '#e8590c', color: '#fff', borderColor: 'transparent' }}
            title="Perbaiki Gmail sekali klik (tanpa keluar akun): bersihkan cookie yang bikin error + ambil sesi sehat dari Chrome (kalau Chrome akun ini sudah login)"
            onClick={perbaikiCookie}
          >
            🔧 Perbaiki Gmail
          </button>
          <button
            className="btn small gsc-btn"
            onClick={() =>
              goService(
                'https://search.google.com/search-console' +
                  (p.gscProperty ? '?resource_id=' + encodeURIComponent(p.gscProperty) : '')
              )
            }
          >
            Go to GSC
          </button>
          <button
            className="btn small dis-btn"
            onClick={() => goService('https://search.google.com/search-console/disavow-links')}
          >
            Go to Disavow
          </button>
          <button
            className="btn small"
            title="Simpan sesi login akun ini ke cloud"
            onClick={async () => {
              const ok = await saveSession(p.uuid)
              toast(ok ? '💾 Sesi disimpan ke cloud' : 'Sesi belum bisa disimpan — login dulu & pastikan terhubung cloud')
            }}
          >
            💾 Simpan sesi
          </button>
          <button
            className="btn small"
            title="Hapus cookie akun ini (lokal + cloud) lalu login bersih — untuk memperbaiki error cookie"
            onClick={async () => {
              await resetSession(p.uuid)
              savedRef.current = false
              setUrlValue('')
              // Muat ulang BERSIH: sembunyikan webview sebentar (booting) lalu pasang lagi dengan
              // alamat tujuan. Mount ulang = memuat dari nol → cegah halaman nyangkut di about:blank.
              setBooting(true)
              setNav(initialUrl)
              setTimeout(() => setBooting(false), 50)
              toast('🔄 Sesi direset — silakan login ulang')
            }}
          >
            🔄 Reset login
          </button>
          <button className="btn small" onClick={onClose}>
            ✕ Tutup
          </button>
        </div>
        <div className="iframe-wrap">
          {booting ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--muted)',
                fontSize: 13
              }}
            >
              Memuat halaman…
            </div>
          ) : (
            <WebviewPane ref={paneRef} partition={'persist:profile-' + p.uuid} src={nav} zoom={zoom} onUrl={onUrl} />
          )}
          {helpOpen && !booting ? (
            <div className="blocked-overlay">
              <div className="blocked-card">
                <div className="blocked-title">
                  {helpAuto
                    ? '🔒 Google menolak login dari dalam aplikasi'
                    : '🔑 Pakai sesi login dari Chrome asli'}
                </div>
                {helpAuto ? (
                  <p className="blocked-text">
                    Akun ini bermasalah di dashboard — entah Google menolak (<em>“browser may not be
                    secure”</em>) atau <em>error cookie</em>. Penyebabnya sama: <strong>sesi login-nya perlu
                    disegarkan</strong> dari browser resmi. Ikuti 2 langkah di bawah.
                  </p>
                ) : null}
                <p className="blocked-text">
                  Jalan yang pasti: <strong>login sekali di Chrome asli</strong>, lalu sesinya
                  dipindahkan ke sini. Sesudah itu akun ini <strong>langsung masuk</strong> saat diklik —
                  tidak lewat halaman login lagi.
                </p>
                <p className="blocked-text">
                  <strong>Langkah 1</strong> — tekan tombol biru: Chrome asli terbuka, <strong>email sudah
                  terisi</strong> + <strong>password otomatis disalin</strong>. Di Chrome: klik Next → tekan{' '}
                  <strong>Ctrl+V</strong> di kolom sandi → masuk sampai Gmail/Search Console terbuka.
                  <br />
                  <strong>Langkah 2</strong> — setelah berhasil masuk, <strong>TUTUP jendela Chrome itu</strong>{' '}
                  (penting), lalu kembali ke sini dan tekan tombol hijau.
                </p>
                <div className="blocked-actions">
                  <button
                    className="btn"
                    style={{ background: '#e8590c', color: '#fff', borderColor: 'transparent' }}
                    title="Sekali klik (tanpa keluar akun): bersihkan cookie yang bikin error + ambil sesi dari Chrome (kalau Chrome akun ini sudah login)"
                    onClick={perbaikiCookie}
                  >
                    🔧 Perbaiki Gmail — klik ini DULU
                  </button>
                  <button className="btn primary" onClick={loginDiChromeAsli}>
                    🌐 Langkah 1 — Login di Chrome asli
                  </button>
                  <button className="btn ambil-sesi" onClick={ambilSesiDariChrome}>
                    ⬇ Langkah 2 — Ambil sesinya ke sini
                  </button>
                  <button className="btn" onClick={cobaLagiDiSini}>
                    🔄 Coba lagi di sini
                  </button>
                  <button className="btn" onClick={() => setHelpOpen(false)}>
                    ✕ Tutup
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <div className="iframe-note">Klik akun lain di panel kiri untuk berpindah tanpa menutup jendela.</div>
      </div>
      {showMail ? (
        <MailReader uuid={p.uuid} email={p.gmail?.email || p.title} onClose={() => setShowMail(false)} />
      ) : null}
    </section>
  )
}
