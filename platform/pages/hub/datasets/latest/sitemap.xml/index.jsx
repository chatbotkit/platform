import { getServerSideSitemapLegacy } from 'next-sitemap'

import { getStartOfDay } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

export default function Index() {}

export async function getServerSideProps(context) {
  const all = await prisma.hubDatasetPage.findMany({
    take: 100,

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

      createdAt: true,
    },

    cacheStrategy: {
      // @todo improve the cache strategy

      swr: 60,
      ttl: 60,
    },
  })

  if (!all.length) {
    return {
      notFound: true,
    }
  }

  const today = getStartOfDay().toISOString()

  return getServerSideSitemapLegacy(
    context,
    all.map((item) => {
      return {
        loc: `${process.env.SITE_URL}/hub/datasets/${item.slug || item.id}`,
        lastmod: item.createdAt
          ? new Date(item.createdAt).toISOString()
          : today,
      }
    })
  )
}
