import { create } from 'zustand'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Cfg, Gmail, Profile, Proxy, Store } from './types'
import {
  loadDataRaw,
  saveDataRaw,
  loadCfgRaw,
  saveCfgRaw,
  cleanupLegacy,
  dataFilePath
} from './storage'
import { safeParse, createdMs } from './util'
import { initSupabase, getSupabase } from './supabase'
import * as api from './api'

/* ---------- Inisialisasi data & konfigurasi ---------- */
cleanupLegacy()

function seedData(): Store {
  return { profiles: [] }
}

function loadInitialStore(): Store {
  const s = safeParse<Store | null>(loadDataRaw(), null)
  if (!s || !Array.isArray(s.profiles)) return seedData()
  // Bersihkan profil contoh bawaan lama (demo-001..014); migrasi tag "gmail" → Group
  s.profiles = s.profiles.filter((p) => !/^demo-\d{3}$/.test(p.uuid))
  s.profiles.forEach((p) => {
    if (Array.isArray(p.tags) && p.tags.includes('gmail')) {
      if (!p.group) p.group = 'gmail'
      p.tags = p.tags.filter((t) => t !== 'gmail')
    }
    if (typeof p.title === 'string') p.title = p.title.replace(/^Gmail\s*[—-]\s*/i, '').trim()
    if (typeof p.url === 'string' && /mail\.google\.com|gmail\.com\/?$|inbox/i.test(p.url)) p.url = ''
    if (!p.createdAt) p.createdAt = createdMs(p) // stabilkan "umur akun"
  })
  return s
}

const initialCfg: Cfg = Object.assign(
  { localUrl: 'http://localhost:58888', token: '', live: false, supaUrl: '', supaKey: '' },
  safeParse<Partial<Cfg>>(loadCfgRaw(), {})
)

/* Variabel modul (di luar React) untuk debounce & channel realtime */
let pushTimer: ReturnType<typeof setTimeout> | null = null
let realtimeChan: RealtimeChannel | null = null
/* Presence: hitung berapa orang sedang membuka tiap akun (live antar rekan) */
let presenceChan: RealtimeChannel | null = null
let currentOpen: string[] = []
const clientId = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)

interface AppState {
  store: Store
  cfg: Cfg
  profiles: Profile[]
  selected: Set<string>
  notice: string
  toastMsg: string
  toastSeq: number
  dataPath: string
  cloudEmail: string | null
  cloudStatus: string

  // util UI
  toast: (msg: string) => void
  setNotice: (msg: string) => void

  // data inti
  persist: () => void
  loadProfiles: () => Promise<void>
  upsertProfile: (data: ProfileFormData, editingUuid: string | null) => void
  addGmailBulk: (accts: Gmail[], os: string, extraTags: string[]) => number
  deleteProfile: (uuid: string) => void
  deleteSelected: () => void
  setFieldOnSelected: (field: 'group' | 'brand', value: string) => number
  markVerified: (uuid: string) => void
  bumpUsage: (uuid: string) => void
  resetData: () => void
  importBackup: (profiles: Profile[], proxies: Proxy[] | undefined, merge: boolean) => string

  // start/stop
  startProfile: (uuid: string) => Promise<void>
  stopProfile: (uuid: string) => Promise<void>

  // seleksi
  toggleSelected: (uuid: string, on: boolean) => void
  setSelected: (uuids: string[], on: boolean) => void
  clearSelected: () => void

  // konfigurasi
  setLive: (live: boolean) => void
  saveAdsPowerCfg: (localUrl: string, token: string) => void

  // cloud
  saveCloudCfg: (supaUrl: string, supaKey: string) => Promise<void>
  cloudSignIn: (email: string, password: string) => Promise<void>
  cloudSignUp: (email: string, password: string) => Promise<void>
  cloudSignOut: () => Promise<void>
  cloudPull: (silent?: boolean) => Promise<void>
  cloudPush: (immediate?: boolean) => Promise<void>
  restoreCloudSession: () => Promise<void>

