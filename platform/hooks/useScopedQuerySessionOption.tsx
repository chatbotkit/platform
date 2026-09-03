import { useEffect, useState } from 'react'

import useQuerySessionOption from '@/hooks/useQuerySessionOption'

function getRandomScopeName() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `cbk-frame:${crypto.randomUUID()}`
  }

  return `cbk-frame:${Math.random().toString(36).slice(2)}`
}

function getOrCreateWindowScopeName() {
  if (typeof window === 'undefined') {
    return undefined
  }

  if (window.name) {
    return window.name
  }

  const scopeName = getRandomScopeName()

  window.name = scopeName

  return scopeName
}

export default function useScopedQuerySessionOption(
  key: string
): string | undefined {
  const [scopeName, setScopeName] = useState<string | undefined>(() => {
    return getOrCreateWindowScopeName()
  })

  useEffect(() => {
    if (scopeName) {
      return
    }

    setScopeName(getOrCreateWindowScopeName())
  }, [scopeName])

  return useQuerySessionOption(key, {
    storageKey: scopeName ? `session-options:${scopeName}:${key}` : undefined,
  })
}
