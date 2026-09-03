import '@xyflow/react/dist/style.css'

import prisma from '@/prisma/client'

import { CACHE_PRESETS, applyCacheHeaders } from '@/lib/cdn'
import { text2emoji } from '@/lib/emoji'
import { makeJsonSafe } from '@/lib/struct'

import Hub from '@/layouts/Hub'

import Emoji from '@/components/Emoji'
import FAQ from '@/components/FAQ3'
import ForwardLink from '@/components/ForwardLink'
import Headline from '@/components/Headline'
import Hero from '@/components/Hero'
import Link from '@/components/Link'
import List from '@/components/List'
import StructuredData from '@/components/StructuredData'

import {
  useApexHostURL,
  usePortalApex,
  useSpaceApex,
} from '@/hooks/useHostname'
import useSession from '@/hooks/useSession'

import faq from '@/content/faqs/platform-blueprints.yaml'

import { UserCircleIcon } from '@heroicons/react/24/solid'

export function PageHero({ instance }) {
  const portalApex = usePortalApex()

  const spaceApex = useSpaceApex()

  const toApexHostURL = useApexHostURL()

  const { data: session } = useSession()

  const site = instance.blueprint?.spaces?.flatMap(
    (space) => space.sites || []
  )?.[0]

  const portal = instance.blueprint?.portals?.[0]

  // @note sites take priority over portals for the public visit link
  const visitHref =
    site && spaceApex
      ? toApexHostURL(site.slug, spaceApex)
      : portal
        ? toApexHostURL(portal.slug, portalApex)
        : null

  return (
    <>
      <section className="section-white">
        <Hero
          className="mx-auto"
          icon={instance.icon}
          splitTitle={instance.name || 'A blueprint without name'}
          description={instance.description}
          // @note compact drops the description to text-base - bump it back to
          // the lead-like scale used on the examples pages
          descriptionClassName="sm:text-lg md:text-xl [text-wrap:pretty]"
          compact="7xl"
        >
          <div className="flex flex-col sm:flex-row gap-4 justify-left">
            {instance.user.id === session?.user?.id ? (
              <Link className="primary-button" href={`/bots/${instance.id}`}>
                Edit
              </Link>
            ) : (
              // @note cloning runs through the /new wizard (templates/hub.js)
              // so it lands on the same success step as every other setup -
              // that step owns where each experience goes next
              <Link
                className="primary-button"
                href={`/new?${new URLSearchParams({
                  template: 'hub',
                  blueprintId: instance.id,
                })}`}
              >
                Clone
              </Link>
            )}
            {visitHref ? (
              <ForwardLink
                className="default-button"
                href={visitHref}
                target="_blank"
              >
                Visit
              </ForwardLink>
            ) : null}
          </div>
        </Hero>
      </section>
      <section className="section-white skip-border">
        <div className="main-page main-page-7xl pt-0">
          <div className="relative">
            <iframe
              key={instance.id}
              className="w-full aspect-video rounded-xl border border-gray-200 dark:border-gray-800"
              src={`/hub/blueprints/${instance.slug || instance.id}/designer`}
            />
            <div className="absolute left-5 top-5">
              <Link
                className="default-button flex flex-row items-center gap-2"
                href={`/hub/users/${instance.user.id}`}
              >
                {instance.user.image ? (
                  <img
                    className="rounded-full w-6 h-6"
                    src={instance.user.image}
                    alt={instance.user.name}
                  />
                ) : (
                  <UserCircleIcon className="w-6 h-6" />
                )}
                <span>created by {instance.user.name || 'Anonymous'}</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

function IntegrationSteps({ instance }) {
  const steps = [
    {
      title: 'Clone the Blueprint',
      description:
        'Clone the blueprint to your account and add any customizations.',
    },
    {
      title: 'Add Integrations',
      description:
        'Add integrations to the blueprint to connect it to other systems',
    },
    {
      title: 'Save the Blueprint',
      description:
        'Make sure you save the blueprint with the changes you made.',
    },
  ]

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 space-y-14">
      <div className="mx-auto max-w-xl text-center">
        <h2 className="mega-title">
          Integration <span className="heading-highlight">Steps</span>
        </h2>
        <p className="mx-auto mt-3 md:mt-5 max-w-md md:max-w-4xl text-base sm:text-lg md:text-xl text-gray-500 dark:text-gray-500">
          Follow these three simple steps to add{' '}
          <span className="font-semibold">{instance.name}</span> to your bot or
          any bespoke ChatBotKit integration.
        </p>
      </div>
      <div className="mx-auto max-w-2xl space-y-6">
        {steps.map((step, index) => (
          <div key={index} className="flex items-start">
            <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 bg-gray-100 dark:bg-gray-900 rounded-full mr-4">
              <span className="font-semibold text-lg">{index + 1}</span>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
              <p className="text-gray-500 dark:text-gray-500">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RecentConversations({ instance, conversations }) {
  if (!conversations || conversations.length === 0) {
    return null
  }

  return (
    <div className="main-page">
      <Headline title="Recent Activities">
        Explore recent activities powered by this blueprint.
      </Headline>
      <List>
        {conversations.map(({ id, name, description, createdAt }) => {
          name = name?.trim() || ''
          description = description?.trim() || ''

          return (
            <List.Item
              key={id}
              className="!gap-4"
              link={`/hub/blueprints/${
                instance.slug || instance.id
              }/conversations/${id}`}
              // icon={
              //   <Emoji className="tinted-icon p-2 rounded-full border flex flex-row justify-center items-center w-12 h-12 text-2xl">
              //     💬
              //   </Emoji>
              // }
              title={name || 'Untitled Conversation'}
              body={
                <div className="space-y-2">
                  <div className="line-clamp-2">
                    {description ? (
                      <span>{description}</span>
                    ) : (
                      <span className="italic">No description</span>
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
  )
}

export default function Index({ instance, related, conversations }) {
  return (
    <>
      <PageHero instance={instance} />
      {conversations?.length > 0 ? (
        <section className="section-gray-50">
          <RecentConversations
            instance={instance}
            conversations={conversations}
          />
        </section>
      ) : null}
      <section className="section-gray-50">
        <IntegrationSteps instance={instance} />
      </section>
      {related.length > 0 ? (
        <section className="section-gray-100">
          <div className="main-page">
            <Headline title="Related Blueprints">
              Explore other blueprints created by the same author.
            </Headline>
            <List>
              {related.map(({ id, name, description, slug, icon }) => {
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
                      <div className="space-y-2">
                        <div className="line-clamp-2">
                          {description ? (
                            <span>{description}</span>
                          ) : (
                            <span className="italic">
                              A blueprint without description
                            </span>
                          )}
                        </div>
                      </div>
                    }
                  />
                )
              })}
            </List>
          </div>
        </section>
      ) : null}
    </>
  )
}

Index.getLayout = function (children, { instance }) {
  return (
    <Hub
      breadcrumbs={['Blueprints', 'Hub', 'ChatBotKit']}
      title={instance.name || instance.id}
      description={instance.description || instance.name || instance.id}
      image={`/hub/blueprints/${instance.slug || instance.id}/card`}
      rss={
        instance.shareLog
          ? `/hub/blueprints/${
              instance.slug || instance.id
            }/conversations/rss.xml`
          : undefined
      }
    >
      <StructuredData
        data={{
          '@context': 'https://schema.org/',
          '@type': 'SoftwareApplication',
          url: `/hub/blueprints/${instance.slug || instance.id}`,
          name: instance.name,
          description: instance.description,
          applicationCategory: 'AI Chatbot',
          operatingSystem: 'All',
          // @todo replace with real user ratings to avoid Google structured data policy violations
          // aggregateRating: {
          //   '@type': 'AggregateRating',
          //   ratingValue: '4.7',
          //   ratingCount: Math.round(
          //     (DAYS_SINCE_EPOCH +
          //       parseInt(instance.id.replace(/\D/g, '').slice(0, 5), 10)) *
          //       0.01
          //   ),
          // },
          offers: {
            '@type': 'Offer',
            price: '0.00',
            priceCurrency: 'USD',
          },
        }}
      />
      <StructuredData
        data={{
          '@context': 'https://schema.org/',
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Hub',
              item: '/hub',
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Blueprints',
              item: '/hub/blueprints',
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: instance.name || instance.id,
            },
          ],
        }}
      />
      {children}
      <section className="section">
        <FAQ faq={faq} title="Frequently Asked Questions" />
      </section>
    </Hub>
  )
}

export async function getServerSideProps(context) {
  // @note set CDN cache headers to avoid hitting the server on every crawl
  applyCacheHeaders(context.res, CACHE_PRESETS.HUB_PAGE)

  const instanceId = context.query.blueprintId?.trim?.()

  if (!instanceId) {
    return {
      notFound: true,
    }
  }

  const instance = await prisma.hubBlueprintPage.findFirst({
    where: {
      OR: [{ id: instanceId }, { slug: instanceId }],
    },

    select: {
      id: true,

      name: true,
      description: true,

      slug: true,

      icon: true,

      shareLog: true,

      blueprint: {
        select: {
          id: true,

          name: true,
          description: true,

          portals: {
            select: {
              id: true,

              slug: true,
            },

            orderBy: {
              createdAt: 'asc',
            },

            take: 1,
          },

          spaces: {
            select: {
              id: true,

              sites: {
                select: {
                  slug: true,
                },

                orderBy: {
                  createdAt: 'asc',
                },

                take: 1,
              },
            },

            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      },

      user: {
        select: {
          id: true,

          name: true,
          image: true,
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

  const conversations = instance.shareLog
    ? await prisma.conversation.findMany({
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

        take: 10,

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
    : []

  // @note we use Promise.all instead of prisma.$transaction here because these
  // are read-only queries that don't require ACID consistency. Using a
  // transaction holds a single database connection for all queries, which can
  // lead to connection timeouts. With Promise.all, each query uses its own
  // connection and can complete independently.

  const [related, latest] = await Promise.all([
    prisma.hubBlueprintPage.findMany({
      where: {
        userId: instance.user.id,

        id: {
          not: instance.id,
        },
      },

      orderBy: [
        {
          createdAt: 'desc',
        },
      ],

      take: 10,

      select: {
        id: true,

        name: true,
        description: true,

        slug: true,

        icon: true,
      },

      cacheStrategy: {
        ttl: 60,
        swr: 60,
      },
    }),

    prisma.hubBlueprintPage.findMany({
      where: {
        id: {
          not: instance.id,
        },
      },

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

      take: 5,

      select: {
        id: true,

        name: true,
        description: true,

        slug: true,

        icon: true,
      },

      cacheStrategy: {
        swr: 60,
        ttl: 60,
      },
    }),
  ])

  const uniqueRelated = [
    ...new Map([].concat(related, latest).map((i) => [i.id, i])).values(),
  ]

  return {
    props: makeJsonSafe({
      instance,

      conversations,

      related: uniqueRelated.slice(0, 10),
    }),
  }
}
