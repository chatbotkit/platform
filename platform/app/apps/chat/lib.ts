import type { StoreConfig } from '@/lib/app.context'

import type ConfigSchema from './config'

import { z } from 'zod'

const FeaturesSchema = z.object({
  features: z
    .object({
      references: z
        .object({
          force: z.boolean().optional(),
        })
        .optional(),

      search: z
        .object({
          multi: z.boolean().optional(),
        })
        .optional(),

      feedback: z
        .object({
          reason: z.boolean().optional(),
        })
        .optional(),

      promptImprovement: z
        .object({
          enabled: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
})

export type Features = z.infer<typeof FeaturesSchema>['features']

export function getFeatures(config: StoreConfig): Features | null {
  const { success, data } = FeaturesSchema.safeParse(config || {})

  if (success) {
    if ('features' in data && data.features !== undefined) {
      return data.features
    } else {
      return null
    }
  } else {
    return null
  }
}

/**
 * Determine whether the Chat app should run in ephemeral mode (conversations
 * are not persisted and no history sidebar is shown).
 *
 * Priority order:
 *   1. An explicit `ephemeral` flag is always authoritative.
 *   2. Embedded surfaces (`_embed`) are always ephemeral - they are inline /
 *      debugging views that must not spawn a dedicated conversation or
 *      navigate away, so the embed signal overrides `save: true`.
 *   3. An explicit `save` flag decides for top-level usage.
 *   4. Otherwise default to persistent.
 *
 * Callers pass the embed state as `embedded` so that, by default, embedded
 * chats are ephemeral while top-level chats follow the configured `save`.
 */
export function isEphemeral(
  config: z.infer<typeof ConfigSchema>,
  embedded: boolean = false
): boolean {
  if ('ephemeral' in config) {
    return Boolean(config.ephemeral)
  }

  if (embedded) {
    return true
  }

  if ('save' in config) {
    return !Boolean(config.save)
  }

  return false
}
