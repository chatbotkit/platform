import '@xyflow/react/dist/style.css'

import { useEffect, useMemo, useState } from 'react'

import { useRouter } from 'next/router'

import { QUARTER_HOUR_IN_MILLISECONDS } from '@chatbotkit-dev/time'

import { getPlatformGraphQLClient } from '@/lib/cbk.graphql'
import { captureException } from '@/lib/error'
import fetch, { withNextCache } from '@/lib/fetch'
import { makeJsonSafe } from '@/lib/struct'

import Confirm from '@/components/Confirm'

import {
  BlueprintProvider,
  Canvas,
  ResourcesContext,
  buildAbilityResources,
  buildAllResources,
  buildNodeTypes,
  buildSecretResources,
} from '@/pages/blueprints/[blueprintId]/designer'

import { ReactFlowProvider } from '@xyflow/react'

import yaml from 'js-yaml'
import pluralize from 'pluralize'

// @note the blueprint is passed as a JSON string via the `blueprint` query
// parameter and parsed client-side, while the known platform resources
// (abilities/secrets) are prefetched server-side via getServerSideProps

export default function Page({
  controls = true,
  platformAbilitiesData = {},
  platformSecretsData = {},
}) {
  const router = useRouter()

  const [hash, setHash] = useState('')

  useEffect(() => {
    setHash(window.location.hash)
  }, [])

  // @note supports both fragment identifiers and query params for passing
  // blueprint data - fragments are preferred because they stay client-side

  const blueprint = useMemo(() => {
    if (!router.isReady) {
      return null
    }

    let raw = null

    if (hash) {
      const params = new URLSearchParams(hash.slice(1))

      raw = params.get('blueprint')
    }

    if (!raw) {
      raw = router.query.blueprint
    }

    if (!raw) {
      return null
    }

    try {
      const parsed = yaml.load(raw)

      // @note transform from export format (resources map with type/data
      // pairs) to the internal format expected by BlueprintProvider
      // (collection arrays + config)
      if (parsed.resources) {
        return {
          ...Object.entries(parsed.resources).reduce(
            (acc, [id, { type, data }]) => {
              const category = pluralize(type, 2)

              if (!acc[category]) {
                acc[category] = []
              }

              acc[category].push({ id, ...data })

              return acc
            },
            {}
          ),

          config: {
            positions: parsed.positions,
            notes: parsed.notes,
            images: parsed.images,
            frames: parsed.frames,
            tools: parsed.tools,
          },
        }
      }

      return parsed
    } catch {
      return null
    }
  }, [router.isReady, router.query.blueprint, hash])

  const abilityResources = useMemo(
    () => buildAbilityResources(platformAbilitiesData, platformSecretsData),
    [platformAbilitiesData, platformSecretsData]
  )

  const secretResources = useMemo(
    () => buildSecretResources(platformSecretsData),
    [platformSecretsData]
  )

  const allResources = useMemo(
    () => buildAllResources(abilityResources, secretResources),
    [abilityResources, secretResources]
  )

  const nodeTypes = useMemo(
    () => buildNodeTypes(allResources, abilityResources, secretResources),
    [allResources, abilityResources, secretResources]
  )

  const resourcesContext = useMemo(
    () => ({
      allResources,
      abilityResources,
      secretResources,
      nodeTypes,
    }),
    [allResources, abilityResources, secretResources, nodeTypes]
  )

  if (!blueprint) {
    return null
  }

  return (
    <Confirm>
      <ReactFlowProvider>
        <ResourcesContext.Provider value={resourcesContext}>
          <BlueprintProvider blueprint={blueprint} disabled={true}>
            <div className="relative w-screen h-screen">
              <Canvas
                className="w-full h-full"
                controls={controls}
                disabled={true}
              />
            </div>
          </BlueprintProvider>
        </ResourcesContext.Provider>
      </ReactFlowProvider>
    </Confirm>
  )
}

