'use client'

import Portal from '@/components/Portal'

import useDOMQuerySelector from '@/hooks/useDOMQuerySelector'

export function useGlobalRootDiv() {
  const [globalRoot] = useDOMQuerySelector('#global-root', {
    waitForElements: true,
  })

  return globalRoot
}

export function GlobalRootPortal({ children }) {
  return <Portal query="#global-root">{children}</Portal>
}

export default function GlobalRoot() {
  return <div id="global-root" />
}

GlobalRoot.Portal = GlobalRootPortal
