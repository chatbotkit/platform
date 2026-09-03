'use server'

import {
  getActivityArguments,
  getActivityArgumentsAndResult,
  getActivityResult,
} from '@/lib/activity'
import { appActionHandler } from '@/lib/app.action'
import { getSessionClient } from '@/lib/cbk.sdk'
import { getSortedMessages } from '@/lib/message'
import { getTemporaryUserSessionToken } from '@/lib/session.temp'
import { z } from '@/lib/zod.schema'

import ConfigSchema from './config'
import { APP_NAME } from './const'

import { stream } from '@chatbotkit/react/utils/stream'

const DETAIL_MESSAGE_TAKE = 100
const DETAIL_EVENT_TAKE = 200
const DELTA_MESSAGE_TAKE = 50
const DELTA_EVENT_TAKE = 50

function getTimestamp(value) {
  if (typeof value === 'number') {
    return value
  }

  return 0
}

function compareByCreatedAtDesc(a, b) {
  return (
    getTimestamp(b?.createdAt) - getTimestamp(a?.createdAt) ||
    String(b?.id || '').localeCompare(String(a?.id || '')) ||
    String(b?.type || '').localeCompare(String(a?.type || ''))
  )
}

function compareTimelineEvents(a, b) {
  return (
    getTimestamp(a?.at) - getTimestamp(b?.at) ||
    String(a?.type || '').localeCompare(String(b?.type || '')) ||
    String(a?.id || '').localeCompare(String(b?.id || ''))
  )
}

function compareConversations(a, b) {
  return (
    getTimestamp(b?.updatedAt) - getTimestamp(a?.updatedAt) ||
    getTimestamp(b?.createdAt) - getTimestamp(a?.createdAt) ||
    String(a?.id || '').localeCompare(String(b?.id || ''))
  )
}

function sortByCreatedAtDesc(items) {
  return [...items].sort(compareByCreatedAtDesc)
}

const USER_VISIBLE_MESSAGE_TYPES = new Set(['user', 'bot'])

function getMessagePreview(messages) {
  const message = messages.find((message) =>
    USER_VISIBLE_MESSAGE_TYPES.has(message.type)
  )

  return message?.text || 'No messages yet'
}

function getConversationLabel(conversation) {
  return (
    conversation.name ||
    conversation.description ||
    conversation.meta?.title ||
    conversation.meta?.name ||
    conversation.id
  )
}

function getConversationModel(conversation) {
  if ('model' in conversation && typeof conversation.model === 'string') {
    return conversation.model
  }

  return null
}

function getConversationBot(conversation) {
  if ('botId' in conversation && typeof conversation.botId === 'string') {
    return conversation.botId
  }

  return getConversationModel(conversation) || 'Conversation'
}

function getListChannel(conversation) {
  if (conversation.contactId) {
    return 'Contact'
  }

  if (conversation.taskId) {
    return 'Task'
  }

  return 'API'
}

function getDetailChannel(conversation, events) {
  const integrationEvent = events.find(
    (event) =>
      event.widgetIntegrationId ||
      event.slackIntegrationId ||
      event.discordIntegrationId ||
      event.microsoftteamsIntegrationId ||
      event.googlechatIntegrationId ||
      event.whatsappIntegrationId ||
      event.messengerIntegrationId ||
      event.telegramIntegrationId ||
      event.twilioIntegrationId ||
      event.emailIntegrationId
  )

  if (integrationEvent?.slackIntegrationId) {
    return 'Slack'
  }

  if (integrationEvent?.discordIntegrationId) {
    return 'Discord'
  }

  if (integrationEvent?.microsoftteamsIntegrationId) {
    return 'Teams'
  }

  if (integrationEvent?.googlechatIntegrationId) {
    return 'Google Chat'
  }

  if (integrationEvent?.whatsappIntegrationId) {
    return 'WhatsApp'
  }

  if (integrationEvent?.messengerIntegrationId) {
    return 'Messenger'
  }

  if (integrationEvent?.telegramIntegrationId) {
    return 'Telegram'
  }

  if (integrationEvent?.twilioIntegrationId) {
    return 'Twilio'
  }

  if (integrationEvent?.emailIntegrationId) {
    return 'Email'
  }

  if (integrationEvent?.widgetIntegrationId) {
    return 'Widget'
  }

  return getListChannel(conversation)
}

