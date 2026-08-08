import { useState } from 'react'
import { useStore } from '../lib/store'
import { useUI } from '../lib/ui'
import type { Profile } from '../lib/types'

export default function Automation(): JSX.Element {
  const profiles = useStore((s) => s.profiles)
  const requestOpen = useUI((s) => s.requestOpen)

  const gmail = profiles.filter((p) => p.gmail)
  const belum = gmail.filter((p) => !p.verified)
  const masuk = gmail.length - belum.length
  const pct = gmail.length ? Math.round((masuk / gmail.length) * 100) : 0
  const groups = [...new Set(gmail.map((p) => p.group).filter(Boolean))].sort() as string[]

  const [count, setCount] = useState(6)
  const [group, setGroup] = useState('')

  const inGroup = (list: Profile[]): Profile[] => (group ? list.filter((p) => p.group === group) : list)

  const openList = (list: Profile[]): void => {
    const uuids = list.slice(0, count).map((p) => p.uuid)
    if (!uuids.length) return
    requestOpen({ mode: 'grid', uuids })
  }

  const belumCount = Math.min(count, inGroup(belum).length)
  const topCount = Math.min(count, inGroup(gmail).length)

  return (
    <section className="view">
      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <h3>Buka &amp; Login Massal</h3>
          </div>
          <p className="muted">
            Buka beberapa akun berdampingan untuk login borongan. Pola: <strong>buka → login → tutup → ulangi</strong>{' '}
            untuk batch berikutnya.
          </p>

          <div className="field">
            <label>Buka berapa sekaligus</label>
            <input
              type="number"
              className="input"
              min={1}
              max={9}
              value={count}
              onChange={(e) => setCount(Math.min(9, Math.max(1, parseInt(e.target.value) || 1)))}
            />
          </div>
          <div className="field">
            <label>Filter grup (opsional)</label>
            <select className="input" value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="">Semua grup</option>
              {groups.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </div>

          <div className="row-btns" style={{ flexWrap: 'wrap', gap: 8 }}>
            <button className="btn primary" onClick={() => openList(inGroup(belum))} disabled={!belumCount}>
              ⚠ Buka {belumCount} akun BELUM masuk
            </button>
            <button className="btn" onClick={() => openList(inGroup(gmail))} disabled={!topCount}>
              🌐 Buka {topCount} akun teratas
            </button>
          </div>
          <p className="muted" style={{ marginTop: 10 }}>
            Tip: buka maks ~6–9 sekaligus biar tidak berat & tidak mencurigakan bagi Google.
          </p>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Progres Login</h3>
          </div>
          <div className="auto-stat">
            <span>Total akun Gmail</span>
            <b>{gmail.length}</b>
          </div>
          <div className="auto-stat">
            <span>✅ Sudah masuk</span>
            <b>{masuk}</b>
          </div>
          <div className="auto-stat">
            <span>⚠ Belum masuk</span>
            <b>{belum.length}</b>
          </div>
          <div className="stat-target-row" style={{ marginTop: 14 }}>
            <span>progres</span>
            <span className="stat-target-val">{pct}%</span>
          </div>
          <div className="stat-target-bar">
            <div
              className="stat-target-fill"
              style={{ width: pct + '%', background: 'linear-gradient(90deg,#1fb87a,#3ddc97)' }}
            />
          </div>
          {belum.length === 0 ? (
            <p className="muted" style={{ marginTop: 12 }}>
              🎉 Semua akun sudah masuk!
            </p>
          ) : (
            <p className="muted" style={{ marginTop: 12 }}>
              Sisa {belum.length} akun belum login. Klik “Buka {belumCount} akun BELUM masuk” untuk mulai batch.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
