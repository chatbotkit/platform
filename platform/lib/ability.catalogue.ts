import abilities from '@/data/abilities/visible'

import { match } from '@/lib/glob'
import { buildTemplateInstruction } from '@/lib/instruction.template.parse'

/**
 * Finds all abilities from the catalogue whose names matched the given glob
 * pattern. Optionally filters results to only include abilities that match
 * specific categories (abilities with names ending in `[category]` format).
 */
export function findManyByGlob(
  glob: string,
  options?: {
    // only include abilities matching these categories
    categories?: string[]

    // if true, excludes all categories instead of including
    excludeAllCategories?: boolean
  }
): Record<string, (typeof abilities)[string]> {
  if (!glob) {
    return {}
  }

  const result: Record<string, (typeof abilities)[string]> = {}

  for (const [name, ability] of Object.entries(abilities)) {
    if (match(name, glob)) {
      if (options?.excludeAllCategories) {
        // @note exclude any ability that has a category (ends with [category])
        if (!name.match(/\[.+\]$/)) {
          result[name] = ability
        }
      } else if (options?.categories) {
        for (const category of options.categories) {
          if (name.endsWith(`[${category}]`)) {
            result[name] = ability
          }
        }
      } else {
        result[name] = ability
      }
    }
  }

  return result
}

/**
 * Imports abilities matching the given glob pattern. Each ability is enriched
 * with optional name/description prefixes and suffixes, and includes a
 * generated instruction built from the ability's template key and params.
 */
export function importManyByGlob(
  glob: string,
  options?: {
    // only include abilities matching these categories
    categories?: string[]

    // if true, excludes all categories instead of including
    excludeAllCategories?: boolean

    params?: Record<string, string>

    namePrefix?: string
    nameSuffix?: string

    descriptionPrefix?: string
    descriptionSuffix?: string
  }
): Array<{ name: string; description: string; instruction: string }> {
  return Object.entries(
    findManyByGlob(glob, {
      categories: options?.categories,
      excludeAllCategories: options?.excludeAllCategories,
    })
  ).map(([key, { name, description }]) => ({
    name: [options?.namePrefix, name, options?.nameSuffix]
      .filter(Boolean)
      .join(' '),
    description: [
      options?.descriptionPrefix,
      description,
      options?.descriptionSuffix,
    ]
      .filter(Boolean)
      .join('\n\n'),
    instruction: buildTemplateInstruction({
      template: key,
      params: options?.params,
    }),
  }))
}