function getStatus(conversation, messages, events) {
  if (events.some((event) => event.type?.endsWith('.error'))) {
    return 'error'
  }

  const activityMessage = messages.find(
    (message) => message.type === 'activity'
  )

  if (activityMessage) {
    return 'responding'
  }

  const newestMessage = messages[0]

  if (newestMessage?.type === 'user') {
    return 'responding'
  }

  if (Date.now() - conversation.updatedAt < 120000) {
    return 'waiting'
  }

  return 'completed'
}

function getActiveStep(status, messages, events) {
  if (status === 'error') {
    const event = events.find((event) => event.type?.endsWith('.error'))

    return event?.description || event?.type || 'Error detected'
  }

  const activityMessage = messages.find(
    (message) => message.type === 'activity'
  )

  if (activityMessage) {
    const activityName = activityMessage.meta?.activity?.function?.name

    return activityName ? `Running ${activityName}` : 'Activity in progress'
  }

  const event = events[0]

  if (event) {
    return event.description || event.name || event.type
  }

  if (status === 'responding') {
    return 'Awaiting assistant response'
  }

  return status === 'completed' ? 'Completed' : 'Waiting'
}

function getActivityObject(activity) {
  if (!activity) {
    return null
  }

  if (activity.type === 'request') {
    return getActivityArguments(activity) || {}
  }

  if (activity.type === 'response') {
    return getActivityResult(activity) || {}
  }

  return getActivityArgumentsAndResult(activity) || {}
}

function getActivityTitle(activity) {
  const type = activity?.type === 'request-response' ? 'call' : activity?.type
  const name = activity?.function?.name || 'unknown'

  return `activity ${type || '?'} ${name}`
}

function getActivityDescription(activity) {
  const name = activity?.function?.name || 'unknown function'
  const type = activity?.type || 'unknown'

  switch (type) {
    case 'request': {
      return `Calling ${name}`
    }

    case 'response': {
      return `Received result from ${name}`
    }

    case 'request-response': {
      return `Called ${name} and received a result`
    }

    case 'trigger': {
      return `Triggered ${name}`
    }

    default: {
      return `${type} activity for ${name}`
    }
  }
}

function getEventKind(type) {
  if (!type) {
    return 'event'
  }

  if (type.endsWith('.error')) {
    return 'error'
  }

  if (type.includes('message')) {
    return 'message'
  }

  if (type.includes('dataset') || type.includes('search')) {
    return 'retrieval'
  }

  if (type.includes('action') || type.includes('skillset')) {
    return 'tool'
  }

  if (type.includes('conversation')) {
    return 'model'
  }

  return 'event'
}

function toTimelineEvent(item, source = 'event') {
  if (source === 'message') {
    const activity = item.meta?.activity

    if (item.type === 'activity') {
      return {
        id: item.id,
        type: 'tool',
        title: getActivityTitle(activity),
        description: getActivityDescription(activity),
        at: item.createdAt,
        object: getActivityObject(activity),
        raw: item,
      }
    }

    return {
      id: item.id,
      type: 'message',
      title: `${item.type} message`,
      description: item.text || item.description || 'No message text',
      at: item.createdAt,
      raw: item,
    }
  }

  return {
    id: item.id,
    type: getEventKind(item.type),
    title: item.name || item.type,
    description: item.description || item.type,
    at: item.createdAt,
    raw: item,
  }
}

