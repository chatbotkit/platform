import { useEffect, useState } from 'react'

import fetch from '@/lib/fetch'

export type ModelType = 'language' | 'image' | 'video' | 'rerank'

type AvailableModels = {
  ids: string[]
  defaultId: string | null
}

// @note one fetch per model type per page load, shared by every selector
// instance; a failed fetch clears its entry so the next mount retries
const caches = new Map<ModelType, Promise<AvailableModels | null>>()

/** Test seam - clears the shared caches. */
export function _resetAvailableModelsCache(): void {
  caches.clear()
}

function load(type: ModelType): Promise<AvailableModels | null> {
  let cached = caches.get(type)

  if (!cached) {
    cached = fetch(`/api/v1/platform/model/list?type=${type}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const items = data?.items

        if (!Array.isArray(items)) {
          caches.delete(type)

          return null
        }

        return {
          ids: items.map(({ id }: { id: string }) => id),
          defaultId:
            items.find(({ default: isDefault }: { default?: boolean }) => {
              return isDefault
            })?.id ?? null,
        }
      })
      .catch(() => {
        caches.delete(type)

        return null
      })

    caches.set(type, cached)
  }

  return cached
}

function useLoaded(type: ModelType): AvailableModels | null {
  const [available, setAvailable] = useState<AvailableModels | null>(null)

  useEffect(() => {
    let canceled = false

    void load(type).then((loaded) => {
      if (!canceled) {
        setAvailable(loaded)
      }
    })

    return () => {
      canceled = true
    }
  }, [type])

  return available
}

/**
 * The model names this deployment can actually serve, resolved at runtime by
 * the platform model list API. Null while loading or when the list cannot be
 * fetched - callers should fall back to the compiled catalogue.
 */
export default function useAvailableModels(
  type: ModelType = 'language'
): string[] | null {
  return useLoaded(type)?.ids ?? null
}

/**
 * The deployment's real default model of a type, resolved at runtime by the
 * platform model list API. The compiled default is a compile-time guess - the
 * browser bundle always sees the full catalogue - so it holds only as the
 * fallback while this is null (loading, fetch failure, or a deployment that
 * serves no default).
 */
export function useAvailableDefaultModel(
  type: ModelType = 'language'
): string | null {
  return useLoaded(type)?.defaultId ?? null
}
