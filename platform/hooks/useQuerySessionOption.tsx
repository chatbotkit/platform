import { useEffect, useState } from 'react'

import { getSessionStorage } from '@/lib/browserstorage'

import useSearchParams from '@/hooks/useSearchParams'

function toSessionStorageKey(key: string) {
  return `session-options:${key}`
}

export default function useQuerySessionOption(
  key: string,
  { storageKey = toSessionStorageKey(key) }: { storageKey?: string } = {}
): string | undefined {
  const searchParams = useSearchParams()

  const queryValue = searchParams?.get(key) || undefined

  const [value, setValue] = useState<string | undefined>(queryValue)

  useEffect(() => {
    const sessionStorage = getSessionStorage()

    const nextValue =
      queryValue || sessionStorage.getItem(storageKey) || undefined

    setValue(nextValue)

    if (queryValue) {
      sessionStorage.setItem(storageKey, queryValue)
    }
  }, [queryValue, storageKey])

  return value
}
