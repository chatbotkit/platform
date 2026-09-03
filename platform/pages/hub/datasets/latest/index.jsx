import hubConfig from '@/config/hub'

import prisma from '@/prisma/client'

import { CACHE_PRESETS, applyCacheHeaders } from '@/lib/cdn'
import { makeJsonSafe } from '@/lib/struct'

import { default as RealIndex } from '@/pages/hub/datasets/index'

export default function Index(props) {
  return <RealIndex {...props} />
}

Index.getLayout = RealIndex.getLayout

export async function getServerSideProps(context) {
  // @note set CDN cache headers to avoid hitting the server on every crawl
  applyCacheHeaders(context.res, CACHE_PRESETS.HUB_PAGE)

  const datasets = await prisma.hubDatasetPage.findMany({
    take: hubConfig.limits.take,

    orderBy: [
      {
        createdAt: 'desc',
      },
      {
        id: 'desc',
      },
      {
        rank: 'desc',
      },
    ],

    select: {
      id: true,

      name: true,
      description: true,

      slug: true,

      icon: true,
    },

    cacheStrategy: {
      // @todo improve the cache strategy

      swr: 60,
      ttl: 60,
    },
  })

  if (!datasets.length) {
    return {
      notFound: true,
    }
  }

  return {
    props: makeJsonSafe({
      datasets: datasets,
    }),
  }
}
