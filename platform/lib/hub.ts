import hubConfig from '@/config/hub'

import prisma from '@/prisma/client'

type HubItem = {
  id: string
  name: string
  description: string
  slug: string | null
  icon: string | null
  type: string
  rank?: number
  createdAt?: Date
  user: {
    name: string | null
    image: string | null
  }
}

const hubPageSelect = {
  id: true,

  name: true,
  description: true,

  slug: true,
  icon: true,

  user: {
    select: {
      name: true,
      image: true,
    },
  },
} as const

const hubPageOrderBy = [
  {
    rank: 'desc' as const,
  },
  {
    createdAt: 'desc' as const,
  },
  {
    // @note important for deterministic ordering
    id: 'desc' as const,
  },
]

const hubPageCacheStrategy = {
  // @todo improve the cache strategy

  swr: 60,
  ttl: 60,
}

function createHubPageQuery(ids: string[]) {
  return {
    where: {
      OR: [
        {
          slug: {
            in: ids,
          },
        },
        {
          id: {
            in: ids,
          },
        },
        {
          rank: {
            gte: 1000,
          },
        },
      ],
    },

    select: hubPageSelect,
    orderBy: hubPageOrderBy,
    take: hubConfig.limits.take,
    cacheStrategy: hubPageCacheStrategy,
  }
}

/**
 * Fetches all hub items (bots, datasets, skillsets, widgets, blueprints)
 * sorted by rank then creation date.
 */
export async function getItems(): Promise<HubItem[]> {
  const botIds: string[] = []
  const datasetIds: string[] = []
  const skillsetIds: string[] = []
  const widgetIds: string[] = []
  const blueprintIds: string[] = []

  const [bots, datasets, skillsets, widgets, blueprints] = await Promise.all([
    prisma.hubBotPage.findMany(createHubPageQuery(botIds)),
    prisma.hubDatasetPage.findMany(createHubPageQuery(datasetIds)),
    prisma.hubSkillsetPage.findMany(createHubPageQuery(skillsetIds)),
    prisma.hubWidgetPage.findMany(createHubPageQuery(widgetIds)),
    prisma.hubBlueprintPage.findMany(createHubPageQuery(blueprintIds)),
  ])

  return ([] as HubItem[])
    .concat(
      bots.map((b) => ({ ...b, type: 'bot' })),
      datasets.map((d) => ({ ...d, type: 'dataset' })),
      skillsets.map((s) => ({ ...s, type: 'skillset' })),
      widgets.map((w) => ({ ...w, type: 'widget' })),
      blueprints.map((b) => ({ ...b, type: 'blueprint' }))
    )
    .sort((a, b) => {
      if (a.rank !== b.rank) {
        return (b.rank || 0) - (a.rank || 0)
      }

      if (a.createdAt !== b.createdAt) {
        return (
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
        )
      }

      return b.id.localeCompare(a.id)
    })
    .slice(0, hubConfig.limits.take)
}
