import { useEffect, useMemo, useState } from 'react'

import botsConfig from '@/config/bots'
import { defaultLanguageModel } from '@/config/models'

import prisma from '@/prisma/client'
import { MessageType } from '@/prisma/types'

import { getLast } from '@/lib/array'
import { getConversationDetailsField } from '@/lib/bot.conversation'
import { jsonl } from '@/lib/fetch'
import { getSortedMessages } from '@/lib/message'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'
import toast from '@/lib/toast'

import Dashboard from '@/layouts/Dashboard'

import BackstoryInput from '@/components/BackstoryInput'
import CodeAction from '@/components/CodeAction'
import { Messages } from '@/components/Conversation'
import DatasetSelect from '@/components/DatasetSelect'
import DocsLink from '@/components/DocsLink'
import FAQ from '@/components/FAQ'
import LanguageModelSelect from '@/components/LanguageModelSelect'
import NavHeader from '@/components/NavHeader'
import SkillsetSelect from '@/components/SkillsetSelect'
import TokenAutoTextarea from '@/components/TokenAutoTextarea'

import useFetch from '@/hooks/useFetch'
import useTrace from '@/hooks/useTrace'

import faq from '@/content/faqs/website-playground-conversation.yaml'

function getNextType(type) {
  switch (type) {
    case MessageType.backstory:
      return MessageType.user

    case MessageType.user:
      return MessageType.bot

    case MessageType.bot:
      return MessageType.user

    case MessageType.context:
      return MessageType.bot

    case MessageType.instruction:
      return MessageType.bot
  }
}

function formatElapsedMilliseconds(value) {
  return `${(value / 1000).toFixed(1)}s`
}

