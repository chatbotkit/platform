import type { StoreConfig } from '@/lib/app.context'

import { z } from 'zod'

const FeaturesSchema = z.object({
  features: z
    .object({
      conversation: z
        .object({
          detailed: z.boolean().optional(),
          meta: z.boolean().optional(),
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
