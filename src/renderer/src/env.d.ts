/// <reference types="vite/client" />

/* Method elemen <webview> Electron yang dipakai aplikasi.
   (@types/react sudah menyediakan atribut JSX untuk <webview>.) */
export interface WebviewTag extends HTMLElement {
  src: string
  setZoomFactor(factor: number): void
  getURL(): string
  reload(): void
  goBack(): void
  goForward(): void
}
