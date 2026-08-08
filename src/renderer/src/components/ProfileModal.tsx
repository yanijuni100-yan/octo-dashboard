import { useState } from 'react'
import { useStore } from '../lib/store'

export default function ProfileModal({
  editingUuid,
  onClose
}: {
  editingUuid: string | null
  onClose: () => void
}): JSX.Element {
  const profiles = useStore((s) => s.profiles)
  const cfg = useStore((s) => s.cfg)
  const upsertProfile = useStore((s) => s.upsertProfile)
  const toast = useStore((s) => s.toast)
  const setNotice = useStore((s) => s.setNotice)
  const loadProfiles = useStore((s) => s.loadProfiles)

  const p = editingUuid ? profiles.find((x) => x.uuid === editingUuid) : null

  const [title, setTitle] = useState(p?.title || '')
  const [os, setOs] = useState(p?.os || 'Windows')
  const [tags, setTags] = useState(p?.tags.join(', ') || '')
  const [group, setGroup] = useState(p?.group || '')
  const [brand, setBrand] = useState(p?.brand || '')
  const [email, setEmail] = useState(p?.gmail?.email || '')
  const [pass, setPass] = useState(p?.gmail?.password || '')
  const [url, setUrl] = useState(p?.url || '')
  const [gsc, setGsc] = useState(p?.gscProperty || '')
  const [proxyType, setProxyType] = useState(p?.proxy?.type || '')
  const [proxyHost, setProxyHost] = useState(p?.proxy?.host || '')
  const [proxyPort, setProxyPort] = useState(p?.proxy?.port || '')

  const save = (): void => {
    const t = title.trim()
    if (!t) {
      toast('Nama profil wajib diisi')
      return
    }
    const e = email.trim()
    upsertProfile(
      {
        title: t,
        os,
        tags: tags
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        proxy: proxyType ? { type: proxyType, host: proxyHost.trim(), port: proxyPort.trim() } : null,
        gmail: e ? { email: e, password: pass.trim() } : null,
        url: url.trim(),
        gscProperty: gsc.trim(),
        group: group.trim(),
        brand: brand.trim()
      },
      editingUuid
    )
    toast('Profil disimpan')
    if (cfg.live)
      setNotice(
        'ℹ Profil disimpan ke data dummy. Pembuatan profil di akun Octo asli perlu dilakukan lewat aplikasi Octo Browser.'
      )
    loadProfiles()
    onClose()
  }

  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-head">
          <h3>{editingUuid ? 'Edit Profil' : 'Profil Baru'}</h3>
          <button className="x" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="field">
          <label>Nama profil</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label>Sistem Operasi</label>
          <select className="input" value={os} onChange={(e) => setOs(e.target.value)}>
            <option>Windows</option>
            <option>macOS</option>
            <option>Linux</option>
            <option>Android</option>
          </select>
        </div>
        <div className="field">
          <label>Tag (pisahkan dengan koma)</label>
          <input className="input" placeholder="ecommerce, akun-1" value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>
        <div className="field">
          <label>Group (opsional)</label>
          <input className="input" placeholder="contoh: Klien Utama, Internal" value={group} onChange={(e) => setGroup(e.target.value)} />
        </div>
        <div className="field">
          <label>Brand (opsional)</label>
          <input className="input" placeholder="contoh: Toko A, MerekX" value={brand} onChange={(e) => setBrand(e.target.value)} />
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Email Gmail (opsional)</label>
            <input className="input" placeholder="nama@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label>Kata sandi (opsional)</label>
            <input className="input" placeholder="sandi akun" value={pass} onChange={(e) => setPass(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Situs web — dibuka saat tombol ▶ diklik (opsional)</label>
          <input className="input" placeholder="contoh: facebook.com — kosongkan untuk otomatis" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div className="field">
          <label>Property GSC (opsional)</label>
          <input className="input" placeholder="sc-domain:contoh.com  atau  https://www.contoh.com/" value={gsc} onChange={(e) => setGsc(e.target.value)} />
        </div>
        <div className="grid-3">
          <div className="field">
            <label>Tipe proxy</label>
            <select className="input" value={proxyType} onChange={(e) => setProxyType(e.target.value)}>
              <option value="">Tanpa proxy</option>
              <option>HTTP</option>
              <option>SOCKS5</option>
            </select>
          </div>
          <div className="field">
            <label>Host</label>
            <input className="input" value={proxyHost} onChange={(e) => setProxyHost(e.target.value)} />
          </div>
          <div className="field">
            <label>Port</label>
            <input className="input" value={proxyPort} onChange={(e) => setProxyPort(e.target.value)} />
          </div>
        </div>
        <div className="row-btns">
          <button className="btn primary" onClick={save}>
            Simpan
          </button>
          <button className="btn" onClick={onClose}>
            Batal
          </button>
        </div>
      </div>
    </div>
  )
}
