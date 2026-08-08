import { useState } from 'react'
import { useStore } from '../lib/store'
import { parseGmailList } from '../lib/util'

export default function GmailModal({ onClose }: { onClose: () => void }): JSX.Element {
  const addGmailBulk = useStore((s) => s.addGmailBulk)
  const cfg = useStore((s) => s.cfg)
  const toast = useStore((s) => s.toast)
  const setNotice = useStore((s) => s.setNotice)
  const loadProfiles = useStore((s) => s.loadProfiles)

  const [list, setList] = useState('')
  const [os, setOs] = useState('Windows')
  const [extraTags, setExtraTags] = useState('')

  const parsed = parseGmailList(list)
  const preview = parsed.length
    ? `${parsed.length} akun valid akan dibuatkan profil.`
    : 'Belum ada akun valid (harus mengandung "@").'

  const save = (): void => {
    if (!parsed.length) {
      toast('Tidak ada akun Gmail yang valid')
      return
    }
    const extra = extraTags
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const n = addGmailBulk(parsed, os, extra)
    toast(n + ' profil Gmail dibuat')
    if (cfg.live)
      setNotice('ℹ Profil Gmail disimpan ke data dummy. Sinkronisasi ke akun Octo asli lewat aplikasi Octo Browser.')
    loadProfiles()
    onClose()
  }

  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-head">
          <h3>Bulk Add Gmail</h3>
          <button className="x" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="muted">
          Tempel akun Gmail, <strong>satu akun per baris</strong>. Format: <code>email@gmail.com:password</code> —
          pemisah boleh <code>:</code> <code>/</code> atau spasi. Password opsional.
        </p>
        <div className="field">
          <label>Daftar akun Gmail</label>
          <textarea
            className="input"
            rows={7}
            placeholder={'akun1@gmail.com:pass123\nakun2@gmail.com:pass456\nakun3@gmail.com'}
            value={list}
            onChange={(e) => setList(e.target.value)}
          />
        </div>
        <div className="grid-2">
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
            <label>Tag tambahan (opsional)</label>
            <input className="input" placeholder="warmup, batch-1" value={extraTags} onChange={(e) => setExtraTags(e.target.value)} />
          </div>
        </div>
        <p className="muted">{preview}</p>
        <div className="row-btns">
          <button className="btn primary" onClick={save}>
            Buat profil
          </button>
          <button className="btn" onClick={onClose}>
            Batal
          </button>
        </div>
      </div>
    </div>
  )
}
