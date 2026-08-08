import type { Gmail, Profile } from './types'

/* Parse JSON dengan aman — data rusak tidak boleh mematikan aplikasi */
export function safeParse<T>(raw: string | null | undefined, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function timeAgo(ts: number): string {
  const d = Date.now() - ts
  const h = Math.floor(d / 3_600_000)
  if (h < 1) return 'baru saja'
  if (h < 24) return h + ' jam lalu'
  return Math.floor(h / 24) + ' hari lalu'
}

export function fmtDateShort(ts: number): string {
  try {
    const dt = new Date(ts)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
    const dd = String(dt.getDate()).padStart(2, '0')
    const mo = months[dt.getMonth()]
    const yy = String(dt.getFullYear()).slice(2)
    const hh = String(dt.getHours()).padStart(2, '0')
    const mm = String(dt.getMinutes()).padStart(2, '0')
    return `${dd} ${mo} '${yy}, ${hh}:${mm}`
  } catch {
    return ''
  }
}

/* Warna konsisten dari sebuah string (hue 0-359) */
export function hueOf(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h)
  return Math.abs(h) % 360
}

export function initialOf(s: string): string {
  return (s.match(/[a-zA-Z]/) || ['?'])[0].toUpperCase()
}

/* Tentukan situs yang dibuka saat tombol Login diklik.
   Akun Gmail SELALU mendarat di Search Console — tidak pernah ke inbox. */
export function siteFor(p: Profile): string {
  if (p.gmail) {
    // Buka LANGSUNG ke Search Console (tanpa AccountChooser — endpoint itu memicu
    // error "cookie settings" di laptop lain). Cookie tetap disinkron (restoreSession),
    // jadi kalau Google menerima cookie → langsung masuk; kalau tidak → login bersih.
    let gsc = 'https://search.google.com/search-console'
    if (p.gscProperty) gsc += '?resource_id=' + encodeURIComponent(p.gscProperty)
    return gsc
  }
  if (p.url) return /^https?:\/\//i.test(p.url) ? p.url : 'https://' + p.url
  const t = (p.title || '').toLowerCase()
  const map: Record<string, string> = {
    facebook: 'https://facebook.com',
    tiktok: 'https://tiktok.com',
    instagram: 'https://instagram.com',
    youtube: 'https://youtube.com',
    twitter: 'https://twitter.com',
    amazon: 'https://amazon.com',
    shopee: 'https://shopee.co.id',
    tokopedia: 'https://tokopedia.com',
    google: 'https://google.com'
  }
  for (const k in map) if (t.includes(k)) return map[k]
  return 'https://www.google.com/'
}

/* URL AccountChooser untuk berpindah layanan (Gmail/GSC/Disavow) pada akun tertentu */
export function accountChooserUrl(email: string, targetUrl: string): string {
  return (
    'https://accounts.google.com/AccountChooser?Email=' +
    encodeURIComponent(email) +
    '&continue=' +
    encodeURIComponent(targetUrl)
  )
}

/* Apakah URL menandakan akun sudah berhasil login ke layanan Google */
export function isLoggedInUrl(url: string): boolean {
  if (!url) return false
  const isSignIn = /accounts\.google\.com\/(signin|v3\/signin|ServiceLogin|AccountChooser)/i.test(url)
  // Halaman ERROR/interstitial Google (BUKAN login berhasil). Kalau ini dianggap "sudah login",
  // aplikasi akan menyimpan cookie yang RUSAK → dipulihkan lagi nanti → error berulang →
  // pengguna terpaksa Reset login terus. Kecualikan supaya cookie rusak tak pernah tersimpan.
  const isError = /accounts\.google\.com\/(CookieMismatch|CheckCookie|speedbump)/i.test(url)
  return /^https?:\/\/[^/]*\.google\.com\//i.test(url) && !isSignIn && !isError
}

/* Apakah URL ini halaman PENOLAKAN Google — layar "Couldn't sign you in / This browser or
   app may not be secure"? Muncul kalau Google menganggap jendela di dalam aplikasi bukan
   browser resmi. Dipakai untuk memunculkan panduan Bahasa Indonesia + tombol Chrome asli,
   supaya pemakai tidak mentok menatap pesan berbahasa Inggris. */
export function isGoogleBlockedUrl(url: string): boolean {
  if (!url) return false
  return (
    /accounts\.google\.com\/(v3\/)?signin\/rejected/i.test(url) ||
    /accounts\.google\.com\/signin\/oauth\/deniedsigninrejected/i.test(url) ||
    /disallowed_useragent/i.test(url)
  )
}

/* Parse daftar Gmail dari textarea — pemisah fleksibel: ":" "/" "|" "," spasi/tab */
export function parseGmailList(text: string): Gmail[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/([^\s:/|,]+@[^\s:/|,]+)[\s:/|,]+(.*)/)
      if (m) return { email: m[1], password: m[2].trim() }
      const only = line.match(/[^\s:/|,]+@[^\s:/|,]+/)
      return { email: only ? only[0] : line, password: '' }
    })
    .filter((a) => a.email.includes('@'))
}

export function csvCell(v: unknown): string {
  const s = String(v == null ? '' : v)
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 100)
}

export const todayStamp = (): string => new Date().toISOString().slice(0, 10)

/* Perkiraan waktu pembuatan profil (ms). Pakai createdAt; jika tidak ada, coba
   baca dari timestamp di uuid (gm-/demo-<base36>); jika tak masuk akal, pakai lastActive. */
export function createdMs(p: Profile): number {
  if (p.createdAt) return p.createdAt
  const m = /^(?:gm|demo)-([0-9a-z]+)/i.exec(p.uuid || '')
  if (m) {
    const ts = parseInt(m[1], 36)
    if (ts > 1.4e12 && ts < 2.0e12) return ts // ms timestamp wajar (2014–2033)
  }
  return p.lastActive || Date.now()
}

/* Umur akun dalam hari */
export function ageDays(p: Profile): number {
  return Math.max(0, Math.floor((Date.now() - createdMs(p)) / 86_400_000))
}
