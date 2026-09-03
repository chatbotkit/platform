import { useMemo, useState } from 'react'

import { defaultLanguageModel } from '@/config/models'

import prisma from '@/prisma/client'

import { CACHE_PRESETS, applyCacheHeaders } from '@/lib/cdn'
import { text2emoji } from '@/lib/emoji'
import { parseAndRevealLanguageModel } from '@/lib/model.utils'
import { makeJsonSafe } from '@/lib/struct'

import Hub from '@/layouts/Hub'

import CodeAction from '@/components/CodeAction'
import CodeBlock from '@/components/CodeBlock'
import { useConfirm } from '@/components/Confirm'
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

import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'
import useSession from '@/hooks/useSession'

import faq from '@/content/faqs/platform-bot-instance.yaml'
import {
  ConfigWrapper,
  IntlWrapper,
  ModalWrapper,
  Popup,
  ResizeWrapper,
  StateWrapper,
  ThemeWrapper,
} from '@/pages/integrations/widget/[widgetIntegrationId]/frame'

import { UserCircleIcon } from '@heroicons/react/24/solid'

export function Chat({ instance, children }) {
  const { data: session } = useSession()

  const integration = useMemo(() => {
    return instance.bot.widgetIntegrations?.[0]
  }, [instance])

  const theme = useMemo(() => {
    return instance.bot.widgetIntegrations?.[0]?.theme
  }, [instance])

  const [conversationId, setConversationId] = useState(null)

  const { code, fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  async function getToken() {
    let newConversationId, token, expiresAt

    {
      const { error, data } = await fetch(
        `/api/v1/hub/bot/${instance.id}/session/create`,
        {
          data: {},
        }
      )

      if (error) {
        return
      }

      newConversationId = data.id
      token = data.token
      expiresAt = data.expiresAt

      setConversationId(newConversationId)
    }

    return {
      conversationId: newConversationId,
      token,
      expiresAt,
    }
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      {theme ? (
        <div className="space-y-8">
          <ConfigWrapper
            // userIcon={session?.user?.image || dataset.user.image} // @note disabled because sometimes it does not look good
            integration={integration} // @todo remove this dependence
            barIcon={integration.barIcon} // @todo remove this dependence
            botIcon={integration.botIcon} // @todo remove this dependence
            math={integration.math}
            attachments={integration.attachments}
            verbose={false}
            theme={theme}
            autoScroll={false}
            autoFocus={false}
          >
            <IntlWrapper>
              <ResizeWrapper disabled={true}>
                <ThemeWrapper>
                  <ModalWrapper>
                    <StateWrapper>
                      <Popup getToken={getToken} disabled={!session} />
                    </StateWrapper>
                  </ModalWrapper>
                </ThemeWrapper>
              </ResizeWrapper>
            </IntlWrapper>
          </ConfigWrapper>
          <div className="space-x-4">
            <Link className="primary-button" href="/bots/new" target="_blank">
              Create Your Own
            </Link>
            {conversationId ? (
              <Link
                className="default-button"
                href={`/conversations/${conversationId}`}
                target="_blank"
              >
                View Conversation
              </Link>
            ) : null}
            {children}
          </div>
        </div>
      ) : (
        <>
          <ConversationManager
            conversationCreateEndpoint={`/v1/hub/bot/${instance.id}/session/create`}
            autoClear={true}
            autoStart={true}
            autoAddBackstory={false}
            startPlaceholder={`Start chatting with ${
              instance.name || instance.id
            }`}
            chatPlaceholder={'What else is on your mind'}
            stream={true}
            verbose={true}
          />
          <div>{children}</div>
        </>
      )}
    </>
  )
}

export function Configuration({ instance }) {
  const model = useMemo(() => {
    const value = instance.model || defaultLanguageModel

    let name
    let config

    try {
      ;({ name, config } = parseAndRevealLanguageModel(value))
    } catch {
      // @note the bot's model may be unrecognized - e.g. a renamed/removed
      // model, or a free-text value that slipped past write-time validation.
      // This card is display-only, so fall back to showing the raw name instead
      // of throwing during render.
      name = value
      config = {}
    }

    delete config.visible
    delete config.deprecated

    return {
      name,
      config,
    }
  }, [instance.model])

  return (
    <List>
      {[
        {
          id: 'backstory',
          name: 'Backstory',
          description: 'The backstory are the primary bot instructions.',
          details: instance.backstory,
          lang: 'markdown',
        },
        {
          id: 'model',
          name: 'Model',
          description: 'The model is used to generate bot responses.',
          details: model,
        },
        // @todo add links to the dataset and skillset if public
      ].map(({ id, name, description, details, lang }) => {
        return (
          <ListItem
            key={id}
            className="cursor-default"
            title={name || id}
            body={
              <div className="space-y-2">
                <div>
                  {description ? (
                    <span>{description}</span>
                  ) : (
                    <span className="italic">No comment</span>
                  )}
                </div>
                {details ? (
                  <Expando
                    titleClassName="default-link text-sm"
                    title="Details"
                  >
                    {lang ? (
                      <CodeBlock className="text-xs" language={lang}>
                        {details}
                      </CodeBlock>
                    ) : (
                      <ObjectView className="text-xs" object={details} />
                    )}
                  </Expando>
                ) : null}
              </div>
            }
            expanded={true}
          />
        )
      })}
    </List>
  )
}

function IntegrationSteps({ instance }) {
  const steps = [
    {
      title: 'Clone the Bot',
      description: 'Clone the bot to your account and add any customizations.',
    },
    {
      title: 'Create an Integration',
      description:
        'Select the integration you want to use, such as an AI widget, Slack, Discord, WhatsApp, Facebook Messenger, or Telegram.',
    },
    {
      title: 'Connect the Bot',
      description:
        'Connect the bot to your integration by selecting it from your list of bots.',
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
          <span className="font-semibold">{instance.name}</span> to your website
          or target messaging platform.
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
  const { data: session } = useSession()

  return (
    <>
      <section className="section-gray-100" id="chat">
        <div className="main-page">
          <Headline title="Bot Chat">
            Chat with this bot to see how it works.
          </Headline>
          <Chat key={instance.id} instance={instance}>
            <>
              {instance.user.id === session?.user?.id ? (
                <Link className="primary-button" href={`/bots/${instance.id}`}>
                  Edit
                </Link>
              ) : (
                <Link
                  className="primary-button"
                  type="button"
                  href={`/new?${new URLSearchParams({
                    template: 'hub',
                    botId: instance.id,
                  })}`}
                >
                  Add to your website
                </Link>
              )}
            </>
          </Chat>
        </div>
      </section>
      <section className="section-white">
        <div className="main-page">
          <Headline title="Bot Configuration">
            See how the bot is configured.
          </Headline>
          <Configuration key={instance.id} instance={instance} />
        </div>
      </section>
      <section className="section-gray-50">
        <IntegrationSteps instance={instance} />
      </section>
      {related.length > 0 ? (
        <section className="section-gray-100">
          <div className="main-page">
            <Headline title="Related Bots">
              Explore other bots created by the same author.
            </Headline>
            <List>
              {related.map(({ id, name, description, slug, icon }) => {
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
      breadcrumbs={['Bots', 'Hub', 'ChatBotKit']}
      title={instance.name || instance.id}
      description={instance.description || instance.name || instance.id}
      image={`/hub/bots/${instance.slug || instance.id}/card`}
    >
      <StructuredData
        data={{
          '@context': 'https://schema.org/',
          '@type': 'SoftwareApplication',
          url: `/hub/bots/${
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
          //   ratingCount:
          //     instance.rank ||
          //     Math.round(
          //       (DAYS_SINCE_EPOCH +
          //         parseInt(instance.id.replace(/\D/g, '').slice(0, 5), 10)) *
          //         0.01
          //     ),
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
              name: 'Bots',
              item: '/hub/bots',
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: instance.name || instance.id,
            },
          ],
        }}
      />
      <PageHero instance={instance} />
      {children}
      <FAQ faq={faq} />
    </Hub>
  )
}

export function PageHero({ instance }) {
  const { data: session } = useSession()

  const router = useRouter()

  const confirm = useConfirm()

  const { code, fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  async function onCloneClick() {
    if (!(await confirm('Are you sure you want to clone this bot?'))) {
      return
    }

    const { error: createError, data: createData } = await fetch(
      `/api/v1/bot/create`,
      {
        method: 'POST',

        data: {
          name: instance.name,
          description: instance.description,

          backstory: instance.bot.backstory,

          model: instance.bot.model,
        },

        loadingMessage: 'Cloning bot...',
      }
    )

    if (createError) {
      return
    }

    router.push(`/bots/${createData.id}`)
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      <section className="section-gray-50">
        <Hero
          splitTitle={instance.name || 'A bot without name'}
          description={instance.description}
        >
          <div className="space-y-10 w-full">
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
            <div className="flex flex-row justify-center items-center space-x-2">
              {instance.user.id === session?.user?.id ? (
                <Link className="primary-button" href={`/bots/${instance.id}`}>
                  Edit
                </Link>
              ) : (
                <button
                  className="primary-button"
                  type="button"
                  onClick={onCloneClick}
                >
                  Copy
                </button>
              )}
              <ForwardButton
                className="default-button"
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
            </div>
          </div>
        </Hero>
      </section>
    </>
  )
}

export async function getServerSideProps(context) {
  const botId = context.query.botId?.trim?.()

  if (!botId) {
    return {
      notFound: true,
    }
  }

  // @note set CDN cache headers to avoid hitting the server on every crawl
  applyCacheHeaders(context.res, CACHE_PRESETS.HUB_PAGE)

  const instance = await prisma.hubBotPage.findFirst({
    where: {
      OR: [{ id: botId }, { slug: botId }],
    },

    select: {
      id: true,

      name: true,
      description: true,

      slug: true,

      icon: true,

      bot: {
        select: {
          id: true,

          backstory: true,

          model: true,

          widgetIntegrations: {
            select: {
              title: true,

              intro: true,

              theme: true,

              files: {
                select: {
                  fileId: true,
                  type: true,
                },
              },
            },

            take: 1,
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

  // @note we use Promise.all instead of prisma.$transaction here because these
  // are read-only queries that don't require ACID consistency. Using a
  // transaction holds a single database connection for all queries, which can
  // lead to connection timeouts. With Promise.all, each query uses its own
  // connection and can complete independently.

  const [related, latestBots] = await Promise.all([
    prisma.hubBotPage.findMany({
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

    prisma.hubBotPage.findMany({
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
    ...new Map([].concat(related, latestBots).map((i) => [i.id, i])).values(),
  ]

  return {
    props: makeJsonSafe({
      instance,

      related: uniqueRelated.slice(0, 10),
    }),
  }
}
