import { useEffect, useState } from 'react'
import { useStore } from './lib/store'
import { useUI } from './lib/ui'
import { applyTheme, currentTheme } from './lib/theme'
import BgOrbs from './components/BgOrbs'
import Toast from './components/Toast'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import Overview from './views/Overview'
import Profiles from './views/Profiles'
import Proxies from './views/Proxies'
import Automation from './views/Automation'
import Settings from './views/Settings'
import type { ViewName } from './lib/types'

export default function App(): JSX.Element {
  const [view, setView] = useState<ViewName>('overview')
  const notice = useStore((s) => s.notice)
  const loadProfiles = useStore((s) => s.loadProfiles)
  const restoreCloudSession = useStore((s) => s.restoreCloudSession)
  const openRequest = useUI((s) => s.openRequest)

  // Inisialisasi sekali
  useEffect(() => {
    applyTheme(currentTheme())
    loadProfiles()
    restoreCloudSession()
    const onErr = (e: ErrorEvent): void =>
      useStore.getState().setNotice('⚠ Terjadi error: ' + e.message)
    window.addEventListener('error', onErr)
    return () => window.removeEventListener('error', onErr)
  }, [loadProfiles, restoreCloudSession])

  // Permintaan buka akun (dari sidebar / overview) → pindah ke tab Profil
  useEffect(() => {
    if (openRequest && view !== 'profiles') setView('profiles')
  }, [openRequest, view])

  return (
    <>
      <BgOrbs />
      <div id="app">
        <Sidebar view={view} onNav={setView} />
        <main className="main">
          <Topbar view={view} onNav={setView} />
          {notice ? <div className="notice">{notice}</div> : null}
          <div style={{ display: view === 'overview' ? 'block' : 'none' }}>
            <Overview onNav={setView} />
          </div>
          {view === 'profiles' && <Profiles />}
          {view === 'proxies' && <Proxies />}
          {view === 'automation' && <Automation />}
          {view === 'settings' && <Settings />}
        </main>
      </div>
      <Toast />
    </>
  )
}
