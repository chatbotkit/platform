import { useCallback, useMemo, useRef } from 'react'

import {
  redactEntities,
  simplifyEntities,
  unredactEntities,
} from '@/lib/entity'
import { either } from '@/lib/helpers'
import { byteSlice, getRandomId } from '@/lib/string'
import { extractUrls } from '@/lib/unfurl.url'

import useAborter from '@/hooks/useAborter'
import useConversationManagerFetch from '@/hooks/useConversationManagerFetch'
import useConversationManagerState from '@/hooks/useConversationManagerState'
import useFunctionDispatch from '@/hooks/useFunctionDispatch'
import useTrace from '@/hooks/useTrace'

export const ERROR_TYPE = 'error'
export const TOKEN_TYPE = 'token'
export const REASONING_TOKEN_TYPE = 'reasoningToken'
export const MESSAGE_TYPE = 'message'
export const INTENT_DETECTION_BEGIN_TYPE = 'intentDetectionBegin'
export const INTENT_DETECTION_END_TYPE = 'intentDetectionEnd'
export const OPERATION_BEGIN_TYPE = 'operationBegin'
export const OPERATION_END_TYPE = 'operationEnd'
export const DATASET_SEARCH_BEGIN_TYPE = 'datasetSearchBegin'
export const DATASET_SEARCH_END_TYPE = 'datasetSearchEnd'
export const SEND_RESULT_TYPE = 'sendResult'
export const RECEIVE_RESULT_TYPE = 'receiveResult'
export const WAIT_FOR_CHANNEL_MESSAGE_BEGIN_TYPE = 'waitForChannelMessageBegin'

/**
 * @typedef {Record<string, unknown> & {
 *   stream?: boolean,
 *   functions?: Array<{
 *     name: string,
 *     description?: string,
 *     parameters?: Record<string, unknown>,
 *     handler?: (...args: unknown[]) => unknown,
 *   }>,
 * }} ConversationManagerOptions
 */

function getOptions(options) {
  options = { ...options }

  if (process.env.NODE_ENV === 'development') {
    if ('conversationId' in options) {
      throw new Error(`conversationId usage detected`)
    }

    if ('token' in options) {
      throw new Error(`Implicit token usage detected`)
    }

    if ('text' in options) {
      throw new Error(`Implicit text usage detected`)
    }
  }

  return options
}

/**
 * @param {ConversationManagerOptions} [options]
 */
