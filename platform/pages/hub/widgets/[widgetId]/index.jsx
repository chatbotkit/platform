import { useMemo } from 'react'

import demos from '@/data/demos.yaml'

import prisma from '@/prisma/client'

import { splitHalf } from '@/lib/array'
import { CACHE_PRESETS, applyCacheHeaders } from '@/lib/cdn'
import { text2emoji } from '@/lib/emoji'
import { makeJsonSafe } from '@/lib/struct'

import Hub from '@/layouts/Hub'

import Emoji from '@/components/Emoji'
import FAQ from '@/components/FAQ3'
import Headline from '@/components/Headline'
import Link from '@/components/Link'
import List from '@/components/List'
import StructuredData from '@/components/StructuredData'
import WidgetsScreen from '@/components/WidgetsScreen'

import useSession from '@/hooks/useSession'

import faq from '@/content/faqs/platform-integrations-widget.yaml'

import { UserCircleIcon } from '@heroicons/react/24/solid'

import clsx from 'clsx'

export function PageHero({ instance, widgetOptions }) {
  const { data: session } = useSession()

  const widget = useMemo(() => {
    return {
      ...widgetOptions,
      ...instance.widget,
    }
  }, [instance, widgetOptions])

  let title

  {
    const [t, st] = splitHalf(
      (instance.name || instance.widget.title || '').split(/\s+/g) || ''
    )

    title = [t.join?.(' '), st.join?.(' ')]
  }

  let description

  {
    description = instance.description
  }

  return (
    <>
      <section className="section-white">
        <WidgetsScreen
          // @note this page had no h1 at all - WidgetsScreen spreads props into
          // MovingScreen, which defaults titleAs to h2. Every sibling hub detail
          // page renders its title through Hero, which defaults to h1, so this
          // brings the widget page in line.
          title={title}
          titleAs="h1"
          description={description}
          descriptionAs={({ className, children }) => (
            <p className={clsx(className, 'line-clamp-3')}>{children}</p>
          )}
          widgets={[widget]}
          actions={
            <>
              {instance.user.id === session?.user?.id ? (
                <Link
                  className="default-button"
                  href={`/widgets/${instance.id}`}
                >
                  Edit
                </Link>
              ) : (
                // @note cloning runs through the /new wizard (templates/hub.js)
                // so it lands on the same success step as every other setup -
                // that step owns where each experience goes next
                <Link
                  className="default-button"
                  href={`/new?${new URLSearchParams({
                    template: 'hub',
                    widgetId: instance.id,
                  })}`}
                >
                  Clone
                </Link>
              )}
            </>
          }
          content={
            <>
              <div className="flex flex-row justify-center items-center space-x-4">
                <span>created by</span>
                <Link
                  className="relative group/tooltip"
                  href={`/hub/users/${instance.user.id}`}
                >
                  {instance.user.image ? (
                    <img
                      className="rounded-full w=10 h-10 inline"
                      src={instance.user.image}
                      alt={instance.user.name}
                    />
                  ) : (
                    <UserCircleIcon className="h-8 w-8" />
                  )}
                  {instance.user.name ? (
                    <span className="tooltip top-2 w-24">
                      {instance.user.name}
                    </span>
                  ) : null}
                </Link>
              </div>
            </>
          }
          layout="flex"
          movingScreenContainerMinHeight="1200px"
          movingScreenExposeMaxHeight="100%"
        />
      </section>
    </>
  )
}

function IntegrationSteps({ instance }) {
  const steps = [
    {
      title: 'Clone the Widget',
      description:
        'Clone the widget to your account and add any customizations.',
    },
    {
      title: 'Create a Bot',
      description:
        'Select the bot you want to connect to the widget or create a new bot.',
    },
    {
      title: 'Connect the Widget',
      description:
        'Select the bot from the list of available bots and connect it to the widget.',
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

export default function Index({ instance, related, widgetOptions }) {
  return (
    <>
      <PageHero instance={instance} widgetOptions={widgetOptions} />
      <section className="section-gray-50">
        <IntegrationSteps instance={instance} />
      </section>
      {related.length > 0 ? (
        <section className="section-gray-100">
          <div className="main-page">
            <Headline title="Related Widgets">
              Explore other widgets created by the same author.
            </Headline>
            <List>
              {related.map(({ id, name, description, slug, icon }) => {
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
                      <div className="space-y-2">
                        <div className="line-clamp-2">
                          {description ? (
                            <span>{description}</span>
                          ) : (
                            <span className="italic">
                              A widget without description
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
      breadcrumbs={['Widgets', 'Hub', 'ChatBotKit']}
      title={instance.name || instance.id}
      description={instance.description || instance.name || instance.id}
      image={`/hub/widgets/${instance.slug || instance.id}/card`}
    >
      <StructuredData
        data={{
          '@context': 'https://schema.org/',
          '@type': 'SoftwareApplication',
          url: `/hub/widgets/${
            instance.slug || instance.id
          }`,
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
              name: 'Widgets',
              item: '/hub/widgets',
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
  const instanceId = context.query.widgetId?.trim?.()

  if (!instanceId) {
    return {
      notFound: true,
    }
  }

  // @note set CDN cache headers to avoid hitting the server on every crawl
  applyCacheHeaders(context.res, CACHE_PRESETS.HUB_PAGE)

  const instance = await prisma.hubWidgetPage.findFirst({
    where: {
      OR: [{ id: instanceId }, { slug: instanceId }],
    },

    select: {
      id: true,

      name: true,
      description: true,

      slug: true,

      icon: true,

      widget: {
        select: {
          title: true,
          intro: true,
          initial: true,
          theme: true,
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

  // @note we use Promise.all instead of prisma.$transaction here because these
  // are read-only queries that don't require ACID consistency. Using a
  // transaction holds a single database connection for all queries, which can
  // lead to connection timeouts. With Promise.all, each query uses its own
  // connection and can complete independently.

  const [related, latest] = await Promise.all([
    prisma.hubWidgetPage.findMany({
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

    prisma.hubWidgetPage.findMany({
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

      related: uniqueRelated.slice(0, 10),

      widgetOptions: {
        ...demos.default,
      },
    }),
  }
}
