import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import type * as React from 'react'
import { isElectron } from '../lib/storage'
import type { WebviewTag } from '../env'

interface NavEvent {
  url?: string
}

// Kontrol navigasi yang dibuka ke komponen induk (untuk tombol ◀ Kembali / ▶ Maju / ⟳ Muat ulang).
export interface WebviewHandle {
  goBack: () => void
  goForward: () => void
  reload: () => void
}

interface WebviewPaneProps {
  src: string
  partition: string
  zoom?: number
  onUrl?: (url: string) => void
  className?: string
}

const WebviewPane = forwardRef<WebviewHandle, WebviewPaneProps>(function WebviewPane(
  { src, partition, zoom = 1, onUrl, className },
  ref
): JSX.Element {
  const innerRef = useRef<WebviewTag | null>(null)

  // Buka kontrol navigasi ke induk. Dibungkus try/catch kalau webview belum siap / tak ada riwayat.
  useImperativeHandle(ref, () => ({
    goBack: () => {
      try {
        innerRef.current?.goBack()
      } catch {
        /* abaikan */
      }
    },
    goForward: () => {
      try {
        innerRef.current?.goForward()
      } catch {
        /* abaikan */
      }
    },
    reload: () => {
      try {
        innerRef.current?.reload()
      } catch {
        /* abaikan */
      }
    }
  }))

  useEffect(() => {
    const wv = innerRef.current
    if (!wv || !isElectron) return
    const upd = (ev: Event): void => onUrl?.((ev as unknown as NavEvent).url || '')
    const domReady = (): void => {
      try {
        wv.setZoomFactor(zoom)
      } catch {
        /* abaikan */
      }
    }
    wv.addEventListener('did-navigate', upd)
    wv.addEventListener('did-navigate-in-page', upd)
    wv.addEventListener('dom-ready', domReady)
    return () => {
      wv.removeEventListener('did-navigate', upd)
      wv.removeEventListener('did-navigate-in-page', upd)
      wv.removeEventListener('dom-ready', domReady)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onUrl])

  useEffect(() => {
    const wv = innerRef.current
    if (wv && isElectron) {
      try {
        wv.setZoomFactor(zoom)
      } catch {
        /* abaikan */
      }
    }
  }, [zoom])

  if (!isElectron) {
    return <iframe className={className} src={src} referrerPolicy="no-referrer" />
  }
  return (
    <webview
      ref={innerRef as unknown as React.Ref<HTMLWebViewElement>}
      className={className}
      src={src}
      partition={partition}
      allowpopups={true}
    />
  )
})

export default WebviewPane
