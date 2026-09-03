import prisma from '@/prisma/client'

import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import DocsLink from '@/components/DocsLink'
import FAQ from '@/components/FAQ'
import Hero from '@/components/Hero'
import Link from '@/components/Link'
import MemoryList from '@/components/MemoryList'

import faq from '@/content/faqs/platform-memories.yaml'

export default function Index({
  authenticated,
  botId,
  contactId,
  filterOptions,
}) {
  return (
    <section className="section-white">
      <div className="main-page main-page-list">
        <MemoryList
          botId={botId}
          contactId={contactId}
          filterOptions={filterOptions}
          autoLoad
          loadMore="auto"
          actions={
            authenticated ? (
              <Link className="primary-button" href="/memories/new">
                Create Memory
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
      title="Memories"
      authenticated={authenticated}
    >
      {authenticated ? (
        children
      ) : (
        <PageHero>
          <DocsLink className="default-button" slug="memories">
            Learn More
          </DocsLink>
          {/* <Link
          className="primary-button"
          href={{
            pathname: '/signin',
            query: {
              callbackUrl: '/memories',
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
      title={['Create and manage memories', 'for your contacts and agents']}
      description="Memories enable your AI agents to store and retrieve important information about your contacts, creating personalized experiences and maintaining context across conversations."
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

  const botIdValue = context.query.botId
  const contactIdValue = context.query.contactId

  const botId = typeof botIdValue === 'string' ? botIdValue : undefined
  const contactId =
    typeof contactIdValue === 'string' ? contactIdValue : undefined

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

      botId: botId,
      contactId: contactId,

      filterOptions: filterOptions,
    }),
  }
}