export default function Index({
  backstory,

  model: _model,

  datasetId: _datasetId,
  skillsetId: _skillsetId,

  conversation: _conversation,

  datasets,
  skillsets,
}) {
  const trace = useTrace()

  const conversation = useMemo(() => {
    return _conversation || []
  }, [_conversation])

  const [datasetId, setDatasetId] = useState(
    _datasetId || getConversationDetailsField(conversation, 'datasetId')
  )

  const [skillsetId, setSkillsetId] = useState(
    _skillsetId || getConversationDetailsField(conversation, 'skillsetId')
  )

  const [model, setModel] = useState(
    _model ||
      getConversationDetailsField(conversation, 'model') ||
      defaultLanguageModel
  )

  const [messages, setMessages] = useState(conversation.messages || [])

  const [type, setType] = useState(
    getNextType(getLast(messages)?.type) || MessageType.backstory
  )

  const [text, setText] = useState(messages.length ? '' : backstory || '')

  const [responseStartedAt, setResponseStartedAt] = useState(null)

  const [elapsedTime, setElapsedTime] = useState(0)

  const [tokensUsed, setTokensUsed] = useState(0)

  const { code, fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
    streamingMessage: true,
  })

  useEffect(() => {
    if (responseStartedAt === null) {
      return
    }

    let frameId

    const updateElapsedTime = () => {
      setElapsedTime(Date.now() - responseStartedAt)
      frameId = requestAnimationFrame(updateElapsedTime)
    }

    updateElapsedTime()

    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [responseStartedAt])

  function handleRemove(messageId) {
    setMessages(messages.filter((m) => m.id !== messageId))
  }

  function handleEdit(messageId, text) {
    setMessages(messages.map((m) => (m.id !== messageId ? m : { ...m, text })))
  }

  function handleKeyDown(event) {
    if ((event.ctrlKey || event.metaKey) && event.keyCode === 13) {
      event.preventDefault()

      handleAddMessage()
    }
  }

  function handleAddMessage() {
    const niceText = text.trim()

    if (!niceText) {
      return messages.slice(0)
    }

    const now = Date.now()

    const newMessages = messages.concat([
      { id: now.toString(), text: niceText, type: type, createdAt: now },
    ])

    setMessages(newMessages)

    setType(getNextType(type))

    setText('')

    return newMessages
  }

  async function handleReceiveResponse() {
    setElapsedTime(0)
    setTokensUsed(0)
    setResponseStartedAt(Date.now())

    let thisBackstory
    let thisMessages

    try {
      if (messages[0]?.type === 'backstory') {
        thisBackstory = messages[0].text

        thisMessages = messages.slice(1)
      } else {
        thisBackstory = undefined

        thisMessages = messages.slice(0)
      }

      const { error, data: body } = await fetch(
        `/api/v1/conversation/complete`,
        {
          headers: {
            Accept: 'application/jsonl',

            'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
          },

          data: {
            backstory: thisBackstory,

            model,

            messages: thisMessages,

            datasetId,
            skillsetId,
          },

          dataType: 'body',

          loadingMessage: 'Receiving response...',
        }
      )

      if (!error) {
        setType(MessageType.bot)

        let newText = ''

        for await (let { type, data } of jsonl(body)) {
          trace.event(type, data)

          switch (true) {
            case type === 'token': {
              newText += data.token

              setText(newText)

              break
            }

            case type === 'result': {
              setTokensUsed(data.usage.token)

              break
            }

            case type === 'error': {
              toast.error(data.message || data.code)

              break
            }
          }
        }
      }
    } finally {
      setResponseStartedAt(null)
    }
  }

  async function handleSaveNew() {
    await fetch(`/api/v1/conversation/create`, {
      successMessage: 'New conversation created',

      data: {
        backstory,

        model,

        datasetId,
        skillsetId,

        messages: messages,

        meta: {
          app: 'situation',
        },
      },
    })
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      <section className="section-white">
        <div className="main-page">
          <NavHeader link="/playground" caption="playgrounds" title="Situation">
            <p>
              The following playground can be used to troubleshoot
              conversational situation to help find the perfect configuration
              for your chatbot. Keep in mind that changes are not persisted. For
              more information refer to the{' '}
              <DocsLink className="default-link" slug="conversations">
                Conversations
              </DocsLink>{' '}
              documentation.
            </p>
          </NavHeader>
          {/* @todo research why we are not using the Conversation component here and if compatible use it instead */}
          <div className="space-y-4">
            {messages.length ? (
              <Messages
                messages={messages}
                onRemove={handleRemove}
                onEdit={handleEdit}
              />
            ) : null}
            <select
              className="default-input w-full max-w-sm"
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              {Object.keys(MessageType)
                .filter((type) => type !== MessageType.activity)
                .map((type) => (
                  <option key={type}>{type}</option>
                ))}
            </select>
            {type === 'backstory' ? (
              <BackstoryInput
                className="default-input max-h-96 !overflow-auto"
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={handleKeyDown}
              />
            ) : (
              <TokenAutoTextarea
                className="default-input max-h-96 !overflow-auto"
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={handleKeyDown}
              >
                {responseStartedAt !== null ||
                tokensUsed > 0 ||
                elapsedTime > 0 ? (
                  <div className="order-[-1] flex justify-center gap-1 select-none">
                    {tokensUsed > 0 ? (
                      <div className="relative group/tooltip cursor-help">
                        <span className="flex justify-center items-center text-xs rounded pt-1 pb-1 pr-2 pl-2 bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-500 tabular-nums">
                          <span className="truncate">{tokensUsed}</span>
                        </span>
                        <span className="tooltip below w-36">
                          Credit tokens consumed
                        </span>
                      </div>
                    ) : null}
                    <div className="relative group/tooltip cursor-help">
                      <span className="flex justify-center items-center text-xs rounded pt-1 pb-1 pr-2 pl-2 bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-500 tabular-nums">
                        <span className="truncate">
                          {formatElapsedMilliseconds(elapsedTime)}
                        </span>
                      </span>
                      <span className="tooltip below w-44">
                        Elapsed response time
                      </span>
                    </div>
                  </div>
                ) : null}
              </TokenAutoTextarea>
            )}
            <div className="flex flex-row gap-2">
              <div className="flex-1 flex flex-row gap-2">
                <button
                  className="default-button"
                  type="button"
                  onClick={handleAddMessage}
                >
                  Add Message
                </button>
                <button
                  className="primary-button"
                  type="button"
                  onClick={handleReceiveResponse}
                  disabled={
                    ![
                      MessageType.user,
                      MessageType.bot,
                      MessageType.context,
                      MessageType.instruction,
                      MessageType.backstory,
                      MessageType.activity,
                    ].includes(getLast(messages)?.type)
                  }
                >
                  Receive Response
                </button>
              </div>
              <div>
                <button
                  className="default-button"
                  type="button"
                  onClick={handleSaveNew}
                  disabled={!messages.length}
                >
                  Save New
                </button>
              </div>
            </div>
          </div>
          {/* model */}
          <div>
            <label className="default-label" htmlFor="model">
              Model
            </label>
            <div className="mt-1">
              <LanguageModelSelect
                className="block w-full max-w-sm default-input"
                name="model"
                value={model}
                setValue={setModel}
              />
            </div>
            <p className="input-description">
              Optional model name for this situation.
            </p>
          </div>
          {/* datasetId */}
          <div>
            <label className="default-label" htmlFor="datasetId">
              Dataset
            </label>
            <div className="mt-1">
              <DatasetSelect
                className="block w-full max-w-sm default-input"
                name="datasetId"
                value={datasetId}
                onChange={(event) => setDatasetId(event.target.value)}
                datasets={datasets}
              />
            </div>
            <p className="input-description">
              Optional dataset to use for this bot.
            </p>
          </div>
          {/* skillsetId */}
          <div>
            <label className="default-label" htmlFor="datasetId">
              Skillset
            </label>
            <div className="mt-1">
              <SkillsetSelect
                className="block w-full max-w-sm default-input"
                name="skillsetId"
                value={skillsetId}
                onChange={(event) => setSkillsetId(event.target.value)}
                skillsets={skillsets}
              />
            </div>
            <p className="input-description">
              Optional skillset to use for this bot.
            </p>
          </div>
        </div>
      </section>
    </>
  )
}

