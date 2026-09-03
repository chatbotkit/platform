import { getStartOfDay } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import { CACHE_PRESETS, applyCacheHeaders } from '@/lib/cdn'
import { makeJsonSafe } from '@/lib/struct'

import { toXML } from 'jstoxml'

const MAX_FEED_ITEMS = 10

export default function Index() {}

export async function getServerSideProps(context) {
  const blueprintId = context.query.blueprintId?.trim?.()

  if (!blueprintId) {
    return {
      notFound: true,
    }
  }

  // @note fetch the hub page and verify shareLog is enabled
  const instance = await prisma.hubBlueprintPage.findFirst({
    where: {
      OR: [{ id: blueprintId }, { slug: blueprintId }],
    },

    select: {
      id: true,

      name: true,
      description: true,

      slug: true,

      shareLog: true,

      blueprint: {
        select: {
          id: true,
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

  // @note only allow access if shareLog is enabled
  if (!instance.shareLog) {
    return {
      notFound: true,
    }
  }

  const conversations = await prisma.conversation.findMany({
    where: {
      bot: {
        blueprintId: instance.blueprint.id,
      },
    },

    orderBy: [
      {
        createdAt: 'desc',
      },
    ],

    take: MAX_FEED_ITEMS,

    select: {
      id: true,

      name: true,
      description: true,

      createdAt: true,
    },

    cacheStrategy: {
      ttl: 60,
      swr: 60,
    },
  })

  const today = getStartOfDay().toUTCString()

  const blueprintSlug = instance.slug || instance.id

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
              title: `${instance.name || 'Blueprint'} Conversations`,
            },
            {
              description: `Recent conversations with the ${
                instance.name || 'Blueprint'
              } agent on ChatBotKit Hub`,
            },
            {
              link: `${process.env.SITE_URL}/hub/blueprints/${blueprintSlug}`,
            },
            {
              'atom:link': {
                _attrs: {
                  href: `${process.env.SITE_URL}/hub/blueprints/${blueprintSlug}/conversations/rss.xml`,
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
            ...conversations.map((item) => ({
              item: [
                {
                  title: item.name || 'Untitled Conversation',
                },
                {
                  description:
                    item.description || 'A conversation with the agent',
                },
                {
                  link: `${process.env.SITE_URL}/hub/blueprints/${blueprintSlug}/conversations/${item.id}`,
                },
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