export default function useConversationManager({
  autoStart,
  autoClear,
  autoAddBackstory,

  privacy,
  moderation,

  stream,

  tps,

  verbose,

  unfurl,

  maxTextByteLength,

  toastId,

  loadingMessage,
  failureMessage,
  successMessage,
  streamingMessage,

  // @note opt-in: when set, a usage-limit (LIMITS_REACHED) response surfaces
  // this text as a bot message client-side instead of the placeholder silently
  // vanishing. Used by the embedded widget.
  limitReplyText,

  onError,
  onStart,
  onSend,
  onReceive,
  onItem,

  basePrefix = '/api',

  conversationCreateEndpoint = '/v1/conversation/create',
  conversationInitiateEndpoint = '/v1/conversation/[conversationId]/initiate',
  conversationSendEndpoint = '/v1/conversation/[conversationId]/send',
  conversationReceiveEndpoint = '/v1/conversation/[conversationId]/receive',
  conversationCompleteEndpoint = '/v1/conversation/[conversationId]/complete',
  conversationAttachmentUploadEndpoint = '/v1/conversation/[conversationId]/attachment/upload',

  urlUnfurlEndpoint = '/v1/url/unfurl',

  driver,

  app,

  ...initialState
} = {}) {
  // trace

  const trace = useTrace()

  // state

  const {
    backstory,
    setBackstory,

    model,
    setModel,

    botId,
    setBotId,

    datasetId,
    setDatasetId,

    skillsetId,
    setSkillsetId,

    conversationId,
    setConversationId,

    token,
    setToken,

    messages,
    setMessages,

    entities,
    setEntities,

    references,
    setReferences,

    functions,
    setFunctions,

    attachments,
    setAttachments,

    text,
    setText,

    thinking,
    setThinking,

    writing,
    setWriting,

    appendMessage,
    prependMessage,
    extendMessage,
    removeMessage,

    addBotMessageToken,
    addBotMessageReasoningToken,
    addBotMessageAction,

    extendLastUserMessage,
    extendLastBotMessage,

    receivedMessages,
    incomingMessage,
  } = useConversationManagerState(initialState)

  // context

  const contextRef = useRef({})

  contextRef.current.messages = messages

  // client-side function handlers

  const functionChannelRef = useRef(new Map())

  const functionsWithChannels = useMemo(() => {
    const channels = new Set()

    return functions.map((fn) => {
      if (!fn?.handler) {
        if (fn?.result?.channel) {
          channels.add(fn.result.channel)
        }

        return fn
      }

      let channel = fn.result?.channel

      if (!channel) {
        channel = functionChannelRef.current.get(fn.name)

        if (!channel) {
          channel = `conversation-function-${fn.name}-${getRandomId()}`

          functionChannelRef.current.set(fn.name, channel)
        }
      }

      if (process.env.NODE_ENV === 'development' && channels.has(channel)) {
        throw new Error(
          `Duplicate function result channel detected: ${channel}`
        )
      }

      channels.add(channel)

      return {
        ...fn,

        result: {
          channel,
        },
      }
    })
  }, [functions])

  const functionHandlerMap = useMemo(() => {
    return new Map(
      functionsWithChannels
        .filter((fn) => fn?.handler && fn?.result?.channel)
        .map((fn) => [fn.result.channel, fn])
    )
  }, [functionsWithChannels])

  const getSerializableFunctions = useCallback(() => {
    return functionsWithChannels?.map(
      ({ name, description, parameters, result }) => ({
        name,
        description,
        parameters,
        result,
      })
    )
  }, [functionsWithChannels])

  // fetch

  const {
    loading,

    streaming,

    code,

    fetch,

    fetchStream,

    reportError,
  } = useConversationManagerFetch({
    toastId: toastId,

    loadingMessage: loadingMessage,
    failureMessage: failureMessage,
    successMessage: successMessage,
    streamingMessage: streamingMessage,

    stream: stream,

    tps: tps,

    token: token,

    basePrefix: basePrefix,

    driver: driver,
  })

  const handleChannelFunctionItem = useCallback(
    async (options, item) => {
      if (item.type !== WAIT_FOR_CHANNEL_MESSAGE_BEGIN_TYPE) {
        return false
      }

      const channel = item.data?.channel
      const fn = functionHandlerMap.get(channel)

      if (!fn) {
        return false
      }

      try {
        const result = await fn.handler?.(item.data?.function?.args || {})

        await fetch(`/v1/channel/${channel}/publish`, {
          ...options,

          data: {
            message: {
              result,
            },
          },

          context: contextRef.current,

          trackLoading: false,
          trackStreaming: false,
        })
      } catch (error) {
        await fetch(`/v1/channel/${channel}/publish`, {
          ...options,

          data: {
            message: {
              error:
                error instanceof Error
                  ? error.message
                  : 'Function handler failed',
            },
          },

          context: contextRef.current,

          trackLoading: false,
          trackStreaming: false,
        })
      }

      return true
    },
    [fetch, functionHandlerMap]
  )

  // abort

  const aborter = useAborter([])

  // error helper functions

  const handleError = useCallback(
    async (error, options) => {
      options = getOptions(options)

      if (options.onError) {
        await options.onError(error)
      }

      if (onError) {
        await onError(error)
      }

      await reportError(error, options)
    },
    [onError, reportError]
  )

  // attachment helper functions

  const processAttachments = useCallback(
    async (conversationId, options) => {
      options = getOptions(options)

      const thisAttachments = /** @type {Array<File>} */ (
        either(options.attachments, attachments)
      )

      let processedAttachments = []

      if (thisAttachments?.length) {
        if (!conversationId) {
          throw new Error('Conversation ID is required to process attachments')
        }

        setAttachments([]) // @note we want to clear out the attachments as soon as possible to improve the responsiveness of the UI

        for (let attachment of thisAttachments) {
          const { error: uploadError, data: uploadData } = await fetch(
            conversationAttachmentUploadEndpoint.replace(
              '[conversationId]',
              conversationId
            ),
            {
              ...options,

              data: {
                file: {
                  name: attachment.name,
                  type: attachment.type,
                  size: attachment.size,
                },
              },

              context: contextRef.current,
            }
          )

          if (uploadError) {
            await handleError(uploadError, options)
          } else {
            processedAttachments.push({
              id: uploadData.id,
              remoteName: uploadData.name,
              localName: attachment.name,
              type: attachment.type,
              size: attachment.size,
              localURL: URL.createObjectURL(attachment),
            })

            await fetch(uploadData.uploadRequest.url, {
              ...options,

              method: uploadData.uploadRequest.method,

              headers: {
                Authorization: undefined, // @note we don't want to send the token for the upload

                ...uploadData.uploadRequest.headers,
              },

              body: await attachment.arrayBuffer(),

              dataType: 'body',

              context: contextRef.current,
            })
          }
        }
      }

      let finalText = ''

      if (processedAttachments.length) {
        extendLastUserMessage({
          attachments: processedAttachments,
        })
      }

      return finalText
    },
    [
      conversationAttachmentUploadEndpoint,

      attachments,

      extendLastUserMessage,

      fetch,

      handleError,

      setAttachments,
    ]
  )

  // unfurl helper functions

  const handleUnfurling = useCallback(
    async (messageId, text, options) => {
      if (!unfurl) {
        return
      }

      const maxUrls = 3 // @todo make configurable

      const urls = extractUrls(text)

      // check if too many URLs or no URLs found

      if (urls.length > maxUrls || urls.length === 0) {
        return
      }

      // extract the first URL that does not contain a hash fragment

      const url = urls.filter((url) => !url.includes('#'))[0]

      const { error, data } = await fetch(urlUnfurlEndpoint, {
        ...options,

        data: {
          url,
        },

        context: contextRef.current,

        trackLoading: false,
        trackStreaming: false,
      })

      if (!error) {
        extendMessage(messageId, {
          micro: data.data,

          updatedAt: Date.now(), // @note required to correctly update the message
        })
      }
    },
    [urlUnfurlEndpoint, extendMessage, fetch, unfurl]
  )

  // handle operation

  const getVerboseOperationBeginAction = useCallback(
    (data) => {
      if (!verbose) {
        return null
      }

      const { action } = data

      if (!action) {
        return null
      }

      let verboseTypes = []

      if (Array.isArray(verbose)) {
        verboseTypes = verbose
      } else if (typeof verbose === 'boolean') {
        verboseTypes = ['dataset', 'skillset', 'function']
      }

      const {
        id,

        kind: actionKind,

        name,

        input: _input,

        justification,
      } = action

      const kind =
        actionKind ||
        (verboseTypes.length === 1 ? verboseTypes[0] : undefined) ||
        'dataset'

      if (!verboseTypes.includes(kind)) {
        return null
      }

      // @note input can be a string or an object, so we normalize it to a
      // string for display purposes

      const input =
        typeof _input === 'string'
          ? _input
          : _input
          ? JSON.stringify(_input)
          : _input

      if (!justification && !input && !name) {
        return null
      }

      return {
        id,
        kind,
        name,
        input,
        justification,
        working: true,
      }
    },
    [verbose]
  )

  const getVerboseOperationEndAction = useCallback(
    (data) => {
      if (!verbose) {
        return null
      }

      const { action } = data

      if (!action) {
        return null
      }

      let verboseTypes = []

      if (Array.isArray(verbose)) {
        verboseTypes = verbose
      } else if (typeof verbose === 'boolean') {
        verboseTypes = ['dataset', 'skillset', 'function']
      }

      const kind =
        action.kind ||
        (verboseTypes.length === 1 ? verboseTypes[0] : undefined) ||
        'dataset'

      if (!verboseTypes.includes(kind) || !action.id) {
        return null
      }

      return {
        ...action,
        kind,
        working: false,
      }
    },
    [verbose]
  )

  // handle on start/send/receive/item

  const handleOnStart = useFunctionDispatch(
    // @note the reason we use function dispatch is because we wont have the
    // conversationId at the time the function is called, so we need to invoke
    // the function after the state is updated
    async (options, data) => {
      options = getOptions(options)

      if (options.onStart) {
        await options.onStart(conversationId, data)
      }

      if (onStart) {
        await onStart(conversationId, data)
      }
    },
    [conversationId, onStart]
  )

  const handleOnSend = useCallback(
    async (options, data) => {
      options = getOptions(options)

      if (options.onSend) {
        await options.onSend(conversationId, data)
      }

      if (onSend) {
        await onSend(conversationId, data)
      }
    },
    [conversationId, onSend]
  )

  const handleOnReceive = useCallback(
    async (options, data) => {
      options = getOptions(options)

      if (options.onReceive) {
        await options.onReceive(conversationId, data)
      }

      if (onReceive) {
        await onReceive(conversationId, data)
      }
    },
    [conversationId, onReceive]
  )

  const handleOnItem = useCallback(
    async (options, data) => {
      options = getOptions(options)

      if (options.onItem) {
        await options.onItem(conversationId, data)
      }

      if (onItem) {
        await onItem(conversationId, data)
      }

      await handleChannelFunctionItem(options, data)
    },
    [conversationId, handleChannelFunctionItem, onItem]
  )

  // conversation utility methods

  const getConversationOptions = useCallback(() => {
    return {
      botId,

      backstory,

      model,

      datasetId,
      skillsetId,

      privacy,
      moderation,

      meta: {
        app,
      },
    }
  }, [botId, backstory, model, datasetId, skillsetId, privacy, moderation, app])

  // state utility methods

  const flushText = useFunctionDispatch(
    async function flushText(options) {
      options = getOptions(options)

      if (text) {
        appendMessage({
          id: getRandomId('tmp-'),
          text: text,
          type: 'user',
          createdAt: Date.now(),
          extra: options.extra,
        })

        setText('')
      }

      if (options.callback) {
        await options.callback({ text })
      }
    },
    [text, setText, appendMessage]
  )

  // base methods

  const sendMessage = useFunctionDispatch(
    async function sendMessage(options) {
      options = getOptions(options)

      // deal with the text first

      let thisText

      {
        // if we have a text to use then use it instead

        if (options.textToUse) {
          thisText = options.textToUse

          delete options.textToUse
        } else {
          if (text) {
            // commit the text message to speed up the user experience

            flushText(options)

            thisText = text
          }
        }

        if (!thisText) {
          // if no text then we must bail out

          return
        }

        // truncate text if maxTextByteLength is set

        if (maxTextByteLength) {
          thisText = byteSlice(thisText, 0, maxTextByteLength)
        }
      }

      // @note this is a state invariant - conversationId must be set before
      // calling sendMessage, throw to fail-fast and expose programming bugs

      if (!conversationId) {
        throw new Error('Conversation ID is required to send messages')
      }

      // redact the entities

      const [redactedText, ...extractedEntities] = redactEntities(
        thisText,
        entities
      )

      // process the attachments

      const attachmentsText = await processAttachments(conversationId, options)

      // build the final text

      const finalText = redactedText + attachmentsText

      // create the stream

      setThinking(true)
      setWriting(false)

      try {
        trace.log(`conversation/send`)

        const iter = await fetchStream(
          conversationSendEndpoint.replace('[conversationId]', conversationId),
          {
            ...options,

            signal: aborter.signal,

            headers: {
              ...options?.headers,

              'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
            },

            data: {
              text: finalText,

              entities: extractedEntities,

              functions: getSerializableFunctions(),
            },

            context: contextRef.current,

            errorType: ERROR_TYPE,
            returnType: SEND_RESULT_TYPE,
          }
        )

        // build the new entities

        const newEntities = { ...entities }

        // process the stream

        for await (let { type, data } of iter) {
          trace.event(type, data)

          if (aborter.aborted) {
            break
          }

          setWriting(true)

          await handleOnItem(options, { type, data })

          switch (type) {
            case ERROR_TYPE: {
              await handleError(data, options)

              break
            }

            case OPERATION_BEGIN_TYPE: {
              break
            }

            case OPERATION_END_TYPE: {
              break
            }

            case DATASET_SEARCH_BEGIN_TYPE: {
              break
            }

            case DATASET_SEARCH_END_TYPE: {
              const { records } = data

              setReferences(records)

              break
            }

            case SEND_RESULT_TYPE: {
              await handleOnSend(options, data)

              const { entities: _entities } = data

              Object.assign(newEntities, simplifyEntities(_entities))

              setEntities(newEntities)

              break
            }
          }
        }
      } finally {
        setThinking(false)
        setWriting(false)
      }
    },
    [
      conversationSendEndpoint,

      trace,

      setThinking,
      setWriting,

      flushText,

      text,

      conversationId,

      entities,
      setEntities,

      setReferences,

      getSerializableFunctions,

      aborter,

      fetchStream,

      handleError,
      handleOnItem,
      handleOnSend,

      processAttachments,

      maxTextByteLength,
    ]
  )

  const receiveMessage = useFunctionDispatch(
    async function receiveMessage(options) {
      options = getOptions(options)

      // @note this is a state invariant - conversationId must be set before
      // calling receiveMessage, throw to fail-fast and expose programming bugs

      if (!conversationId) {
        throw new Error('Conversation ID is required to receive messages')
      }

      // create the stream

      setThinking(true)
      setWriting(false)

      try {
        trace.log(`conversation/receive`)

        const iter = await fetchStream(
          conversationReceiveEndpoint.replace(
            '[conversationId]',
            conversationId
          ),
          {
            ...options,

            signal: aborter.signal,

            headers: {
              ...options?.headers,

              'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
            },

            data: {
              // pass
            },

            context: contextRef.current,

            errorType: ERROR_TYPE,
            returnType: RECEIVE_RESULT_TYPE,
          }
        )

        // create a temp message for the bot tokens

        let botTempMessageId = getRandomId('tmp-')

        let previousTempBotMessageId = null

        // process the stream

        for await (let { type, data } of iter) {
          trace.event(type, data)

          if (aborter.aborted) {
            break
          }

          setWriting(true)

          await handleOnItem(options, { type, data })

          switch (type) {
            case ERROR_TYPE: {
              await handleError(data, options)

              if (data.code === 'LIMITS_REACHED') {
                removeMessage(botTempMessageId)

                // @note surface a pre-canned reply (opt-in via limitReplyText,
                // e.g. the embedded widget) so the user sees a response instead
                // of the streaming placeholder silently disappearing
                if (limitReplyText) {
                  appendMessage({
                    id: getRandomId('bot-'),
                    type: 'bot',
                    text: limitReplyText,
                  })
                }
              }

              break
            }

            case OPERATION_BEGIN_TYPE: {
              const action = await getVerboseOperationBeginAction(data)

              if (action) {
                addBotMessageAction(botTempMessageId, action)
              }

              break
            }

            case OPERATION_END_TYPE: {
              const action = await getVerboseOperationEndAction(data)

              if (action) {
                addBotMessageAction(botTempMessageId, action)
              }

              break
            }

            case DATASET_SEARCH_BEGIN_TYPE: {
              break
            }

            case DATASET_SEARCH_END_TYPE: {
              const { records } = data

              setReferences(records)

              extendLastBotMessage({
                references: records,
              })

              break
            }

            case TOKEN_TYPE: {
              const { token } = data

              addBotMessageToken(botTempMessageId, token)

              break
            }

            case REASONING_TOKEN_TYPE: {
              const { token } = data

              addBotMessageReasoningToken(botTempMessageId, token)

              break
            }

            case MESSAGE_TYPE: {
              const message = data

              if (message.type === 'bot') {
                extendMessage(
                  botTempMessageId,
                  {
                    // @note do not change the message id

                    text: unredactEntities(message.text.trim(), entities),

                    type: 'bot',

                    createdAt: Date.now(),
                  },
                  true
                )

                await handleUnfurling(botTempMessageId, message.text, options)

                previousTempBotMessageId = botTempMessageId

                botTempMessageId = getRandomId('tmp-')
              }

              break
            }

            case RECEIVE_RESULT_TYPE: {
              await handleOnReceive(options, data)

              const { id, text } = data

              if (!text) {
                removeMessage(previousTempBotMessageId || botTempMessageId)
              } else {
                extendMessage(
                  previousTempBotMessageId || botTempMessageId,
                  {
                    id: id,

                    text: unredactEntities(text.trim(), entities),

                    type: 'bot',

                    createdAt: Date.now(),
                  },
                  true
                )

                await handleUnfurling(id, text, options)
              }

              break
            }

            default: {
              // pass

              break
            }
          }
        }
      } finally {
        setThinking(false)
        setWriting(false)
      }
    },
    [
      conversationReceiveEndpoint,

      trace,

      setThinking,
      setWriting,

      addBotMessageToken,
      addBotMessageReasoningToken,
      addBotMessageAction,
      extendMessage,
      removeMessage,
      appendMessage,

      limitReplyText,

      extendLastBotMessage,

      conversationId,

      entities,

      setReferences,

      aborter,

      fetchStream,

      handleError,
      getVerboseOperationBeginAction,
      getVerboseOperationEndAction,
      handleOnItem,
      handleOnReceive,
      handleUnfurling,
    ]
  )

  const completeMessage = useFunctionDispatch(
    async function completeMessage(options) {
      options = getOptions(options)

      // deal with the text first

      let thisText

      {
        // if we have a text to use then use it instead

        if (options.textToUse) {
          thisText = options.textToUse

          delete options.textToUse
        } else {
          if (text) {
            // commit the text message to speed up the user experience

            flushText(options)

            thisText = text
          }
        }

        if (!thisText) {
          // if no text then we must bail out

          return
        }

        // truncate text if maxTextByteLength is set

        if (maxTextByteLength) {
          thisText = byteSlice(thisText, 0, maxTextByteLength)
        }
      }

      // @note this is a state invariant - conversationId must be set before
      // calling completeMessage, throw to fail-fast and expose programming bugs

      if (!conversationId) {
        throw new Error('Conversation ID is required to complete a message')
      }

      // redact the entities

      const [redactedText, ...extractedEntities] = redactEntities(
        thisText,
        entities
      )

      // process the attachments

      const attachmentsText = await processAttachments(conversationId, options)

      // build the final text

      const finalText = redactedText + attachmentsText

      // create the stream

      setThinking(true)
      setWriting(false)

      try {
        trace.log(`conversation/complete`)

        const iter = await fetchStream(
          conversationCompleteEndpoint.replace(
            '[conversationId]',
            conversationId
          ),
          {
            ...options,

            signal: aborter.signal,

            headers: {
              ...options?.headers,

              'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
            },

            data: {
              text: finalText,

              entities: extractedEntities,

              functions: getSerializableFunctions(),
            },

            context: contextRef.current,

            errorType: ERROR_TYPE,
            returnType: RECEIVE_RESULT_TYPE,
          }
        )

        // build the new entities

        const newEntities = { ...entities }

        // create a temp message for the bot tokens

        let botTempMessageId = getRandomId('tmp-')

        let previousTempBotMessageId = null

        // process the stream

        for await (let { type, data } of iter) {
          trace.event(type, data)

          if (aborter.aborted) {
            break
          }

          setWriting(true)

          await handleOnItem(options, { type, data })

          switch (type) {
            case ERROR_TYPE: {
              await handleError(data, options)

              if (data.code === 'LIMITS_REACHED') {
                removeMessage(botTempMessageId)

                // @note surface a pre-canned reply (opt-in via limitReplyText,
                // e.g. the embedded widget) so the user sees a response instead
                // of the streaming placeholder silently disappearing
                if (limitReplyText) {
                  appendMessage({
                    id: getRandomId('bot-'),
                    type: 'bot',
                    text: limitReplyText,
                  })
                }
              }

              break
            }

            case OPERATION_BEGIN_TYPE: {
              const action = await getVerboseOperationBeginAction(data)

              if (action) {
                addBotMessageAction(botTempMessageId, action)
              }

              break
            }

            case OPERATION_END_TYPE: {
              const action = await getVerboseOperationEndAction(data)

              if (action) {
                addBotMessageAction(botTempMessageId, action)
              }

              break
            }

            case DATASET_SEARCH_BEGIN_TYPE: {
              break
            }

            case DATASET_SEARCH_END_TYPE: {
              const { records } = data

              setReferences(records)

              extendLastBotMessage({
                references: records,
              })

              break
            }

            case TOKEN_TYPE: {
              const { token } = data

              addBotMessageToken(botTempMessageId, token)

              break
            }

            case REASONING_TOKEN_TYPE: {
              const { token } = data

              addBotMessageReasoningToken(botTempMessageId, token)

              break
            }

            case MESSAGE_TYPE: {
              const message = data

              if (message.type === 'bot') {
                extendMessage(
                  botTempMessageId,
                  {
                    // @note do not change the message id

                    text: unredactEntities(message.text.trim(), newEntities),

                    type: 'bot',

                    createdAt: Date.now(),
                  },
                  true
                )

                await handleUnfurling(botTempMessageId, message.text, options)

                previousTempBotMessageId = botTempMessageId

                botTempMessageId = getRandomId('tmp-')
              }

              break
            }

            case SEND_RESULT_TYPE: {
              await handleOnSend(options, data)

              const { entities: _entities } = data

              Object.assign(newEntities, simplifyEntities(_entities))

              setEntities(newEntities)

              break
            }

            case RECEIVE_RESULT_TYPE: {
              await handleOnReceive(options, data)

              const { id, text } = data

              if (!text) {
                removeMessage(previousTempBotMessageId || botTempMessageId)
              } else {
                extendMessage(
                  previousTempBotMessageId || botTempMessageId,
                  {
                    id: id,

                    text: unredactEntities(text.trim(), newEntities),

                    type: 'bot',

                    createdAt: Date.now(),
                  },
                  true
                )

                await handleUnfurling(id, text, options)
              }

              break
            }

            default: {
              // pass

              break
            }
          }
        }
      } finally {
        setThinking(false)
        setWriting(false)
      }
    },
    [
      conversationCompleteEndpoint,

      trace,

      setThinking,
      setWriting,

      flushText,

      text,

      addBotMessageToken,
      addBotMessageReasoningToken,
      addBotMessageAction,

      extendMessage,
      removeMessage,
      appendMessage,

      limitReplyText,

      extendLastBotMessage,

      conversationId,

      entities,
      setEntities,

      setReferences,

      getSerializableFunctions,

      aborter,

      fetchStream,

      handleError,
      getVerboseOperationBeginAction,
      getVerboseOperationEndAction,
      handleOnItem,
      handleOnReceive,
      handleOnSend,
      handleUnfurling,

      processAttachments,

      maxTextByteLength,
    ]
  )

  const initiateMessage = useFunctionDispatch(
    async function initiateMessage(options) {
      options = getOptions(options)

      // deal with the text first

      let thisText

      {
        thisText = options.textToUse
      }

      // @note this is a state invariant - conversationId must be set before
      // calling initiateMessage, throw to fail-fast and expose programming bugs

      if (!conversationId) {
        throw new Error('Conversation ID is required to initiate a message')
      }

      // redact the entities

      const [redactedText, ...extractedEntities] = redactEntities(
        thisText,
        entities
      )

      // build the final text

      const finalText = redactedText

      // create the stream

      setThinking(true)
      setWriting(false)

      try {
        const iter = await fetchStream(
          conversationInitiateEndpoint.replace(
            '[conversationId]',
            conversationId
          ),
          {
            ...options,

            signal: aborter.signal,

            headers: {
              ...options?.headers,

              'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
            },

            data: {
              text: finalText,

              entities: extractedEntities,

              functions: getSerializableFunctions(),
            },

            context: contextRef.current,

            errorType: ERROR_TYPE,
            returnType: RECEIVE_RESULT_TYPE,
          }
        )

        // build the new entities

        const newEntities = { ...entities }

        // create a temp message for the bot tokens

        let botTempMessageId = getRandomId('tmp-')

        let previousTempBotMessageId = null

        // process the stream

        for await (let { type, data } of iter) {
          trace.event(type, data)

          if (aborter.aborted) {
            break
          }

          setWriting(true)

          await handleOnItem(options, { type, data })

          switch (type) {
            case ERROR_TYPE: {
              await handleError(data, options)

              if (data.code === 'LIMITS_REACHED') {
                removeMessage(botTempMessageId)

                // @note surface a pre-canned reply (opt-in via limitReplyText,
                // e.g. the embedded widget) so the user sees a response instead
                // of the streaming placeholder silently disappearing
                if (limitReplyText) {
                  appendMessage({
                    id: getRandomId('bot-'),
                    type: 'bot',
                    text: limitReplyText,
                  })
                }
              }

              break
            }

            case OPERATION_BEGIN_TYPE: {
              const action = await getVerboseOperationBeginAction(data)

              if (action) {
                addBotMessageAction(botTempMessageId, action)
              }

              break
            }

            case OPERATION_END_TYPE: {
              const action = await getVerboseOperationEndAction(data)

              if (action) {
                addBotMessageAction(botTempMessageId, action)
              }

              break
            }

            case DATASET_SEARCH_BEGIN_TYPE: {
              break
            }

            case DATASET_SEARCH_END_TYPE: {
              const { records } = data

              setReferences(records)

              extendLastBotMessage({
                references: records,
              })

              break
            }

            case TOKEN_TYPE: {
              const { token } = data

              addBotMessageToken(botTempMessageId, token)

              break
            }

            case REASONING_TOKEN_TYPE: {
              const { token } = data

              addBotMessageReasoningToken(botTempMessageId, token)

              break
            }

            case MESSAGE_TYPE: {
              const message = data

              if (message.type === 'bot') {
                extendMessage(
                  botTempMessageId,
                  {
                    // @note do not change the message id

                    text: unredactEntities(message.text.trim(), newEntities),

                    type: 'bot',

                    createdAt: Date.now(),
                  },
                  true
                )

                await handleUnfurling(botTempMessageId, message.text, options)

                previousTempBotMessageId = botTempMessageId

                botTempMessageId = getRandomId('tmp-')
              }

              break
            }

            case SEND_RESULT_TYPE: {
              await handleOnSend(options, data)

              const { entities: _entities } = data

              Object.assign(newEntities, simplifyEntities(_entities))

              setEntities(newEntities)

              break
            }

            case RECEIVE_RESULT_TYPE: {
              await handleOnReceive(options, data)

              const { id, text } = data

              if (!text) {
                removeMessage(previousTempBotMessageId || botTempMessageId)
              } else {
                extendMessage(
                  previousTempBotMessageId || botTempMessageId,
                  {
                    id: id,

                    text: unredactEntities(text.trim(), newEntities),

                    type: 'bot',

                    createdAt: Date.now(),
                  },
                  true
                )

                await handleUnfurling(id, text, options)
              }

              break
            }

            default: {
              // pass

              break
            }
          }
        }
      } finally {
        setThinking(false)
        setWriting(false)
      }
    },
    [
      conversationInitiateEndpoint,

      trace,

      setThinking,
      setWriting,

      addBotMessageToken,
      addBotMessageReasoningToken,
      addBotMessageAction,

      extendMessage,
      removeMessage,
      appendMessage,

      limitReplyText,

      extendLastBotMessage,

      conversationId,

      entities,
      setEntities,

      setReferences,

      getSerializableFunctions,

      aborter,

      fetchStream,

      handleError,
      getVerboseOperationBeginAction,
      getVerboseOperationEndAction,
      handleOnItem,
      handleOnReceive,
      handleOnSend,
      handleUnfurling,
    ]
  )

  // conversation methods

  const startConversation = useFunctionDispatch(
    async function startConversation(options) {
      options = getOptions(options)

      // clear messages if auto clear is enabled
      {
        const ac = either(options.autoClear, autoClear)

        if (ac) {
          delete options.autoClear

          setMessages([])
        }
      }

      // add backstory if auto add backstory is enabled
      {
        const aab = either(options.autoAddBackstory, autoAddBackstory)

        if (aab) {
          delete options.autoAddBackstory

          appendMessage({
            id: getRandomId('backstory-'),
            text: backstory,
            type: 'backstory',
            createdAt: Date.now(),
            extra: options.extra,
          })
        }
      }

      // commit the text message to speed up the user experience
      {
        if (text) {
          appendMessage({
            id: getRandomId('tmp-'),
            text: text,
            type: 'user',
            createdAt: Date.now(),
            extra: options.extra,
          })

          setText('')

          // @note because the text is added it will no longer be available for
          // the next function dispatch, thus we need to add it to the options

          options.textToUse = text
        }
      }

      // create the conversation and continue
      {
        const { error, data } = await fetch(conversationCreateEndpoint, {
          ...options,

          headers: {
            ...options?.headers,

            'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
          },

          data: getConversationOptions(),

          context: contextRef.current,
        })

        if (error) {
          await handleError(error, options)
        } else {
          const { id, token } = data

          setConversationId(id)

          // @note this is a bit non-standard but it is here for convenience

          if (token) {
            setToken(token)
          }

          // @note autoStart is a bad name for this option

          const as = either(options.autoStart, autoStart)

          if (as) {
            delete options.autoStart

            await handleOnStart(options, data)

            completeMessage(options)
          }
        }
      }
    },
    [
      conversationCreateEndpoint,

      text,
      setText,

      autoClear,
      autoAddBackstory,
      autoStart,

      setMessages,
      appendMessage,

      backstory,

      fetch,

      getConversationOptions,

      handleError,
      handleOnStart,

      setConversationId,

      setToken,

      completeMessage,
    ]
  )

  // helper methods

  const interact = useFunctionDispatch(
    (options) => {
      options = getOptions(options)

      if (conversationId) {
        completeMessage(options)
      } else {
        startConversation(options)
      }
    },
    [conversationId, completeMessage, startConversation]
  )

  const abort = useFunctionDispatch(
    (options) => {
      options = getOptions(options)

      aborter.abort(options.reason || 'Aborted by user')
      aborter.reset()
    },
    [aborter]
  )

  const reset = useFunctionDispatch(
    (options) => {
      options = getOptions(options)

      aborter.abort(options.reason || 'Aborted by user')
      aborter.reset()

      setMessages([])

      setConversationId(null)

      if (options.full) {
        delete options.full

        setToken(null)
      }
    },
    [aborter, setMessages, setConversationId, setToken]
  )

  // return

  return {
    backstory,
    setBackstory,

    model,
    setModel,

    botId,
    setBotId,

    datasetId,
    setDatasetId,

    skillsetId,
    setSkillsetId,

    conversationId,
    setConversationId,

    token,
    setToken,

    messages,
    setMessages,

    entities,
    setEntities,

    references,
    setReferences,

    functions,
    setFunctions,

    attachments,
    setAttachments,

    text,
    setText,

    thinking,
    writing,

    flushText,

    sendMessage,
    receiveMessage,
    completeMessage,
    initiateMessage,

    startConversation,

    interact,
    abort,
    reset,

    loading,
    streaming,
    code,

    fetch,

    appendMessage,
    prependMessage,
    extendMessage,
    removeMessage,

    receivedMessages,
    incomingMessage,
  }
}
