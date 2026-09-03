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
          title={['Enhance Your Agents', 'With AI Blueprints']}
          description="Create and share agentic AI solutions that enhance your business processes and customer experiences."
          // @note compact drops the description to text-base - bump it back to
          // the lead-like scale used on the examples pages
          descriptionClassName="sm:text-lg md:text-xl [text-wrap:pretty]"
          compact="2xl"
        >
          <Link className="primary-button" href="/blueprints/new">
            Publish Blueprint
          </Link>
          <Link className="default-button" href="/hub/blueprints/latest">
            Latest Blueprints
          </Link>
        </Hero>
      </section>
    </>
  )
}

export default function Index({ blueprints, headlineTitle, headlineText }) {
  return (
    <>
      <section className="section-gray-50">
        <div className="main-page">
          {headlineTitle && headlineText ? (
            <Headline title={headlineTitle}>{headlineText}</Headline>
          ) : null}
          <List>
            {blueprints.map(
              ({ id, name, description, slug, icon, createdAt }) => {
                name = name?.trim() || ''
                description = description?.trim() || ''

                return (
                  <List.Item
                    key={id}
                    className="!gap-4"
                    link={`/hub/blueprints/${slug || id}`}
                    icon={
                      <Emoji className="tinted-icon p-2 rounded-full border flex flex-row justify-center items-center w-12 h-12 text-2xl">
                        {text2emoji(
                          [icon, name, description],
                          'A blueprint without description'
                        )}
                      </Emoji>
                    }
                    title={name || id}
                    body={
                      description || (
                        <span className="italic">
                          A blueprint without description
                        </span>
                      )
                    }
                    timestamp={createdAt}
                  />
                )
              }
            )}
          </List>
        </div>
      </section>
    </>
  )
}

Index.getLayout = function (children) {
  return (
    <Hub
      title="Blueprints"
      description="Create and share agentic AI solutions"
      image={`/hub/blueprints/index/card`}
    >
      <PageHero />
      {children}
    </Hub>
  )
}

export async function getServerSideProps(context) {
  // @note set CDN cache headers to avoid hitting the server on every crawl
  applyCacheHeaders(context.res, CACHE_PRESETS.HUB_PAGE)

  const blueprints = await prisma.hubBlueprintPage.findMany({
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

  if (!blueprints.length) {
    return {
      redirect: {
        destination: `/hub/blueprints/latest`, // @todo get relative url
        permanent: false,
      },
    }
  }

  return {
    props: makeJsonSafe({
      blueprints: blueprints,
    }),
  }
}
