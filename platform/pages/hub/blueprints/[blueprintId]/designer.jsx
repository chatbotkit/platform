import '@xyflow/react/dist/style.css'

import { useMemo } from 'react'

import prisma from '@/prisma/client'

import { stripSensitiveFields } from '@/lib/blueprint.export'
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

export default function Page({ blueprint }) {
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
            <Canvas className="w-screen h-screen" disabled={true} />
          </BlueprintProvider>
        </ResourcesContext.Provider>
      </ReactFlowProvider>
    </Confirm>
  )
}

export async function getServerSideProps(context) {
  const instanceId = context.query.blueprintId?.trim?.()

  if (!instanceId) {
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

  const instance = await prisma.hubBlueprintPage.findFirst({
    where: {
      OR: [{ id: instanceId }, { slug: instanceId }],
    },

    select: {
      id: true,

      name: true,
      description: true,

      slug: true,

      icon: true,

      blueprint: {
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
      },

      user: {
        select: {
          id: true,

          name: true,
          image: true,
        },
      },
    },

    cacheStrategy: {
      ttl: 60,
      swr: 60,
    },
  })

  if (!instance) {
    return {
      notFound: true,
    }
  }

  // @note this is a public preview, so strip every credential/token field
  // across all resources (secret values, integration auth tokens, the github
  // App private key/webhook secret, …) before the blueprint leaves the platform.
  // Reuses the same `public` export sensitivity the JSON/terraform exports use so
  // the "what is a credential" definition can't drift between them.
  for (const type of Object.keys(queryResources)) {
    const collection = pluralize(type, 2)
    const items = instance.blueprint[collection]

    if (!Array.isArray(items)) {
      continue
    }

    instance.blueprint[collection] = items.map((item) =>
      stripSensitiveFields(item, 'public', type)
    )
  }

  // @todo anonymize the ids

  return {
    props: makeJsonSafe(
      {
        blueprint: instance.blueprint,
      },
      {
        unsafeKeys: null,
      }
    ),
  }
}
