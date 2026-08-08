import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import WebviewPane, { type WebviewHandle } from './WebviewPane'
import { isLoggedInUrl, siteFor } from '../lib/util'
import type { Profile } from '../lib/types'

interface Cell {
  uuid: string
  src: string
  url: string
  zoom: number
  ready: boolean
  ddOpen: boolean
  ddQuery: string
  ddPos?: { top: number; left: number }
}

function colsFor(n: number): number {
  return n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4
}
function zoomFor(cols: number): number {
  return cols >= 4 ? 0.45 : cols === 3 ? 0.55 : cols === 2 ? 0.72 : 1
}

export default function GridView({ uuids, onClose }: { uuids: string[]; onClose: () => void }): JSX.Element {
  const profiles = useStore((s) => s.profiles)
  const markVerified = useStore((s) => s.markVerified)
  const restoreSession = useStore((s) => s.restoreSession)
  const saveSession = useStore((s) => s.saveSession)
  const gmails = useMemo(() => profiles.filter((p) => p.gmail), [profiles])
  const savedRef = useRef<Set<string>>(new Set())
  // Ref kontrol navigasi (◀ ▶ ⟳) per kotak grid, dikunci pakai indeks kotak.
  const paneRefs = useRef<Map<number, WebviewHandle>>(new Map())

  const initial = useMemo<Cell[]>(() => {
    const cols = colsFor(uuids.length)
    const z = zoomFor(cols)
    return uuids
      .map((u) => profiles.find((p) => p.uuid === u))
      .filter((p): p is Profile => !!p && !!p.gmail)
      .map((p) => ({ uuid: p.uuid, src: siteFor(p), url: siteFor(p), zoom: z, ready: false, ddOpen: false, ddQuery: '' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [cells, setCells] = useState<Cell[]>(initial)

  // Pulihkan cookie tiap akun dulu, baru MUNCULKAN webview-nya (src sudah = GSC sejak awal,
  // jadi webview memuat GSC langsung dari nol — tidak lewat about:blank yang bisa nyangkut).
  // Tiap kotak dipulihkan paralel + batas waktu 8 detik supaya kotak berjaringan lambat tidak
  // menahan kotak lain, dan tidak ada kotak yang mentok selamanya di placeholder.
  useEffect(() => {
    let alive = true
    initial.forEach((c) => {
      const timeout = new Promise((r) => setTimeout(r, 8000))
      Promise.race([restoreSession(c.uuid), timeout]).then(() => {
        if (alive) setCells((cs) => cs.map((x) => (x.uuid === c.uuid ? { ...x, ready: true } : x)))
      })
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cols = colsFor(cells.length)
  const update = (i: number, patch: Partial<Cell>): void =>
    setCells((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)))

  const emailOf = (uuid: string): string => profiles.find((p) => p.uuid === uuid)?.gmail?.email || uuid

  const goService = (i: number, target: string): void => {
    // Langsung ke layanan (tanpa AccountChooser).
    update(i, { src: target, url: target })
  }

  // Kotak alamat ala Chrome: ketik alamat → buka situs; ketik kata → cari di Google.
  const goUrl = (i: number, raw0: string): void => {
    const raw = raw0.trim()
    if (!raw) return
    let url: string
    if (/^https?:\/\//i.test(raw)) url = raw
    else if (/^localhost(:\d+)?(\/|$)/i.test(raw)) url = 'http://' + raw
    else if (!/\s/.test(raw) && /\.[a-z]{2,}($|[/:?#])/i.test(raw)) url = 'https://' + raw
    else url = 'https://www.google.com/search?q=' + encodeURIComponent(raw)
    update(i, { src: url, url })
  }

  return (
    <section className="iframe-view grid">
      <div className="if-main">
        <div className="iframe-head">
          <span>
            <strong>{cells.length} akun</strong> &nbsp;·&nbsp; <span className="muted">tampil berdampingan</span>
          </span>
          <button className="btn small" style={{ marginLeft: 'auto' }} onClick={onClose}>
            ✕ Tutup
          </button>
        </div>
        <div className="iframe-wrap">
          <div className="grid-wrap" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {cells.map((c, i) => {
              const p = profiles.find((x) => x.uuid === c.uuid)
              const query = c.ddQuery.toLowerCase().trim()
              const items = gmails.filter(
                (x) =>
                  !query ||
                  x.gmail!.email.toLowerCase().includes(query) ||
                  x.tags.some((t) => t.toLowerCase().includes(query))
              )
              return (
                <div className="grid-cell" key={i} data-zoom={c.zoom}>
                  <div className="grid-cell-bar">
                    <span className="gc-email">{emailOf(c.uuid)}</span>
                    <button className="gc-mini" title="Kembali (halaman sebelumnya)" onClick={() => paneRefs.current.get(i)?.goBack()}>
                      ◀
                    </button>
                    <button className="gc-mini" title="Maju (halaman berikutnya)" onClick={() => paneRefs.current.get(i)?.goForward()}>
                      ▶
                    </button>
                    <button className="gc-mini" title="Muat ulang halaman" onClick={() => paneRefs.current.get(i)?.reload()}>
                      ⟳
                    </button>
                    <input
                      type="text"
                      className="gc-url"
                      spellCheck={false}
                      placeholder="Cari di Google atau ketik alamat…"
                      value={c.url}
                      onChange={(e) => update(i, { url: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && goUrl(i, c.url)}
                    />
                    <div className="gc-zoom">
                      <button
                        className="gc-mini"
                        onClick={() => update(i, { zoom: Math.max(0.3, Math.round((c.zoom - 0.1) * 10) / 10) })}
                      >
                        −
                      </button>
                      <span className="gc-zlabel">{Math.round(c.zoom * 100)}%</span>
                      <button
                        className="gc-mini"
                        onClick={() => update(i, { zoom: Math.min(2, Math.round((c.zoom + 0.1) * 10) / 10) })}
                      >
                        +
                      </button>
                    </div>
                    <button className="gc-mini" title="Gmail" onClick={() => goService(i, 'https://mail.google.com/mail/u/0/')}>
                      ✉
                    </button>
                    <button
                      className="gc-mini gc-chrome"
                      title="Buka Chrome (Google) di kotak ini"
                      onClick={() => goService(i, 'https://www.google.com/')}
                    >
                      🌐
                    </button>
                    <button
                      className="gc-mini gc-gsc"
                      title="Search Console"
                      onClick={() =>
                        goService(
                          i,
                          'https://search.google.com/search-console' +
                            (p?.gscProperty ? '?resource_id=' + encodeURIComponent(p.gscProperty) : '')
                        )
                      }
                    >
                      GSC
                    </button>
                    <button className="gc-mini gc-disavow" title="Disavow" onClick={() => goService(i, 'https://search.google.com/search-console/disavow-links')}>
                      DIS
                    </button>
                    <button
                      className="gc-toggle"
                      title="Ganti akun"
                      onClick={(e) => {
                        const r = e.currentTarget.getBoundingClientRect()
                        update(i, {
                          ddOpen: !c.ddOpen,
                          ddQuery: '',
                          ddPos: { top: r.bottom + 4, left: Math.max(8, Math.min(window.innerWidth - 348, r.right - 340)) }
                        })
                      }}
                    >
                      ▾
                    </button>
                  </div>

                  {c.ready ? (
                    <WebviewPane
                      key={'wv-' + c.uuid}
                      ref={(h) => {
                        if (h) paneRefs.current.set(i, h)
                        else paneRefs.current.delete(i)
                      }}
                      partition={'persist:profile-' + c.uuid}
                      src={c.src}
                      zoom={c.zoom}
                      onUrl={(u) => {
                        if (u && isLoggedInUrl(u) && p) {
                          if (!p.verified) markVerified(p.uuid)
                          if (!savedRef.current.has(p.uuid)) {
                            savedRef.current.add(p.uuid)
                            saveSession(p.uuid)
                          }
                        }
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        color: 'var(--muted)',
                        fontSize: 12
                      }}
                    >
                      Memuat halaman…
                    </div>
                  )}

                  {c.ddOpen ? (
                    <div
                      className="gc-dropdown"
                      style={{
                        position: 'fixed',
                        top: c.ddPos?.top ?? 80,
                        left: c.ddPos?.left ?? 80,
                        width: 340,
                        maxHeight: Math.min(480, window.innerHeight - (c.ddPos?.top ?? 80) - 16),
                        zIndex: 99999,
                        background: '#16172e',
                        border: '1px solid var(--line)',
                        borderRadius: 10,
                        padding: 8,
                        boxShadow: '0 12px 32px rgba(0,0,0,.7)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6
                      }}
                    >
                      <input
                        className="gc-search"
                        placeholder="Cari email / tag…"
                        value={c.ddQuery}
                        onChange={(e) => update(i, { ddQuery: e.target.value })}
                      />
                      <div className="gc-list" style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                        {items.length ? (
                          items.map((x) => (
                            <div
                              className="gc-item"
                              key={x.uuid}
                              onClick={() =>
                                update(i, { uuid: x.uuid, src: siteFor(x), url: siteFor(x), ddOpen: false })
                              }
                            >
                              {x.gmail!.email}
                            </div>
                          ))
                        ) : (
                          <div className="gc-empty">tidak ada akun</div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
        <div className="iframe-note">Tiap kotak bisa ganti akun lewat tombol ▾.</div>
      </div>
    </section>
  )
}
