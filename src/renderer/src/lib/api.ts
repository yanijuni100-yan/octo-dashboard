/* ====================================================================
   LAPISAN API LIVE — Octo Browser Cloud API + AdsPower Local API.
   Dipakai hanya saat mode "Live API" aktif. Mode dummy memakai data lokal.
   ==================================================================== */
import type { Cfg, Profile } from './types'

export async function activeUuids(cfg: Cfg): Promise<string[]> {
  const res = await fetch(cfg.localUrl + '/api/profiles/active')
  if (!res.ok) throw new Error('Local API HTTP ' + res.status)
  const j = await res.json()
  return (j.uuids || j.data || []).map((x: { uuid?: string } | string) =>
    typeof x === 'string' ? x : x.uuid
  )
}

export async function listLiveProfiles(cfg: Cfg): Promise<Profile[]> {
  if (!cfg.token) throw new Error('Token API kosong — isi di Pengaturan.')
  const res = await fetch('https://app.octobrowser.net/api/v2/automation/profiles?page_len=100', {
    headers: { 'X-Octo-Api-Token': cfg.token }
  })
  if (!res.ok) throw new Error('Cloud API HTTP ' + res.status)
  const json = await res.json()
  const active = await activeUuids(cfg).catch(() => [] as string[])
  return (json.data || []).map(
    (p: {
      uuid: string
      title?: string
      fingerprint?: { os?: string }
      os?: string
      tags?: string[]
      proxy?: { type: string; host: string; port: string }
      updated_at?: string
    }): Profile => ({
      uuid: p.uuid,
      title: p.title || '(tanpa nama)',
      os: p.fingerprint?.os || p.os || '—',
      status: active.includes(p.uuid) ? 'active' : 'stopped',
      tags: p.tags || [],
      proxy: p.proxy ? { type: p.proxy.type, host: p.proxy.host, port: p.proxy.port } : null,
      lastActive: p.updated_at ? Date.parse(p.updated_at) : Date.now()
    })
  )
}

export async function startProfileLive(cfg: Cfg, uuid: string): Promise<void> {
  const res = await fetch(cfg.localUrl + '/api/profiles/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uuid, headless: false })
  })
  if (!res.ok) throw new Error('start gagal HTTP ' + res.status)
}

export async function stopProfileLive(cfg: Cfg, uuid: string): Promise<void> {
  const res = await fetch(cfg.localUrl + '/api/profiles/stop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uuid })
  })
  if (!res.ok) throw new Error('stop gagal HTTP ' + res.status)
}

export async function testConnection(cfg: Cfg): Promise<boolean> {
  const res = await fetch(cfg.localUrl + '/api/connection')
  return res.ok
}
