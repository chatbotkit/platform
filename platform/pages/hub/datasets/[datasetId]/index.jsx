import { useMemo } from 'react'

import datasetsConfig from '@/config/datasets'

import prisma from '@/prisma/client'

import { applyCacheHeaders, CACHE_PRESETS } from '@/lib/cdn'
import { text2emoji } from '@/lib/emoji'
import { makeJsonSafe } from '@/lib/struct'

import Hub from '@/layouts/Hub'

import ConversationManager from '@/components/ConversationManager'
import Emoji from '@/components/Emoji'
import Expando from '@/components/Expando'
import FAQ from '@/components/FAQ'
import ForwardButton from '@/components/ForwardButton'
import Headline from '@/components/Headline'
import Hero from '@/components/Hero'
import Link from '@/components/Link'
import List, { ListItem } from '@/components/List'
import ObjectView from '@/components/ObjectView'
import StructuredData from '@/components/StructuredData'

import useSession from '@/hooks/useSession'

import faq from '@/content/faqs/platform-dataset-instance.yaml'

import { UserCircleIcon } from '@heroicons/react/24/solid'

export function Chat({ instance, children }) {
  const { data: session } = useSession()

  const { backstory, model } = useMemo(() => {
    return {
      backstory: `${datasetsConfig.defaultTestBackstory}\n\nDataset Name: ${instance.name}\nDataset Description: ${instance.description}`,

      model: datasetsConfig.defaultTestModel,
    }
  }, [instance.name, instance.description])

  return (
    <>
      <ConversationManager
        conversationCreateEndpoint={`/v1/hub/dataset/${instance.id}/session/create`}
        backstory={backstory}
        model={model}
        autoStart={true}
        autoAddBackstory={false}
        advancedOptions={false}
        stream={true}
        verbose={instance.user.id === session?.user?.id}
        conversationLink={true}
        situationLink={true}
      />
      <div>{children}</div>
    </>
  )
}

export function Records({ instance }) {
  return (
    <>
      <div>
        <List>
          {instance.records.map((record) => {
            return (
              <ListItem
                key={record.id}
                className="cursor-default"
                body={<span className="notranslate">record.text</span>}
              >
                <Expando titleClassName="text-sm default-link" title="Record">
                  <ObjectView className="text-xs" object={record} />
                </Expando>
              </ListItem>
            )
          })}
        </List>
      </div>
    </>
  )
}

