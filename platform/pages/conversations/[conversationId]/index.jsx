import { useMemo, useState } from 'react'

import botsConfig from '@/config/bots'
import { defaultLanguageModel } from '@/config/models'

import prisma from '@/prisma/client'

import { getConversationDetailsField } from '@/lib/bot.conversation'
import { canUseDataset } from '@/lib/dataset.access'
import { formToData } from '@/lib/form'
import { getSortedMessages } from '@/lib/message'
import {
  parseAndRevealLanguageModel,
  redactLanguageModel,
} from '@/lib/model.utils'
import { getSoftSession } from '@/lib/session.get'
import { canUseSkillset } from '@/lib/skillset.access'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import BotList from '@/components/BotList'
import CodeAction from '@/components/CodeAction'
import { useConfirmDelete } from '@/components/Confirm'
import ContactList from '@/components/ContactList'
import Conversation from '@/components/Conversation'
import ConversationAttachmentList from '@/components/ConversationAttachmentList'
import ConversationInsights from '@/components/ConversationInsights'
import ConversationList from '@/components/ConversationList'
import ConversationMonitor from '@/components/ConversationMonitor'
import DatasetList from '@/components/DatasetList'
import DescriptionInput from '@/components/DescriptionInput'
import Expando from '@/components/Expando'
import ExpiresAtInput from '@/components/ExpiresAtInput'
import FAQ from '@/components/FAQ'
import Headline from '@/components/Headline'
import Link from '@/components/Link'
import MetaInput from '@/components/MetaInput'
import ObjectView from '@/components/ObjectView'
import PageSections from '@/components/PageSections'
import SkillsetList from '@/components/SkillsetList'
import TaskList from '@/components/TaskList'
import ThisSolution from '@/components/ThisSolution'

import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'

import faq from '@/content/faqs/platform-conversation-instance.yaml'

