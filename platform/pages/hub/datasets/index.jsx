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
          title={['Enhance Your Chatbot', 'With Data-Driven Insights']}
          description="Explore a collaborative space for enriching your conversational AI. Use datasets to provide additional context, drive data-informed responses, and deliver more personalized experiences."
          // @note compact drops the description to text-base - bump it back to
          // the lead-like scale used on the examples pages
          descriptionClassName="sm:text-lg md:text-xl [text-wrap:pretty]"
          compact="2xl"
        >
          <Link className="primary-button" href="/datasets/new">
            Publish Dataset
          </Link>
          <Link className="default-button" href="/hub/datasets/latest">
            Latest Datasets
          </Link>
        </Hero>
      </section>
    </>
  )
}

export default function Index({ datasets, headlineTitle, headlineText }) {
  return (
    <>
      <section className="section-gray-50">
        <div className="main-page">
          {headlineTitle && headlineText ? (
            <Headline title={headlineTitle}>{headlineText}</Headline>
          ) : null}
          <List>
            {datasets.map(
              ({ id, name, description, slug, icon, createdAt }) => {
                name = name?.trim() || ''
                description = description?.trim() || ''

                return (
                  <List.Item
                    key={id}
                    className="!gap-4"
                    link={`/hub/datasets/${slug || id}`}
                    icon={
                      <Emoji className="tinted-icon p-2 rounded-full border flex flex-row justify-center items-center w-12 h-12 text-2xl">
                        {text2emoji(
                          [icon, name, description],
                          'A dataset without description'
                        )}
                      </Emoji>
                    }
                    title={name || id}
                    body={
                      description || (
                        <span className="italic">
                          A dataset without description
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
      title="Datasets"
      description="Step into the world of ChatBotKit Hub - your comprehensive platform for enriching the performance of your conversational AI. Leverage datasets to provide additional context, drive data-informed responses, and deliver a more personalized conversational experience."
      image={`/hub/datasets/index/card`}
    >
      <PageHero />
      {children}
    </Hub>
  )
}

export async function getServerSideProps(context) {
  // @note set CDN cache headers to avoid hitting the server on every crawl
  applyCacheHeaders(context.res, CACHE_PRESETS.HUB_PAGE)

  const datasets = await prisma.hubDatasetPage.findMany({
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

  if (!datasets.length) {
    return {
      redirect: {
        destination: `/hub/datasets/latest`, // @todo get relative url
        permanent: false,
      },
    }
  }

  return {
    props: makeJsonSafe({
      datasets: datasets,
    }),
  }
}
