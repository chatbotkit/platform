import { getStartOfDay } from '@chatbotkit-dev/time'

import { CACHE_PRESETS, applyCacheHeaders } from '@/lib/cdn'
import { getExampleHref, getSortedExamples } from '@/lib/example.fetch'
import { getEnclosure } from '@/lib/rss'
import { makeJsonSafe } from '@/lib/struct'

import { toXML } from 'jstoxml'

const MAX_FEED_ITEMS = 10

export default function Index() {}

export async function getServerSideProps(context) {
  const all = getSortedExamples()

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
              title: 'ChatBotKit Examples',
            },
            {
              description:
                'Explore the possibilities of conversational AI technology with our collection of chatbot examples. Let your imagination run wild and discover new ideas as you learn and experiment in our virtual environment.',
            },
            {
              link: `${process.env.SITE_URL}/examples`,
            },
            {
              'atom:link': {
                _attrs: {
                  href: `${process.env.SITE_URL}/examples/rss.xml`,
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
              // @note hub examples stay in the feed with their /examples/<slug>
              // link, which redirects to the hub - consistent with other items
              .filter((item) => !!item.date)
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
                    // @note hub examples link straight to the hub page
                    link: `${process.env.SITE_URL}${getExampleHref(item)}`,
                  },
                  ...getEnclosure(item),
                  {
                    pubDate: () => new Date(item.date).toUTCString(),
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
