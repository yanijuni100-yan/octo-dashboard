import { useEffect, useState } from 'react'
import { useStore } from '../lib/store'
import { timeAgo } from '../lib/util'

/* ====================================================================
   PEMBACA VERIFIKASI — panel DI DALAM dashboard yang membaca email
   verifikasi (Cloudflare/OTP) lewat IMAP + App Password, TANPA membuka
   browser Gmail (jadi tidak kena blokir "browser may not be secure").
   Docs: docs/mail-reader.md
   ==================================================================== */

interface VMail {
  from: string
  subject: string
  date: number
  codes: string[]
  links: string[]
  snippet: string
}

export default function MailReader({
  uuid,
  email,
  onClose
}: {
  uuid: string
  email: string
  onClose: () => void
}): JSX.Element {
  const toast = useStore((s) => s.toast)
  const api = window.electronAPI?.mail

  const [hasCred, setHasCred] = useState<boolean | null>(null)
  const [pw, setPw] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [emails, setEmails] = useState<VMail[]>([])
  const [fetched, setFetched] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!api) {
        if (alive) setHasCred(false)
        return
      }
      const r = await api.hasCred(uuid)
      if (alive) setHasCred(!!r.has)
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uuid])

  const fetchNow = async (): Promise<void> => {
    if (!api) return
    setLoading(true)
    setError('')
    const r = await api.fetchVerification(uuid, email)
    setLoading(false)
    setFetched(true)
    if (r.ok) setEmails(r.emails || [])
    else setError(r.error || 'Gagal mengambil email.')
  }

  const saveCred = async (): Promise<void> => {
    if (!api || !pw.trim()) return
    setSaving(true)
    const r = await api.setCred(uuid, pw)
    setSaving(false)
    if (r.ok) {
      setHasCred(true)
      setPw('')
      toast('✅ App Password disimpan (terenkripsi)')
      fetchNow()
    } else {
      toast(r.error || 'Gagal menyimpan App Password')
    }
  }

  const clearCred = async (): Promise<void> => {
    if (!api) return
    await api.clearCred(uuid)
    setHasCred(false)
    setEmails([])
    setFetched(false)
    toast('App Password dihapus untuk akun ini')
  }

  const copy = (t: string): void => {
    navigator.clipboard.writeText(t).then(() => toast('Disalin: ' + t))
  }
  const openLink = (u: string): void => {
    window.electronAPI?.openExternal(u)
    toast('Membuka link di browser…')
  }
  const openAppPwPage = (): void => {
    window.electronAPI?.openInChrome('https://myaccount.google.com/apppasswords', uuid, email)
    toast('Membuka halaman App Password di Chrome akun ini…')
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.55)',
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#16172e',
          border: '1px solid var(--line)',
          borderRadius: 14,
          width: 'min(680px, 96vw)',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '14px 16px',
            borderBottom: '1px solid var(--line)'
          }}
        >
          <strong style={{ fontSize: 15 }}>📧 Pembaca Verifikasi</strong>
          <span className="muted" style={{ fontSize: 12 }}>
            {email}
          </span>
          <button className="btn small" style={{ marginLeft: 'auto' }} onClick={onClose}>
            ✕ Tutup
          </button>
        </div>

        <div style={{ padding: 16, overflow: 'auto' }}>
          {hasCred === null ? (
            <div className="muted">Memeriksa…</div>
          ) : !hasCred ? (
            <div>
              <p style={{ marginBottom: 10, lineHeight: 1.5 }}>
                Untuk membaca email verifikasi tanpa membuka Gmail, masukkan <b>App Password</b> akun
                ini (sandi khusus 16-huruf dari Google — <b>tidak minta OTP lagi</b> saat dipakai).
              </p>
              <ol style={{ margin: '0 0 12px 18px', lineHeight: 1.6, fontSize: 13 }}>
                <li>Klik tombol di bawah → buka halaman "Sandi Aplikasi" (di Chrome akun ini).</li>
                <li>Buat sandi baru (pilih "Mail") → salin 16 huruf yang muncul.</li>
                <li>Tempel di kolom bawah → Simpan.</li>
              </ol>
              <button className="btn small" style={{ marginBottom: 12 }} onClick={openAppPwPage}>
                🔑 Buka halaman App Password
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  className="if-search"
                  style={{ flex: 1 }}
                  placeholder="Tempel App Password (16 huruf)…"
                  value={pw}
                  spellCheck={false}
                  onChange={(e) => setPw(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveCred()}
                />
                <button className="btn small primary" disabled={saving || !pw.trim()} onClick={saveCred}>
                  {saving ? 'Menyimpan…' : 'Simpan'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                <button className="btn small primary" disabled={loading} onClick={fetchNow}>
                  {loading ? 'Mengambil…' : '🔄 Ambil email verifikasi'}
                </button>
                <button className="btn small" onClick={clearCred} title="Hapus App Password akun ini">
                  Hapus sandi
                </button>
              </div>

              {error ? (
                <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 10 }}>⚠ {error}</div>
              ) : null}

              {!fetched && !loading ? (
                <div className="muted" style={{ fontSize: 13 }}>
                  Klik "Ambil email verifikasi" untuk menarik 20 email terbaru.
                </div>
              ) : null}

              {fetched && !loading && emails.length === 0 && !error ? (
                <div className="muted" style={{ fontSize: 13 }}>Tidak ada email ditemukan.</div>
              ) : null}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {emails.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      border: '1px solid var(--line)',
                      borderRadius: 10,
                      padding: 12,
                      background: 'rgba(255,255,255,.03)'
                    }}
                  >
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                      <b style={{ fontSize: 13 }}>{m.subject}</b>
                      <span className="muted" style={{ fontSize: 11, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                        {m.date ? timeAgo(m.date) : ''}
                      </span>
                    </div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                      {m.from}
                    </div>
                    {m.snippet ? (
                      <div style={{ fontSize: 12, marginTop: 6, color: 'var(--muted)', lineHeight: 1.4 }}>
                        {m.snippet}…
                      </div>
                    ) : null}
                    {m.codes.length ? (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
                        <span className="muted" style={{ fontSize: 11 }}>Kode:</span>
                        {m.codes.map((c) => (
                          <button
                            key={c}
                            className="btn small"
                            style={{ fontFamily: 'monospace', fontWeight: 700 }}
                            onClick={() => copy(c)}
                            title="Klik untuk salin"
                          >
                            {c} 📋
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {m.links.length ? (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        {m.links.map((l) => (
                          <button key={l} className="btn small" onClick={() => openLink(l)} title={l}>
                            🔗 Buka link verifikasi
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
