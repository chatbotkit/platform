import '@xyflow/react/dist/style.css'

import { useMemo } from 'react'

import { getExampleBySlug } from '@/lib/example.fetch'
import { makeJsonSafe } from '@/lib/struct'

import Confirm from '@/components/Confirm'
import ForwardLink from '@/components/ForwardLink'

import useCache from '@/hooks/useCache'

import { createClient } from '@/graphql/v1/client'
import {
  BlueprintProvider,
  Canvas,
  MODE_PUBLIC_PREVIEW,
  ResourcesContext,
  buildAbilityResources,
  buildAllResources,
  buildNodeTypes,
  buildSecretResources,
} from '@/pages/blueprints/[blueprintId]/designer'

import { ReactFlowProvider } from '@xyflow/react'

import pluralize from 'pluralize'

export default function Page({
  blueprint,
  controls = true,
  showLink = false,
  slug,
}) {
  const { data: platformTemplatesData } = useCache(
    'blueprint.designer.platformTemplates',
    async () => {
      const client = createClient({
        endpoint: new URL('/api/v1/graphql', window.location.origin).href,
      })

      // @todo come up with a better way to fetch the templates

      try {
        return await client.platformTemplates()
      } catch (e) {
        // @note silently ignore 401/403 errors - this is a public page where
        // authentication is optional, so unauthenticated users are expected. a
        // 403 happens when the request reaches the CSRF/protection check without
        // the X-Requested-With header (e.g. a proxy/extension strips it), which
        // for an optional-auth read is the same "not authed" case as a 401.
        if (e?.response?.status === 401 || e?.response?.status === 403) {
          return null
        }

        throw e
      }
    },
    {
      ttl: 30 * 60 * 1000, // cache for 30 minutes
      staleWhileRevalidate: true,
    },
    []
  )

  const platformAbilitiesData = useMemo(() => {
    if (!platformTemplatesData) {
      return {}
    }

    return Object.fromEntries(
      (platformTemplatesData?.platformAbilities?.edges || [])
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
  }, [platformTemplatesData])

  const platformSecretsData = useMemo(() => {
    if (!platformTemplatesData) {
      return {}
    }

    return Object.fromEntries(
      (platformTemplatesData?.platformSecrets?.edges || [])
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
  }, [platformTemplatesData])

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
      mode: MODE_PUBLIC_PREVIEW,
    }),
    [allResources, abilityResources, secretResources, nodeTypes]
  )

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
              {showLink ? (
                <div className="absolute left-5 bottom-5">
                  <ForwardLink
                    className="default-button"
                    href={`/examples/${slug}`}
                    target="_blank"
                  >
                    See this example
                  </ForwardLink>
                </div>
              ) : null}
            </div>
          </BlueprintProvider>
        </ResourcesContext.Provider>
      </ReactFlowProvider>
    </Confirm>
  )
}

export async function getServerSideProps(context) {
  const example = getExampleBySlug(context.params.slug)

  if (!example) {
    return {
      notFound: true,
    }
  }

  if (!example.blueprint) {
    return {
      notFound: true,
    }
  }

  const blueprint = {
    ...Object.entries(example.blueprint.resources).reduce(
      (acc, [id, { type, data }]) => {
        const category = pluralize(type, 2)

        if (!acc[category]) {
          acc[category] = []
        }

        acc[category].push({
          id,

          ...data,
        })

        return acc
      },
      {}
    ),

    config: {
      positions: example.blueprint.positions,

      notes: example.blueprint.notes,
      images: example.blueprint.images,
      frames: example.blueprint.frames,

      tools: example.blueprint.tools,
    },
  }

  return {
    props: makeJsonSafe(
      {
        blueprint: blueprint,

        controls: context.query.controls !== 'false',

        showLink: context.query.showLink === 'true',

        slug: context.params.slug,
      },
      {
        unsafeKeys: null,
      }
    ),
  }
}
