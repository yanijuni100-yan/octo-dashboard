import { useRef, useState } from 'react'
import type * as React from 'react'
import { useStore } from '../lib/store'
import { applyTheme, currentTheme } from '../lib/theme'
import { isElectron } from '../lib/storage'
import { testConnection } from '../lib/api'
import { csvCell, downloadFile, todayStamp } from '../lib/util'
import type { Profile } from '../lib/types'

const THEMES: { key: string; label: string; a: string; b: string }[] = [
  { key: 'ungu', label: 'Ungu', a: '#9b8cff', b: '#5b8def' },
  { key: 'cyber', label: 'Cyber Biru', a: '#2d9bff', b: '#00d4ff' },
  { key: 'emerald', label: 'Emerald', a: '#10c98a', b: '#36e0b0' },
  { key: 'sunset', label: 'Sunset', a: '#ff7a59', b: '#ffb347' },
  { key: 'pink', label: 'Pink Neon', a: '#ff5ca8', b: '#b15cff' },
  { key: 'emas', label: 'Emas Mewah', a: '#e0b454', b: '#ffd479' },
  { key: 'merah', label: 'Merah', a: '#ff5a6e', b: '#ff8a5c' },
  { key: 'aqua', label: 'Aqua', a: '#22b8d6', b: '#36e0b0' },
  { key: 'rainbow', label: 'Rainbow', a: '#b15cff', b: '#36e0b0' }
]

