/* ====================================================================
   PENYIMPANAN LOKAL
   - Mode aplikasi (Electron): file di disk lewat IPC (tahan clear-cache).
   - Mode web (browser): localStorage.
   - Migrasi otomatis dari localStorage lama → file (sekali jalan).
   ==================================================================== */

const LS = { data: 'octo_dash_data', cfg: 'octo_dash_cfg' }

const fileStore =
  (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.storage) || null

export const isElectron = !!(typeof window !== 'undefined' && window.electronAPI?.isElectron)

export function dataFilePath(): string {
  if (fileStore) {
    try {
      return fileStore.path() || ''
    } catch {
      return ''
    }
  }
  return ''
}

export function loadDataRaw(): string | null {
  if (fileStore) {
    let res: ReturnType<NonNullable<typeof fileStore>['read']> | null = null
    try {
      res = fileStore.read()
    } catch {
      res = null
    }
    if (res && res.ok) {
      if (res.content != null) return res.content // sumber utama: file lokal
      // File belum ada → migrasi dari localStorage lama (sekali jalan)
      const legacy = localStorage.getItem(LS.data)
      if (legacy != null) {
        try {
          fileStore.write(legacy)
        } catch {
          /* abaikan */
        }
        return legacy
      }
      return null
    }
    // Gagal baca file → jangan kehilangan data: pakai localStorage sebagai cadangan
    return localStorage.getItem(LS.data)
  }
  return localStorage.getItem(LS.data)
}

export function saveDataRaw(str: string): boolean {
  if (fileStore) {
    let res: ReturnType<NonNullable<typeof fileStore>['write']> | null = null
    try {
      res = fileStore.write(str)
    } catch {
      res = null
    }
    if (res && res.ok) return true
    // Gagal tulis file → cadangkan ke localStorage supaya tidak hilang
    try {
      localStorage.setItem(LS.data, str)
    } catch {
      /* abaikan */
    }
    return false
  }
  try {
    localStorage.setItem(LS.data, str)
    return true
  } catch {
    return false
  }
}

export function loadCfgRaw(): string | null {
  return localStorage.getItem(LS.cfg)
}

export function saveCfgRaw(str: string): void {
  try {
    localStorage.setItem(LS.cfg, str)
  } catch {
    /* abaikan */
  }
}

/* Bersihkan sisa data versi sangat lama */
export function cleanupLegacy(): void {
  try {
    localStorage.removeItem('octo_master_hash')
  } catch {
    /* abaikan */
  }
}
