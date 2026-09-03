import hubConfig from '@/config/hub'

import prisma from '@/prisma/client'

import { CACHE_PRESETS, applyCacheHeaders } from '@/lib/cdn'
import { text2emoji } from '@/lib/emoji'
import { makeJsonSafe } from '@/lib/struct'

import Hub from '@/layouts/Hub'

import Emoji from '@/components/Emoji'
import Headline from '@/components/Headline'
import Hero from '@/components/Hero'
import Link from '@/components/Link'
import List from '@/components/List'

export function PageHero() {
  return (
    <>
      <section className="section-white">
        <Hero
          title={['Enhance Your Bot', 'With AI Widgets']}
          description="Create and share beautiful AI widgets that enhance your website and application functionality."
          // @note compact drops the description to text-base - bump it back to
          // the lead-like scale used on the examples pages
          descriptionClassName="sm:text-lg md:text-xl [text-wrap:pretty]"
          compact="2xl"
        >
          <Link className="primary-button" href="/integrations/widget/new">
            Publish Widget
          </Link>
          <Link className="default-button" href="/hub/widgets/latest">
            Latest Widgets
          </Link>
        </Hero>
      </section>
    </>
  )
}

export default function Index({ widgets, headlineTitle, headlineText }) {
  return (
    <>
      <section className="section-gray-50">
        <div className="main-page">
          {headlineTitle && headlineText ? (
            <Headline title={headlineTitle}>{headlineText}</Headline>
          ) : null}
          <List>
            {widgets.map(({ id, name, description, slug, icon, createdAt }) => {
              name = name?.trim() || ''
              description = description?.trim() || ''

              return (
                <List.Item
                  key={id}
                  className="!gap-4"
                  link={`/hub/widgets/${slug || id}`}
                  icon={
                    <Emoji className="tinted-icon p-2 rounded-full border flex flex-row justify-center items-center w-12 h-12 text-2xl">
                      {text2emoji(
                        [icon, name, description],
                        'A widget without description'
                      )}
                    </Emoji>
                  }
                  title={name || id}
                  body={
                    description || (
                      <span className="italic">
                        A widget without description
                      </span>
                    )
                  }
                  timestamp={createdAt}
                />
              )
            })}
          </List>
        </div>
      </section>
    </>
  )
}

Index.getLayout = function (children) {
  return (
    <Hub
      title="Widgets"
      description="Create and share beautiful AI widgets."
      image={`/hub/widgets/index/card`}
    >
      <PageHero />
      {children}
    </Hub>
  )
}

export async function getServerSideProps(context) {
  // @note set CDN cache headers to avoid hitting the server on every crawl
  applyCacheHeaders(context.res, CACHE_PRESETS.HUB_PAGE)

  const widgets = await prisma.hubWidgetPage.findMany({
    where: {
      rank: {
        gte: 1000,
      },
    },

    take: hubConfig.limits.take,

    orderBy: [
      {
        rank: 'desc',
      },
      {
        createdAt: 'desc',
      },
      {
        id: 'desc',
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

  if (!widgets.length) {
    return {
      redirect: {
        destination: `/hub/widgets/latest`, // @todo get relative url
        permanent: false,
      },
    }
  }

  return {
    props: makeJsonSafe({
      widgets: widgets,
    }),
  }
}
