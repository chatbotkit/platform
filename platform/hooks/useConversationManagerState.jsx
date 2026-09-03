import { useCallback, useMemo, useReducer, useRef } from 'react'

import { equal, merge } from '@/lib/object'

import useTraceUpdate from '@/hooks/useTraceUpdate'

export const compareFunctions = {
  // @todo add specific compare functions here
}

export function reduce(state, action) {
  const { type, data } = action

  function rebuild(key) {
    let value = data[key]

    if (typeof value === 'function') {
      value = value(state[key], state)
    }

    const compare = compareFunctions[key] || ((a, b) => a === b)

    if (compare(state[key], value)) {
      return state
    } else {
      return {
        ...state,

        [key]: value,
      }
    }
  }

  switch (type) {
    // reset

    case 'reset': {
      return typeof data.state === 'function'
        ? init(data.state(state))
        : init(data.state)
    }

    // backstory

    case 'setBackstory': {
      return rebuild('backstory')
    }

    // model

    case 'setModel': {
      return rebuild('model')
    }

    // bot

    case 'setBotId': {
      return rebuild('botId')
    }

    // dataset

    case 'setDatasetId': {
      return rebuild('datasetId')
    }

    // skillset

    case 'setSkillsetId': {
      return rebuild('skillsetId')
    }

    // messages

    case 'setMessages': {
      return rebuild('messages')
    }

    case 'appendMessage': {
      // @note appends a message to the end of the array

      const newMessages = [...state.messages, data.message]

      return {
        ...state,

        messages: newMessages,
      }
    }

    case 'prependMessage': {
      // @note inserts a message before the last message in the array - used to
      // add context/activity messages during streaming bot responses, ensuring
      // they appear before the currently streaming incomingMessage

      const firstHalf = state.messages.slice(0, -1)
      const secondHalf = state.messages.slice(-1)

      const newMessages = [...firstHalf, data.message, ...secondHalf]

      return {
        ...state,

        messages: newMessages,
      }
    }

    case 'extendMessage': {
      let start = state.messages.findLastIndex(
        (message) => message.id === data.id
      )

      if (start < 0) {
        if (data.upsert) {
          const newMessages = state.messages.slice(0)

          newMessages.push({
            id: data.id,

            ...data.message,
          })

          return {
            ...state,

            messages: newMessages,
          }
        } else {
          // eslint-disable-next-line no-console
          console.warn(
            `attempted to extend non-existent message id ${data.id}`,
            {
              data,
            }
          )

          return state
        }
      } else {
        const newMessages = state.messages.slice(0)

        newMessages.splice(start, 1, merge(state.messages[start], data.message))

        return {
          ...state,

          messages: newMessages,
        }
      }
    }

    case 'removeMessage': {
      const start = state.messages.findIndex(
        (message) => message.id === data.id
      )

      if (start < 0) {
        // eslint-disable-next-line no-console
        console.warn(`attempted to remove non-existent message id ${data.id}`, {
          data,
        })

        return state
      }

      const newMessages = state.messages.slice(0)

      newMessages.splice(start, 1)

      return {
        ...state,

        messages: newMessages,
      }
    }

    case 'evacuateMessage': {
      const start = state.messages.findIndex(
        (message) => message.id === data.id && message.text === ''
      )

      if (start < 0) {
        return state
      }

      const newMessages = state.messages.slice(0)

      newMessages.splice(start, 1)

      return {
        ...state,

        messages: newMessages,
      }
    }

    case 'addBotMessageToken': {
      let start = state.messages.findLastIndex(
        (message) => message.id === data.id && message.type === 'bot'
      )

      let deleteCount

      let message

      if (start >= 0) {
        deleteCount = 1

        message = state.messages[start]
      } else {
        start = state.messages.length

        deleteCount = 0

        message = {
          id: data.id,

          type: 'bot',
          text: '',

          createdAt: Date.now(),
        }
      }

      message = {
        ...message,

        text: (message.text || '') + data.token,
      }

      const newMessages = state.messages.slice(0)

      newMessages.splice(start, deleteCount, message)

      return {
        ...state,

        messages: newMessages,
      }
    }

    case 'addBotMessageReasoningToken': {
      let start = state.messages.findLastIndex(
        (message) => message.id === data.id && message.type === 'bot'
      )

      let deleteCount

      let message

      if (start >= 0) {
        deleteCount = 1

        message = state.messages[start]
      } else {
        start = state.messages.length

        deleteCount = 0

        message = {
          id: data.id,

          type: 'bot',
          text: '',

          createdAt: Date.now(),
        }
      }

      message = {
        ...message,

        reasoning: (message.reasoning || '') + data.token,
      }

      const newMessages = state.messages.slice(0)

      newMessages.splice(start, deleteCount, message)

      return {
        ...state,

        messages: newMessages,
      }
    }

    case 'addBotMessageAction': {
      let start = state.messages.findLastIndex(
        (message) => message.id === data.id && message.type === 'bot'
      )

      let deleteCount

      let message

      if (start >= 0) {
        deleteCount = 1

        message = state.messages[start]
      } else {
        start = state.messages.length

        deleteCount = 0

        message = {
          id: data.id,

          type: 'bot',
          text: '',

          createdAt: Date.now(),
        }
      }

      let newActions = (message.actions || []).slice(0)

      const existingAction = message.actions?.find(
        (action) => action.id === data.action.id
      )

      if (existingAction) {
        newActions = newActions.map((action) => {
          if (action.id === data.action.id) {
            return {
              ...action,
              ...data.action,
            }
          }

          return action
        })
      } else {
        newActions = [...newActions, data.action]
      }

      message = {
        ...message,

        actions: newActions,
      }

      const newMessages = state.messages.slice(0)

      newMessages.splice(start, deleteCount, message)

      return {
        ...state,

        messages: newMessages,
      }
    }

    case 'addBotMessageReference': {
      let start = state.messages.findLastIndex(
        (message) => message.id === data.id && message.type === 'bot'
      )

      let deleteCount

      let message

      if (start >= 0) {
        deleteCount = 1

        message = state.messages[start]
      } else {
        start = state.messages.length

        deleteCount = 0

        message = {
          id: data.id,

          type: 'bot',
          text: '',

          createdAt: Date.now(),
        }
      }

      let newReferences = (message.references || []).slice(0)

      const existingReference = message.references?.find(
        (reference) => reference.id === data.reference.id
      )

      if (existingReference) {
        newReferences = newReferences.map((reference) => {
          if (reference.id === data.reference.id) {
            return {
              ...reference,
              ...data.reference,
            }
          }

          return reference
        })
      } else {
        newReferences = [...newReferences, data.reference]
      }

      message = {
        ...message,

        references: newReferences,
      }

      const newMessages = state.messages.slice(0)

      newMessages.splice(start, deleteCount, message)

      return {
        ...state,

        messages: newMessages,
      }
    }

    case 'extendLastUserMessage': {
      const lastUserMessageIndex = state.messages.findLastIndex(
        (message) => message.type === 'user'
      )

      if (lastUserMessageIndex >= 0) {
        const lastUserMessage = state.messages[lastUserMessageIndex]

        const newLastUserMessage = merge(lastUserMessage, data.message)

        const newMessages = state.messages.slice(0)

        newMessages.splice(lastUserMessageIndex, 1, newLastUserMessage)

        state = {
          ...state,

          messages: newMessages,
        }
      }

      return state
    }

    case 'extendLastBotMessage': {
      const lastBotMessageIndex = state.messages.findLastIndex(
        (message) => message.type === 'bot'
      )

      if (lastBotMessageIndex >= 0) {
        const lastBotMessage = state.messages[lastBotMessageIndex]

        const newLastBotMessage = merge(lastBotMessage, data.message)

        const newMessages = state.messages.slice(0)

        newMessages.splice(lastBotMessageIndex, 1, newLastBotMessage)

        state = {
          ...state,

          messages: newMessages,
        }
      }

      return state
    }

    // entities

    case 'setEntities': {
      return rebuild('entities')
    }

    // functions

    case 'setFunctions': {
      return rebuild('functions')
    }

    // actions

    case 'setActions': {
      return rebuild('actions')
    }

    case 'appendAction': {
      return {
        ...state,

        actions: [...state.actions, data.action],
      }
    }

    // references

    case 'setReferences': {
      return rebuild('references')
    }

    case 'appendReference': {
      return {
        ...state,

        references: {
          ...state.references,
          [data.reference.id]: data.reference,
        },
      }
    }

    // attachments

    case 'setAttachments': {
      return rebuild('attachments')
    }

    case 'appendAttachment': {
      return {
        ...state,

        attachments: [...state.attachments, data.attachment],
      }
    }

    // clips

    case 'setClips': {
      return rebuild('clips')
    }

    case 'appendClip': {
      return {
        ...state,

        clips: [...state.clips, data.clip],
      }
    }

    // conversationId

    case 'setConversationId': {
      return rebuild('conversationId')
    }

    // token

    case 'setToken': {
      return rebuild('token')
    }

    // text

    case 'setText': {
      return rebuild('text')
    }

    // thinking

    case 'setThinking': {
      return rebuild('thinking')
    }

    // writing

    case 'setWriting': {
      return rebuild('writing')
    }

    // default

    default: {
      throw new Error(`Unrecognized action type ${type}`)
    }
  }
}

