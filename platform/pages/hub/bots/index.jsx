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
          title={['Build Your Own', 'AI-Powered Bot']}
          description="Discover a collaborative space that simplifies bot creation and helps you unlock the full potential of conversational AI. Create unique bots with personalized configurations and start building useful chatbot solutions."
          // @note compact drops the description to text-base - bump it back to
          // the lead-like scale used on the examples pages
          descriptionClassName="sm:text-lg md:text-xl [text-wrap:pretty]"
          compact="2xl"
        >
          <Link className="primary-button" href="/bots/new">
            Publish Bot
          </Link>
          <Link className="default-button" href="/hub/bots/latest">
            Latest Bots
          </Link>
        </Hero>
      </section>
    </>
  )
}

export default function Index({ bots, headlineTitle, headlineText }) {
  return (
    <>
      <section className="section-gray-50">
        <div className="main-page">
          {headlineTitle && headlineText ? (
            <Headline title={headlineTitle}>{headlineText}</Headline>
          ) : null}
          <List>
            {bots.map(({ id, name, description, slug, icon, createdAt }) => {
              name = name?.trim() || ''
              description = description?.trim() || ''

              return (
                <List.Item
                  key={id}
                  className="!gap-4"
                  link={`/hub/bots/${slug || id}`}
                  icon={
                    <Emoji className="tinted-icon p-2 rounded-full border flex flex-row justify-center items-center w-12 h-12 text-2xl">
                      {text2emoji(
                        [icon, name, description],
                        'A bot without description'
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
                            A bot without description
                          </span>
                        )}
                      </div>
                    </div>
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
      title="Bots"
      description="Venture into the realm of ChatBotKit Hub - a platform that simplifies bot creation and empowers you to unlock the full potential of conversational AI technology. Create unique bots with personalized configurations and start building tangible chatbot solutions today."
      image={`/hub/bots/index/card`}
    >
      <PageHero />
      {children}
    </Hub>
  )
}

export async function getServerSideProps(context) {
  // @note set CDN cache headers to avoid hitting the server on every crawl
  applyCacheHeaders(context.res, CACHE_PRESETS.HUB_PAGE)

  const bots = await prisma.hubBotPage.findMany({
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

  if (!bots.length) {
    return {
      redirect: {
        destination: `/hub/bots/latest`, // @todo get relative url
        permanent: false,
      },
    }
  }

  return {
    props: makeJsonSafe({
      bots: bots,
    }),
  }
}
