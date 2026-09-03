import { useCallback } from 'react'

import useProjectScope from './useProjectScope'

export function scopeCreateData(data, scope) {
  if (!data || !scope?.id || data.blueprintId) {
    return data
  }

  return {
    ...data,
    blueprintId: scope.id,
  }
}

export default function useScopedCreateData() {
  const { scope } = useProjectScope()

  return useCallback((data) => scopeCreateData(data, scope), [scope])
}
