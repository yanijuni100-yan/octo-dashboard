import { useEffect, useState } from 'react'
import { useStore } from '../lib/store'
import { useUI } from '../lib/ui'
import { hueOf, initialOf } from '../lib/util'
import type { Profile } from '../lib/types'
import ProfileModal from '../components/ProfileModal'
import GmailModal from '../components/GmailModal'
import FrameView from '../components/FrameView'
import GridView from '../components/GridView'

type SortKey = 'title' | 'group' | 'brand' | 'usage' | null
type FrameState =
  | { mode: 'none' }
  | { mode: 'single'; uuid: string }
  | { mode: 'grid'; uuids: string[] }

export default function Profiles(): JSX.Element {
  const profiles = useStore((s) => s.profiles)
  const selected = useStore((s) => s.selected)
  const toggleSelected = useStore((s) => s.toggleSelected)
  const setSelected = useStore((s) => s.setSelected)
  const clearSelected = useStore((s) => s.clearSelected)
  const deleteProfile = useStore((s) => s.deleteProfile)
  const deleteSelected = useStore((s) => s.deleteSelected)
  const setFieldOnSelected = useStore((s) => s.setFieldOnSelected)
  const bumpUsage = useStore((s) => s.bumpUsage)
  const toast = useStore((s) => s.toast)
  const presenceCounts = useStore((s) => s.presenceCounts)
  const updatePresence = useStore((s) => s.updatePresence)

  const activeOpen = useUI((s) => s.activeOpen)
  const setActiveOpen = useUI((s) => s.setActiveOpen)
  const openRequest = useUI((s) => s.openRequest)
  const clearOpenRequest = useUI((s) => s.clearOpenRequest)

  const [search, setSearch] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: number }>({ key: null, dir: 1 })
  const [modal, setModal] = useState<{ open: boolean; uuid: string | null }>({ open: false, uuid: null })
  const [gmailOpen, setGmailOpen] = useState(false)
  const [frame, setFrame] = useState<FrameState>({ mode: 'none' })

  const openSingle = (uuid: string): void => {
    setFrame({ mode: 'single', uuid })
    setActiveOpen(new Set([uuid]))
    updatePresence([uuid])
    bumpUsage(uuid)
  }
  const openGrid = (uuids: string[]): void => {
    setFrame({ mode: 'grid', uuids })
    setActiveOpen(new Set(uuids))
    updatePresence(uuids)
  }
  const closeFrame = (): void => {
    setFrame({ mode: 'none' })
    setActiveOpen(new Set())
    updatePresence([])
  }

  useEffect(() => {
    if (!openRequest) return
    if (openRequest.mode === 'single' && openRequest.uuids[0]) openSingle(openRequest.uuids[0])
    else if (openRequest.mode === 'grid') openGrid(openRequest.uuids)
    clearOpenRequest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRequest])

  useEffect(() => {
    if (frame.mode !== 'none') document.body.classList.add('framing')
    else document.body.classList.remove('framing')
    return () => document.body.classList.remove('framing')
  }, [frame.mode])

  const tags = [...new Set(profiles.flatMap((p) => p.tags))].sort()

  const getFiltered = (): Profile[] => {
    const q = search.toLowerCase().trim()
    const list = profiles.filter(
      (p) =>
        (!q || p.title.toLowerCase().includes(q)) &&
        (!filterTag || p.tags.includes(filterTag)) &&
        (filterStatus === '' || (filterStatus === 'masuk' ? !!p.verified : !p.verified))
    )
    if (sort.key) {
      const k = sort.key
      const val = (p: Profile): string | number => {
        if (k === 'usage') return p.usage || 0
        return (p[k] || '').toString().toLowerCase()
      }
      list.sort((a, b) => {
        const va = val(a)
        const vb = val(b)
        if (va < vb) return -1 * sort.dir
        if (va > vb) return 1 * sort.dir
        return 0
      })
    }
    return list
  }

  const list = getFiltered()
  const total = profiles.length

  const clickSort = (key: SortKey): void => {
    setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: key === 'usage' ? -1 : 1 }))
  }

  const bulkOpenAll = (): void => {
    const sel = [...selected]
    if (!sel.length) return
    if (
      sel.length > 6 &&
      !confirm(
        `Buka ${sel.length} akun berdampingan sekaligus?\n\nMembuka banyak Gmail bersamaan bisa berat & berisiko terdeteksi Google. Lanjut?`
      )
    )
      return
    openGrid(sel)
    toast(sel.length + ' akun dibuka berdampingan')
  }

  const bulkSetField = (field: 'group' | 'brand', label: string): void => {
    const sel = [...selected]
    if (!sel.length) return
    const current = profiles.find((p) => p.uuid === sel[0])?.[field] || ''
    const val = prompt(`Set ${label} untuk ${sel.length} akun terpilih.\n\nKosongkan untuk hapus ${label}:`, current)
    if (val === null) return
    const count = setFieldOnSelected(field, val.trim())
    toast(`${label} di-set untuk ${count} akun`)
  }

  const bulkBar =
    selected.size > 0 ? (
      <div className="bulkbar">
        <span>{selected.size} dipilih</span>
        <button className="btn small primary" onClick={bulkOpenAll}>
          ↗ Buka semua
        </button>
        <button className="btn small bulk-group" onClick={() => bulkSetField('group', 'Group')}>
          🏷 Set Group
        </button>
        <button className="btn small bulk-brand" onClick={() => bulkSetField('brand', 'Brand')}>
          ⭐ Set Brand
        </button>
        <button
          className="btn small danger"
          onClick={() => {
            if (confirm('Hapus ' + selected.size + ' profil terpilih?')) {
              deleteSelected()
              toast('Profil dihapus')
            }
          }}
        >
          🗑 Hapus
        </button>
        <button className="btn small" onClick={clearSelected}>
          ✕ Batal pilih
        </button>
      </div>
    ) : null

  if (frame.mode === 'single') {
    return (
      <>
        <FrameView key={frame.uuid} uuid={frame.uuid} onClose={closeFrame} onSwitch={openSingle} />
        {bulkBar}
      </>
    )
  }
  if (frame.mode === 'grid') {
    return <GridView uuids={frame.uuids} onClose={closeFrame} />
  }

  return (
    <section className="view">
      <div className="gmail-card" onClick={() => setGmailOpen(true)}>
        <span className="g-ic">
          <svg viewBox="0 0 52 40" width="22" height="17" aria-hidden="true">
            <path fill="#4285F4" d="M3.5 40h9V18L0 8v28.5C0 38 1.6 40 3.5 40z" />
            <path fill="#34A853" d="M39.5 40h9c2 0 3.5-1.6 3.5-3.5V8l-12.5 10z" />
            <path fill="#FBBC04" d="M39.5 3.5V18L52 8V5.3c0-4.9-5.6-7.7-9.5-4.8z" />
            <path fill="#EA4335" d="M12.5 18V3.5L26 13.6 39.5 3.5V18L26 28z" />
            <path fill="#C5221F" d="M0 5.3V8l12.5 10V3.5L9.5.5C5.6-2.4 0 .4 0 5.3z" />
          </svg>
        </span>
        <strong>Bulk Add Gmail</strong>
        <button className="gmail-plus" title="Tambah akun Gmail massal">
          +
        </button>
      </div>

      <div className="toolbar">
        <input
          type="search"
          className="input"
          placeholder="Cari nama profil…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input" value={filterTag} onChange={(e) => setFilterTag(e.target.value)}>
          <option value="">Semua tag</option>
          {tags.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select className="input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">Semua status</option>
          <option value="masuk">Sudah masuk</option>
          <option value="belum">Belum masuk</option>
        </select>
        <span className="count-badge">
          {list.length === total ? `${total} akun Gmail` : `${list.length} ditampilkan · dari ${total} akun`}
        </span>
        <button className="btn primary" onClick={() => setModal({ open: true, uuid: null })}>
          + Profil Baru
        </button>
      </div>

      {bulkBar}

      <div className="card no-pad">
        <table className="table">
          <thead>
            <tr>
              <th className="chk">
                <input
                  type="checkbox"
                  checked={list.length > 0 && list.every((p) => selected.has(p.uuid))}
                  onChange={(e) => setSelected(list.map((p) => p.uuid), e.target.checked)}
                />
              </th>
              <th className="sortable" onClick={() => clickSort('title')}>
                Profil <span className="sort-ind">{sort.key === 'title' ? (sort.dir === 1 ? '▲' : '▼') : ''}</span>
              </th>
              <th>Status</th>
              <th>OS</th>
              <th>Proxy</th>
              <th className="sortable" onClick={() => clickSort('group')}>
                Group <span className="sort-ind">{sort.key === 'group' ? (sort.dir === 1 ? '▲' : '▼') : ''}</span>
              </th>
              <th className="sortable" onClick={() => clickSort('brand')}>
                Brand <span className="sort-ind">{sort.key === 'brand' ? (sort.dir === 1 ? '▲' : '▼') : ''}</span>
              </th>
              <th className="sortable" onClick={() => clickSort('usage')}>
                Pengguna <span className="sort-ind">{sort.key === 'usage' ? (sort.dir === 1 ? '▲' : '▼') : ''}</span>
              </th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const ident = p.gmail ? p.gmail.email : p.title
              return (
                <tr key={p.uuid}>
                  <td className="chk">
                    <input
                      type="checkbox"
                      className="rowchk"
                      checked={selected.has(p.uuid)}
                      onChange={(e) => toggleSelected(p.uuid, e.target.checked)}
                    />
                  </td>
                  <td>
                    <div className="p-row">
                      <span className="avatar" style={{ background: `hsl(${hueOf(ident)},62%,52%)` }}>
                        {initialOf(ident)}
                      </span>
                      <div className="p-name">
                        <strong>{p.title}</strong>
                        <span>{p.gmail ? p.gmail.email : p.uuid}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    {p.verified ? (
                      <span className="badge active">Masuk</span>
                    ) : (
                      <span className="badge stopped">Belum</span>
                    )}
                  </td>
                  <td>{p.os}</td>
                  <td>
                    {p.proxy ? (
                      `${p.proxy.type} · ${p.proxy.host}:${p.proxy.port}`
                    ) : (
                      <span className="muted">tanpa proxy</span>
                    )}
                  </td>
                  <td>{p.group ? <span className="group-pill">{p.group}</span> : <span className="muted">—</span>}</td>
                  <td>{p.brand ? <span className="brand-pill">{p.brand}</span> : <span className="muted">—</span>}</td>
                  <td>
                    {(() => {
                      const n = presenceCounts[p.uuid] || (activeOpen.has(p.uuid) ? 1 : 0)
                      return (
                        <div className="p-usage">
                          {n > 0 ? (
                            <>
                              <span className="p-usage-on">● {n} orang membuka</span>
                              <span className="p-usage-t">sedang dipakai</span>
                            </>
                          ) : (
                            <>
                              <span className="p-usage-n">0 orang</span>
                              <span className="p-usage-t">tidak dipakai</span>
                            </>
                          )}
                        </div>
                      )
                    })()}
                  </td>
                  <td>
                    <div className="act-btns">
                      <button className="btn-login" onClick={() => openSingle(p.uuid)}>
                        Login
                      </button>
                      <button className="iconbtn ed" title="Edit" onClick={() => setModal({ open: true, uuid: p.uuid })}>
                        ✎
                      </button>
                      <button
                        className="iconbtn dl"
                        title="Hapus"
                        onClick={() => {
                          if (confirm('Hapus profil "' + p.title + '"?')) {
                            deleteProfile(p.uuid)
                            toast('Profil dihapus')
                          }
                        }}
                      >
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {list.length === 0 ? <div className="empty">Tidak ada profil yang cocok.</div> : null}
      </div>

      {modal.open ? (
        <ProfileModal editingUuid={modal.uuid} onClose={() => setModal({ open: false, uuid: null })} />
      ) : null}
      {gmailOpen ? <GmailModal onClose={() => setGmailOpen(false)} /> : null}
    </section>
  )
}
