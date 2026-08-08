import { create } from 'zustand'

export interface OpenRequest {
  mode: 'single' | 'grid'
  uuids: string[]
}

interface UIState {
  /* uuid akun yang sedang dibuka di webview (single/grid) — untuk sidebar & badge */
  activeOpen: Set<string>
  setActiveOpen: (s: Set<string>) => void
  /* perintah lintas-komponen: minta buka akun (dipakai sidebar & overview) */
  openRequest: OpenRequest | null
  requestOpen: (r: OpenRequest) => void
  clearOpenRequest: () => void
}

export const useUI = create<UIState>((set) => ({
  activeOpen: new Set<string>(),
  setActiveOpen: (s) => set({ activeOpen: s }),
  openRequest: null,
  requestOpen: (r) => set({ openRequest: r }),
  clearOpenRequest: () => set({ openRequest: null })
}))
