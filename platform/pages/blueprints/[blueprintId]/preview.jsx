import '@xyflow/react/dist/style.css'

import { useMemo } from 'react'

import prisma from '@/prisma/client'

import { stripSensitiveFields } from '@/lib/blueprint.export'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Confirm from '@/components/Confirm'

import useCache from '@/hooks/useCache'

import { createClient } from '@/graphql/v1/client'
import {
  BlueprintProvider,
  Canvas,
  MODE_PUBLIC_PREVIEW,
  ResourcesContext,
  advancedResources,
  basicResources,
  buildAbilityResources,
  buildAllResources,
  buildNodeTypes,
  buildSecretResources,
  complianceResources,
  integrationResources,
} from '@/pages/blueprints/[blueprintId]/designer'

import { ReactFlowProvider } from '@xyflow/react'

import pluralize from 'pluralize'

/**
 * A read-only, embeddable preview of the blueprint canvas. It imports only
 * the canvas subset of the designer - the same pattern the hub and examples
 * designer previews use - so embedding it does not pull in the full designer
 * experience.
 */
export default function Page({ blueprint, controls = true }) {
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
        // @note degrade gracefully - the preview still renders the canvas
        // without the platform templates
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
            <Canvas
              className="w-screen h-screen"
              controls={controls}
              disabled={true}
            />
          </BlueprintProvider>
        </ResourcesContext.Provider>
      </ReactFlowProvider>
    </Confirm>
  )
}

export async function getServerSideProps(context) {
  const session = await getSoftSession(context.req, context.res)

  if (!session) {
    return {
      redirect: {
        destination: `/signin?callbackUrl=${context.resolvedUrl}`,
        permanent: false,
      },
    }
  }

  const blueprintId = context.query.blueprintId?.trim?.()

  if (!blueprintId) {
    return {
      notFound: true,
    }
  }

  const queryResources = {
    ...basicResources,
    ...advancedResources,
    ...complianceResources,
    ...integrationResources,
  }

  const blueprint = await prisma.blueprint.findUnique({
    where: {
      id: blueprintId,
    },

    include: {
      ...Object.fromEntries(
        Object.entries(queryResources).map(([type, { schema }]) => {
          const collection = pluralize(type, 2)

          return [
            collection,
            {
              select: {
                id: true,

                ...Object.fromEntries(
                  Object.entries(schema).map(([key]) => [key, true])
                ),
              },
            },
          ]
        })
      ),
    },
  })

  if (!blueprint) {
    return {
      notFound: true,
    }
  }

  if (blueprint.userId !== session.user.id) {
    return {
      notFound: true,
    }
  }

  // @note the preview is read only and does not need credentials - strip
  // every sensitive field before the blueprint leaves the server, the same
  // way the public hub preview does
  for (const type of Object.keys(queryResources)) {
    const collection = pluralize(type, 2)
    const items = blueprint[collection]

    if (!Array.isArray(items)) {
      continue
    }

    blueprint[collection] = items.map((item) =>
      stripSensitiveFields(item, 'public', type)
    )
  }

  return {
    props: makeJsonSafe(
      {
        blueprint,

        controls: context.query.controls !== 'false',
      },
      {
        unsafeKeys: null,
      }
    ),
  }
}