async function fetchExecutionContext(cbk, conversation, events) {
  const taskId = conversation.taskId

  if (taskId) {
    try {
      const [task, executionResult] = await Promise.all([
        cbk.task.fetch(taskId),
        cbk.task.execution.list(taskId, { order: 'desc', take: 5 }),
      ])

      const executions = executionResult.items || []
      const execution =
        executions.find((e) => e.conversationId === conversation.id) ||
        executions[0] ||
        null

      return {
        kind: 'task' as const,
        id: taskId,
        name: task.name || taskId,
        resourceStatus: task.status,
        resourceOutcome: task.outcome,
        executionStatus: execution?.status ?? null,
        executionOutcome: execution?.outcome ?? null,
        executionSummary: execution?.summary ?? null,
        executionId: execution?.id ?? null,
      }
    } catch {
      return null
    }
  }

  const triggerId = events.find(
    (e) => e.triggerIntegrationId
  )?.triggerIntegrationId

  if (triggerId) {
    try {
      const trigger = await cbk.integration.trigger.fetch(triggerId)

      return {
        kind: 'trigger' as const,
        id: triggerId,
        name: trigger.name || triggerId,
        resourceStatus: null,
        resourceOutcome: null,
        executionStatus: null,
        executionOutcome: null,
        executionSummary: null,
        executionId: null,
      }
    } catch {
      return null
    }
  }

  return null
}

/**
 * @action
 */
export const listAll = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    blueprintId: z.string().optional(),
    take: z.number().optional(),
  }),
  async (_config, session, { take = 20, blueprintId }) => {
    const cbk = await getSessionClient(session)

    const [conversationResult, blueprintEventResult] = await Promise.all([
      cbk.conversation.list({
        order: 'desc',
        take,
      }),
      blueprintId
        ? cbk.event.log.list({
            order: 'desc',
            take: DETAIL_EVENT_TAKE,
            // @ts-expect-error because it is not exported in the sdk
            blueprintId,
          })
        : (Promise.resolve({ items: [] }) as unknown as ReturnType<
            typeof cbk.event.log.list
          >),
    ])

    const conversationItems = conversationResult.items || []
    const blueprintEventItems = blueprintEventResult.items || []

    const allowedConversationIds = blueprintId
      ? new Set(
          blueprintEventItems
            .filter((event) => event.blueprintId === blueprintId)
            .map((event) => event.conversationId)
            .filter(Boolean)
        )
      : null

    const filteredConversations =
      allowedConversationIds && allowedConversationIds.size > 0
        ? conversationItems.filter((conversation) =>
            allowedConversationIds.has(conversation.id)
          )
        : conversationItems

    const items = filteredConversations
      .map((conversation) => ({
        id: conversation.id,
        contact: conversation.contactId || 'unknown contact',
        channel: getListChannel(conversation),
        bot: getConversationBot(conversation),
        model: getConversationModel(conversation) || 'configured bot',
        summary: getConversationLabel(conversation),
        updatedAt: conversation.updatedAt,
        createdAt: conversation.createdAt,
      }))
      .sort(compareConversations)

    return {
      items,
      updatedAt: Date.now(),
    }
  }
)

/**
 * @action
 */
export const fetchConversationDetail = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    conversationId: z.string(),
  }),
  async (_config, session, { conversationId }) => {
    const cbk = await getSessionClient(session)

    const [conversation, messagesResult, eventsResult] = await Promise.all([
      cbk.conversation.fetch(conversationId),
      cbk.conversation.message.list(conversationId, {
        order: 'desc',
        take: DETAIL_MESSAGE_TAKE,
      }),
      cbk.event.log.list({
        order: 'desc',
        take: DETAIL_EVENT_TAKE,
        // @ts-expect-error because it is not exported in the sdk
        conversationId,
      }),
    ])

    const messageItems = messagesResult.items || []
    const eventItems = eventsResult.items || []

    const messages = getSortedMessages(messageItems, 'desc')
    const events = sortByCreatedAtDesc(eventItems)
    const status = getStatus(conversation, messages, events)
    const execution = await fetchExecutionContext(cbk, conversation, events)

    return {
      id: conversation.id,
      taskId: conversation.taskId ?? null,
      contact: conversation.contactId || 'unknown contact',
      channel: getDetailChannel(conversation, events),
      bot: getConversationBot(conversation),
      blueprint: events.find((event) => event.blueprintId)?.blueprintId,
      status,
      summary: getConversationLabel(conversation),
      latest: getMessagePreview(messages),
      model: getConversationModel(conversation) || 'configured bot',
      activeStep: getActiveStep(status, messages, events),
      tokens: null,
      latency: null,
      updatedAt: conversation.updatedAt,
      createdAt: conversation.createdAt,
      execution,
      events: [
        ...messages.map((message) => toTimelineEvent(message, 'message')),
        ...events.map((event) => toTimelineEvent(event, 'event')),
      ].sort(compareTimelineEvents),
      lastMessageId: messageItems[0]?.id ?? null,
      lastEventId: eventItems[0]?.id ?? null,
    }
  }
)

