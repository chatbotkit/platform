import '@/lib/scope.server'

import abilityTemplateData, { type AbilityTemplate } from '@/data/abilities/all'

import debug from '@/lib/debug'

/**
 * The function gets an instruction that points to a template and returns the a
 * template instruction object if found.
 */
export function unpackTemplateInstruction(id: string): AbilityTemplate | null {
  debug(`unpack template instruction`, { id })

  const lookup = id.trim().toLowerCase()

  return (
    Object.entries(abilityTemplateData).find(([id]) => id === lookup)?.[1] ||
    null
  )
}
