'use client'

import { createContext, useContext } from 'react'

export const BlueprintContext = createContext(null)

export function useBlueprintContext() {
  const context = useContext(BlueprintContext)

  if (!context) {
    throw new Error('useBlueprintContext must be used within BlueprintProvider')
  }

  return context
}
