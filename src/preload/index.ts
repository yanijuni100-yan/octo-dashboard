import { contextBridge, ipcRenderer } from 'electron'

const api = {
  isElectron: true as const,
  openProfileWindow: (url: string, partition?: string, title?: string) =>
    ipcRenderer.send('open-profile-window', { url, partition, title }),
  // Penyimpanan data dashboard ke file lokal (sinkron, agar load awal sederhana)
  storage: {
    read: () => ipcRenderer.sendSync('octo-data-read'),
    write: (content: string) => ipcRenderer.sendSync('octo-data-write', content),
    path: () => ipcRenderer.sendSync('octo-data-path')
  },
  // Sinkron sesi (cookie) per akun antar komputer
  cookies: {
    export: (partition: string) => ipcRenderer.invoke('cookies-export', partition),
    import: (partition: string, cookies: unknown[]) =>
      ipcRenderer.invoke('cookies-import', partition, cookies),
    clear: (partition: string) => ipcRenderer.invoke('cookies-clear', partition),
    // Perbaiki cookie TANPA keluar akun: hapus hanya cookie konsistensi/pelacak Google.
    fixMismatch: (partition: string) => ipcRenderer.invoke('cookies-fix-mismatch', partition)
  },
  // Buka URL di Google Chrome asli (folder profil TETAP per akun → tidak login lagi).
  // withDebug = dibuka untuk keperluan MEMINDAHKAN sesi login ke dashboard.
  openInChrome: (url: string, profileKey: string, title?: string, withDebug?: boolean) =>
    ipcRenderer.invoke('open-in-chrome', { url, profileKey, title, withDebug }),
  // Ambil sesi login (cookie) dari Chrome asli akun ini → tanam ke jendela akun di dashboard
  pullChromeSession: (profileKey: string, partition: string) =>
    ipcRenderer.invoke('chrome-session-pull', { profileKey, partition }),
  // Pembaca Verifikasi (IMAP): baca email verifikasi tanpa membuka browser Gmail
  mail: {
    setCred: (uuid: string, appPassword: string) =>
      ipcRenderer.invoke('mail-cred-set', uuid, appPassword),
    hasCred: (uuid: string) => ipcRenderer.invoke('mail-cred-has', uuid),
    clearCred: (uuid: string) => ipcRenderer.invoke('mail-cred-clear', uuid),
    fetchVerification: (uuid: string, email: string) =>
      ipcRenderer.invoke('mail-fetch-verification', { uuid, email })
  },
  // Buka tautan di browser default sistem (mis. link verifikasi Cloudflare)
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url)
}

contextBridge.exposeInMainWorld('electronAPI', api)
