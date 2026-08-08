import { app, BrowserWindow, ipcMain, session, Menu, clipboard, safeStorage, shell } from 'electron'
import { join, dirname } from 'node:path'
import fs from 'node:fs'
import http from 'node:http'
import { spawn } from 'node:child_process'
import WebSocket from 'ws'

/* ====================================================================
   PENYIMPANAN DATA DASHBOARD KE DISK (file lokal) — bukan localStorage.
   - Dev      : <folder proyek>/data/octo-data.json (pakai data lama yang ada).
   - Terpasang: <userData>/data/octo-data.json (lokasi aman, tahan reinstall).
   - Tulis ATOMIK (tmp → rename) supaya tidak korup kalau app mati di tengah.
   - octo-data.prev.json = salinan "terakhir baik" untuk rollback.
   - backups/octo-data-YYYY-MM-DD.json = snapshot harian (simpan 14 terakhir).
   ==================================================================== */
const MAX_BACKUPS = 14

function dataDir(): string {
  return app.isPackaged ? join(app.getPath('userData'), 'data') : join(process.cwd(), 'data')
}
function dataFile(): string {
  return join(dataDir(), 'octo-data.json')
}
function prevFile(): string {
  return join(dataDir(), 'octo-data.prev.json')
}
function backupDir(): string {
  return join(dataDir(), 'backups')
}

function ensureDirs(): void {
  fs.mkdirSync(dataDir(), { recursive: true })
  fs.mkdirSync(backupDir(), { recursive: true })
}

type ReadResult = {
  ok: boolean
  content?: string | null
  path: string
  error?: string
  recovered?: boolean
}

function readData(): ReadResult {
  const DATA_FILE = dataFile()
  try {
    if (!fs.existsSync(DATA_FILE)) return { ok: true, content: null, path: DATA_FILE }
    const content = fs.readFileSync(DATA_FILE, 'utf8')
    JSON.parse(content) // validasi: kalau korup, lempar → jatuh ke pemulihan
    return { ok: true, content, path: DATA_FILE }
  } catch (err) {
    // File utama tidak terbaca / korup → pulihkan dari salinan terakhir-baik
    try {
      const PREV_FILE = prevFile()
      if (fs.existsSync(PREV_FILE)) {
        const content = fs.readFileSync(PREV_FILE, 'utf8')
        JSON.parse(content)
        return { ok: true, content, path: PREV_FILE, recovered: true }
      }
    } catch {
      /* abaikan */
    }
    return { ok: false, error: String((err as Error)?.message || err), path: DATA_FILE }
  }
}

function dailySnapshot(content: string): void {
  try {
    const d = new Date()
    const stamp =
      d.getFullYear() +
      '-' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getDate()).padStart(2, '0')
    const snap = join(backupDir(), `octo-data-${stamp}.json`)
    if (!fs.existsSync(snap)) {
      fs.writeFileSync(snap, content, 'utf8')
      const files = fs
        .readdirSync(backupDir())
        .filter((f) => /^octo-data-\d{4}-\d{2}-\d{2}\.json$/.test(f))
        .sort()
      while (files.length > MAX_BACKUPS) {
        try {
          fs.unlinkSync(join(backupDir(), files.shift() as string))
        } catch {
          /* abaikan */
        }
      }
    }
  } catch {
    /* snapshot best-effort, jangan ganggu penyimpanan utama */
  }
}

type WriteResult = { ok: boolean; path: string; error?: string }

function writeData(content: string): WriteResult {
  const DATA_FILE = dataFile()
  try {
    ensureDirs()
    // Simpan salinan "terakhir baik" sebelum menimpa
    try {
      if (fs.existsSync(DATA_FILE)) fs.copyFileSync(DATA_FILE, prevFile())
    } catch {
      /* abaikan */
    }
    // Tulis atomik
    const tmp = DATA_FILE + '.tmp'
    fs.writeFileSync(tmp, content, 'utf8')
    fs.renameSync(tmp, DATA_FILE)
    dailySnapshot(content)
    return { ok: true, path: DATA_FILE }
  } catch (err) {
    return { ok: false, error: String((err as Error)?.message || err), path: DATA_FILE }
  }
}

