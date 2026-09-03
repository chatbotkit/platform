import prisma from '@/prisma/client'

import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import ConversationManager from '@/components/ConversationManager'
import DocsLink from '@/components/DocsLink'
import FAQ from '@/components/FAQ'
import NavHeader from '@/components/NavHeader'

import faq from '@/content/faqs/website-playground-conversation.yaml'

export default function Index({
  botId,

  backstory,

  model,

  datasetId,
  skillsetId,

  bots,

  datasets,
  skillsets,
}) {
  return (
    <section className="section-white">
      <div className="main-page">
        <NavHeader
          link="/playground"
          caption="playgrounds"
          title="Conversation"
        >
          Use this playground to experiment with different backstories,
          datasets, skillsets and advanced options to see how they affect the
          chatbot&apos;s responses. For more information see the{' '}
          <DocsLink className="default-link" slug="conversations">
            Conversations
          </DocsLink>{' '}
          documentation.
        </NavHeader>
        <ConversationManager
          botId={botId}
          backstory={backstory}
          model={model}
          datasetId={datasetId}
          skillsetId={skillsetId}
          bots={bots}
          datasets={datasets}
          skillsets={skillsets}
          stream={true}
          verbose={true}
          conversationLink={true}
          situationLink={true}
          autoAddBackstory={true}
        />
      </div>
    </section>
  )
}

Index.getLayout = function (children) {
  return (
    <Dashboard
      breadcrumbs={['Playground', 'ChatBotKit']}
      title="AI Conversation Playground"
      description="Use this playground to experiment with different backstories, datasets, skillsets and advanced options to see how they affect the chatbot's responses."
      keywords="chatbot, playground, conversation, datasets, skillsets, backstories"
      image={`/playground/conversation/card`}
    >
      {children}
      <FAQ faq={faq} />
    </Dashboard>
  )
}

export async function getServerSideProps(context) {
  const session = await getSoftSession(context.req, context.res)

  const backstory = context.query.backstory || null

  const model = context.query.model || null

  const botId = context.query.botId || null

  const datasetId = context.query.datasetId || null
  const skillsetId = context.query.skillsetId || null

  if (!session) {
    return {
      props: makeJsonSafe({
        backstory,

        model,

        botId,

        datasetId,
        skillsetId,

        bots: [],

        datasets: [],

        skillsets: [],
      }),
    }
  }

  // @todo remove this because the *Selectors will do the job

  // @note we use Promise.all instead of prisma.$transaction here because these
  // are read-only queries that don't require ACID consistency. Using a
  // transaction holds a single database connection for all queries, which can
  // lead to connection timeouts. With Promise.all, each query uses its own
  // connection and can complete independently.

  const [bots, datasets, skillsets] = await Promise.all([
    prisma.bot.findMany({
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
        createdAt: true,
      },
    }),

    prisma.dataset.findMany({
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
        createdAt: true,
      },
    }),

    prisma.skillset.findMany({
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
        createdAt: true,
      },
    }),
  ])

  return {
    props: makeJsonSafe({
      botId,

      backstory,

      model,

      datasetId,
      skillsetId,

      bots,

      datasets,
      skillsets,
    }),
  }
}

/**
 * @doc Playgrounds
 * @index 10
 *
 * ## Conversation
 *
 * The [Conversation Playground](https://chatbotkit.com/playground/conversation) is the core Playground in ChatBotKit. It gives you an interactive environment where you can talk to your bot, try different inputs, and observe how the bot responds in real time.
 *
 * Use it when you want to test prompts, compare models, swap in different datasets or skillsets, and understand how a bot behaves before making changes in production. It is usually the first Playground to use when you are developing a new conversational experience.
 */
