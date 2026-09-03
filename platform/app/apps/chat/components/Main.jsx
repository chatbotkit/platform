'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'

import { logAnalyticsEvent } from '@/lib/analytics'
import { getLast } from '@/lib/array'
import {
  ALL_GROUPING_CAPTIONS,
  groupConversationsByTaskAndDate,
} from '@/lib/conversation.group'
import {
  TAG_ERROR,
  TAG_MESSAGE,
  TAG_OPERATION_BEGIN,
  TAG_OPERATION_END,
  TAG_REASONING_TOKEN,
  TAG_TOKEN,
} from '@/lib/conversation.tag'
import { captureException, errorToErrorResponse } from '@/lib/error'
import fetch, { getFetchError } from '@/lib/fetch'
import { runTasks } from '@/lib/job'
import { escape as escapeForRegEx } from '@/lib/regex'
import { throwUnprocessableEntity } from '@/lib/response'
import { getRandomId, getTempId } from '@/lib/string'
import toast from '@/lib/toast'

import { AppScene, useApp } from '@/layouts/App'

import { useConfirmDelete, useConfirmInput } from '@/components/Confirm'
import { useConsoleDebugFunctions } from '@/components/Console'
import Portal from '@/components/Portal'

import useAborter from '@/hooks/useAborter'
import useCodeAction from '@/hooks/useCodeAction'
import useComboKeybinding from '@/hooks/useComboKeyBinding'
import useConversationManagerState from '@/hooks/useConversationManagerState'
import useDropzone from '@/hooks/useDropzone'
import useIsTop from '@/hooks/useIsTop'
import usePostMessageHandler, {
  postMessage,
} from '@/hooks/usePostMessageHandler'
import useReadyNotification from '@/hooks/useReadyNotification'
import useRouter from '@/hooks/useRouter'
import useScopedQuerySessionOption from '@/hooks/useScopedQuerySessionOption'
import useTrace from '@/hooks/useTrace'

import { APP_NAME } from '../const'
import useDebugMode from '../hooks/useDebugMode'
import { getFeatures, isEphemeral } from '../lib'
import {
  completeThread,
  createTaskFromConversation,
  deleteThread,
  improvePrompt,
  listBots,
  listModels,
  listSources,
  listTasks,
  uploadSessionFiles,
} from '../server'
import ChatArea from './ChatArea'
import {
  ChatExtraFeaturesProvider,
  useChatExtraFeatures,
} from './ChatExtraFeaturesContext'
import ChatMessages, { PendingMessages } from './ChatMessages'
import ChatTextSelectionTools from './ChatTextSelectionTools'
import { ConversationContextProvider } from './ConversationContext'
import {
  BotSelectorList,
  ModelSelectorList,
  SourceSelectorList,
} from './Selector'
import { InputMentionsTip } from './Tips'

import { consume } from '@chatbotkit/react/utils/stream'

import clsx from 'clsx'
import tippy from 'tippy.js'

const MAX_MESSAGES = 100 // @todo make configurable

function TaskCheckmarkIcon({ className, ...props }) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function TaskFailureIcon({ className, ...props }) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function TaskLoadingIcon({ className, ...props }) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="none"
      className={clsx(className, 'animate-spin')}
    >
      <circle
        cx="10"
        cy="10"
        r="8"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.2"
      />
      <path d="M10 2a8 8 0 0 1 8 8" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function Initial({ initial = [], className, ...props }) {
  return initial?.length ? (
    <ul
      {...props}
      className={clsx(
        'list-none flex flex-row gap-2 justify-center align-center',
        className
      )}
    >
      {initial.map((message, index) => {
        let name
        let text

        if (typeof message === 'object' && message !== null) {
          name = message.name
          text = message.text
        } else {
          name = message
          text = message
        }

        return (
          <li
            key={index}
            className={clsx(
              'text-xs',
              'text-gray-500 dark:text-gray-500 bg-gray-100/50 hover:bg-gray-50 dark:bg-gray-900/50 dark:hover:bg-gray-950',
              'cursor-pointer',
              'p-2 rounded-full',
              'border border-gray-200 dark:border-gray-800',
              'transition-all duration-300',
              'line-clamp-1'
            )}
            onClick={() => {
              window.postMessage({
                type: 'sendMessage',
                props: { text },
              })
            }}
          >
            {((name) => {
              const match = name.match(/@\w+/)

              if (match) {
                return (
                  <>
                    <span className="font-semibold">{match[0]}</span>
                    {name.slice(match[0].length)}
                  </>
                )
              }

              return name
            })(name)}
          </li>
        )
      })}
    </ul>
  ) : null
}

function Scene({ className, ...props }) {
  const { config } = useApp()

  const isInDashboard = useScopedQuerySessionOption('_embed') === 'dashboard'

  const headline = useMemo(() => {
    if (config.intro?.title) {
      return config.intro.title
    }

    if (isInDashboard) {
      return 'Agent Console'
    } else {
      return "What's on your mind today?"
    }
  }, [config.intro?.title, isInDashboard])

  const description = useMemo(() => {
    if (config.intro?.text) {
      return config.intro.text
    }

    return null
  }, [config.intro?.text])

  return (
    <AppScene
      {...props}
      className={clsx('scene', '[&_*]:text-center', className)}
      name={null}
      headline={headline}
      description={description}
    />
  )
}