  // sinkron sesi (cookie) per akun
  saveSession: (uuid: string) => Promise<boolean>
  restoreSession: (uuid: string) => Promise<boolean>
  resetSession: (uuid: string) => Promise<void>
  cleanupSessions: () => Promise<number>

  // presence: berapa orang sedang membuka tiap akun (live)
  presenceCounts: Record<string, number>
  updatePresence: (uuids: string[]) => void
}

export interface ProfileFormData {
  title: string
  os: string
  tags: string[]
  proxy: Proxy | null
  gmail: Gmail | null
  url: string
  gscProperty: string
  group: string
  brand: string
}

export const useStore = create<AppState>((set, get) => {
  /* Tulis store ke disk + jadwalkan dorong ke cloud */
  function persistInternal(): void {
    const { store } = get()
    store.updatedAt = Date.now()
    if (!saveDataRaw(JSON.stringify(store))) {
      get().toast('⚠ Gagal menyimpan data ke disk — perubahan terakhir mungkin tidak tersimpan.')
    }
    scheduleCloudPush()
  }

  /* Setelah mengubah store.profiles: refresh daftar tampil (mode dummy) + persist */
  function commit(profiles: Profile[]): void {
    const cfg = get().cfg
    const store = { ...get().store, profiles }
    set({ store })
    if (!cfg.live) set({ profiles })
    persistInternal()
  }

  function scheduleCloudPush(): void {
    const sb = getSupabase()
    if (!sb || !get().cloudEmail) return
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = setTimeout(() => get().cloudPush(false), 1200)
  }

  /* Pasang data dari cloud ke aplikasi (dipakai pull & realtime).
     Last-write-wins berdasarkan updatedAt. */
  function applyCloudData(data: Store, remoteIso?: string): boolean {
    if (!data || !Array.isArray(data.profiles)) return false
    const localTs = get().store.updatedAt || 0
    const remoteTs = remoteIso ? Date.parse(remoteIso) || 0 : data.updatedAt || 0
    if (remoteTs < localTs) return false
    saveDataRaw(JSON.stringify(data))
    set({ store: data })
    if (!get().cfg.live) set({ profiles: data.profiles })
    return true
  }

  function stopRealtime(): void {
    const sb = getSupabase()
    if (realtimeChan && sb) {
      try {
        sb.removeChannel(realtimeChan)
      } catch {
        /* abaikan */
      }
    }
    realtimeChan = null
  }

  function stopPresence(): void {
    const sb = getSupabase()
    if (presenceChan && sb) {
      try {
        sb.removeChannel(presenceChan)
      } catch {
        /* abaikan */
      }
    }
    presenceChan = null
    set({ presenceCounts: {} })
  }

  function startPresence(): void {
    const sb = getSupabase()
    if (!sb || !get().cloudEmail) return
    stopPresence()
    sb.auth.getUser().then(({ data }) => {
      const uid = data.user?.id
      if (!uid) return
      const ch = sb.channel('presence-' + uid, { config: { presence: { key: clientId } } })
      ch.on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState() as unknown as Record<string, Array<{ open?: string[] }>>
        const counts: Record<string, number> = {}
        Object.values(state).forEach((metas) => {
          const open = metas[0]?.open || []
          open.forEach((u) => {
            counts[u] = (counts[u] || 0) + 1
          })
        })
        set({ presenceCounts: counts })
      }).subscribe((status: string) => {
        if (status === 'SUBSCRIBED') ch.track({ open: currentOpen })
      })
      presenceChan = ch
    })
  }

  function startRealtime(): void {
    const sb = getSupabase()
    const email = get().cloudEmail
    if (!sb || !email) return
    stopRealtime()
    sb.auth.getUser().then(({ data }) => {
      const uid = data.user?.id
      if (!uid) return
      // Tipe filter realtime supabase-js cukup ketat; pakai cast agar ringkas.
      const ch = sb.channel('dash-' + uid) as unknown as {
        on: (
          ev: string,
          cfg: Record<string, unknown>,
          cb: (payload: { new?: { data?: Store; updated_at?: string } }) => void
        ) => { subscribe: () => RealtimeChannel }
      }
      realtimeChan = ch
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'dashboards', filter: 'user_id=eq.' + uid },
          (payload) => {
            const row = payload.new
            if (row && row.data && applyCloudData(row.data, row.updated_at)) {
              get().toast('↻ Data diperbarui dari komputer lain')
            }
          }
        )
        .subscribe()
    })
  }

  async function afterLogin(): Promise<void> {
    const sb = getSupabase()
    if (!sb) return
    const { data } = await sb.auth.getUser()
    set({ cloudEmail: data.user?.email || data.user?.id || 'akun' })
    await get().cloudPull(true)
    startRealtime()
    startPresence()
    updateCloudStatus()
  }

  function updateCloudStatus(): void {
    const sb = getSupabase()
    const email = get().cloudEmail
    let cloudStatus: string
    if (!sb) cloudStatus = 'Status: koneksi Supabase belum diisi.'
    else if (!email) cloudStatus = 'Status: tersambung, belum login.'
    else cloudStatus = '✓ Login sebagai ' + email + ' — data tersinkron otomatis.'
    set({ cloudStatus })
  }

  /* Hapus baris sesi (cookie) untuk uuid tertentu di cloud — dipakai saat profil dihapus */
  async function deleteSessionRows(uuids: string[]): Promise<void> {
    const sb = getSupabase()
    if (!sb || !get().cloudEmail || !uuids.length) return
    try {
      const { data: u } = await sb.auth.getUser()
      const uid = u.user?.id
      if (!uid) return
      for (let i = 0; i < uuids.length; i += 100) {
        await sb.from('sessions').delete().eq('user_id', uid).in('profile_uuid', uuids.slice(i, i + 100))
      }
    } catch {
      /* abaikan */
    }
  }

  return {
    store: loadInitialStore(),
    cfg: initialCfg,
    profiles: [],
    selected: new Set<string>(),
    notice: '',
    toastMsg: '',
    toastSeq: 0,
    dataPath: dataFilePath(),
    cloudEmail: null,
    cloudStatus: 'Status: belum tersambung.',
    presenceCounts: {},

    toast: (msg) => set((s) => ({ toastMsg: msg, toastSeq: s.toastSeq + 1 })),
    setNotice: (msg) => set({ notice: msg }),

    persist: () => persistInternal(),

    loadProfiles: async () => {
      const { cfg, store } = get()
      set({ notice: '' })
      if (!cfg.live) {
        set({ profiles: store.profiles })
        return
      }
      try {
        const live = await api.listLiveProfiles(cfg)
        set({ profiles: live })
      } catch (e) {
        set({
          profiles: store.profiles,
          notice:
            '⚠ Mode Live gagal: ' +
            (e as Error).message +
            ' — menampilkan data dummy. Catatan: panggilan langsung ke Cloud API dari browser sering ' +
            'diblokir CORS; gunakan Octo Browser yang berjalan + Local API, atau tetap di mode dummy.'
        })
      }
    },

    upsertProfile: (data, editingUuid) => {
      const profiles = [...get().store.profiles]
      if (editingUuid) {
        const idx = profiles.findIndex((x) => x.uuid === editingUuid)
        if (idx >= 0) profiles[idx] = { ...profiles[idx], ...data }
      } else {
        profiles.unshift({
          uuid: (data.gmail ? 'gm-' : 'demo-') + Date.now().toString(36),
          status: 'stopped',
          lastActive: Date.now(),
          createdAt: Date.now(),
          ...data
        })
      }
      commit(profiles)
    },

    addGmailBulk: (accts, os, extraTags) => {
      const profiles = [...get().store.profiles]
      accts.forEach((a, i) => {
        profiles.unshift({
          uuid: 'gm-' + Date.now().toString(36) + i,
          title: a.email,
          os,
          status: 'stopped',
          tags: [...extraTags],
          proxy: null,
          gmail: a,
          lastActive: Date.now(),
          createdAt: Date.now()
        })
      })
      commit(profiles)
      return accts.length
    },

    deleteProfile: (uuid) => {
      commit(get().store.profiles.filter((x) => x.uuid !== uuid))
      deleteSessionRows([uuid])
    },

    deleteSelected: () => {
      const sel = get().selected
      const uuids = [...sel]
      commit(get().store.profiles.filter((p) => !sel.has(p.uuid)))
      set({ selected: new Set() })
      deleteSessionRows(uuids)
    },

    setFieldOnSelected: (field, value) => {
      const sel = get().selected
      let count = 0
      const profiles = get().store.profiles.map((p) => {
        if (sel.has(p.uuid)) {
          count++
          return { ...p, [field]: value }
        }
        return p
      })
      commit(profiles)
      return count
    },

    markVerified: (uuid) => {
      const profiles = get().store.profiles.map((p) =>
        p.uuid === uuid ? { ...p, verified: true } : p
      )
      commit(profiles)
    },

    bumpUsage: (uuid) => {
      const profiles = get().store.profiles.map((p) =>
        p.uuid === uuid ? { ...p, usage: (p.usage || 0) + 1, lastActive: Date.now() } : p
      )
      commit(profiles)
    },

    resetData: () => {
      set({ store: seedData() })
      persistInternal()
      set({ profiles: [] })
    },

    importBackup: (incoming, proxies, merge) => {
      const store = { ...get().store }
      let msg = ''
      if (merge) {
        const existing = new Set(
          store.profiles.filter((p) => p.gmail).map((p) => p.gmail!.email)
        )
        let added = 0
        const profiles = [...store.profiles]
        incoming.forEach((p) => {
          if (p.gmail && existing.has(p.gmail.email)) return
          profiles.unshift(p)
          added++
        })
        store.profiles = profiles
        msg = `✓ Impor selesai: ${added} profil baru ditambahkan (duplikat dilewati).`
      } else {
        store.profiles = incoming
        if (Array.isArray(proxies)) store.proxies = proxies
        msg = `✓ Impor selesai: ${incoming.length} profil menggantikan data lama.`
      }
      set({ store })
      persistInternal()
      if (!get().cfg.live) set({ profiles: store.profiles })
      return msg
    },

    startProfile: async (uuid) => {
      const { cfg } = get()
      if (cfg.live) await api.startProfileLive(cfg, uuid)
      const profiles = get().store.profiles.map((p) =>
        p.uuid === uuid ? { ...p, status: 'active' as const, lastActive: Date.now() } : p
      )
      if (!cfg.live) commit(profiles)
      else set({ profiles: get().profiles.map((p) => (p.uuid === uuid ? { ...p, status: 'active' } : p)) })
    },

    stopProfile: async (uuid) => {
      const { cfg } = get()
      if (cfg.live) await api.stopProfileLive(cfg, uuid)
      const profiles = get().store.profiles.map((p) =>
        p.uuid === uuid ? { ...p, status: 'stopped' as const, lastActive: Date.now() } : p
      )
      if (!cfg.live) commit(profiles)
      else set({ profiles: get().profiles.map((p) => (p.uuid === uuid ? { ...p, status: 'stopped' } : p)) })
    },

    toggleSelected: (uuid, on) => {
      const selected = new Set(get().selected)
      if (on) selected.add(uuid)
      else selected.delete(uuid)
      set({ selected })
    },

    setSelected: (uuids, on) => {
      const selected = new Set(get().selected)
      uuids.forEach((u) => (on ? selected.add(u) : selected.delete(u)))
      set({ selected })
    },

    clearSelected: () => set({ selected: new Set() }),

    setLive: (live) => {
      const cfg = { ...get().cfg, live }
      set({ cfg })
      saveCfgRaw(JSON.stringify(cfg))
      get().loadProfiles()
    },

    saveAdsPowerCfg: (localUrl, token) => {
      const cfg = { ...get().cfg, localUrl: localUrl || 'http://localhost:58888', token }
      set({ cfg })
      saveCfgRaw(JSON.stringify(cfg))
    },

    saveCloudCfg: async (supaUrl, supaKey) => {
      const cfg = { ...get().cfg, supaUrl: supaUrl.trim(), supaKey: supaKey.trim() }
      set({ cfg })
      saveCfgRaw(JSON.stringify(cfg))
      stopRealtime()
      set({ cloudEmail: null })
      initSupabase(cfg.supaUrl, cfg.supaKey)
      await get().restoreCloudSession()
    },

    cloudSignIn: async (email, password) => {
      const sb = getSupabase()
      if (!sb) throw new Error('Isi & simpan Supabase URL + anon key dulu.')
      const { error } = await sb.auth.signInWithPassword({ email, password })
      if (error) throw error
      await afterLogin()
    },

    cloudSignUp: async (email, password) => {
      const sb = getSupabase()
      if (!sb) throw new Error('Isi & simpan Supabase URL + anon key dulu.')
      const { error } = await sb.auth.signUp({ email, password })
      if (error) throw error
    },

    cloudSignOut: async () => {
      const sb = getSupabase()
      if (sb) {
        try {
          await sb.auth.signOut()
        } catch {
          /* abaikan */
        }
      }
      stopRealtime()
      stopPresence()
      set({ cloudEmail: null })
      updateCloudStatus()
    },

    cloudPull: async (silent) => {
      const sb = getSupabase()
      if (!sb || !get().cloudEmail) {
        if (!silent) get().toast('Belum login Supabase.')
        return
      }
      const { data: u } = await sb.auth.getUser()
      const uid = u.user?.id
      if (!uid) return
      const { data, error } = await sb
        .from('dashboards')
        .select('data, updated_at')
        .eq('user_id', uid)
        .maybeSingle()
      if (error) {
        if (!silent) get().toast('Gagal tarik cloud: ' + error.message)
        return
      }
      if (data && data.data) {
        const applied = applyCloudData(data.data as Store, data.updated_at as string)
        if (!silent)
          get().toast(
            applied
              ? '✓ Data ditarik dari cloud (' + get().store.profiles.length + ' profil)'
              : 'Data lokal lebih baru — tidak ditimpa. Pakai "Kirim ke cloud" bila perlu.'
          )
      } else {
        await get().cloudPush(true)
        if (!silent) get().toast('✓ Data lokal diunggah ke cloud.')
      }
    },

    cloudPush: async (immediate) => {
      const sb = getSupabase()
      if (!sb || !get().cloudEmail) {
        if (immediate) get().toast('Belum login Supabase.')
        return
      }
      const { data: u } = await sb.auth.getUser()
      const uid = u.user?.id
      if (!uid) return
      const store = get().store
      if (!store.updatedAt) store.updatedAt = Date.now()
      const { error } = await sb.from('dashboards').upsert(
        {
          user_id: uid,
          data: store,
          updated_at: new Date(store.updatedAt).toISOString()
        },
        { onConflict: 'user_id' }
      )
      if (error && immediate) get().toast('Gagal kirim cloud: ' + error.message)
    },

    restoreCloudSession: async () => {
      const sb = getSupabase()
      if (!sb) {
        updateCloudStatus()
        return
      }
      try {
        const { data } = await sb.auth.getSession()
        if (data && data.session) await afterLogin()
      } catch {
        /* abaikan */
      }
      updateCloudStatus()
    },

    saveSession: async (uuid) => {
      const sb = getSupabase()
      const api2 = window.electronAPI?.cookies
      if (!sb || !get().cloudEmail || !api2) return false
      try {
        const { data: u } = await sb.auth.getUser()
        const uid = u.user?.id
        if (!uid) return false
        const res = await api2.export('persist:profile-' + uuid)
        if (!res.ok || !res.cookies.length) return false
        const { error } = await sb.from('sessions').upsert(
          { user_id: uid, profile_uuid: uuid, cookies: res.cookies, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,profile_uuid' }
        )
        return !error
      } catch {
        return false
      }
    },

    restoreSession: async (uuid) => {
      const sb = getSupabase()
      const api2 = window.electronAPI?.cookies
      if (!sb || !get().cloudEmail || !api2) return false
      try {
        // Jangan timpa sesi lokal yang SUDAH login (hindari CookieMismatch).
        const local = await api2.export('persist:profile-' + uuid)
        const hasLocalSession =
          local.ok &&
          local.cookies.some(
            (c) => /(^|\.)google\.com$/.test(c.domain || '') && /SID/.test(c.name)
          )
        if (hasLocalSession) return true

        const { data: u } = await sb.auth.getUser()
        const uid = u.user?.id
        if (!uid) return false
        const { data, error } = await sb
          .from('sessions')
          .select('cookies')
          .eq('user_id', uid)
          .eq('profile_uuid', uuid)
          .maybeSingle()
        if (error || !data || !Array.isArray(data.cookies) || !data.cookies.length) return false
        await api2.import('persist:profile-' + uuid, data.cookies)
        return true
      } catch {
        return false
      }
    },

    resetSession: async (uuid) => {
      const api2 = window.electronAPI?.cookies
      if (api2) {
        try {
          await api2.clear('persist:profile-' + uuid)
        } catch {
          /* abaikan */
        }
      }
      const sb = getSupabase()
      if (sb && get().cloudEmail) {
        try {
          const { data: u } = await sb.auth.getUser()
          const uid = u.user?.id
          if (uid) await sb.from('sessions').delete().eq('user_id', uid).eq('profile_uuid', uuid)
        } catch {
          /* abaikan */
        }
      }
    },

    cleanupSessions: async () => {
      const sb = getSupabase()
      if (!sb || !get().cloudEmail) {
        get().toast('Belum login cloud.')
        return 0
      }
      try {
        const { data: u } = await sb.auth.getUser()
        const uid = u.user?.id
        if (!uid) return 0
        const valid = new Set(get().store.profiles.map((p) => p.uuid))
        const { data, error } = await sb.from('sessions').select('profile_uuid').eq('user_id', uid)
        if (error || !data) {
          get().toast('Gagal membaca sesi: ' + (error?.message || ''))
          return 0
        }
        const orphans = (data as Array<{ profile_uuid: string }>)
          .map((r) => r.profile_uuid)
          .filter((id) => !valid.has(id))
        if (!orphans.length) {
          get().toast('✓ Tidak ada sesi lama untuk dibersihkan')
          return 0
        }
        let deleted = 0
        for (let i = 0; i < orphans.length; i += 100) {
          const chunk = orphans.slice(i, i + 100)
          const { error: delErr } = await sb.from('sessions').delete().eq('user_id', uid).in('profile_uuid', chunk)
          if (!delErr) deleted += chunk.length
        }
        get().toast(`🧹 ${deleted} sesi lama dihapus`)
        return deleted
      } catch (e) {
        get().toast('Gagal membersihkan: ' + (e as Error).message)
        return 0
      }
    },

    updatePresence: (uuids) => {
      currentOpen = uuids
      if (presenceChan) {
        try {
          presenceChan.track({ open: uuids })
        } catch {
          /* abaikan */
        }
      }
    }
  }
})

/* Inisialisasi cloud sekali saat modul dimuat */
initSupabase(initialCfg.supaUrl, initialCfg.supaKey)