/**
 * @action
 */
export const fetchConversationDelta = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    conversationId: z.string(),
    sinceMessageId: z.string().nullish(),
    sinceEventId: z.string().nullish(),
  }),
  async (
    _config,
    session,
    { conversationId, sinceMessageId, sinceEventId }
  ) => {
    const cbk = await getSessionClient(session)

    const [conversation, messagesResult, eventsResult] = await Promise.all([
      cbk.conversation.fetch(conversationId),
      cbk.conversation.message.list(conversationId, {
        order: 'desc',
        take: DELTA_MESSAGE_TAKE,
      }),
      cbk.event.log.list({
        order: 'desc',
        take: DELTA_EVENT_TAKE,
        // @ts-expect-error because it is not exported in the sdk
        conversationId,
      }),
    ])

    const messageItems = messagesResult.items || []
    const eventItems = eventsResult.items || []

    const newMessageItems: typeof messageItems = []

    for (const message of messageItems) {
      if (sinceMessageId && message.id === sinceMessageId) {
        break
      }

      newMessageItems.push(message)
    }

    const newEventItems: typeof eventItems = []

    for (const event of eventItems) {
      if (sinceEventId && event.id === sinceEventId) {
        break
      }

      newEventItems.push(event)
    }

    const messages = getSortedMessages(messageItems, 'desc')
    const events = sortByCreatedAtDesc(eventItems)
    const status = getStatus(conversation, messages, events)

    return {
      conversationId,
      status,
      activeStep: getActiveStep(status, messages, events),
      updatedAt: conversation.updatedAt,
      newEvents: [
        ...newMessageItems.map((message) =>
          toTimelineEvent(message, 'message')
        ),
        ...newEventItems.map((event) => toTimelineEvent(event, 'event')),
      ].sort(compareTimelineEvents),
      lastMessageId: messageItems[0]?.id ?? sinceMessageId ?? null,
      lastEventId: eventItems[0]?.id ?? sinceEventId ?? null,
    }
  }
)

/**
 * @action
 */
export const subscribeTaskWorkflowEvents = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    taskId: z.string(),
    historyLength: z.number().optional(),
  }),
  async (_config, session, { taskId, historyLength = 50 }) => {
    return stream(
      (async function* () {
        const cbk = await getSessionClient(session)

        const subscription = cbk.task.subscribe(taskId, {
          historyLength,
        })

        for await (const event of subscription.stream()) {
          yield event
        }
      })()
    )
  }
)

// @note these actions exist only to AUTHORIZE + SCOPE - they mint short-lived
// bearer tokens the embedded client uses to call the read API directly, instead
// of routing every list/detail fetch through heavy server-side aggregation.
// Tokens act as the embedding user (authorized by appActionHandler) and are
// restricted by allowedRoutes, so they cannot reach anything outside their
// scope. Read-only routes only - no mutations.

const CONVERSATION_TOKEN_DURATION_SECONDS = 15 * 60

/**
 * @action
 *
 * Mint a token scoped to a single conversation's read + monitor routes (fetch,
 * messages, channel subscribe). The client uses it to refresh that conversation
 * and stream its live monitor events directly - one token per selected
 * conversation, re-minted on expiry. Restricted to that one conversation.
 */
export const mintConversationToken = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    conversationId: z.string(),
  }),
  async (_config, session, { conversationId }) => {
    const token = await getTemporaryUserSessionToken(session, {
      allowedRoutes: [
        `/api/v1/conversation/${conversationId}/fetch`,
        `/api/v1/conversation/${conversationId}/message/**`,
        `/api/v1/conversation/${conversationId}/channel/subscribe`,
      ],
      durationInSeconds: CONVERSATION_TOKEN_DURATION_SECONDS,
    })

    return { token }
  }
)