ipcMain.on('octo-data-read', (e) => {
  e.returnValue = readData()
})
ipcMain.on('octo-data-write', (e, content: string) => {
  e.returnValue = writeData(content)
})
ipcMain.on('octo-data-path', (e) => {
  e.returnValue = dataFile()
})

/* ====================================================================
   SINKRON SESI (COOKIE) PER AKUN
   - Tiap akun pakai partition 'persist:profile-<uuid>'.
   - Export: ambil semua cookie partition → dikirim ke renderer → disimpan
     ke Supabase. Import: cookie dari Supabase → ditanam ke partition sebelum
     webview dibuka, supaya akun langsung login (bila Google menerima sesi).
   ==================================================================== */
ipcMain.handle('cookies-export', async (_e, partition: string) => {
  try {
    const ses = session.fromPartition(partition)
    const cookies = await ses.cookies.get({})
    return { ok: true, cookies }
  } catch (err) {
    return { ok: false, error: String((err as Error)?.message || err), cookies: [] }
  }
})

ipcMain.handle('cookies-clear', async (_e, partition: string) => {
  try {
    await session.fromPartition(partition).clearStorageData({ storages: ['cookies'] })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String((err as Error)?.message || err) }
  }
})

ipcMain.handle('cookies-import', async (_e, partition: string, cookies: Electron.Cookie[]) => {
  const ses = session.fromPartition(partition)
  let set = 0
  for (const c of cookies || []) {
    try {
      const host = c.domain?.startsWith('.') ? c.domain.slice(1) : c.domain
      const url = (c.secure ? 'https://' : 'http://') + host + (c.path || '/')
      await ses.cookies.set({
        url,
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        secure: c.secure,
        httpOnly: c.httpOnly,
        expirationDate: c.expirationDate,
        sameSite: c.sameSite
      })
      set++
    } catch {
      /* lewati cookie yang gagal diset */
    }
  }
  return { ok: true, set }
})

// PERBAIKI COOKIE TANPA KELUAR AKUN: hapus HANYA cookie "konsistensi/pelacak" Google yang
// sering memicu CookieMismatch (mis. SIDCC, NID). Cookie LOGIN inti (SID/HSID/SSID/APISID/
// SAPISID/__Secure-*PSID/…) TIDAK disentuh → akun TETAP login. Google akan menerbitkan ulang
// cookie yang dibuang secara otomatis di permintaan berikutnya, sehingga mismatch hilang.
const COOKIE_BUANG = new Set([
  'SIDCC',
  '__Secure-1PSIDCC',
  '__Secure-3PSIDCC',
  'OTZ',
  'AEC',
  '1P_JAR',
  'NID',
  'DV'
])
ipcMain.handle('cookies-fix-mismatch', async (_e, partition: string) => {
  try {
    const ses = session.fromPartition(partition)
    const all = await ses.cookies.get({})
    let removed = 0
    for (const c of all) {
      const dom = (c.domain || '').replace(/^\./, '')
      if (!/(^|\.)google\.com$/i.test(dom)) continue // hanya domain Google
      if (!COOKIE_BUANG.has(c.name)) continue // hanya yang tak penting
      const url = (c.secure ? 'https://' : 'http://') + dom + (c.path || '/')
      try {
        await ses.cookies.remove(url, c.name)
        removed++
      } catch {
        /* lewati yang gagal dihapus */
      }
    }
    return { ok: true, removed }
  } catch (err) {
    return { ok: false, removed: 0, error: String((err as Error)?.message || err) }
  }
})

/* ====================================================================
   BUKA DI GOOGLE CHROME ASLI — folder profil TETAP per akun
   - Kenapa: Google sering memblokir login Gmail di dalam webview app.
     Chrome asli dipercaya Google → login lancar, tidak diblokir.
   - Tiap akun pakai folder profil sendiri:
       <dataDir>/chrome-profiles/<uuid akun>
     Jadi: login SEKALI per akun, sesudah itu Chrome selalu ingat
     (klik = langsung masuk Gmail, tidak login lagi).
   - Folder ada di dalam data/ yang sudah di-ignore git → cookie login
     TIDAK ikut ter-commit (aman).
   ==================================================================== */
function chromeProfilesDir(): string {
  return join(dataDir(), 'chrome-profiles')
}

