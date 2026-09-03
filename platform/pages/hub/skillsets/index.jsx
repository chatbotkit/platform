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
          title={['Unleash The Power Of', 'Autonomous AI Agents']}
          description="Explore a collaborative space for expanding the capabilities of your conversational AI. Use skillsets to understand user intent, drive actions, and create more capable AI experiences."
          // @note compact drops the description to text-base - bump it back to
          // the lead-like scale used on the examples pages
          descriptionClassName="sm:text-lg md:text-xl [text-wrap:pretty]"
          compact="2xl"
        >
          <Link className="primary-button" href="/skillsets/new">
            Publish Skillset
          </Link>
          <Link className="default-button" href="/hub/skillsets/latest">
            Latest Skillsets
          </Link>
        </Hero>
      </section>
    </>
  )
}

export default function Index({ skillsets, headlineTitle, headlineText }) {
  return (
    <>
      <section className="section-gray-50">
        <div className="main-page">
          {headlineTitle && headlineText ? (
            <Headline title={headlineTitle}>{headlineText}</Headline>
          ) : null}
          <List>
            {skillsets.map(
              ({ id, name, description, slug, icon, createdAt }) => {
                name = name?.trim() || ''
                description = description?.trim() || ''

                return (
                  <List.Item
                    key={id}
                    className="!gap-4"
                    link={`/hub/skillsets/${slug || id}`}
                    icon={
                      <Emoji className="tinted-icon p-2 rounded-full border flex flex-row justify-center items-center w-12 h-12 text-2xl">
                        {text2emoji(
                          [icon, name, description],
                          'A skillset without description'
                        )}
                      </Emoji>
                    }
                    title={name || id}
                    body={
                      <div className="space-y-2">
                        <div className="line-clamp-2">
                          {description ? (
                            <span>{description}</span>
                          ) : (
                            <span className="italic">
                              A skillset without description
                            </span>
                          )}
                        </div>
                      </div>
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
      title="Skillsets"
      description="Dive into the world of ChatBotKit Hub - a collaborative platform for fine-tuning and expanding the capabilities of your conversational AI. Harness the power of skillsets to understand user intent, drive actions, and shape the future of AI communications."
      image={`/hub/skillsets/index/card`}
    >
      <PageHero />
      {children}
    </Hub>
  )
}

export async function getServerSideProps(context) {
  // @note set CDN cache headers to avoid hitting the server on every crawl
  applyCacheHeaders(context.res, CACHE_PRESETS.HUB_PAGE)

  const skillsets = await prisma.hubSkillsetPage.findMany({
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

  if (!skillsets.length) {
    return {
      redirect: {
        destination: `/hub/skillsets/latest`, // @todo get relative url
        permanent: false,
      },
    }
  }

  return {
    props: makeJsonSafe({
      skillsets: skillsets,
    }),
  }
}
