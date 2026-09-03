import type { ReactNode } from 'react'
import { useCallback, useState } from 'react'

import { captureUnknownError, codeFromError } from '@/lib/response'

import CodeAction from '@/components/CodeAction'

type ErrorInput = unknown

export default function useCodeAction(): [
  ReactNode | null,
  (error: ErrorInput) => void,
] {
  const [updateCounter, setUpdateCounter] = useState(0)

  const [code, setCode] = useState<string | null>(null)

  const codeAction = code ? (
    <CodeAction key={`${code}-${updateCounter}`} code={code} />
  ) : null

  const setError = useCallback((error: ErrorInput): void => {
    setUpdateCounter((updateCounter) => updateCounter + 1)

    void captureUnknownError(error)

    if (typeof error === 'string') {
      setCode(error)
    } else {
      setCode(codeFromError(error))
    }
  }, [])

  return [codeAction, setError]
}