function MainContent({
  bots: _bots = [],
  models: _models = [],
  sources: _sources = [],
  conversations: _conversations = [],

  children,
}) {
  const { config, setSidebarItems, setShowFooter, state: appState } = useApp()

  const { extraFeatures } = useChatExtraFeatures()

  const features = useMemo(() => {
    return getFeatures(config)
  }, [config])

  const router = useRouter()

  // @note blueprintId from URL for filtering bots server-side
  const blueprintIdFilter = router.query.blueprintId

  const confirmDelete = useConfirmDelete()
  const confirmInput = useConfirmInput()

  const { initial = [] } = config

  const [codeAction, setCodeActionError] = useCodeAction()

  const [bots, setBots] = useState(_bots)
  const [models, setModels] = useState(_models)
  const [sources, setSources] = useState(_sources)

  const [conversations, setConversations] = useState(_conversations)

  const [selectedBot, setSelectedBot] = useState(null)

  const [selectedModel, setSelectedModel] = useState(null)

  const [selectedSources, setSelectedSources] = useState([])

  const trace = useTrace()

  const isTop = useIsTop()

  const embedded = !isTop

  // @note `_embed` is the same signal that hides the app chrome (sidebar /
  // header). When embedded the app runs ephemeral (no history sidebar, reset
  // on new) unless the config explicitly opts into ephemeral/save. Top-level
  // usage stays fully featured and persistent.

  const isEmbedded = !!useScopedQuerySessionOption('_embed')

  const ephemeral = useMemo(
    () => isEphemeral(config, isEmbedded),
    [config, isEmbedded]
  )

  useEffect(() => {
    if (bots.length === 0) {
      return
    }

    if (embedded) {
      return
    }

    if (selectedBot) {
      return
    }

    setSelectedBot(bots.find(({ default: _default }) => !!_default) || bots[0])
  }, [embedded, bots, selectedBot])

  useEffect(() => {
    if (models.length === 0) {
      return
    }

    if (embedded) {
      return
    }

    if (selectedModel) {
      return
    }

    setSelectedModel(
      models.find(({ default: _default }) => !!_default) || models[0]
    )
  }, [embedded, models, selectedModel])

  useReadyNotification()

  const editorRef = useRef(null)

  const {
    conversationId,
    setConversationId,

    thinking,
    setThinking,

    writing,
    setWriting,

    prependMessage,
    appendMessage,
    extendMessage,

    addBotMessageToken,
    addBotMessageReasoningToken,
    addBotMessageAction,

    receivedMessages: messages,
    incomingMessage: incoming,

    attachments,
    setAttachments,
    appendAttachment,

    clips,
    setClips,
    appendClip,

    reset: resetConversationManagerState,
  } = useConversationManagerState()

  useEffect(() => {
    const runningTasks = conversations.filter(
      (conv) => conv.task?.status === 'running'
    )

    if (runningTasks.length === 0) {
      return
    }

    const taskIds = runningTasks
      .map((conv) => conv.task?.id)
      .filter((id) => !!id)

    const pollInterval = setInterval(async () => {
      try {
        const freshTasks = await listTasks({ taskIds })

        setConversations((currentConversations) => {
          return currentConversations.map((conv) => {
            if (!conv.task?.id) {
              return conv
            }

            const freshTask = freshTasks.find((t) => t.id === conv.task.id)

            if (freshTask) {
              const wasRunning = conv.task.status === 'running'

              const isNowFinished = freshTask.status !== 'running'

              if (wasRunning && isNowFinished) {
                const taskName = conv.name || 'Task'

                if (freshTask.outcome === 'success') {
                  toast.success(`${taskName} completed successfully`)
                } else if (freshTask.outcome === 'failure') {
                  toast.error(`${taskName} failed`)
                }
              }

              // @note update to most recent conversation ID if available

              const updatedConv = {
                ...conv,
                task: {
                  id: freshTask.id,

                  status: freshTask.status,
                  outcome: freshTask.outcome,
                },
              }

              if (
                freshTask.conversation?.id &&
                freshTask.conversation.id !== conv.id
              ) {
                updatedConv.id = freshTask.conversation.id
              }

              return updatedConv
            }

            return conv
          })
        })
      } catch (error) {
        await captureException(error)
      }
    }, 30_000)

    return () => clearInterval(pollInterval)
  }, [conversations])

  // load the conversation from the app state if it exists
  {
    const appStateConversation = appState.conversation

    useEffect(() => {
      if (!appStateConversation) {
        return
      }

      resetConversationManagerState((state) => {
        if (state.conversationId === appStateConversation.id) {
          return state
        } else {
          return {
            conversationId: appStateConversation.id,

            messages: appStateConversation.messages, // @note replace to add testing messages
          }
        }
      })
    }, [resetConversationManagerState, appStateConversation])
  }

  // load the selected bot from the app state if it exists
  {
    const appStateSelectedBot = appState.selectedBot

    useEffect(() => {
      if (!appStateSelectedBot) {
        return
      }

      setSelectedBot((prev) => {
        if (
          prev?.id === appStateSelectedBot ||
          prev?.nick === appStateSelectedBot
        ) {
          return prev
        } else {
          return (
            bots.find(
              (bot) =>
                bot.id === appStateSelectedBot ||
                bot.nick === appStateSelectedBot
            ) || null
          )
        }
      })
    }, [bots, setSelectedBot, appStateSelectedBot])
  }

  const {
    getRootProps: getDropzoneRootProps,
    getInputProps: getDropzoneInputProps,

    open: openAttachmentsDialog,

    isDragActive,
  } = useDropzone({
    noKeyboard: true,

    onDropAccepted: async (acceptedFiles) => {
      // @todo check the size of the attachments - in stateless mode we only
      // allow a limited size (up to 4MB) - this is configured in the the
      // next.config.js file - preferably this information should be shareable
      // between the client and the server

      for (const file of acceptedFiles) {
        appendAttachment(file)
      }
    },
  })

  const [dropzoneRootProps, dropzoneInputProps] = useMemo(() => {
    const { onClick: _onClick, ...rootProps } = getDropzoneRootProps()
    const { ...inputProps } = getDropzoneInputProps()

    return [rootProps, inputProps]
  }, [getDropzoneRootProps, getDropzoneInputProps])

  const refreshBots = useCallback(
    async ({ defaultBotId } = {}) => {
      let bots

      try {
        // @note pass blueprintId to filter at GraphQL level
        bots = await listBots({ blueprintId: blueprintIdFilter || undefined })

        if (!bots) {
          return throwUnprocessableEntity('Unexpected action result')
        }

        if ('error' in bots) {
          throw errorToErrorResponse(bots.error)
        }
      } catch (e) {
        setCodeActionError(e)

        return
      }

      setBots(bots)

      if (defaultBotId) {
        setSelectedBot((prev) => {
          return prev || bots.find((bot) => bot.id === defaultBotId)
        })
      }
    },
    [setCodeActionError, blueprintIdFilter]
  )

  usePostMessageHandler(
    'refreshBots',
    ({ defaultBotId }) => {
      refreshBots({ defaultBotId })
    },
    [setBots]
  )

  const refreshModels = useCallback(
    async ({ defaultModelId } = {}) => {
      let models

      try {
        models = await listModels({})

        if (!models) {
          return throwUnprocessableEntity('Unexpected action result')
        }

        if ('error' in models) {
          throw errorToErrorResponse(models.error)
        }
      } catch (e) {
        setCodeActionError(e)

        return
      }

      setModels(models)

      if (defaultModelId) {
        setSelectedModel((prev) => {
          return prev || models.find((model) => model.id === defaultModelId)
        })
      }
    },
    [setCodeActionError]
  )

  usePostMessageHandler(
    'refreshModels',
    ({ defaultModelId }) => {
      refreshModels({ defaultModelId })
    },
    [setBots]
  )

  // @note sources include spaces, datasets, skillsets, mcps, etc. They were
  // only loaded once (server-rendered) and never refreshed client-side, so a
  // newly created space would not show up until a full reload. Mirror the
  // bots/models refreshers so the `refresh` command and embed hosts can pull
  // fresh sources.

  const refreshSources = useCallback(async () => {
    let sources

    try {
      // @note pass blueprintId so sources are scoped to the blueprint, mirroring
      // refreshBots above; embedded surfaces skip MCP sources
      sources = await listSources({
        blueprintId: blueprintIdFilter || undefined,
        embedded: isEmbedded,
      })

      if (!sources) {
        return throwUnprocessableEntity('Unexpected action result')
      }

      if ('error' in sources) {
        throw errorToErrorResponse(sources.error)
      }
    } catch (e) {
      setCodeActionError(e)

      return
    }

    setSources(sources)
  }, [setCodeActionError, blueprintIdFilter, isEmbedded])

  usePostMessageHandler(
    'refreshSources',
    () => {
      refreshSources()
    },
    [refreshSources]
  )

  // @note re-pull bots, models and sources on mount with the live client
  // session. The server-rendered props can be incomplete - notably in embedded
  // surfaces (e.g. the dashboard agent console) where the SSR pass may not be
  // authorized to list the contact's spaces and silently drops them (see the
  // NOT_AUTHORIZED guard in listInternalSources). Sources were previously left
  // out of this refresh, so spaces never appeared until a manual `/refresh`.

  useEffect(() => {
    refreshBots()
    refreshModels()
    refreshSources()
  }, [refreshBots, refreshModels, refreshSources])

  const debug = useDebugMode()

  const aborter = useAborter([])

  // @note follow-up messages submitted while a reply is still streaming. Because
  // `completeThread` is an action-serialized stream, a second concurrent send
  // cannot truly run in parallel anyway - so instead of starting a broken
  // overlapping completion we queue the message and dispatch it automatically
  // once the current stream finishes (see the drain effect below).

  const [pendingMessages, setPendingMessages] = useState([])

  // @note synchronous guard set the moment a completion starts (before any
  // state has settled) so a rapid second submit reliably enqueues instead of
  // racing the `thinking`/`writing` flags

  const completionInFlightRef = useRef(false)

  const completeMessage = useCallback(
    async ({ botId, modelId, sourceIds, text }) => {
      text = (text || '').trim()

      if (!text) {
        return
      }

      botId = (botId || '').trim()
      modelId = (modelId || '').trim()
      sourceIds = Array.isArray(sourceIds)
        ? sourceIds.filter((id) => id && id.trim())
        : []

      const userMessageId = getRandomId('tmp-')

      appendMessage({
        id: userMessageId,
        type: 'user',
        from: 'user',
        text: text,
        createdAt: Date.now(),
      })

      let selectedAttachments

      if (attachments?.length) {
        selectedAttachments = await Promise.all(
          attachments.map(async (attachment) => ({
            name: attachment.name,
            type: attachment.type,
            size: attachment.size,
            data: await attachment.arrayBuffer(),
          }))
        )

        setAttachments([])
      }

      if (clips?.length) {
        setClips([])
      }

      let theBot

      {
        if (botId) {
          theBot = bots.find((bot) => bot.id === botId || bot.nick === botId)

          if (!theBot) {
            theBot = bots.find((bot) => bot.default)
          }

          if (!theBot) {
            theBot = bots[0]
          }
        }

        if (!theBot) {
          theBot = selectedBot
        }

        setSelectedBot(theBot)
      }

      let theModel

      {
        if (modelId) {
          theModel = models.find(
            (model) => model.id === modelId || model.nick === modelId
          )

          if (!theModel) {
            theModel = models.find((model) => model.default)
          }

          if (!theModel) {
            theModel = models[0]
          }
        }

        if (!theModel) {
          theModel = selectedModel
        }

        setSelectedModel(theModel)
      }

      let theSources

      {
        if (sourceIds) {
          theSources = sources.filter(
            (source) =>
              sourceIds.includes(source.id) || sourceIds.includes(source.nick)
          )

          if (!theSources.length) {
            theSources = sources.filter((source) => source.default)
          }

          if (!theSources.length) {
            theSources = [sources[0]]
          }
        }

        if (!theSources.length) {
          theSources = selectedSources
        }

        setSelectedSources(theSources)
      }

      if (selectedAttachments?.length) {
        extendMessage(userMessageId, {
          attachments: selectedAttachments.map((attachment) => ({
            name: attachment.name,
            type: attachment.type,
            url: URL.createObjectURL(
              new Blob([attachment.data], { type: attachment.type })
            ),
          })),
        })
      }

      const botMessageId = getRandomId('tmp-')

      addBotMessageToken(botMessageId, '')

      extendMessage(botMessageId, {
        from: theBot?.nick || 'auto',
      })

      aborter.reset()

      let source

      try {
        setThinking(true)

        let attachments

        if (selectedAttachments?.length) {
          const result = await uploadSessionFiles({
            files: selectedAttachments.map((/** @type {File} */ file) => ({
              name: file.name,
              type: file.type,
              size: file.size,
            })),
          })

          if (!result) {
            return throwUnprocessableEntity('Unexpected action result')
          }

          if ('error' in result) {
            throw errorToErrorResponse(result.error)
          }

          const uploadOk = await runTasks(
            result.files.map(async (file, index) => {
              const attachment = selectedAttachments[index]

              const request = await fetch(file.uploadRequest.url, {
                method: file.uploadRequest.method,

                headers: {
                  ...file.uploadRequest.headers,
                },

                body: attachment.data,
              })

              if (!request.ok) {
                throw await getFetchError(request)
              }
            })
          )

          if (!uploadOk) {
            toast.error('Failed to upload attachments. Please try again.', {
              duration: 10000,
            })

            return
          }

          attachments = result.files.map((file) => ({
            url: file.downloadRequest.url,
          }))
        }

        trace.log(`conversation/complete`)

        source = completeThread({
          conversationId: conversationId || undefined,

          // @note scope the ephemeral environment-tool namespace per blueprint so
          // designing one blueprint does not cross-pollinate installed tools into
          // another (mirrors how listBots/listInternalSources are scoped)
          blueprintId: blueprintIdFilter || undefined,

          botId: theBot?.id,

          modelId: theModel?.id,

          sourceIds: theSources.map(({ id }) => id),

          messages: [
            // previous messages, slice to the last MAX_MESSAGES

            ...messages.slice(-Math.abs(MAX_MESSAGES)).map((message) => ({
              ...message,

              meta: message.meta || undefined,
            })),

            // the last user message

            { type: 'user', text: text },
          ],

          attachments: attachments,

          clips: clips,

          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,

          debug: debug,

          // @note reprogramming is a client-side toggle, gated server-side by audience trust
          reprogramming: extraFeatures.reprogramming,

          // @note embed state drives ephemeral persistence server-side when the
          // config does not explicitly set ephemeral/save
          embedded: isEmbedded,
        })

        if (!source) {
          return throwUnprocessableEntity('Unexpected action result')
        }

        if ('error' in source) {
          throw errorToErrorResponse(source.error)
        }

        setAttachments([]) // @todo but do this sooner
      } catch (e) {
        if (aborter.isAbortError(e)) {
          return
        }

        setCodeActionError(e)

        return
      } finally {
        setThinking(false)
      }

      setWriting(true)

      let newConversationId

      try {
        let hasTokens = false
        let hasReasoningTokens = false

        let lastTokenIsMarker = false
        let lastReasoningTokenIsMarker = false

        aborter.assertNotAborted()

        const it = await consume(source)

        aborter.assertNotAborted()

        for await (const { type, data } of it) {
          trace.event(type, data)

          aborter.assertNotAborted()

          switch (type) {
            case TAG_ERROR: {
              const { message } = data || {}

              toast.error(message, {
                duration: 10000,
              })

              break
            }

            case TAG_OPERATION_BEGIN: {
              const { action } = data || {}

              addBotMessageAction(botMessageId, action)

              if (hasTokens) {
                addBotMessageToken(botMessageId, ` [${action.name}](#action)`)

                lastTokenIsMarker = true
              }

              if (hasReasoningTokens) {
                addBotMessageReasoningToken(
                  botMessageId,
                  ` [${action.name}](#action)`
                )

                lastReasoningTokenIsMarker = true
              }

              logAnalyticsEvent('bot_operation', {
                event_type: 'operation',
                status: 'begin',
              })

              break
            }

            case TAG_OPERATION_END: {
              const { action } = data || {}

              addBotMessageAction(botMessageId, action)

              // @note when reprogramming writes the bot backstory, notify the
              // parent window (e.g. blueprint designer) so it can refetch and
              // reflect the updated backstory in the canvas
              if (
                extraFeatures.reprogramming &&
                /write.*backstory/i.test(action?.name) &&
                theBot?.id
              ) {
                postMessage('botBackstoryUpdated', { botId: theBot.id })
              }

              logAnalyticsEvent('bot_operation', {
                event_type: 'operation',
                status: 'end',
              })

              break
            }

            case TAG_TOKEN: {
              const prefix = lastTokenIsMarker ? '\n\n' : ''

              addBotMessageToken(botMessageId, `${prefix}${data.token}`)

              lastTokenIsMarker = false

              hasTokens = true

              break
            }

            case TAG_REASONING_TOKEN: {
              const prefix = lastReasoningTokenIsMarker ? '\n\n' : ''

              addBotMessageReasoningToken(
                botMessageId,
                `${prefix}${data.token}`
              )

              lastReasoningTokenIsMarker = false

              hasReasoningTokens = true

              break
            }

            case TAG_MESSAGE: {
              switch (data.type) {
                case 'activity': {
                  prependMessage({
                    id: getRandomId('tmp-'),

                    ...data,

                    from: theBot?.nick,
                  })

                  break
                }
              }

              break
            }

            case 'conversation': {
              newConversationId = data.id

              const conversation = {
                ...data,

                id: data.id,

                name: data.name || (
                  <span className="animate-pulse">New conversation</span>
                ),
                description: data.description || '',
              }

              setConversationId(data.id)

              setConversations((conversations) => [
                conversation,

                ...conversations.filter(({ id }) => id !== conversation.id),
              ])

              const selectedBotMessage = getLast(data.messages)

              if (selectedBotMessage?.id) {
                extendMessage(botMessageId, {
                  id: selectedBotMessage.id,
                })
              }

              break
            }
          }
        }
      } catch (e) {
        if (aborter.isAbortError(e)) {
          return
        }

        setCodeActionError(e)
      } finally {
        setWriting(false)
      }

      if (newConversationId) {
        router.push(`/apps/${APP_NAME}/${newConversationId}`)
      }
    },
    [
      router,

      trace,

      attachments,
      setAttachments,

      clips,
      setClips,

      setThinking,
      setWriting,

      prependMessage,
      appendMessage,
      extendMessage,

      addBotMessageToken,
      addBotMessageReasoningToken,
      addBotMessageAction,

      bots,
      selectedBot,

      models,
      selectedModel,

      sources,
      selectedSources,

      messages,

      aborter,

      conversationId,
      setConversationId,

      setConversations,

      setCodeActionError,

      debug,

      extraFeatures,

      isEmbedded,

      blueprintIdFilter,
    ]
  )

  const sendMessage = useCallback(
    async ({ botId, modelId, sourceIds, text }) => {
      // @note a completion is already streaming - queue this one as a follow-up
      // turn instead of starting a second (serialized, overlapping) stream

      if (completionInFlightRef.current) {
        setPendingMessages((queue) => [
          ...queue,
          { id: getRandomId('queued-'), botId, modelId, sourceIds, text },
        ])

        return
      }

      completionInFlightRef.current = true

      logAnalyticsEvent('message_send', {})

      try {
        await completeMessage({ botId, modelId, sourceIds, text })
      } finally {
        completionInFlightRef.current = false

        logAnalyticsEvent('message_receive', {})
      }
    },
    [completeMessage]
  )

  // @note when the current completion settles, dispatch the next queued message.
  // `sendMessage` is rebuilt with fresh `messages` once the reply is committed,
  // so the follow-up is sent with the now-complete conversation as context.

  useEffect(() => {
    if (thinking || writing || completionInFlightRef.current) {
      return
    }

    if (pendingMessages.length === 0) {
      return
    }

    const [next, ...rest] = pendingMessages

    setPendingMessages(rest)

    sendMessage(next)
  }, [thinking, writing, pendingMessages, sendMessage])

  const removePendingMessage = useCallback((id) => {
    setPendingMessages((queue) => queue.filter((message) => message.id !== id))
  }, [])

  usePostMessageHandler(
    'sendMessage',
    ({ botId, modelId, sourceIds, text }) => {
      sendMessage({ botId, modelId, sourceIds, text })
    },
    [sendMessage]
  )

  const restartConversation = useCallback(() => {
    aborter.reset()

    setPendingMessages([])

    if (ephemeral) {
      resetConversationManagerState({})
    } else {
      router.push(`/apps/${APP_NAME}`)
    }
  }, [router, ephemeral, resetConversationManagerState, aborter])

  {
    useComboKeybinding('n', restartConversation, [])
  }

  const deleteConversation = useCallback(
    async (conversationIdToDelete = conversationId) => {
      if (!conversationIdToDelete) {
        return
      }

      if (
        !(await confirmDelete(
          'Do you really want to delete this conversation?'
        ))
      ) {
        return
      }

      setConversations((conversations) =>
        conversations.filter(({ id }) => id !== conversationIdToDelete)
      )

      await deleteThread({
        conversationId: conversationIdToDelete,
      })

      if (conversationId === conversationIdToDelete) {
        router.push(`/apps/chat`)
      }
    },
    [router, conversationId, confirmDelete]
  )

  const handleOnSubmit = useCallback(
    async (input) => {
      const inputText = input
        .getText({
          textSerializers: {
            commandMention: ({ node }) => {
              return `/${node.attrs.id}`
            },

            botMention: ({ node }) => {
              return `@${node.attrs.id}`
            },

            modelMention: ({ node }) => {
              return `^${node.attrs.id}`
            },

            sourceMention: ({ node }) => {
              return `#${node.attrs.id}`
            },
          },
        })
        .trim()

      if (!inputText) {
        return
      }

      // handle commands
      {
        let command
        let args

        const match = inputText.match(/^\s*\/(\w+)(.*)?$/)

        if (match) {
          command = (match[1] || '').trim()
          args = (match[2] || '').trim()
        }

        if (command === 'new') {
          // @note clearContent(true) so the editor emits an update - otherwise
          // `hasContent` in ChatArea goes stale (see the submit clear below)
          input.commands.clearContent(true)

          restartConversation()

          if (args) {
            input.commands.setContent(args)

            await handleOnSubmit(input)
          }

          return
        }

        if (command === 'rename') {
          // @todo add code here

          return
        }

        if (command === 'fork') {
          // @todo add code here

          return
        }

        if (command === 'delete') {
          input.commands.setContent(args)

          await deleteConversation()

          return
        }

        if (command === 'refresh') {
          input.commands.setContent(args)

          // @note refresh all selectable resources - bots, models and sources
          // (which include spaces) - so newly created entities appear without
          // a full page reload
          await Promise.all([refreshBots(), refreshModels(), refreshSources()])

          return
        }

        if (command === 'task') {
          input.commands.clearContent(true)

          const contextMessages = messages
            .filter((msg) => ['user', 'bot'].includes(msg.type))
            .map((msg) => ({
              type: msg.type,
              text: msg.text,
            }))

          if (args) {
            contextMessages.push({
              type: 'user',
              text: args,
            })
          }

          if (contextMessages.length === 0) {
            const data = await confirmInput(
              <div className="space-y-4">
                <p className="text-sm auto-text-gray-600">
                  No messages found in conversation. Please provide a task
                  description:
                </p>
                <textarea
                  name="description"
                  className="default-input w-full"
                  rows={4}
                  placeholder="Enter task description..."
                  required
                />
              </div>,
              {
                title: 'Create Task',
                submitButtonCaption: 'Create',
                cancelButtonCaption: 'Cancel',
              }
            )

            if (!data || !data.description) {
              toast.error('Task description is required')

              return
            }

            contextMessages.push({
              type: 'user',
              text: data.description,
            })
          }

          try {
            const dummyConversationId = getTempId()
            const dummyTaskId = getTempId()

            const dummyConversation = {
              id: dummyConversationId,

              name: <span className="animate-pulse">New task</span>,
              description: 'Task is being created and will appear shortly',

              task: {
                id: dummyTaskId,
                status: 'running',
                outcome: 'pending',
              },

              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }

            setConversations((conversations) => [
              dummyConversation,

              ...conversations,
            ])

            const result = await createTaskFromConversation({
              messages: contextMessages,
              botId: selectedBot?.id,
            })

            if (result && 'error' in result) {
              throw errorToErrorResponse(result.error)
            }

            const { taskId, name } = result

            toast.success('Task created successfully')

            setConversations((conversations) =>
              conversations.map((conv) =>
                conv.id === dummyConversationId
                  ? {
                      ...conv,

                      name: name || 'Task',
                      task: {
                        id: taskId,
                        status: 'running',
                        outcome: 'pending',
                      },
                    }
                  : conv
              )
            )
          } catch (error) {
            toast.error(error?.message || 'Failed to create task')
          }

          return
        }
      }

      let botId
      let modelId
      let sourceIds

      let text

      const botListRegex = bots
        .map(({ nick }) => escapeForRegEx(nick))
        .sort((a, b) => b.length - a.length)
        .join('|')

      const modelListRegex = models
        .map(({ id }) => escapeForRegEx(id))
        .sort((a, b) => b.length - a.length)
        .join('|')

      const sourceListRegex = sources
        .map(({ nick }) => escapeForRegEx(nick))
        .sort((a, b) => b.length - a.length)
        .join('|')

      const botMentions = inputText.match(
        new RegExp(`@(?:${botListRegex})`, 'g')
      )

      const modelMentions = inputText.match(
        new RegExp(`\\^(?:${modelListRegex})`, 'g')
      )

      const sourceMentions = inputText.match(
        new RegExp(`#(?:${sourceListRegex})`, 'g')
      )

      switch (true) {
        case !botMentions: {
          botId = selectedBot?.nick || 'auto'

          text = inputText.trim()

          break
        }

        case botMentions.length === 1: {
          botId =
            inputText.match(new RegExp(`@(${botListRegex})`))?.[1]?.trim() ||
            'auto'

          text = inputText.replace(new RegExp(`@(${botListRegex})`), '').trim()

          break
        }

        default: {
          botId = 'auto'

          text = inputText.trim()

          break
        }
      }

      if (!botId || !text) {
        return
      }

      switch (true) {
        case !modelMentions: {
          modelId = selectedModel?.id || 'auto'

          break
        }

        case modelMentions && modelMentions.length === 1: {
          modelId =
            inputText
              .match(new RegExp(`\\^(${modelListRegex})`))?.[1]
              ?.trim() || ''

          text = inputText
            .replace(new RegExp(`\\^(${modelListRegex})`, ''), '')
            .trim()

          break
        }

        default: {
          modelId = 'auto'

          break
        }
      }

      if (sourceMentions && sourceMentions.length > 0) {
        sourceIds = sourceMentions
          .map((mention) => {
            const match = mention.match(new RegExp(`#(${sourceListRegex})`))

            return match ? match[1].trim() : null
          })
          .filter(Boolean)

        text = inputText

        sourceMentions.forEach((mention) => {
          text = text.replace(mention, '')
        })

        text = text.trim()
      } else {
        sourceIds = selectedSources
          .map((source) => source.nick || source.id)
          .filter(Boolean)
      }

      // @note clearContent(true) emits an editor update so ChatArea's
      // `hasContent` resets to false. With the default (no emit) it stayed
      // stale-true after a send, and the abort control - which only shows
      // while `(thinking || writing) && !hasContent` - never appeared, so the
      // stop button looked broken once messages could be queued.
      input.commands.clearContent(true)

      await sendMessage({ botId, modelId, sourceIds, text })
    },
    [
      bots,

      models,

      sources,

      selectedBot,

      selectedModel,

      selectedSources,

      sendMessage,

      restartConversation,

      deleteConversation,

      refreshBots,
      refreshModels,
      refreshSources,

      confirmInput,

      messages,
    ]
  )

  const handleSubmit = useCallback(async () => {
    if (!editorRef.current) {
      return
    }

    const input = editorRef.current

    handleOnSubmit(input)
  }, [handleOnSubmit])

  const handleSelectBotClick = useCallback(
    (event) => {
      const contentDiv = document.createElement('div')

      let root = null
      let popup = null

      const renderContent = (currentSelectedBot) => {
        if (!root) {
          root = createRoot(contentDiv)
        }

        root.render(
          <BotSelectorList
            bots={bots}
            selectedBot={currentSelectedBot}
            onSelectBot={(bot) => {
              let newSelectedBot = bot

              setSelectedBot(newSelectedBot)

              renderContent(newSelectedBot)

              // @note is it a good idea to hide automatically?
              // popup?.hide()
            }}
          />
        )
      }

      popup = tippy(event.currentTarget, {
        content: contentDiv,
        appendTo: () => document.body,
        showOnCreate: true,
        interactive: true,
        trigger: 'manual',
        placement: 'bottom-start',
        arrow: false,
        theme: 'go-away',
        popperOptions: {
          strategy: 'fixed', // @note ensures tooltip uses fixed positioning
        },
        onHidden: (instance) => {
          instance.destroy()
        },
      })

      renderContent(selectedBot)
    },
    [bots, selectedBot, setSelectedBot]
  )

  const handleDeselectBot = useCallback(() => {
    const autoBot = bots.find((bot) => bot.auto)

    setSelectedBot(autoBot || bots[0])
  }, [bots, setSelectedBot])

  const handleSelectModelClick = useCallback(
    (event) => {
      const contentDiv = document.createElement('div')

      let root = null
      let popup = null

      const renderContent = (currentSelectedModel) => {
        if (!root) {
          root = createRoot(contentDiv)
        }

        root.render(
          <ModelSelectorList
            models={models}
            selectedModel={currentSelectedModel}
            onSelectModel={(model) => {
              let newSelectedModel = model

              setSelectedModel(newSelectedModel)

              renderContent(newSelectedModel)

              // @note is it a good idea to hide automatically?
              // popup?.hide()
            }}
          />
        )
      }

      popup = tippy(event.currentTarget, {
        content: contentDiv,
        appendTo: () => document.body,
        showOnCreate: true,
        interactive: true,
        trigger: 'manual',
        placement: 'bottom-start',
        arrow: false,
        theme: 'go-away',
        popperOptions: {
          strategy: 'fixed', // @note ensures tooltip uses fixed positioning
        },
        onHidden: (instance) => {
          instance.destroy()
        },
      })

      renderContent(selectedModel)
    },
    [models, selectedModel, setSelectedModel]
  )

  const handleDeselectModel = useCallback(() => {
    const autoModel = models.find((model) => model.auto)

    setSelectedModel(autoModel || models[0])
  }, [models, setSelectedModel])

  const handleSelectSourcesClick = useCallback(
    (event) => {
      const contentDiv = document.createElement('div')

      let root = null
      let popup = null

      const renderContent = (currentSelectedSources) => {
        if (!root) {
          root = createRoot(contentDiv)
        }

        root.render(
          <SourceSelectorList
            sources={sources}
            selectedSources={currentSelectedSources}
            onSelectSource={(source) => {
              let newSelectedSources = currentSelectedSources.some(
                (s) => s.id === source.id
              )
                ? currentSelectedSources.filter((s) => s.id !== source.id)
                : [...currentSelectedSources, source]

              if (newSelectedSources.some(({ auto }) => !!auto)) {
                newSelectedSources = []
              }

              setSelectedSources(newSelectedSources)

              renderContent(newSelectedSources)

              // @note we are not hiding automatically because we allow for
              // multiple selection
              // popup?.hide()
            }}
          />
        )
      }

      popup = tippy(event.currentTarget, {
        content: contentDiv,
        appendTo: () => document.body,
        showOnCreate: true,
        interactive: true,
        trigger: 'manual',
        placement: 'bottom-start',
        arrow: false,
        theme: 'go-away',
        popperOptions: {
          strategy: 'fixed', // @note ensures tooltip uses fixed positioning
        },
        onHidden: (instance) => {
          instance.destroy()
        },
      })

      renderContent(selectedSources)
    },
    [sources, selectedSources, setSelectedSources]
  )

  const handleDeselectSource = useCallback((source) => {
    setSelectedSources((prev) => prev.filter((s) => s.id !== source.id))
  }, [])

  const handleAttachFile = useCallback(() => {
    openAttachmentsDialog()
  }, [openAttachmentsDialog])

  const handleTakeScreenshot = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({})

      const video = document.createElement('video')

      {
        video.srcObject = stream
        video.play()
      }

      video.onloadedmetadata = async function () {
        const canvas = document.createElement('canvas')

        {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
        }

        const context = canvas.getContext('2d')

        {
          context?.drawImage(video, 0, 0, canvas.width, canvas.height)
        }

        canvas.toBlob(function (blob) {
          if (!blob) {
            toast.error('Failed to take screenshot')

            return
          }

          appendAttachment(
            new File([blob], 'screenshot.png', {
              type: 'image/png',
            })
          )

          toast.success('Screenshot taken')
        })

        stream.getTracks().forEach((track) => track.stop())
      }
    } catch (e) {
      toast.error('Could not take screenshot: ' + e)
    }
  }, [appendAttachment])

  const handleAbortStream = useCallback(() => {
    // @note aborting the active reply also drops any queued follow-ups - the
    // user is explicitly stopping the current train of thought

    setPendingMessages([])

    aborter.abort('Aborted by user')
  }, [aborter])

  const [improvingPrompt, setImprovingPrompt] = useState(false)

  const handleImprovePrompt = useCallback(async () => {
    if (!editorRef.current || improvingPrompt) {
      return
    }

    const editor = editorRef.current
    const currentText = editor.getText()

    if (!currentText.trim()) {
      toast.error('Please enter some text to improve')

      return
    }

    setImprovingPrompt(true)

    try {
      const result = await improvePrompt({
        text: currentText,
      })

      if (result && 'error' in result) {
        throw new Error(result.error.message || 'Failed to improve prompt')
      }

      if (result?.improvedText && result.improvedText.trim()) {
        editor.chain().setContent(result.improvedText.trim()).focus().run()
        toast.success('Prompt improved successfully')
      } else {
        toast.error('Could not improve the prompt')
      }
    } catch (error) {
      toast.error('Failed to improve prompt: ' + error.message)
    } finally {
      setImprovingPrompt(false)
    }
  }, [improvingPrompt])

  const handleLargeTextPaste = useCallback(
    (text) => {
      const textBlob = new Blob([text], { type: 'text/plain' })

      const textFile = new File(
        [textBlob],
        `Pasted Text (${text.length} chars).txt`,
        {
          type: 'text/plain',
          lastModified: Date.now(),
        }
      )

      textFile.isLargeText = true
      textFile.originalContent = text

      setAttachments((prev) => [...prev, textFile])
    },
    [setAttachments]
  )

  const hasMessages = messages.length > 0

  {
    useEffect(() => {
      setShowFooter(hasMessages ? false : undefined)
    }, [hasMessages, setShowFooter])
  }

  useEffect(() => {
    // @note it will not delete if there is only one conversation

    if (!conversations?.length) {
      return
    }

    // @note do not update sidebar in ephemeral mode

    if (ephemeral) {
      return
    }

    setSidebarItems((items) => {
      const filteredItems = (items || []).filter(
        ({ title }) => !ALL_GROUPING_CAPTIONS.includes(title)
      )

      const groupedConversations =
        groupConversationsByTaskAndDate(conversations)

      const groupItems = groupedConversations.map((group) => ({
        title: group.title,
        expanded: true,
        collapsible: false,
        flat: true,
        items: group.conversations.map((conversation, index) => {
          const isTemp = conversation.id.startsWith('tmp-')

          const hasTask = !!conversation.task

          return {
            title: conversation.name || `Conversation`,

            href: !isTemp ? `/apps/chat/${conversation.id}` : undefined,

            // @note match the active conversation by pathname - exact enough
            // that a URL like /apps/chat/<id>extra no longer prefix-matches and
            // highlights the <id> conversation, but query-tolerant so the entry
            // still highlights when the url carries a query string
            exact: 'pathname',

            forcePrefetch: index < 5,

            icon: hasTask
              ? (props) => {
                  const status = conversation.task?.status
                  const outcome = conversation.task?.outcome

                  // @note display different icons based on task execution state
                  if (status === 'running') {
                    return (
                      <TaskLoadingIcon
                        {...props}
                        className="shrink-0 w-4 h-4 text-blue-500"
                      />
                    )
                  } else if (outcome === 'success') {
                    return (
                      <TaskCheckmarkIcon
                        {...props}
                        className="shrink-0 w-4 h-4 text-green-500"
                      />
                    )
                  } else if (outcome === 'failure') {
                    return (
                      <TaskFailureIcon
                        {...props}
                        className="shrink-0 w-4 h-4 text-red-500"
                      />
                    )
                  }

                  // @note pending or idle state - show default task icon
                  return (
                    <TaskCheckmarkIcon
                      {...props}
                      className="shrink-0 w-4 h-4 text-gray-400"
                    />
                  )
                }
              : undefined,

            menu: !isTemp
              ? {
                  className: 'text-sm',

                  items: [
                    {
                      title: 'Open',

                      href: `/apps/chat/${conversation.id}`,

                      selectable: false,
                    },
                    {
                      title: 'Delete',

                      onClick: async () =>
                        await deleteConversation(conversation.id),

                      selectable: false,
                    },
                  ],
                }
              : undefined,

            data: {
              type: 'history-item',
            },
          }
        }),
      }))

      return [...filteredItems, ...groupItems]
    })
  }, [ephemeral, conversations, setSidebarItems, deleteConversation])

  useConsoleDebugFunctions({
    getMessages: {
      description: 'Gets a list of messages',
      fn: () => {
        return messages
      },
    },

    printMessages: {
      description: 'Prints a list of messages',
      fn: () => {
        // eslint-disable-next-line no-console
        console.table(messages)
      },
    },
  })

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400&display=swap');

        html,
        body {
          overscroll-behavior-y: none;
        }
      `}</style>
      {codeAction}
      {/* drag & drop */}
      <input {...dropzoneInputProps} />
      {/* context */}
      <ConversationContextProvider messages={messages}>
        {/* nav */}
        <Portal query="#app-nav-title">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">
              {appState?.conversation?.name || ''}
            </p>
          </div>
        </Portal>
        <div
          {...dropzoneRootProps}
          className={clsx('absolute left-0 top-0 h-full w-full', {
            relative: hasMessages,
          })}
        >
          <div
            className={clsx(
              'main-page main-page-3xl xl:main-page-4xl px-5 xl:px-12 pb-0',
              {
                'w-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pb-32':
                  !hasMessages,
              }
            )}
          >
            {/* tips */}
            <InputMentionsTip
              disabled={useMemo(
                () => messages.filter(({ type }) => type === 'user').length < 2,
                [messages]
              )}
            />
            {/* scene */}
            <Scene collapsed={hasMessages} />
            {/* messages */}
            {hasMessages ? (
              <ChatMessages.Memo
                messages={messages}
                incoming={incoming}
                bots={bots}
                conversationId={conversationId}
                thinking={thinking}
                writing={writing}
                forceReferences={features?.references?.force === true}
                collectFeedbackReason={features?.feedback?.reason === true}
                showTools={true}
              >
                {pendingMessages.length ? (
                  <PendingMessages
                    pending={pendingMessages}
                    onCancel={removePendingMessage}
                  />
                ) : null}
              </ChatMessages.Memo>
            ) : null}
            {/* chat area */}
            <ChatArea.Memo
              className={clsx({
                [clsx('pointer-events-none')]: isDragActive,
              })}
              innerClassName={clsx({
                [clsx(
                  'after:content-["Drop_files_to_attach"]',
                  'after:absolute',
                  'after:inset-0',
                  'after:bg-gray-50/40 dark:after:bg-gray-800/60 after:backdrop-blur-sm',
                  'after:border after:border-indigo-500 dark:after:border-gray-400 after:border-dashed',
                  'after:text-gray-500 dark:after:text-white',
                  'after:flex after:items-center after:justify-center',
                  'after:text-base after:font-medium',
                  'after:rounded-2xl',
                  'after:pointer-events-none'
                )]: isDragActive,
              })}
              editorRef={editorRef}
              bots={bots}
              models={models}
              sources={sources}
              attachments={attachments}
              setAttachments={setAttachments}
              clips={clips}
              setClips={setClips}
              hasMessages={hasMessages}
              handleOnSubmit={handleOnSubmit}
              handleSubmit={handleSubmit}
              handleAttachFile={handleAttachFile}
              handleTakeScreenshot={handleTakeScreenshot}
              handleSelectBotClick={handleSelectBotClick}
              handleDeselectBot={handleDeselectBot}
              handleSelectModelClick={handleSelectModelClick}
              handleDeselectModel={handleDeselectModel}
              handleSelectSourcesClick={handleSelectSourcesClick}
              handleDeselectSource={handleDeselectSource}
              handleAbortStream={handleAbortStream}
              handleImprovePrompt={handleImprovePrompt}
              handleLargeTextPaste={handleLargeTextPaste}
              selectedBot={selectedBot}
              selectedModel={selectedModel}
              selectedSources={selectedSources}
              thinking={thinking}
              writing={writing}
              improvingPrompt={improvingPrompt}
              features={features}
              trace={embedded}
              config={config}
            />
            {/* chat text selection tools */}
            <ChatTextSelectionTools.Memo
              target=".message,.file-block-content"
              appendClip={appendClip}
            />
            {/* initial */}
            {!hasMessages ? <Initial initial={initial} /> : null}
          </div>
        </div>
        {children}
      </ConversationContextProvider>
    </>
  )
}

/**
 * Thin shell: declares which extra features are available for the embedded
 * context, then delegates everything else to MainContent which consumes the
 * context like any other consumer.
 */
export function Main(props) {
  return (
    <ChatExtraFeaturesProvider>
      <MainContent {...props} />
    </ChatExtraFeaturesProvider>
  )
}

export function MainConfigurator({
  conversation,
  selectedBot,
  selectedModel,
  selectedSource,
}) {
  const { setState, resetInfobarWidth } = useApp()

  useEffect(() => {
    setState((state) => ({
      ...state,

      conversation,

      selectedBot,

      selectedModel,

      selectedSource,
    }))

    resetInfobarWidth()
  }, [
    setState,
    resetInfobarWidth,
    conversation,
    selectedBot,
    selectedModel,
    selectedSource,
  ])

  return null
}

export default Main