// Folder profil Chrome milik SATU akun. Nama folder dibersihkan dari karakter aneh
// supaya tidak bisa menunjuk ke lokasi lain di disk.
function profilChromeDir(profileKey: string): string {
  const safeKey = String(profileKey || 'default').replace(/[^a-zA-Z0-9_-]/g, '_')
  return join(chromeProfilesDir(), safeKey)
}

// Cari lokasi chrome.exe di Windows (beberapa lokasi pemasangan umum).
function findChromePath(): string | null {
  const candidates: string[] = []
  const pf = process.env['PROGRAMFILES']
  const pf86 = process.env['PROGRAMFILES(X86)']
  const local = process.env['LOCALAPPDATA']
  if (pf) candidates.push(join(pf, 'Google/Chrome/Application/chrome.exe'))
  if (pf86) candidates.push(join(pf86, 'Google/Chrome/Application/chrome.exe'))
  if (local) candidates.push(join(local, 'Google/Chrome/Application/chrome.exe'))
  candidates.push('C:/Program Files/Google/Chrome/Application/chrome.exe')
  candidates.push('C:/Program Files (x86)/Google/Chrome/Application/chrome.exe')
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c
    } catch {
      /* abaikan kandidat yang gagal dicek */
    }
  }
  return null
}

/* ====================================================================
   IDENTITAS BROWSER UNTUK JENDELA AKUN (webview)
   MASALAH yang diperbaiki: saat login Google muncul
   "Couldn't sign you in — This browser or app may not be secure".

   SEBAB (terbukti dari uji header yang benar-benar dikirim, 2026-08-03):
   1) Mesin browser bawaan aplikasi ini mengaku "Chrome 128" (rilis Agustus
      2024) — jauh lebih tua dari Chrome asli di komputer pemakai. Browser
      yang terlalu tua ditolak Google di halaman login.
   2) Aplikasi TIDAK mengirim "kartu identitas browser" (header sec-ch-ua,
      sec-ch-ua-mobile, sec-ch-ua-platform) yang SELALU dikirim Chrome asli
      di tiap permintaan. Mengaku Chrome tapi tanpa kartu identitas =
      ketahuan bukan Chrome asli.
   (Pembersihan lama hanya membuang tulisan "Electron" dari User-Agent —
   itu menutup poin lain, tapi tidak menutup dua poin di atas.)

   PERBAIKAN: samakan identitas (User-Agent + kartu identitas) dengan versi
   Chrome yang BENAR-BENAR terpasang di komputer ini, lalu pasang di level
   SESI supaya sudah aktif SEBELUM halaman pertama dimuat (tidak balapan
   dengan proses pemuatan halaman).

   CATATAN JUJUR: ini menaikkan peluang login berhasil, TAPI tidak menjamin
   selamanya — Google memang membatasi login di jendela dalam aplikasi.
   Jalan yang paling pasti tetap tombol "Buka di Chrome" (Chrome asli).
   ==================================================================== */

// Cari versi Chrome asli yang terpasang (nama folder di .../Application = nomor versi).
function detectChromeVersion(): string | null {
  const exe = findChromePath()
  if (!exe) return null
  try {
    const versions = fs
      .readdirSync(dirname(exe))
      .filter((n) => /^\d+\.\d+\.\d+\.\d+$/.test(n))
      .sort((a, b) => {
        const pa = a.split('.').map(Number)
        const pb = b.split('.').map(Number)
        for (let i = 0; i < 4; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i]
        return 0
      })
    return versions.length ? versions[versions.length - 1] : null
  } catch {
    return null
  }
}

const PLATFORM_UA =
  process.platform === 'darwin'
    ? 'Macintosh; Intel Mac OS X 10_15_7'
    : process.platform === 'linux'
      ? 'X11; Linux x86_64'
      : 'Windows NT 10.0; Win64; x64'
const CH_PLATFORM =
  process.platform === 'darwin' ? '"macOS"' : process.platform === 'linux' ? '"Linux"' : '"Windows"'

// Kalau Chrome tidak terpasang, pakai versi mesin browser bawaan aplikasi (jujur apa adanya).
const CHROME_VERSION = detectChromeVersion() || process.versions.chrome
const CHROME_MAJOR = CHROME_VERSION.split('.')[0]
const BROWSER_UA = `Mozilla/5.0 (${PLATFORM_UA}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_VERSION} Safari/537.36`
const BROWSER_CH_UA = `"Not;A=Brand";v="24", "Chromium";v="${CHROME_MAJOR}", "Google Chrome";v="${CHROME_MAJOR}"`