function IntegrationSteps({ instance }) {
  const steps = [
    {
      title: 'Clone the Dataset',
      description:
        'Clone the dataset to your account and add any customizations.',
    },
    {
      title: 'Create a Bot',
      description:
        'Select the bot you want to connect to the dataset or create a new bot.',
    },
    {
      title: 'Connect the Dataset',
      description:
        'Select the dataset from the list of available datasets and connect it to the bot.',
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

export default function Index({ instance, related }) {
  return (
    <>
      <section className="section-gray-100" id="chat">
        <div className="main-page">
          <Headline title="Dataset Chat">
            Chat with this dataset to see how it works.
          </Headline>
          <Chat key={instance.id} instance={instance} />
        </div>
      </section>
      {instance.records.length > 0 ? (
        <section className="section-white">
          <div className="main-page">
            <Headline title="Dataset Records">
              Learn how this dataset works and how to use it.
            </Headline>
            <Records instance={instance} />
          </div>
        </section>
      ) : null}
      <section className="section-gray-50">
        <IntegrationSteps instance={instance} />
      </section>
      {related.length > 0 ? (
        <section className="section-gray-100">
          <div className="main-page">
            <Headline title="Related Datasets">
              Explore other datasets created by the same author.
            </Headline>
            <List>
              {related.map(({ id, name, description, slug, icon }) => {
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
                      <div className="space-y-2">
                        <div className="line-clamp-2">
                          {description ? (
                            <span>{description}</span>
                          ) : (
                            <span className="italic">
                              A dataset without description
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
      breadcrumbs={['Datasets', 'Hub', 'ChatBotKit']}
      title={instance.name || instance.id}
      description={instance.description || instance.name || instance.id}
      image={`/hub/datasets/${instance.slug || instance.id}/card`}
    >
      <StructuredData
        data={{
          '@context': 'https://schema.org/',
          '@type': 'SoftwareApplication',
          url: `/hub/datasets/${
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
              name: 'Datasets',
              item: '/hub/datasets',
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: instance.name || instance.id,
            },
          ],
        }}
      />
      <PageHero dataset={instance} />
      {children}
      <FAQ faq={faq} />
    </Hub>
  )
}

export function PageHero({ dataset }) {
  const { data: session } = useSession()

  return (
    <>
      <section className="section-gray-50">
        <Hero
          splitTitle={dataset.name || 'A dataset without name'}
          description={dataset.description}
        >
          <div className="space-y-10 w-full">
            <div className="flex flex-row justify-center items-center space-x-2">
              <span>created by</span>
              <Link
                className="relative group/tooltip"
                href={`/hub/users/${dataset.user.id}`}
              >
                {dataset.user.image ? (
                  <img
                    className="rounded-full w=10 h-10 inline"
                    src={dataset.user.image}
                    alt={dataset.user.name}
                  />
                ) : (
                  <UserCircleIcon className="h-8 w-8" />
                )}
                {dataset.user.name ? (
                  <span className="tooltip top-2 w-24">
                    {dataset.user.name}
                  </span>
                ) : null}
              </Link>
            </div>
            <div className="space-x-2">
              <ForwardButton
                className="primary-button"
                type="button"
                onClick={() => {
                  const node = document.querySelector('#chat')

                  node.querySelector('textarea').focus()

                  node.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                    inline: 'center',
                  })
                }}
              >
                Try Now
              </ForwardButton>
              {dataset.user.id === session?.user?.id ? (
                <Link
                  className="default-button"
                  href={`/datasets/${dataset.id}`}
                >
                  Edit
                </Link>
              ) : (
                // @note disabled because it does not make sense at the moment
                // @todo enable this when the feature is ready - the wizard
                // already handles the dataset case (templates/hub.js)
                true || (
                  <Link
                    className="default-button"
                    href={`/new?${new URLSearchParams({
                      template: 'hub',
                      datasetId: dataset.id,
                    })}`}
                  >
                    Clone
                  </Link>
                )
              )}
            </div>
          </div>
        </Hero>
      </section>
    </>
  )
}

export async function getServerSideProps(context) {
  const datasetId = context.query.datasetId?.trim?.()

  if (!datasetId) {
    return {
      notFound: true,
    }
  }

  // @note set CDN cache headers to avoid hitting the server on every crawl
  applyCacheHeaders(context.res, CACHE_PRESETS.HUB_PAGE)

  const instance = await prisma.hubDatasetPage.findFirst({
    where: {
      OR: [{ id: datasetId }, { slug: datasetId }],
    },

    select: {
      id: true,

      name: true,
      description: true,

      slug: true,

      icon: true,

      dataset: {
        select: {
          id: true,
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

  // @note fetch records from the store instead of Prisma

  const { getStore } = await import('@/lib/store.types')

  const store = await getStore()

  const recordsResult = await store.listRecords({
    datasetId: instance.dataset.id,
    limit: 3,
  })

  instance.records = recordsResult.records.map((record) => ({
    id: record.id,
    text: record.text,
  }))

  // @note we use Promise.all instead of prisma.$transaction here because these
  // are read-only queries that don't require ACID consistency. Using a
  // transaction holds a single database connection for all queries, which can
  // lead to connection timeouts. With Promise.all, each query uses its own
  // connection and can complete independently.

  const [related, latest] = await Promise.all([
    prisma.hubDatasetPage.findMany({
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

    prisma.hubDatasetPage.findMany({
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
    }),
  }
}
