import { getStartOfDay } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import { CACHE_PRESETS, applyCacheHeaders } from '@/lib/cdn'
import { getEnclosure } from '@/lib/rss'
import { makeJsonSafe } from '@/lib/struct'

import { toXML } from 'jstoxml'

const MAX_FEED_ITEMS = 10

export default function Index() {}

export async function getServerSideProps(context) {
  const all = await prisma.hubBotPage.findMany({
    take: MAX_FEED_ITEMS,

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

      createdAt: true,
    },

    cacheStrategy: {
      // @todo improve the cache strategy

      swr: 60,
      ttl: 60,
    },
  })

  const today = getStartOfDay().toUTCString()

  context.res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8')

  applyCacheHeaders(context.res, CACHE_PRESETS.RSS)

  const xmlOptions = {
    header: true,
    indent: '  ',
  }

  context.res.write(
    toXML(
      {
        _name: 'rss',
        _attrs: {
          version: '2.0',
          'xmlns:atom': 'http://www.w3.org/2005/Atom',
          'xmlns:media': 'http://search.yahoo.com/mrss/',
        },
        _content: {
          channel: [
            {
              title: 'ChatBotKit Latest Hub Bots',
            },
            {
              description: `The latest bots on the ChatBotKit Hub`,
            },
            {
              link: `${process.env.SITE_URL}/hub/bots/latest`,
            },
            {
              'atom:link': {
                _attrs: {
                  href: `${process.env.SITE_URL}/hub/bots/latest/rss.xml`,
                  rel: 'self',
                  type: 'application/rss+xml',
                },
              },
            },
            {
              lastBuildDate: () => today,
            },
            {
              pubDate: () => today,
            },
            {
              language: 'en',
            },
            ...all.map((item) => ({
              item: [
                {
                  title: item.name,
                },
                {
                  description: item.description,
                },
                {
                  link: `${process.env.SITE_URL}/hub/bots/${
                    item.slug || item.id
                  }`,
                },
                ...getEnclosure(item),
                {
                  pubDate: () => new Date(item.createdAt).toUTCString(),
                },
              ],
            })),
          ],
        },
      },
      xmlOptions
    )
  )

  context.res.end()

  return {
    props: makeJsonSafe({}),
  }
}
