'use client'

import { createPortal } from 'react-dom'

import useDOMQuerySelector from '@/hooks/useDOMQuerySelector'

export default function Portal({ portalKey, query, children }) {
  const [target] = useDOMQuerySelector(
    query,
    {
      waitForElements: true,
    },
    [portalKey]
  )

  return <>{target && createPortal(children, target, portalKey)}</>
}