Index.getLayout = function (children) {
  return (
    <Dashboard
      breadcrumbs={['Playground', 'ChatBotKit']}
      title="AI Bot Situation Playground"
      description="Use this playground to experiment with different backstories, datasets, skillsets and advanced options to see how they affect the chatbot's responses."
      keywords="chatbot, playground, situation, datasets, skillsets, backstories"
      image={`/playground/situation/card`}
    >
      {children}
      <FAQ faq={faq} />
    </Dashboard>
  )
}

export async function getServerSideProps(context) {
  const session = await getSoftSession(context.req, context.res)

  const backstory = context.query.backstory || botsConfig.defaultBackstory

  const model = context.query.model || null

  const datasetId = context.query.datasetId || null
  const skillsetId = context.query.skillsetId || null

  let conversation = null

  if (!session) {
    return {
      props: makeJsonSafe({
        backstory,

        model,

        datasetId,
        skillsetId,

        conversation: conversation,

        datasets: [],
        skillsets: [],
      }),
    }
  }

  if (context.query.conversationId) {
    conversation = await prisma.conversation.findUnique({
      where: {
        id: context.query.conversationId,
      },

      select: {
        id: true,

        userId: true,

        bot: {
          select: {
            backstory: true,

            model: true,

            datasetId: true,
            skillsetId: true,
          },
        },

        backstory: true,

        model: true,

        datasetId: true,
        skillsetId: true,

        createdAt: true,

        messages: {
          // @note disabled because it can overfill the memory for very long messages
          // orderBy: [
          //   {
          //     createdAt: 'asc',
          //   },
          //   { id: 'asc' },
          // ],

          select: {
            id: true,

            type: true,
            text: true,
            meta: true,

            createdAt: true,
          },
        },
      },
    })

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

    conversation.messages = getSortedMessages(conversation.messages)

    conversation.createdAt = conversation.createdAt.getTime()

    {
      const backstory = conversation.bot?.backstory || conversation.backstory

      if (backstory) {
        conversation.messages.unshift({
          id: conversation.id,
          type: MessageType.backstory,
          text: backstory,
          createdAt: new Date(conversation.createdAt),
        })
      }
    }

    conversation.messages = conversation.messages.map((message) => {
      message.createdAt = message.createdAt.getTime()

      return message
    })
  } else {
    conversation = null
  }

  return makeJsonSafe({
    props: {
      backstory,

      model,

      datasetId,
      skillsetId,

      conversation,
    },
  })
}

/**
 * @doc Playgrounds
 * @index 20
 *
 * ## Situation
 *
 * The [Situation Playground](https://chatbotkit.com/playground/situation) helps you test how a bot behaves under different conditions. You can simulate a conversation, adjust configuration, and inspect how the model responds when the surrounding context changes.
 *
 * Use it when you want to troubleshoot a developed conversation, compare response strategies, or identify where a configuration needs improvement before you save those changes elsewhere.
 */
