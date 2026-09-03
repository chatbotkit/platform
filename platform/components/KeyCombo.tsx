import type { HTMLAttributes } from 'react'
import { useEffect, useState } from 'react'

export interface KeyComboProps extends HTMLAttributes<HTMLSpanElement> {
  secondKey: string
}

export default function KeyCombo({ secondKey, ...props }: KeyComboProps) {
  const [isMac, setIsMac] = useState(false)

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0)
    }
  }, [])

  return (
    <span {...props}>
      <kbd>{isMac ? '⌘' : 'CTRL'}</kbd> + <kbd>{secondKey}</kbd>
    </span>
  )
}