// Satu sesi cukup dipasangi sekali (onBeforeSendHeaders hanya boleh 1 pendengar per sesi).
const sesiSudahDisamakan = new WeakSet<Electron.Session>()

function samakanIdentitasBrowser(ses: Electron.Session): void {
  if (sesiSudahDisamakan.has(ses)) return
  sesiSudahDisamakan.add(ses)
  try {
    ses.setUserAgent(BROWSER_UA)
    ses.webRequest.onBeforeSendHeaders((details, callback) => {
      const headers = { ...details.requestHeaders }
      headers['User-Agent'] = BROWSER_UA
      headers['sec-ch-ua'] = BROWSER_CH_UA
      headers['sec-ch-ua-mobile'] = '?0'
      headers['sec-ch-ua-platform'] = CH_PLATFORM
      callback({ requestHeaders: headers })
    })
  } catch {
    /* kalau gagal, aplikasi tetap jalan — hanya peluang login yang mengecil */
  }
}

// Dipasang untuk SETIAP sesi begitu dibuat — termasuk sesi tiap akun
// ('persist:profile-<uuid>'), yang lahir saat cookie dipulihkan sebelum halaman dibuka.
app.on('session-created', (ses) => samakanIdentitasBrowser(ses))

type OpenChromeResult = { ok: boolean; error?: string }