export async function getServerSideProps(context) {
  let platformAbilitiesData = {}
  let platformSecretsData = {}

  try {
    const client = await getPlatformGraphQLClient({
      fetchFn: withNextCache(fetch, {
        tags: ['platformAbilities', 'platformSecrets'],
        ttl: QUARTER_HOUR_IN_MILLISECONDS,
      }),
    })

    const data = await client.platformTemplates()

    platformAbilitiesData = Object.fromEntries(
      (data?.platformAbilities?.edges || [])
        .map((edge) => edge.node)
        .filter((item) => item?.id)
        .map((item) => [
          item.template,
          {
            name: item.name ?? '',
            description: item.description ?? '',
            instruction: item.instruction ?? '',
            properties: item.schema?.properties || {},
            icon: item.icon ?? null,
            commentary: item.commentary ?? null,
            setup: item.setup ?? null,
            tags: Array.isArray(item.tags) ? item.tags : [],
            secret: item.secret ?? null,
            file: item.file ?? null,
            space: item.space ?? null,
            bot: item.bot ?? null,
          },
        ])
    )

    platformSecretsData = Object.fromEntries(
      (data?.platformSecrets?.edges || [])
        .map((edge) => edge.node)
        .filter((item) => item?.id)
        .map((item) => [
          item.template,
          {
            name: item.name ?? '',
            description: item.description ?? '',
            type: item.type ?? 'basic',
            kind: item.kind ?? 'personal',
            config: item.config ?? null,
            icon: item.icon ?? null,
            commentary: item.commentary ?? null,
            setup: item.setup ?? null,
            tags: Array.isArray(item.tags) ? item.tags : [],
          },
        ])
    )
  } catch (error) {
    await captureException(error)
  }

  return {
    props: makeJsonSafe(
      {
        controls: context.query.controls !== 'false',

        platformAbilitiesData,
        platformSecretsData,
      },
      {
        unsafeKeys: null,
      }
    ),
  }
}

/**
 * @doc Blueprint Embed Preview
 * @description Embed a live, read-only blueprint canvas diagram into any webpage or application using a simple iframe.
 * @category Tools
 * @tags blueprint, embed, iframe, preview, canvas, visual
 * @icon heroicons/squares-2x2
 * @index 501
 * @date 2026-03-03
 *
 * The Blueprint Embed Preview is designed to be dropped into an `<iframe>`. It renders a full-screen, read-only blueprint canvas - the same visual diagram you see inside the platform - powered entirely by a URL. No login, no integration code, just a URL with the blueprint data encoded in it.
 *
 * ## Embedding with an iframe
 *
 * Construct the URL by taking the base path and appending the blueprint JSON as the `blueprint` query parameter. Then point an iframe at it:
 *
 * ```html
 * <iframe
 *   src="https://chatbotkit.com/playground/blueprint/embed/preview?blueprint=<encoded-json>"
 *   width="100%"
 *   height="600"
 *   frameborder="0"
 * />
 * ```
 *
 * The canvas fills the entire iframe and is interactive - visitors can pan and zoom to explore the blueprint - but cannot make any changes.
 *
 * ## URL Parameters
 *
 * - **`blueprint`** *(required)* - The blueprint to render, as a URL-encoded JSON or YAML string. Can be passed as a query parameter or as a fragment identifier (e.g. `#blueprint=<encoded>`). Fragment identifiers are preferred because they keep the data client-side.
 * - **`controls`** *(optional)* - Set to `false` to hide the pan/zoom controls. Useful for tighter embed layouts where you want a cleaner look.
 *
 * ## Common Use Cases
 *
 * **Documentation and guides**: Embed live blueprint diagrams directly in docs, tutorials, or blog posts so readers can see exactly how an agent is structured.
 *
 * **Shareable previews**: Send a URL to a teammate or customer that opens a visual snapshot of a blueprint - no platform access needed on their end.
 *
 * **Builder tools and integrations**: Any tool that generates or modifies blueprints can render an instant visual preview by pointing an iframe at this URL.
 */
