'use server'

import {
  MAX_DB_STRING_BYTES_LENGTH,
  MAX_DB_TEXT_BYTES_LENGTH,
} from '@/prisma/constraints'

import { appContactActionHandler } from '@/lib/app.action'
import { getSessionGraphQLClient } from '@/lib/cbk.graphql'
import { getSessionClient } from '@/lib/cbk.sdk'
import { throwNotFound } from '@/lib/response'
import { byteSlice } from '@/lib/string'
import { z } from '@/lib/zod.schema'

import ConfigSchema from './config'
import { APP_NAME, CONTACT_NAMESPACE } from './const'

/**
 * The backstory that frames the conversation as a live note-taking session.
 * The transcript arrives as `context` messages, so the agent must treat the
 * conversation history as a running record of what is being said rather than a
 * back-and-forth chat thread.
 */
const NOTE_STREAM_BACKSTORY = [
  'You are a note-taking assistant for a live in-person meeting or note-taking session.',
  'The conversation history contains a running transcript of what is being said, delivered to you as context messages.',
  'The user will occasionally ask you questions. Answer immediately and concisely using the transcript as your primary source of truth.',
  'Treat each question as a standalone lookup against everything captured so far, not as part of an ongoing dialogue.',
  'When the transcript does not contain the answer, say so plainly and answer from general knowledge if you can.',
  'Prefer short, scannable answers. Use markdown bullet points for lists.',
].join('\n')

/**
 * Starts a new note stream by creating a conversation associated with the
 * contact. The returned conversation accumulates transcript context and is the
 * target for subsequent questions.
 *
 * @action
 */
export const startNoteStream = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    title: z.string().optional(),
  }),
  async (
    config,
    session,
    contact,
    { title }
  ): Promise<{ conversationId: string; name: string }> => {
    const userClient = await getSessionClient(session)

    const defaultName = `Note Stream - ${new Date()
      .toISOString()
      .slice(0, 16)
      .replace('T', ' ')}`

    const name = byteSlice(
      (title?.trim() || defaultName).trim(),
      0,
      MAX_DB_STRING_BYTES_LENGTH
    )

    const conversation = await userClient.conversation.create({
      contactId: contact.id,

      ...(config.model ? { model: config.model } : {}),

      name,

      meta: {
        app: APP_NAME,
        kind: 'note-stream',
      },
    })

    return { conversationId: conversation.id, name }
  }
)

/**
 * Appends transcript entries to the note stream as `context` messages. The
 * client batches finalized transcript chunks and flushes them here so the
 * conversation always reflects the latest of what has been said.
 *
 * @action
 */
export const appendContext = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    conversationId: z.string(),
    entries: z
      .array(
        z.object({
          text: z.string(),
          timestamp: z.union([z.string(), z.number()]).optional(),
        })
      )
      .min(1, 'At least one entry is required'),
  }),
  async (
    _config,
    session,
    contact,
    { conversationId, entries }
  ): Promise<{ count: number }> => {
    const userClient = await getSessionClient(session)

    const conversation = await userClient.conversation.fetch(conversationId)

    if (conversation.contactId !== contact.id) {
      return throwNotFound('Note stream not found')
    }

    let count = 0

    for (const entry of entries) {
      const text = entry.text.trim()

      if (!text) {
        continue
      }

      await userClient.conversation.message.create(conversationId, {
        type: 'context',
        text: byteSlice(text, 0, MAX_DB_TEXT_BYTES_LENGTH),
        meta: {
          source: 'transcript',
          ...(entry.timestamp !== undefined
            ? { timestamp: entry.timestamp }
            : {}),
        },
      })

      count++
    }

    return { count }
  }
)

/**
 * Asks a question against the note stream. The completion runs statefully
 * against the conversation so the agent has access to the entire transcript
 * captured so far.
 *
 * @action
 */
export const ask = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    conversationId: z.string(),
    question: z.string().min(1, 'A question is required'),
  }),
  async (
    _config,
    session,
    contact,
    { conversationId, question }
  ): Promise<{ text: string }> => {
    const userClient = await getSessionClient(session)

    const conversation = await userClient.conversation.fetch(conversationId)

    if (conversation.contactId !== contact.id) {
      return throwNotFound('Note stream not found')
    }

    const { text } = await userClient.conversation.complete(conversationId, {
      text: byteSlice(question.trim(), 0, MAX_DB_TEXT_BYTES_LENGTH),

      extensions: {
        backstory: NOTE_STREAM_BACKSTORY,

        features: [
          { name: 'markdown' },
          { name: 'web', options: { fetch: true, search: true } },
        ],
      },
    })

    return { text }
  }
)

/**
 * A note stream as shown in the sidebar.
 */
type NoteStreamListItem = {
  id: string

  name?: string
  description?: string

  createdAt?: string | number
  updatedAt?: string | number
}

/**
 * Lists the note streams that belong to the contact. Only conversations tagged
 * with this app's meta are returned so the sidebar reflects note streams and
 * nothing else.
 *
 * @action
 */
export const listNoteStreams = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({}),
  async (_config, session, contact): Promise<NoteStreamListItem[]> => {
    const userClient = await getSessionGraphQLClient(session)

    const result = await userClient.listContactConversations({
      contactIds: [contact.id],
      last: 100,
    })

    const conversations =
      result.conversations?.edges
        ?.map((edge) => edge?.node)
        .filter((node): node is NonNullable<typeof node> => !!node) || []

    return conversations
      .filter((conversation) => conversation.meta?.app === APP_NAME)
      .map((conversation) => ({
        id: conversation.id || '',

        name: conversation.name || undefined,
        description: conversation.description || undefined,

        createdAt: conversation.createdAt || undefined,
        updatedAt: conversation.updatedAt || undefined,
      }))
  }
)

/**
 * A single transcript line of a note stream.
 */
type NoteStreamTranscript = {
  text: string
  timestamp?: string | number
}

/**
 * A previously asked question and its answer.
 */
type NoteStreamAsk = {
  question: string
  text: string
}

/**
 * Loads a note stream so its transcript and prior questions can be shown and
 * queried. The transcript comes from the `context` messages and the questions
 * from the paired user/bot messages.
 *
 * @action
 */
export const fetchNoteStream = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    conversationId: z.string(),
  }),
  async (
    _config,
    session,
    contact,
    { conversationId }
  ): Promise<{
    id: string
    name?: string
    transcripts: NoteStreamTranscript[]
    asks: NoteStreamAsk[]
  }> => {
    const userClient = await getSessionClient(session)

    const [conversation, messages] = await Promise.all([
      userClient.conversation.fetch(conversationId),
      userClient.conversation.message.list(conversationId, {
        order: 'asc',
        take: 1000,
      }),
    ])

    if (conversation.contactId !== contact.id) {
      return throwNotFound('Note stream not found')
    }

    const transcripts: NoteStreamTranscript[] = []
    const asks: NoteStreamAsk[] = []

    let pendingQuestion: string | undefined

    for (const message of messages.items) {
      switch (message.type) {
        case 'context': {
          transcripts.push({
            text: message.text,
            timestamp:
              typeof message.meta?.timestamp === 'string' ||
              typeof message.meta?.timestamp === 'number'
                ? message.meta.timestamp
                : undefined,
          })

          break
        }

        case 'user': {
          pendingQuestion = message.text

          break
        }

        case 'bot': {
          if (pendingQuestion !== undefined) {
            asks.push({ question: pendingQuestion, text: message.text })

            pendingQuestion = undefined
          }

          break
        }
      }
    }

    return {
      id: conversation.id,
      name: conversation.name,
      transcripts,
      asks,
    }
  }
)