ipcMain.handle(
  'open-in-chrome',
  async (
    _e,
    {
      url,
      profileKey,
      withDebug
    }: { url: string; profileKey: string; title?: string; withDebug?: boolean }
  ): Promise<OpenChromeResult> => {
    try {
      const chromePath = findChromePath()
      if (!chromePath) {
        return {
          ok: false,
          error: 'Google Chrome tidak ditemukan. Pastikan Chrome sudah terpasang di komputer ini.'
        }
      }
      const userDataDir = profilChromeDir(profileKey)
      fs.mkdirSync(userDataDir, { recursive: true })

      // URL tujuan (default Gmail kalau URL tidak valid / kosong).
      const target = url && /^https?:\/\//i.test(url) ? url : 'https://mail.google.com/mail/u/0/'
      const args = [
        `--user-data-dir=${userDataDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        // Ringankan start: matikan proses latar yang tak perlu supaya buka lebih ringan.
        // Ini flag performa yang AMAN — tidak menyentuh deteksi otomasi Google (jadi tak
        // memicu blokir). Catatan: TIDAK mempercepat internet — hanya mengurangi beban buka.
        '--disable-background-networking',
        '--disable-component-update',
        '--disable-default-apps',
        '--disable-sync',
        // withDebug = dibuka khusus untuk MEMINDAHKAN sesi login ke dashboard.
        // Port 0 = Chrome pilih sendiri nomor pintu yang bebas, lalu menuliskannya
        // ke berkas DevToolsActivePort di folder profil. Pintu ini HANYA bisa
        // dihubungi dari komputer ini sendiri (127.0.0.1), dan hanya dipakai saat
        // tombol "ambil sesi" ditekan. Peluncuran biasa TIDAK memakai pintu ini.
        ...(withDebug ? ['--remote-debugging-port=0'] : []),
        target
      ]
      const child = spawn(chromePath, args, { detached: true, stdio: 'ignore' })
      // Cegah app ikut error kalau Chrome gagal start (path sudah diverifikasi di atas).
      child.on('error', () => {
        /* diabaikan dengan sengaja */
      })
      child.unref()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String((err as Error)?.message || err) }
    }
  }
)

/* ====================================================================
   JEMBATAN SESI: PINDAHKAN LOGIN DARI GOOGLE CHROME ASLI KE DASHBOARD

   KENAPA ADA: Google membatasi halaman login supaya hanya bisa dibuka lewat
   browser resmi, jadi login DI DALAM aplikasi bisa ditolak. Jalan yang pasti
   diterima Google = login di Chrome asli. Setelah itu, "kunci sesi" (cookie)
   hasil login tersebut dipindahkan ke jendela akun di dashboard — sehingga
   sesudah sekali pindah, klik akun LANGSUNG masuk tanpa halaman login lagi.

   CARA AMBILNYA: lewat pintu kendali resmi milik Chrome sendiri (DevTools
   Protocol — pintu yang sama yang dipakai alat uji otomatis seperti Puppeteer).
   Jadi bukan membongkar berkas Chrome: kita SOPAN MEMINTA ke Chrome-nya.

   PENGAMAN:
   - Pintu kendali hanya dibuka saat pemakai menekan tombol "Login di Chrome"
     untuk pemindahan sesi — bukan tiap kali Chrome dibuka.
   - Nomor pintunya dipilih acak oleh Chrome + hanya bisa dihubungi dari
     komputer ini sendiri (127.0.0.1), tidak dari internet.
   - Cookie yang diambil hanya masuk ke sesi akun yang bersangkutan.
   ==================================================================== */

// Chrome menuliskan nomor pintu kendali di baris pertama berkas ini.
function bacaPortDevTools(userDataDir: string): number | null {
  try {
    const f = join(userDataDir, 'DevToolsActivePort')
    if (!fs.existsSync(f)) return null
    const port = parseInt(fs.readFileSync(f, 'utf8').split('\n')[0].trim(), 10)
    return Number.isFinite(port) && port > 0 ? port : null
  } catch {
    return null
  }
}

function ambilJson(port: number, path: string, timeoutMs = 4000): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path }, (res) => {
      let body = ''
      res.on('data', (d) => (body += d))
      res.on('end', () => {
        try {
          resolve(JSON.parse(body))
        } catch (e) {
          reject(e as Error)
        }
      })
    })
    req.on('error', reject)
    req.setTimeout(timeoutMs, () => req.destroy(new Error('Chrome tidak menjawab.')))
  })
}

type CdpCookie = {
  name: string
  value: string
  domain: string
  path: string
  expires: number
  httpOnly: boolean
  secure: boolean
  session: boolean
  sameSite?: string
}

const PESAN_CHROME_BELUM_SIAP =
  'Belum bisa membaca sesi. Pastikan Anda SUDAH login di Chrome (Langkah 1), lalu TUTUP jendela ' +
  'Chrome akun ini dulu (Chrome menolak dibuka dua kali untuk folder yang sama), baru tekan "Ambil sesi".'

// Baca cookie dari folder profil Chrome akun (yang sudah login di Langkah 1) dengan meluncurkan
// Chrome TERSEMBUNYI (headless) + pintu kendali. Karena profil sudah login, TIDAK ada halaman
// login → tidak kena blokir Google. Chrome ini hanya MEMBACA cookie lalu ditutup lagi.
// SYARAT: jendela Chrome biasa untuk profil ini HARUS sudah ditutup dulu.
async function ambilCookieDariChrome(userDataDir: string): Promise<CdpCookie[]> {
  const chromePath = findChromePath()
  if (!chromePath) throw new Error('Google Chrome tidak ditemukan di komputer ini.')

  // Buang berkas port lama supaya kita menunggu nomor pintu yang BARU dari peluncuran ini.
  try {
    fs.rmSync(join(userDataDir, 'DevToolsActivePort'), { force: true })
  } catch {
    /* abaikan */
  }

  const child = spawn(
    chromePath,
    [
      `--user-data-dir=${userDataDir}`,
      '--headless=new',
      '--remote-debugging-port=0',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      'about:blank'
    ],
    { detached: false, stdio: 'ignore' }
  )
  child.on('error', () => {
    /* ditangani lewat timeout tunggu-port di bawah */
  })
  const tutupChrome = (): void => {
    try {
      child.kill()
    } catch {
      /* abaikan */
    }
  }

  // Tunggu Chrome menuliskan nomor pintu kendali (maks ~10 detik).
  let port: number | null = null
  for (let i = 0; i < 50; i++) {
    port = bacaPortDevTools(userDataDir)
    if (port) break
    await new Promise((r) => setTimeout(r, 200))
  }
  if (!port) {
    tutupChrome()
    throw new Error(PESAN_CHROME_BELUM_SIAP)
  }

  let wsUrl: string
  try {
    const ver = (await ambilJson(port, '/json/version')) as { webSocketDebuggerUrl?: string }
    if (!ver.webSocketDebuggerUrl) throw new Error('Chrome tidak memberi alamat sambungan.')
    wsUrl = ver.webSocketDebuggerUrl
  } catch (e) {
    tutupChrome()
    throw e as Error
  }

  return await new Promise<CdpCookie[]>((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { perMessageDeflate: false, maxPayload: 64 * 1024 * 1024 })
    let selesai = false
    const tutup = (fn: () => void): void => {
      if (selesai) return
      selesai = true
      try {
        ws.close()
      } catch {
        /* abaikan */
      }
      tutupChrome() // tutup Chrome tersembunyi setelah cookie terbaca
      fn()
    }
    const timer = setTimeout(
      () => tutup(() => reject(new Error('Chrome tidak menjawab tepat waktu.'))),
      12000
    )
    const kirim = (id: number, method: string): void => {
      try {
        ws.send(JSON.stringify({ id, method }))
      } catch (e) {
        clearTimeout(timer)
        tutup(() => reject(e as Error))
      }
    }
    // Pintu kendali tingkat-browser mengenal 'Storage.getCookies'.
    // 'Network.getAllCookies' hanya ada di tingkat halaman → dipakai sebagai cadangan.
    ws.on('open', () => kirim(1, 'Storage.getCookies'))
    ws.on('error', (err: Error) => {
      clearTimeout(timer)
      tutup(() => reject(err))
    })
    ws.on('message', (data: unknown) => {
      try {
        const msg = JSON.parse(String(data)) as {
          id?: number
          result?: { cookies?: CdpCookie[] }
          error?: { message?: string }
        }
        if (msg.id !== 1 && msg.id !== 2) return
        if (msg.error) {
          if (msg.id === 1) {
            kirim(2, 'Network.getAllCookies') // coba pintu cadangan
            return
          }
          clearTimeout(timer)
          tutup(() => reject(new Error(msg.error?.message || 'Chrome menolak permintaan.')))
          return
        }
        clearTimeout(timer)
        tutup(() => resolve(msg.result?.cookies || []))
      } catch (e) {
        clearTimeout(timer)
        tutup(() => reject(e as Error))
      }
    })
  })
}

// Terjemahkan aturan "boleh dikirim lintas situs" dari istilah Chrome ke istilah Electron.
function konversiSameSite(v?: string): 'unspecified' | 'no_restriction' | 'lax' | 'strict' {
  switch (String(v || '').toLowerCase()) {
    case 'none':
      return 'no_restriction'
    case 'lax':
      return 'lax'
    case 'strict':
      return 'strict'
    default:
      return 'unspecified'
  }
}

async function tanamCookieKeSesi(partition: string, cookies: CdpCookie[]): Promise<number> {
  const ses = session.fromPartition(partition)
  let set = 0
  for (const c of cookies || []) {
    try {
      const domain = c.domain || ''
      const host = domain.startsWith('.') ? domain.slice(1) : domain
      if (!host || !c.name) continue
      const path = c.path || '/'
      const url = (c.secure ? 'https://' : 'http://') + host + path

      let sameSite = konversiSameSite(c.sameSite)
      // Aturan browser: "boleh lintas situs" hanya sah untuk cookie ber-HTTPS.
      if (sameSite === 'no_restriction' && !c.secure) sameSite = 'unspecified'

      const detail: Electron.CookiesSetDetails = {
        url,
        name: c.name,
        value: c.value,
        path,
        secure: !!c.secure,
        httpOnly: !!c.httpOnly,
        sameSite
      }
      // Cookie berawalan "__Host-" WAJIB tanpa domain (aturan browser) — kalau
      // domain diisi, cookie-nya ditolak dan sesi jadi tidak lengkap.
      if (!c.name.startsWith('__Host-')) detail.domain = domain
      // expires = -1 berarti cookie sesi (hilang saat browser ditutup) → jangan diberi tanggal.
      if (!c.session && typeof c.expires === 'number' && c.expires > 0) {
        detail.expirationDate = c.expires
      }
      await ses.cookies.set(detail)
      set++
    } catch {
      /* lewati cookie yang ditolak — sisanya tetap dipasang */
    }
  }
  return set
}

ipcMain.handle(
  'chrome-session-pull',
  async (_e, { profileKey, partition }: { profileKey: string; partition: string }) => {
    try {
      const cookies = await ambilCookieDariChrome(profilChromeDir(profileKey))
      const set = await tanamCookieKeSesi(partition, cookies)
      return { ok: true, total: cookies.length, set }
    } catch (err) {
      return { ok: false, total: 0, set: 0, error: String((err as Error)?.message || err) }
    }
  }
)

/* ====================================================================
   PEMBACA VERIFIKASI (IMAP) — baca email verifikasi TANPA browser
   - App Password (sandi khusus 16-huruf Google) disimpan TERENKRIPSI
     pakai safeStorage (enkripsi tingkat sistem / DPAPI di Windows).
   - Tarik email terbaru dari imap.gmail.com lalu ambil kode/link verifikasi.
   - Ini kanal resmi Google (bukan halaman login browser) → tidak kena blokir
     "browser may not be secure".
   ==================================================================== */
function mailCredsFile(): string {
  return join(dataDir(), 'mail-creds.json')
}
function readMailCreds(): Record<string, string> {
  try {
    const f = mailCredsFile()
    if (!fs.existsSync(f)) return {}
    return JSON.parse(fs.readFileSync(f, 'utf8')) as Record<string, string>
  } catch {
    return {}
  }
}
function writeMailCreds(obj: Record<string, string>): void {
  ensureDirs()
  fs.writeFileSync(mailCredsFile(), JSON.stringify(obj), 'utf8')
}
function getMailPassword(uuid: string): string | null {
  try {
    const enc = readMailCreds()[uuid]
    if (!enc) return null
    return safeStorage.decryptString(Buffer.from(enc, 'base64'))
  } catch {
    return null
  }
}

// Simpan App Password (terenkripsi). Spasi dibuang (Google menampilkannya berkelompok 4).
ipcMain.handle('mail-cred-set', (_e, uuid: string, appPassword: string) => {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      return { ok: false, error: 'Penyimpanan aman (enkripsi) tidak tersedia di sistem ini.' }
    }
    const creds = readMailCreds()
    creds[uuid] = safeStorage.encryptString(String(appPassword || '').replace(/\s+/g, '')).toString('base64')
    writeMailCreds(creds)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String((err as Error)?.message || err) }
  }
})

ipcMain.handle('mail-cred-has', (_e, uuid: string) => {
  return { ok: true, has: !!readMailCreds()[uuid] }
})

ipcMain.handle('mail-cred-clear', (_e, uuid: string) => {
  try {
    const creds = readMailCreds()
    delete creds[uuid]
    writeMailCreds(creds)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String((err as Error)?.message || err) }
  }
})

type VMail = { from: string; subject: string; date: number; codes: string[]; links: string[]; snippet: string }

ipcMain.handle('mail-fetch-verification', async (_e, { uuid, email }: { uuid: string; email: string }) => {
  const pass = getMailPassword(uuid)
  if (!pass) return { ok: false, error: 'App Password belum diisi untuk akun ini.' }
  let client: import('imapflow').ImapFlow | null = null
  try {
    const { ImapFlow } = await import('imapflow')
    const { simpleParser } = await import('mailparser')
    client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: { user: email, pass },
      logger: false
    })
    await client.connect()
    const out: VMail[] = []
    const lock = await client.getMailboxLock('INBOX')
    try {
      const total = (client.mailbox && (client.mailbox as { exists?: number }).exists) || 0
      if (total > 0) {
        const start = Math.max(1, total - 19) // 20 email terakhir
        for await (const msg of client.fetch(`${start}:*`, { source: true })) {
          try {
            const p = await simpleParser(msg.source as Buffer)
            const htmlText = p.html ? String(p.html).replace(/<[^>]+>/g, ' ') : ''
            const text = (p.text || '') + ' ' + htmlText
            const codes = Array.from(new Set(text.match(/\b\d{4,8}\b/g) || [])).slice(0, 5)
            const links = Array.from(
              new Set((text.match(/https?:\/\/[^\s"'<>)]+/gi) || []).filter((u) => /verif|confirm|activate|validate|aktif/i.test(u)))
            ).slice(0, 5)
            out.push({
              from: (p.from && p.from.text) || '',
              subject: p.subject || '(tanpa judul)',
              date: p.date ? p.date.getTime() : 0,
              codes,
              links,
              snippet: (p.text || '').replace(/\s+/g, ' ').trim().slice(0, 220)
            })
          } catch {
            /* lewati email yang gagal diurai */
          }
        }
      }
    } finally {
      lock.release()
    }
    out.sort((a, b) => b.date - a.date)
    return { ok: true, emails: out }
  } catch (err) {
    const msg = String((err as Error)?.message || err)
    return { ok: false, error: msg }
  } finally {
    try {
      if (client) await client.logout()
    } catch {
      /* abaikan */
    }
  }
})

// Buka tautan (mis. link verifikasi Cloudflare) di browser default sistem.
ipcMain.handle('open-external', (_e, url: string) => {
  try {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String((err as Error)?.message || err) }
  }
})

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Octo Dashboard',
    backgroundColor: '#0e0f17',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      webviewTag: true,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

let openCount = 0
ipcMain.on(
  'open-profile-window',
  (_event, { url, partition, title }: { url: string; partition?: string; title?: string }) => {
    const offset = (openCount % 8) * 36
    openCount++
    const win = new BrowserWindow({
      width: 1100,
      height: 760,
      x: 120 + offset,
      y: 90 + offset,
      title: title || 'Profil',
      backgroundColor: '#fff',
      autoHideMenuBar: true,
      webPreferences: {
        partition: partition || 'persist:default',
        contextIsolation: true,
        nodeIntegration: false
      }
    })
    win.loadURL(url)
  }
)

/* ====================================================================
   PERILAKU DI DALAM WEBVIEW TIAP AKUN
   (1) Tautan "buka tab baru" (target=_blank / window.open) — mis. tombol
       "Verify your email" di dalam email — dibuka di HALAMAN YANG SAMA
       (dalam aplikasi), bukan jendela terpisah. Login akun otomatis ikut
       karena halamannya sama. Bisa kembali pakai tombol ◀.
   (2) Klik-kanan memunculkan menu: buka/salin tautan, salin/tempel teks,
       kembali/maju/muat ulang, buka Gmail.
   ==================================================================== */
app.on('web-contents-created', (_e, contents) => {
  if (contents.getType() !== 'webview') return

  // (0) Samakan identitas browser dengan Chrome asli di komputer ini — lihat blok
  //     "IDENTITAS BROWSER" di atas. Pemasangan utama ada di event 'session-created';
  //     baris di sini = sabuk pengaman kedua kalau sesinya sempat lahir lebih dulu.
  samakanIdentitasBrowser(contents.session)
  try {
    contents.setUserAgent(BROWSER_UA)
  } catch {
    /* abaikan */
  }

  // (1) Tautan buka-tab-baru → muat di webview yang sama
  contents.setWindowOpenHandler(({ url }) => {
    if (url && /^https?:\/\//i.test(url)) {
      try {
        contents.loadURL(url)
      } catch {
        /* abaikan bila gagal memuat */
      }
    }
    return { action: 'deny' }
  })

  // (2) Menu klik-kanan di dalam webview
  contents.on('context-menu', (_ev, params) => {
    const items: Electron.MenuItemConstructorOptions[] = []
    if (params.linkURL) {
      const link = params.linkURL
      items.push({ label: 'Buka tautan di sini', click: () => contents.loadURL(link).catch(() => {}) })
      items.push({ label: 'Salin alamat tautan', click: () => clipboard.writeText(link) })
      items.push({ type: 'separator' })
    }
    if (params.isEditable) {
      items.push({ label: 'Potong', click: () => contents.cut() })
      items.push({ label: 'Salin', click: () => contents.copy() })
      items.push({ label: 'Tempel', click: () => contents.paste() })
      items.push({ type: 'separator' })
    } else if (params.selectionText) {
      items.push({ label: 'Salin', click: () => contents.copy() })
      items.push({ type: 'separator' })
    }
    items.push(
      { label: 'Kembali', click: () => contents.goBack() },
      { label: 'Maju', click: () => contents.goForward() },
      { label: 'Muat ulang', click: () => contents.reload() },
      { type: 'separator' },
      { label: 'Buka Gmail', click: () => contents.loadURL('https://mail.google.com/mail/u/0/').catch(() => {}) }
    )
    Menu.buildFromTemplate(items).popup()
  })
})

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