export default function Settings(): JSX.Element {
  const cfg = useStore((s) => s.cfg)
  const store = useStore((s) => s.store)
  const profiles = useStore((s) => s.profiles)
  const dataPath = useStore((s) => s.dataPath)
  const cloudStatus = useStore((s) => s.cloudStatus)
  const toast = useStore((s) => s.toast)
  const saveAdsPowerCfg = useStore((s) => s.saveAdsPowerCfg)
  const saveCloudCfg = useStore((s) => s.saveCloudCfg)
  const cloudSignIn = useStore((s) => s.cloudSignIn)
  const cloudSignUp = useStore((s) => s.cloudSignUp)
  const cloudSignOut = useStore((s) => s.cloudSignOut)
  const cloudPull = useStore((s) => s.cloudPull)
  const cloudPush = useStore((s) => s.cloudPush)
  const cleanupSessions = useStore((s) => s.cleanupSessions)
  const resetData = useStore((s) => s.resetData)
  const importBackup = useStore((s) => s.importBackup)
  const loadProfiles = useStore((s) => s.loadProfiles)

  const [theme, setTheme] = useState(currentTheme())
  const [localUrl, setLocalUrl] = useState(cfg.localUrl)
  const [token, setToken] = useState(cfg.token)
  const [connResult, setConnResult] = useState('')

  const [supaUrl, setSupaUrl] = useState(cfg.supaUrl)
  const [supaKey, setSupaKey] = useState(cfg.supaKey)
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')

  const [exportResult, setExportResult] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const pickTheme = (key: string): void => {
    applyTheme(key)
    setTheme(key)
    toast('Tema: ' + (THEMES.find((t) => t.key === key)?.label || key))
  }

  const onTestConn = async (): Promise<void> => {
    saveAdsPowerCfg(localUrl, token)
    setConnResult('Menguji…')
    try {
      const ok = await testConnection({ ...cfg, localUrl: localUrl.trim() || cfg.localUrl })
      setConnResult(ok ? '✓ Local API merespons di ' + localUrl : '✗ Local API tidak merespons.')
    } catch (e) {
      setConnResult(
        '✗ Gagal menghubungi Local API: ' +
          (e as Error).message +
          ' — pastikan aplikasi Octo Browser sedang berjalan.'
      )
    }
  }

  const exportAdsPower = (): void => {
    const gmails = (profiles.length ? profiles : store.profiles).filter((p) => p.gmail?.email)
    if (!gmails.length) {
      setExportResult('Tidak ada akun Gmail yang bisa diekspor.')
      return
    }
    const cols = ['name', 'group_name', 'domain_name', 'open_urls', 'username', 'password', 'remark']
    const rows = [cols.join(',')]
    gmails.forEach((p) => {
      rows.push(
        [
          csvCell(p.gmail!.email),
          csvCell(p.group || 'gmail'),
          csvCell('google.com'),
          csvCell('https://mail.google.com/'),
          csvCell(p.gmail!.email),
          csvCell(p.gmail!.password || ''),
          csvCell(p.brand || '')
        ].join(',')
      )
    })
    downloadFile(`adspower-import-${todayStamp()}.csv`, '﻿' + rows.join('\r\n'), 'text/csv;charset=utf-8')
    setExportResult(
      `✓ Berhasil ekspor ${gmails.length} akun ke CSV — siap diimpor di AdsPower (Browser Profile → Import).`
    )
  }

  const exportBackup = (): void => {
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      profiles: store.profiles,
      proxies: store.proxies || []
    }
    downloadFile(`octo-backup-${todayStamp()}.json`, JSON.stringify(backup, null, 2), 'application/json')
    setExportResult(
      `✓ Backup ${backup.profiles.length} profil tersimpan. Simpan file ini, lalu impor di laptop baru.`
    )
  }

  /**
   * Ekspor daftar merek + Gmail (+ alamat GSC) untuk dipindahkan SEKALI ke dashboard BIGSEO.
   *
   * Sesudah dipindahkan dan tiap merek disambungkan ke Google di sana, BIGSEO membaca daftar
   * domain langsung dari Google sendiri — aplikasi ini tak perlu dibuka lagi untuk urusan GSC.
   *
   * 🔒 SENGAJA TIDAK memuat password Gmail: BIGSEO tidak membutuhkannya (izin ke Google diberikan
   *    lewat tombol "Sambungkan", bukan lewat password), jadi kalau berkasnya tercecer, tak ada
   *    kredensial yang ikut bocor. Bandingkan dengan "Ekspor backup penuh" di bawah yang memang
   *    berisi password karena tujuannya memindahkan seluruh isi aplikasi.
   */
  const exportBigseo = (): void => {
    const sumber = profiles.length ? profiles : store.profiles
    const dipakai = sumber.filter((p) => (p.brand || '').trim() && p.gmail?.email)
    if (!dipakai.length) {
      setExportResult(
        '✗ Belum ada akun yang bisa dikirim. Syaratnya tiap akun sudah diisi kolom Brand dan Gmail.'
      )
      return
    }

    // 1 merek cukup diwakili 1 Gmail (Gmail penghubung ke Google). Kalau satu merek dipakai
    // banyak akun, yang dipilih adalah akun yang SUDAH punya alamat GSC — dari situlah domain
    // utama merek bisa dikenali otomatis di BIGSEO.
    const perMerek = new Map<string, { brand: string; gmail: string; gsc_property: string }>()
    dipakai.forEach((p) => {
      const kunci = (p.brand as string).trim().toLowerCase()
      const punyaGsc = Boolean((p.gscProperty || '').trim())
      const lama = perMerek.get(kunci)
      if (lama && !(punyaGsc && !lama.gsc_property)) return
      perMerek.set(kunci, {
        brand: (p.brand as string).trim(),
        gmail: p.gmail!.email,
        gsc_property: (p.gscProperty || '').trim()
      })
    })

    const akun = [...perMerek.values()]
    const isi = {
      versi: 1,
      sumber: 'octo-dashboard',
      dibuat_pada: new Date().toISOString(),
      catatan:
        'Tidak memuat password. Unggah di BIGSEO → Redirect Domain → Koneksi GSC → Impor dari Octo.',
      akun
    }
    downloadFile(`bigseo-akun-${todayStamp()}.json`, JSON.stringify(isi, null, 2), 'application/json')

    const tanpaGsc = akun.filter((a) => !a.gsc_property).length
    setExportResult(
      `✓ ${akun.length} merek siap dikirim (dari ${dipakai.length} akun).` +
        (tanpaGsc ? ` ${tanpaGsc} merek belum ada alamat GSC-nya — domain utamanya diisi menyusul di BIGSEO.` : '') +
        ' Berikutnya: buka BIGSEO → Redirect Domain → Koneksi GSC → Impor dari Octo.'
    )
  }

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const data = JSON.parse(await file.text()) as { profiles?: Profile[]; proxies?: Profile['proxy'][] }
      if (!data || !Array.isArray(data.profiles)) throw new Error('Format file tidak dikenali')
      const merge = confirm(
        `File berisi ${data.profiles.length} profil.\n\n` +
          `OK = Gabung dengan data sekarang (tanpa duplikasi email)\n` +
          `Cancel = Ganti total semua data sekarang dengan file ini`
      )
      const msg = importBackup(
        data.profiles,
        (data.proxies as never) || undefined,
        merge
      )
      setExportResult(msg)
      loadProfiles()
      toast('Impor backup berhasil')
    } catch (err) {
      setExportResult('✗ Gagal impor: ' + (err as Error).message)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <section className="view">
      {/* Tema */}
      <div className="card">
        <div className="card-head">
          <h3>Tema Tampilan</h3>
        </div>
        <p className="muted">Pilih warna tema dashboard. Pilihan tersimpan otomatis.</p>
        <div className="theme-grid">
          {THEMES.map((t) => (
            <button
              key={t.key}
              className={'theme-opt' + (theme === t.key ? ' active' : '')}
              style={{ ['--a' as string]: t.a, ['--b' as string]: t.b } as React.CSSProperties}
              onClick={() => pickTheme(t.key)}
            >
              <span className="theme-sw" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* AdsPower / Octo */}
      <div className="card">
        <div className="card-head">
          <h3>Koneksi AdsPower API</h3>
        </div>
        <p className="muted">
          Untuk mode <strong>Live API</strong>, aplikasi <strong>AdsPower</strong> harus berjalan di komputer ini.
          Default Local API AdsPower: <code>http://local.adspower.net:50325</code>
        </p>
        <div className="field">
          <label>Local API Base URL</label>
          <input
            type="text"
            className="input"
            placeholder="http://local.adspower.net:50325"
            value={localUrl}
            onChange={(e) => setLocalUrl(e.target.value)}
          />
        </div>
        <div className="field">
          <label>AdsPower API Key</label>
          <input
            type="password"
            className="input"
            placeholder="API Key dari pengaturan akun AdsPower"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </div>
        <div className="row-btns">
          <button
            className="btn primary"
            onClick={() => {
              saveAdsPowerCfg(localUrl, token)
              toast('Pengaturan disimpan')
            }}
          >
            Simpan
          </button>
          <button className="btn" onClick={onTestConn}>
            Tes koneksi
          </button>
        </div>
        <p className="muted">{connResult}</p>
      </div>

      {/* Supabase cloud */}
      <div className="card">
        <div className="card-head">
          <h3>☁️ Sinkron Cloud (Supabase)</h3>
        </div>
        <p className="muted">
          Simpan &amp; sinkronkan data ke <strong>Supabase</strong> agar sama di semua komputer. Login sekali, lalu
          data tersinkron otomatis. Agar beberapa komputer berbagi data sama, login dengan akun Supabase yang{' '}
          <strong>sama</strong>.
        </p>
        <div className="field">
          <label>Supabase Project URL</label>
          <input
            type="text"
            className="input"
            placeholder="https://xxxxxxxx.supabase.co"
            spellCheck={false}
            value={supaUrl}
            onChange={(e) => setSupaUrl(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Supabase anon key (public)</label>
          <input
            type="password"
            className="input"
            placeholder="eyJhbGciOiJI..."
            value={supaKey}
            onChange={(e) => setSupaKey(e.target.value)}
          />
        </div>
        <div className="row-btns">
          <button
            className="btn"
            onClick={async () => {
              await saveCloudCfg(supaUrl, supaKey)
              toast(supaUrl.trim() && supaKey.trim() ? 'Koneksi Supabase disimpan' : 'URL/key kosong — koneksi nonaktif')
            }}
          >
            Simpan koneksi
          </button>
        </div>
        <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '16px 0' }} />
        <div className="grid-2">
          <div className="field">
            <label>Email</label>
            <input type="email" className="input" placeholder="kamu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" className="input" placeholder="password akun Supabase" value={pass} onChange={(e) => setPass(e.target.value)} />
          </div>
        </div>
        <div className="row-btns" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button
            className="btn primary"
            onClick={async () => {
              try {
                await cloudSignIn(email.trim(), pass)
                setPass('')
                toast('✓ Login berhasil — data tersinkron')
              } catch (e) {
                toast('Login gagal: ' + (e as Error).message)
              }
            }}
          >
            🔓 Login
          </button>
          <button
            className="btn"
            onClick={async () => {
              try {
                await cloudSignUp(email.trim(), pass)
                toast('✓ Akun dibuat. Cek email bila diminta, lalu Login.')
              } catch (e) {
                toast('Daftar gagal: ' + (e as Error).message)
              }
            }}
          >
            + Daftar akun
          </button>
          <button
            className="btn"
            onClick={async () => {
              await cloudSignOut()
              toast('Sudah logout — kembali memakai data lokal')
            }}
          >
            Logout
          </button>
          <button className="btn" onClick={() => cloudPull(false)}>
            ⬇ Tarik dari cloud
          </button>
          <button
            className="btn"
            onClick={async () => {
              await cloudPush(true)
              toast('✓ Data dikirim ke cloud')
            }}
          >
            ⬆ Kirim ke cloud
          </button>
          <button
            className="btn"
            title="Hapus sesi/cookie milik profil yang sudah tidak ada (orphan) di cloud"
            onClick={() => cleanupSessions()}
          >
            🧹 Bersihkan sesi lama
          </button>
        </div>
        <p className="muted" style={{ marginTop: 12 }}>
          {cloudStatus}
        </p>
      </div>

      {/* Pindah ke BIGSEO */}
      <div className="card">
        <div className="card-head">
          <h3>🔗 Pindahkan Pengelolaan GSC ke BIGSEO</h3>
        </div>
        <p className="muted">
          Kirim daftar <strong>merek + Gmail</strong> ke dashboard BIGSEO. Cukup <strong>sekali</strong>: setelah tiap
          merek disambungkan ke Google di sana, BIGSEO membaca sendiri daftar domain dari Google Search Console —
          aplikasi ini <strong>tidak perlu dibuka lagi</strong> untuk urusan GSC dan redirect.
        </p>
        <p className="muted">
          🔒 File ini <strong>tidak berisi password</strong>. Isinya cuma nama merek, alamat Gmail, dan alamat GSC.
        </p>
        <div className="row-btns">
          <button className="btn primary" onClick={exportBigseo}>
            🔗 Ekspor ke BIGSEO (JSON)
          </button>
        </div>
        <p className="muted" style={{ marginTop: 10 }}>
          Langkah berikutnya di BIGSEO: <strong>Redirect Domain → Koneksi GSC → Impor dari Octo</strong>, lalu tekan{' '}
          <strong>Sambungkan</strong> pada tiap merek.
        </p>
      </div>

      {/* Ekspor & impor */}
      <div className="card">
        <div className="card-head">
          <h3>Ekspor &amp; Pindah Data</h3>
        </div>
        <p className="muted">
          Untuk pindah ke laptop baru atau ke AdsPower. <strong>Catatan:</strong> file ini berisi email &amp; password —
          simpan di tempat aman.
        </p>
        <div className="row-btns" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button className="btn primary" onClick={exportAdsPower}>
            📤 Ekspor untuk AdsPower (CSV)
          </button>
          <button className="btn" onClick={exportBackup}>
            📦 Ekspor backup penuh (JSON)
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            📥 Impor backup (JSON)
          </button>
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={onImportFile} />
        </div>
        <p className="muted" style={{ marginTop: 10 }}>
          {exportResult}
        </p>
      </div>

      {/* Data */}
      <div className="card">
        <div className="card-head">
          <h3>Data</h3>
        </div>
        {isElectron && dataPath ? (
          <p className="muted">
            💾 Data tersimpan permanen di:
            <br />
            <code style={{ wordBreak: 'break-all' }}>{dataPath}</code>
            <br />
            <span style={{ opacity: 0.8 }}>
              Backup harian otomatis ada di folder <code>data\backups</code>. Aman walau cache dibersihkan atau app
              di-install ulang.
            </span>
          </p>
        ) : (
          <p className="muted">Data tersimpan di browser Anda.</p>
        )}
        <button
          className="btn danger"
          onClick={() => {
            if (confirm('Reset semua data ke kosong?')) {
              resetData()
              toast('Data direset')
            }
          }}
        >
          Reset data
        </button>
      </div>
    </section>
  )
}