export function init(state) {
  return {
    backstory: state.backstory || '',

    model: state.model || '',

    botId: state.botId || '',

    datasetId: state.datasetId || null,
    skillsetId: state.skillsetId || null,

    messages: state.messages || [],

    entities: state.entities || {},

    actions: state.actions || [],

    references: state.references || {},

    functions: state.functions || [],

    attachments: state.attachments || [],

    clips: state.clips || [],

    conversationId: state.conversationId || null,

    token: state.token || null,

    text: state.text || '',

    thinking: state.thinking ?? false,

    writing: state.writing ?? false,
  }
}

export default function useConversationManagerState({
  backstory: _backstory,

  model: _model,

  botId: _botId,

  datasetId: _datasetId,
  skillsetId: _skillsetId,

  messages: _messages,

  entities: _entities,

  functions: _functions,

  actions: _actions,

  references: _references,

  attachments: _attachments,

  clips: _clips,

  conversationId: _conversationId,

  token: _token,
} = {}) {
  // @note once set these values should not change thus we monitor them for
  // changes and report if they do

  useTraceUpdate({
    _backstory,

    _model,

    _botId,

    _datasetId,
    _skillsetId,

    _messages,

    _entities,

    _functions,

    _actions,

    _references,

    _attachments,

    _clips,

    _conversationId,

    _token,
  })

  // state

  const [state, dispatch] = useReducer(
    reduce,
    {
      backstory: _backstory,

      model: _model,

      botId: _botId,

      datasetId: _datasetId,
      skillsetId: _skillsetId,

      messages: _messages,

      entities: _entities,

      functions: _functions,

      actions: _actions,

      references: _references,

      attachments: _attachments,

      clips: _clips,

      conversationId: _conversationId,

      token: _token,
    },
    init
  )

  const backstory = state.backstory
  const model = state.model
  const botId = state.botId
  const datasetId = state.datasetId
  const skillsetId = state.skillsetId
  const messages = state.messages
  const functions = state.functions
  const attachments = state.attachments
  const clips = state.clips
  const entities = state.entities
  const actions = state.actions
  const references = state.references
  const conversationId = state.conversationId
  const token = state.token
  const text = state.text
  const thinking = state.thinking
  const writing = state.writing

  const previousReceivedMessagesRef = useRef(messages)
  const previousIncomingMessageRef = useRef(null)

  // @note track the last message to prevent premature splitting when
  // thinking/writing is set before the actual bot response arrives

  const previousLastMessageRef = useRef(null)

  const [receivedMessages, incomingMessage] = useMemo(() => {
    if (!thinking && !writing) {
      return [messages, null]
    }

    const lastMessage = messages[messages.length - 1]

    if (!lastMessage) {
      return [messages, null]
    }

    if (lastMessage.type !== 'bot') {
      return [messages, null]
    }

    let receivedMessages = messages.slice(0, -1)
    let incomingMessage = lastMessage

    if (
      receivedMessages.length === previousReceivedMessagesRef.current.length
    ) {
      receivedMessages = previousReceivedMessagesRef.current
    }

    if (equal(incomingMessage, previousIncomingMessageRef.current)) {
      incomingMessage = previousIncomingMessageRef.current
    }

    return [receivedMessages, incomingMessage]
  }, [messages, thinking, writing])

  previousReceivedMessagesRef.current = receivedMessages
  previousIncomingMessageRef.current = incomingMessage

  previousLastMessageRef.current = messages[messages.length - 1] || null

  const reset = useCallback(
    (state) => {
      dispatch({ type: 'reset', data: { state } })
    },
    [dispatch]
  )

  const setBackstory = useCallback(
    (backstory) => {
      dispatch({ type: 'setBackstory', data: { backstory } })
    },
    [dispatch]
  )

  const setModel = useCallback(
    (model) => {
      dispatch({ type: 'setModel', data: { model } })
    },
    [dispatch]
  )

  const setBotId = useCallback(
    (botId) => {
      dispatch({ type: 'setBotId', data: { botId } })
    },
    [dispatch]
  )

  const setDatasetId = useCallback(
    (datasetId) => {
      dispatch({ type: 'setDatasetId', data: { datasetId } })
    },
    [dispatch]
  )

  const setSkillsetId = useCallback(
    (skillsetId) => {
      dispatch({ type: 'setSkillsetId', data: { skillsetId } })
    },
    [dispatch]
  )

  const setMessages = useCallback(
    (messages) => {
      dispatch({ type: 'setMessages', data: { messages } })
    },
    [dispatch]
  )

  const setEntities = useCallback(
    (entities) => {
      dispatch({ type: 'setEntities', data: { entities } })
    },
    [dispatch]
  )

  const setFunctions = useCallback(
    (functions) => {
      dispatch({ type: 'setFunctions', data: { functions } })
    },
    [dispatch]
  )

  const setActions = useCallback(
    (actions) => {
      dispatch({ type: 'setActions', data: { actions } })
    },
    [dispatch]
  )

  const appendAction = useCallback(
    (action) => {
      dispatch({ type: 'appendAction', data: { action } })
    },
    [dispatch]
  )

  const setReferences = useCallback(
    (references) => {
      dispatch({ type: 'setReferences', data: { references } })
    },
    [dispatch]
  )

  const appendReference = useCallback(
    (reference) => {
      dispatch({ type: 'appendReference', data: { reference } })
    },
    [dispatch]
  )

  const setAttachments = useCallback(
    (attachments) => {
      dispatch({ type: 'setAttachments', data: { attachments } })
    },
    [dispatch]
  )

  const appendAttachment = useCallback(
    (attachment) => {
      dispatch({ type: 'appendAttachment', data: { attachment } })
    },
    [dispatch]
  )

  const setClips = useCallback(
    (clips) => {
      dispatch({ type: 'setClips', data: { clips } })
    },
    [dispatch]
  )

  const appendClip = useCallback(
    (clip) => {
      dispatch({ type: 'appendClip', data: { clip } })
    },
    [dispatch]
  )

  const setConversationId = useCallback(
    (conversationId) => {
      dispatch({ type: 'setConversationId', data: { conversationId } })
    },
    [dispatch]
  )

  const setToken = useCallback(
    (token) => {
      dispatch({ type: 'setToken', data: { token } })
    },
    [dispatch]
  )

  const setText = useCallback(
    (text) => {
      dispatch({ type: 'setText', data: { text } })
    },
    [dispatch]
  )

  const setThinking = useCallback(
    (thinking) => {
      dispatch({ type: 'setThinking', data: { thinking } })
    },
    [dispatch]
  )

  const setWriting = useCallback(
    (writing) => {
      dispatch({ type: 'setWriting', data: { writing } })
    },
    [dispatch]
  )

  const appendMessage = useCallback(
    (message) => {
      dispatch({ type: 'appendMessage', data: { message } })
    },
    [dispatch]
  )

  const prependMessage = useCallback(
    (message) => {
      dispatch({ type: 'prependMessage', data: { message } })
    },
    [dispatch]
  )

  const extendMessage = useCallback(
    (id, message, upsert) => {
      dispatch({ type: 'extendMessage', data: { id, message, upsert } })
    },
    [dispatch]
  )

  const removeMessage = useCallback(
    (id) => {
      dispatch({ type: 'removeMessage', data: { id } })
    },
    [dispatch]
  )

  const evacuateMessage = useCallback(
    (id) => {
      dispatch({ type: 'evacuateMessage', data: { id } })
    },
    [dispatch]
  )

  const addBotMessageToken = useCallback(
    (id, token) => {
      dispatch({ type: 'addBotMessageToken', data: { id, token } })
    },
    [dispatch]
  )

  const addBotMessageReasoningToken = useCallback(
    (id, token) => {
      dispatch({ type: 'addBotMessageReasoningToken', data: { id, token } })
    },
    [dispatch]
  )

  const addBotMessageAction = useCallback(
    (id, action) => {
      dispatch({ type: 'addBotMessageAction', data: { id, action } })
    },
    [dispatch]
  )

  const addBotMessageReference = useCallback(
    (id, reference) => {
      dispatch({ type: 'addBotMessageReference', data: { id, reference } })
    },
    [dispatch]
  )

  const extendLastUserMessage = useCallback(
    (message) => {
      dispatch({ type: 'extendLastUserMessage', data: { message } })
    },
    [dispatch]
  )

  const extendLastBotMessage = useCallback(
    (message) => {
      dispatch({ type: 'extendLastBotMessage', data: { message } })
    },
    [dispatch]
  )

  // return

  return {
    state,

    reset,

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

    functions,
    setFunctions,

    actions,
    setActions,
    appendAction,

    references,
    setReferences,
    appendReference,

    attachments,
    setAttachments,
    appendAttachment,

    clips,
    setClips,
    appendClip,

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
    evacuateMessage,

    addBotMessageToken,
    addBotMessageReasoningToken,
    addBotMessageAction,
    addBotMessageReference,

    extendLastUserMessage,
    extendLastBotMessage,

    receivedMessages,
    incomingMessage,
  }
}
