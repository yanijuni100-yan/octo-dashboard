import { useEffect, useState } from 'react'
import { useStore } from '../lib/store'

export default function Toast(): JSX.Element {
  const msg = useStore((s) => s.toastMsg)
  const seq = useStore((s) => s.toastSeq)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!seq) return
    setShow(true)
    const t = setTimeout(() => setShow(false), 2600)
    return () => clearTimeout(t)
  }, [seq])

  return <div className={'toast' + (show ? '' : ' hidden')}>{msg}</div>
}
