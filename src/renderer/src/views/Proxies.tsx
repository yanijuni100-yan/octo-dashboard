import { useStore } from '../lib/store'
import type { Proxy } from '../lib/types'

export default function Proxies(): JSX.Element {
  const profiles = useStore((s) => s.profiles)

  const map = new Map<string, Proxy & { used: number }>()
  profiles.forEach((p) => {
    if (!p.proxy) return
    const key = p.proxy.host + ':' + p.proxy.port
    if (!map.has(key)) map.set(key, { ...p.proxy, used: 0 })
    map.get(key)!.used++
  })
  const rows = [...map.values()]

  return (
    <section className="view">
      <div className="card no-pad">
        <table className="table">
          <thead>
            <tr>
              <th>Proxy</th>
              <th>Tipe</th>
              <th>Host : Port</th>
              <th>Dipakai</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((px) => (
              <tr key={px.host + ':' + px.port}>
                <td>
                  <strong>{px.host}</strong>
                </td>
                <td>{px.type}</td>
                <td>
                  {px.host}:{px.port}
                </td>
                <td>{px.used} profil</td>
                <td>
                  <span className="badge active">OK</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <div className="empty">Belum ada proxy.</div> : null}
      </div>
    </section>
  )
}
