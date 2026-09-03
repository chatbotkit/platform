import prisma from '@/prisma/client'

import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import ConversationList, {
  INTEGRATION_FILTER_CHANNELS,
} from '@/components/ConversationList'
import DocsLink from '@/components/DocsLink'
import FAQ from '@/components/FAQ'
import Hero from '@/components/Hero'
import Link from '@/components/Link'

import faq from '@/content/faqs/platform-conversations.yaml'

export default function Index({ authenticated, filters, filterOptions }) {
  return (
    <section className="section-white">
      <div className="main-page main-page-list">
        <ConversationList
          {...filters}
          filterOptions={filterOptions}
          autoLoad
          loadMore="auto"
          actions={
            authenticated ? (
              <Link className="primary-button" href="/conversations/new">
                Create Conversation
              </Link>
            ) : null
          }
        />
      </div>
    </section>
  )
}

Index.getLayout = function (children, { authenticated }) {
  return (
    <Dashboard
      breadcrumbs={['ChatBotKit']}
      title="Conversations"
      description="Unlock the full potential of your business by teaching your chatbot to understand and respond to your requests in a natural way."
      authenticated={authenticated}
    >
      {authenticated ? (
        children
      ) : (
        <PageHero>
          <DocsLink className="default-button" slug="conversations">
            Learn More
          </DocsLink>
          {/* <Link
            className="primary-button"
            href={{
              pathname: '/signin',
              query: {
                callbackUrl: '/conversations',
              },
            }}
          >
            Sign in
          </Link> */}
        </PageHero>
      )}
      <FAQ faq={faq} />
    </Dashboard>
  )
}

export function PageHero(props) {
  return (
    <Hero
      {...props}
      title={['Review the conversations', 'with your customers']}
      description="Conversations are the heart of customer interactions. Manage and organize them all in one place to improve your customer engagement and support."
      compact={true}
    />
  )
}

export async function getServerSideProps(context) {
  const session = await getSoftSession(context.req, context.res)

  if (!session) {
    return {
      props: makeJsonSafe({
        authenticated: false,
      }),
    }
  }

  const queryString = (name) => {
    const value = context.query[name]

    return typeof value === 'string' ? value : undefined
  }

  const filters = {
    app: queryString('app'),
    abuse:
      queryString('abuse') === 'true'
        ? true
        : queryString('abuse') === 'false'
          ? false
          : undefined,
    // the filterable channels are defined once, in ConversationList
    ...Object.fromEntries(
      INTEGRATION_FILTER_CHANNELS.map((channel) => [
        `${channel}IntegrationId`,
        queryString(`${channel}IntegrationId`),
      ])
    ),
    botId: queryString('botId'),
    contactId: queryString('contactId'),
    taskId: queryString('taskId'),
  }

  for (const key of Object.keys(filters)) {
    if (filters[key] === undefined) {
      delete filters[key]
    }
  }

  const bots = await prisma.bot.findMany({
    where: {
      userId: session.user.id,
    },

    orderBy: [
      {
        createdAt: 'desc',
      },
    ],

    select: {
      id: true,

      name: true,
      description: true,

      createdAt: true,
    },
  })

  const filterOptions = bots.map((bot) => ({
    id: `bot-${bot.id}`,
    link: `?botId=${bot.id}`,
    title: bot.name || bot.id,
    description: bot.description || 'Bot without description',
    tag: 'bot',
    displayName: bot.name || bot.id,
    timestamp: bot.createdAt,
    isSelected: !!(context.query.botId && context.query.botId === bot.id),
  }))

  return {
    props: makeJsonSafe({
      authenticated: true,

      filters: filters,

      filterOptions: filterOptions,
    }),
  }
}
