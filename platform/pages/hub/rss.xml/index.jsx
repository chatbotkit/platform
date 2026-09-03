import { getStartOfDay } from '@chatbotkit-dev/time'

import { CACHE_PRESETS, applyCacheHeaders } from '@/lib/cdn'
import { getItems } from '@/lib/hub'
import { getEnclosure } from '@/lib/rss'
import { makeJsonSafe } from '@/lib/struct'

import { toXML } from 'jstoxml'

const MAX_FEED_ITEMS = 10

export default function Index() {}

export async function getServerSideProps(context) {
  const all = await getItems()

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
              title: 'ChatBotKit Hub',
            },
            {
              description: `Embark on a journey of innovation with ChatBotKit Hub - your collaborative nexus for discovering, sharing, and evolving the frontier of conversational AI technology.`,
            },
            {
              link: `${process.env.SITE_URL}/hub`,
            },
            {
              'atom:link': {
                _attrs: {
                  href: `${process.env.SITE_URL}/hub/rss.xml`,
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
            ...all
              .filter((item) => !!item.createdAt)
              .slice(0, MAX_FEED_ITEMS)
              .map((item) => ({
                item: [
                  {
                    title: item.title,
                  },
                  {
                    description: item.description,
                  },
                  {
                    link: `${process.env.SITE_URL}/hub/${item.type}s/${
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