export function Form({ conversation }) {
  const confirmDelete = useConfirmDelete()

  const [updateCounter, setUpdateCounter] = useState(0)

  const router = useRouter()

  const { code, fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  async function handleOnSubmit(event) {
    event.preventDefault()
    event.stopPropagation()

    const data = formToData(event.target)

    if (!data) {
      return
    }

    if (conversation.id) {
      const { error } = await fetch(
        `/api/v1/conversation/${conversation.id}/update`,
        {
          data,

          successMessage: 'Conversation updated.',
        }
      )

      if (!error) {
        Object.assign(conversation, data)

        setUpdateCounter((updateCounter) => updateCounter + 1)
      }
    } else {
      const {
        data: { id: conversationId },
      } = await fetch(`/api/v1/conversation/create`, {
        data,

        successMessage: 'Conversation created.',
      })

      if (conversationId) {
        router.push(`/conversations/${conversationId}`)
      }
    }
  }

  async function handleDelete(event) {
    event.preventDefault()
    event.stopPropagation()

    if (
      !(await confirmDelete('Do you really want to delete this conversation?'))
    ) {
      return
    }

    const { error } = await fetch(
      `/api/v1/conversation/${conversation.id}/delete`,
      {
        data: {},

        successMessage: 'Conversation deleted...',
      }
    )

    if (!error) {
      router.push(`/conversations`)
    }
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      <ThisSolution
        type="conversation"
        instance={conversation}
        updateKey={updateCounter}
        portal={true}
      />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          {/* conversation configuration */}
          <div>
            <Headline title="Conversation Configuration">
              This information is used to configure the conversation.
            </Headline>
            <div className="mt-6 space-y-6">
              {/* name */}
              <div>
                <label className="default-label" htmlFor="name">
                  Name
                </label>
                <div className="mt-1">
                  <input
                    className="default-input w-full"
                    name="name"
                    type="text"
                    defaultValue={conversation.name}
                  />
                </div>
                <p className="input-description">
                  Type any name to recognize the conversation from others.{' '}
                  <strong>
                    The name can any influence how the conversation is used.
                  </strong>
                </p>
              </div>
              {/* description */}
              <div>
                <label className="default-label" htmlFor="description">
                  Description
                </label>
                <div className="mt-1">
                  <DescriptionInput
                    className="default-input w-full"
                    name="description"
                    defaultValue={conversation.description}
                  />
                </div>
                <p className="input-description">
                  Type description to inform what this conversation is about.{' '}
                  <strong>
                    The description can influence how the conversation is used.
                  </strong>
                </p>
              </div>
              {/* advanced options */}
              <Expando
                titleClassName="default-link text-sm"
                title="Show Advanced Options"
              >
                <div className="mt-6 space-y-6">
                  {/* expiry */}
                  <div>
                    <label className="default-label" htmlFor="expiresAt">
                      Expires
                    </label>
                    <div className="mt-1">
                      <ExpiresAtInput
                        className="default-input w-full max-w-xs"
                        name="expiresAt"
                        defaultValue={conversation.expiresAt}
                      />
                    </div>
                    <p className="input-description">
                      When set, the conversation is automatically deleted at
                      this time (in your local timezone). Leave empty for no
                      expiry.
                    </p>
                  </div>
                  {/* meta */}
                  <div>
                    <label className="default-label" htmlFor="meta">
                      Meta
                    </label>
                    <div className="mt-1">
                      <MetaInput name="meta" defaultMeta={conversation.meta} />
                    </div>
                    <p className="input-description">
                      Custom metadata for this conversation.
                    </p>
                  </div>
                </div>
              </Expando>
            </div>
          </div>
        </div>
        {/* actions */}
        <div>
          <div className="action-area">
            {/* <BackLink className="default-button" href="/conversations">
              Back To Conversations
            </BackLink> */}
            {conversation.id ? (
              <button
                className="danger-button"
                type="button"
                onClick={handleDelete}
              >
                Delete
              </button>
            ) : null}
            <span className="action-area-space" />
            <button type="submit" className="primary-button">
              {conversation.id ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </form>
    </>
  )
}

export function Messages({ conversation }) {
  const [order, setOrder] = useState('asc')

  const [messages, setMessages] = useState(conversation.messages)

  const { loading, fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  const sortedMessages = useMemo(() => {
    // messages arrive sorted ascending from the server
    return order === 'desc' ? messages.slice().reverse() : messages
  }, [messages, order])

  async function handleRefresh() {
    if (!conversation.id) {
      return
    }

    // @note pull the full message list from the api by paginating through all
    // pages so that someone monitoring the conversation can refresh on demand

    const all = []

    let cursor

    for (;;) {
      const { data, error } = await fetch(
        `/api/v1/conversation/${conversation.id}/message/list?order=asc&take=100${
          cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
        }`,
        {
          successMessage: 'Messages refreshed.',
        }
      )

      if (error) {
        return
      }

      const page = data?.items || []

      all.push(...page)

      if (page.length < 100 || !data?.cursor) {
        break
      }

      cursor = data.cursor
    }

    setMessages(all)
  }

  return (
    <div className="space-y-6 divide-y divide-gray-200 dark:divide-gray-800">
      <div>
        {messages.length > 0 ? (
          <div className="pb-6 flex flex-row justify-end space-x-3">
            <button
              type="button"
              className="default-button small push"
              onClick={() =>
                setOrder((order) => (order === 'asc' ? 'desc' : 'asc'))
              }
            >
              {order === 'asc' ? 'Oldest first ↑' : 'Newest first ↓'}
            </button>
            {conversation.id ? (
              <button
                type="button"
                className="default-button small"
                disabled={loading}
                onClick={handleRefresh}
              >
                Refresh ↻
              </button>
            ) : null}
          </div>
        ) : null}
        <Conversation
          key={`conversation-${conversation.id}-messages-${order}-${messages.length}`}
          conversationId={conversation.id}
          backstory={botsConfig.defaultBackstory}
          messages={sortedMessages}
          stream={true}
          functional={messages.length === 0}
          disabled={messages.length > 0}
        />
        {conversation.id ? (
          <div className="pt-6 flex flex-row space-x-3">
            <Link
              className="default-button"
              href={{
                pathname: '/playground/situation',
                query: { conversationId: conversation.id },
              }}
            >
              Simulate Situation
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function Model({ conversation }) {
  const model = getConversationDetailsField(
    conversation,
    'model',
    defaultLanguageModel
  )

  let name
  let config

  try {
    ;({ name, config } = parseAndRevealLanguageModel(model))
  } catch {
    // @note the stored model may be unrecognized - e.g. a renamed/removed
    // model, or a free-text value that slipped past write-time validation. This
    // card is display-only, so fall back to showing the raw name instead of
    // throwing during render.
    name = model
    config = {}
  }

  const conf = useMemo(() => {
    const conf = { ...config }

    delete conf.availableRegions
    delete conf.visible
    delete conf.deprecated

    return conf
  }, [config])

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2">
        {name}
      </div>
      {config.description ? (
        <div className="[word-break:break-word] text-sm text-gray-500 dark:text-gray-500 line-clamp-2">
          {config.description}
        </div>
      ) : null}
      <Expando titleClassName="default-link text-sm" title="Model Details">
        <ObjectView className="text-xs" object={conf} />
      </Expando>
    </div>
  )
}

export default function Index({
  conversation,

  contactConversations,

  recentConversations,
}) {
  return (
    <>
      {/* <div className="main-page last">
        <NavHeader
          link="/conversations"
          caption="conversations"
          title="Conversation"
        >
          <p>
            A conversation is a series of back-and-forth exchanges between a
            user and a chatbot in which messages are exchanged to achieve a
            particular goal or outcome.
          </p>
        </NavHeader>
      </div> */}
      <PageSections className="pt-12">
        <section data-page-section-title="Configuration">
          <div className="main-page">
            <Form conversation={conversation} />
          </div>
        </section>
        {conversation.id ? (
          <section data-page-section-title="Messages" data-page-section-default>
            <div className="main-page">
              <Headline title="Messages">
                The messages exchanged in this conversation.
              </Headline>
              <Messages key={conversation.id} conversation={conversation} />
            </div>
          </section>
        ) : null}
        {conversation.id ? (
          <section data-page-section-title="Live Activity">
            <div className="main-page">
              <Headline title="Live Activity">
                A live feed of this conversation&apos;s lifecycle events - tool
                calls, messages, completions and errors - as it runs, however it
                is driven.
              </Headline>
              <ConversationMonitor conversationId={conversation.id} />
            </div>
          </section>
        ) : null}
        {conversation.id ? (
          <section data-page-section-title="Insights">
            <div className="main-page">
              <Headline title="Insights">
                Token, conversation and message usage for this conversation.
              </Headline>
              <ConversationInsights conversationId={conversation.id} />
            </div>
          </section>
        ) : null}
        {conversation.id ? (
          <section
            data-page-section-title="Attachments"
            data-page-section-index="101"
          >
            <div className="main-page">
              <Headline title="Attachments">
                Files uploaded to this conversation.
              </Headline>
              <ConversationAttachmentList
                conversationId={conversation.id}
                autoLoad={true}
              />
            </div>
          </section>
        ) : null}
        {conversation.id ? (
          conversation.model ? (
            <section data-page-section-title="Model" data-page-section-more>
              <div className="main-page">
                <Headline title="Model">
                  The model this conversation is connected to.
                </Headline>
                <Model conversation={conversation} />
              </div>
            </section>
          ) : null
        ) : null}
        {conversation.id && conversation.contact ? (
          <section data-page-section-title="Contact" data-page-section-more>
            <div className="main-page">
              <Headline title="Contact">
                The contact associated with this conversation.
              </Headline>
              <ContactList
                defaultItems={[conversation.contact]}
                exportRoute={null}
                filter={false}
                quickAccess={true}
              />
            </div>
          </section>
        ) : null}
        {conversation.id && conversation.task ? (
          <section data-page-section-title="Task" data-page-section-more>
            <div className="main-page">
              <Headline title="Task">
                The task associated with this conversation.
              </Headline>
              <TaskList
                defaultItems={[conversation.task]}
                exportRoute={null}
                filter={false}
                quickAccess={true}
              />
            </div>
          </section>
        ) : null}
        {conversation.id && conversation.bot ? (
          <section data-page-section-title="Bot" data-page-section-more>
            <div className="main-page">
              <Headline title="Bot">
                The bot associated with this conversation.
              </Headline>
              <BotList
                defaultItems={[conversation.bot]}
                exportRoute={null}
                filter={false}
                quickAccess={true}
              />
            </div>
          </section>
        ) : null}
        {conversation.id && conversation.dataset ? (
          <section data-page-section-title="Dataset" data-page-section-more>
            <div className="main-page">
              <Headline title="Dataset">
                The dataset associated with this conversation.
              </Headline>
              <DatasetList
                defaultItems={[conversation.dataset]}
                exportRoute={null}
                filter={false}
                quickAccess={true}
              />
            </div>
          </section>
        ) : null}
        {conversation.id && conversation.skillset ? (
          <section data-page-section-title="Skillset" data-page-section-more>
            <div className="main-page">
              <Headline title="Skillset">
                The skillset associated with this conversation.
              </Headline>
              <SkillsetList
                defaultItems={[conversation.skillset]}
                exportRoute={null}
                filter={false}
                quickAccess={true}
              />
            </div>
          </section>
        ) : null}
        {/* {conversation.id ? (
          <section>
            <div className="main-page">
              <Headline title="Meta">
                Meta fields assigned to this conversation.
              </Headline>
              <MetaArea instance={conversation} />
            </div>
          </section>
        ) : null} */}
        {contactConversations?.length > 0 ? (
          <section data-page-section-title="Related" data-page-section-more>
            <div className="main-page">
              <Headline title="Contact Conversations">
                Other conversations connected to the same contact.
              </Headline>
              <ConversationList
                items={contactConversations}
                exportRoute={null}
                totalCount={null}
                loadMore={false}
                filter={false}
              />
            </div>
          </section>
        ) : null}
        {recentConversations?.length > 0 ? (
          <section data-page-section-title="Recent" data-page-section-more>
            <div className="main-page">
              <Headline title="Recent Conversations">
                Other recent conversations in the same account.
              </Headline>
              <ConversationList
                items={recentConversations}
                exportRoute={null}
                totalCount={null}
                loadMore={false}
                filter={false}
              />
            </div>
          </section>
        ) : null}
      </PageSections>
    </>
  )
}

Index.getLayout = function (children, { conversation }) {
  return (
    <Dashboard
      breadcrumbs={['Conversations', 'ChatBotKit']}
      title={conversation.id || 'New'}
      authenticated={true}
    >
      {children}
      <FAQ faq={faq} />
    </Dashboard>
  )
}

export async function getServerSideProps(context) {
  const session = await getSoftSession(context.req, context.res)

  if (!session) {
    return {
      redirect: {
        destination: `/signin?callbackUrl=${context.resolvedUrl}`,
        permanent: false,
      },
    }
  }

  if (context.query.conversationId === 'new') {
    return {
      props: makeJsonSafe({
        conversation: {},
      }),
    }
  }

  const [conversation, recentConversations] = await Promise.all([
    prisma.conversation.findUnique({
      where: {
        id: context.query.conversationId,
      },

      include: {
        contact: {
          select: {
            id: true,

            userId: true,

            name: true,
            description: true,

            verifiedAt: true,

            conversations: {
              select: {
                id: true,

                name: true,
                description: true,

                createdAt: true,

                meta: true,
              },

              orderBy: [
                {
                  createdAt: 'desc',
                },
                {
                  id: 'desc', // @note important for deterministic ordering
                },
              ],

              cursor: {
                id: context.query.conversationId,
              },

              take: 5,
            },
          },
        },

        task: {
          select: {
            id: true,

            userId: true,

            name: true,
            description: true,

            schedule: true,

            status: true,
            outcome: true,

            lastRunAt: true,
          },
        },

        bot: {
          include: {
            dataset: {
              select: {
                id: true,

                userId: true,

                name: true,
                description: true,
              },
            },

            skillset: {
              select: {
                id: true,

                userId: true,

                name: true,
                description: true,
              },
            },
          },
        },

        dataset: {
          select: {
            id: true,

            userId: true,

            name: true,
            description: true,
          },
        },

        skillset: {
          select: {
            id: true,

            userId: true,

            name: true,
            description: true,
          },
        },

        messages: {
          // @note disabled because it can overfill the memory for very long messages
          // orderBy: [
          //   {
          //     createdAt: 'asc',
          //   },
          //   { id: 'asc' },
          // ],
        },
      },
    }),

    prisma.conversation.findMany({
      where: {
        userId: session.user.id,
      },

      orderBy: [
        {
          createdAt: 'desc',
        },
        {
          id: 'desc', // @note important for deterministic ordering
        },
      ],

      select: {
        id: true,

        name: true,
        description: true,

        createdAt: true,

        meta: true,
      },

      cursor: {
        id: context.query.conversationId,
      },

      skip: 1,

      take: 5,
    }),
  ])

  if (!conversation) {
    return {
      notFound: true,
    }
  }

  if (conversation.userId !== session.user.id) {
    return {
      notFound: true,
    }
  }

  const contactConversations = conversation.contact?.conversations || []

  delete conversation.contact?.conversations

  // clean up datasets
  {
    if (
      conversation.bot?.dataset &&
      (await canUseDataset(session.user.id, conversation.bot.dataset)) === false
    ) {
      delete conversation.bot.dataset
    }

    if (
      conversation.dataset &&
      (await canUseDataset(session.user.id, conversation.dataset)) === false
    ) {
      delete conversation.dataset
    }
  }

  // clean up skillsets
  {
    if (
      conversation.bot?.skillset &&
      (await canUseSkillset(session.user.id, conversation.bot.skillset)) ===
        false
    ) {
      delete conversation.bot.skillset
    }

    if (
      conversation.skillset &&
      (await canUseSkillset(session.user.id, conversation.skillset)) === false
    ) {
      delete conversation.skillset
    }
  }

  // sort messages
  {
    conversation.messages = getSortedMessages(conversation.messages)
  }

  // add backstory to the messages
  // @note disabled because it will confuse things more than help
  // {
  //   const backstory = getConversationDetailsField(conversation, 'backstory')
  //
  //   if (backstory) {
  //     conversation.messages.unshift({
  //       id: conversation.id,
  //       text: backstory,
  //       type: 'backstory',
  //       createdAt: conversation.createdAt,
  //     })
  //   }
  // }

  // sanitise the model before serving it
  //
  // @note custom models embed a `credentials` secret directly in their model
  // string. The browser only needs to display the model, so mask the secret
  // before it ever leaves the server.
  {
    if (conversation.model) {
      conversation.model = redactLanguageModel(conversation.model)
    }

    if (conversation.bot?.model) {
      conversation.bot.model = redactLanguageModel(conversation.bot.model)
    }
  }

  // add model to the conversation
  {
    const model = getConversationDetailsField(conversation, 'model')

    if (model) {
      try {
        // @note normalise the stored model to its resolved name for display
        conversation.model = parseAndRevealLanguageModel(model)?.name ?? model
      } catch {
        // @note the stored model may be unrecognized - e.g. a renamed/removed
        // model, or a free-text value that slipped past write-time validation.
        // Resolving it here is purely for display, so degrade gracefully
        // instead of failing the whole page and keep the raw stored value.
        conversation.model = model
      }
    }
  }

  return {
    props: makeJsonSafe({
      conversation: conversation,

      contactConversations: contactConversations,

      recentConversations: recentConversations,
    }),
  }
}
