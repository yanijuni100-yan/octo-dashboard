export interface StorageReadResult {
  ok: boolean
  content?: string | null
  path: string
  error?: string
  recovered?: boolean
}

export interface StorageWriteResult {
  ok: boolean
  path: string
  error?: string
}

export interface CookieData {
  name: string
  value: string
  domain?: string
  path?: string
  secure?: boolean
  httpOnly?: boolean
  expirationDate?: number
  sameSite?: string
}

export interface ElectronAPI {
  isElectron: true
  openProfileWindow: (url: string, partition?: string, title?: string) => void
  storage: {
    read: () => StorageReadResult
    write: (content: string) => StorageWriteResult
    path: () => string
  }
  cookies: {
    export: (partition: string) => Promise<{ ok: boolean; cookies: CookieData[]; error?: string }>
    import: (partition: string, cookies: CookieData[]) => Promise<{ ok: boolean; set: number }>
    clear: (partition: string) => Promise<{ ok: boolean; error?: string }>
    fixMismatch: (partition: string) => Promise<{ ok: boolean; removed: number; error?: string }>
  }
  openInChrome: (
    url: string,
    profileKey: string,
    title?: string,
    withDebug?: boolean
  ) => Promise<{ ok: boolean; error?: string }>
  pullChromeSession: (
    profileKey: string,
    partition: string
  ) => Promise<{ ok: boolean; total: number; set: number; error?: string }>
  mail: {
    setCred: (uuid: string, appPassword: string) => Promise<{ ok: boolean; error?: string }>
    hasCred: (uuid: string) => Promise<{ ok: boolean; has: boolean }>
    clearCred: (uuid: string) => Promise<{ ok: boolean; error?: string }>
    fetchVerification: (
      uuid: string,
      email: string
    ) => Promise<{ ok: boolean; error?: string; emails?: VerificationEmail[] }>
  }
  openExternal: (url: string) => Promise<{ ok: boolean; error?: string }>
}

export interface VerificationEmail {
  from: string
  subject: string
  date: number
  codes: string[]
  links: string[]
  snippet: string
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
