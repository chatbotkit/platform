import { html2text } from '@chatbotkit-dev/file-html/parse'

import { authenticatedMultiHandler } from '@/lib/auxiliary.handler'
import type { Session } from '@/lib/session.handler'
import {
  decode as decodeB64,
  encodeUint8Array as encodeUint8ArrayB64,
  isValid as isValidB64,
} from '@/lib/b64'
import call, { getCallError } from '@/lib/call'
import debug from '@/lib/debug'
import { UserInputError } from '@/lib/error'
import it from '@/lib/it'
import { runTasksMap } from '@/lib/job'
import { typeToFileName } from '@/lib/mime'
import { throwNotAuthenticated } from '@/lib/response'
import { filename } from '@/lib/url'
import { z } from '@/lib/zod.schema'

import { createMimeMessage } from 'mimetext'

// --- Gmail Message Parsing ---

type GmailPayloadPart = {
  mimeType: string
  body?: { data?: string }
  parts?: GmailPayloadPart[]
}

type GmailPayloadHeader = {
  name: string
  value: string
}

type GmailMessageData = {
  id: string
  threadId: string
  snippet: string
  labelIds?: string[]
  payload?: {
    headers?: GmailPayloadHeader[]
    parts?: GmailPayloadPart[]
    body?: { data?: string }
  }
}

/**
 * Decode base64 string if valid, otherwise return as-is
 */
function maybeB64Decode(input: string | undefined): string {
  if (!input) {
    return ''
  }

  return isValidB64(input) ? decodeB64(input) : input
}

/**
 * Recursively find a part matching the given mime type regex
 */
function getRecursivePart(
  regex: RegExp,
  parts: GmailPayloadPart[] | undefined
): GmailPayloadPart | null {
  if (!parts || !Array.isArray(parts)) {
    return null
  }

  for (const part of parts) {
    if (regex.test(part.mimeType)) {
      return part
    }

    const found = getRecursivePart(regex, part.parts)

    if (found) {
      return found
    }
  }

  return null
}

/**
 * Extract message details from Gmail API response
 *
 * @todo Add extraction of `Date` header for displaying when emails were sent/received
 * @todo Add extraction of `Message-ID` header for proper reply threading support
 * @todo Add extraction of `References` header chain for threading context
 * @todo Add extraction of `CC` and `BCC` headers
 */
function getMessageDetails(data: GmailMessageData | Record<string, unknown>) {
  debug(`getMessageDetails`, { data }).log(
    'auxiliary.google.mail.getMessageDetails'
  )

  const { id, threadId, snippet, payload, labelIds } = data as GmailMessageData

  const {
    headers: payloadHeaders,
    parts: payloadParts,
    body: payloadBody,
  } = payload || {}

  const subject = payloadHeaders?.find(
    ({ name }) => name.toLowerCase() === 'subject'
  )?.value

  const from = payloadHeaders?.find(
    ({ name }) => name.toLowerCase() === 'from'
  )?.value

  const to = payloadHeaders?.find(
    ({ name }) => name.toLowerCase() === 'to'
  )?.value

  const replyTo = payloadHeaders?.find(
    ({ name }) => name.toLowerCase() === 'reply-to'
  )?.value

  const unsubscribe = payloadHeaders?.find(({ name }) =>
    /list-unsubscribe/i.test(name)
  )?.value

  const textBody = maybeB64Decode(
    getRecursivePart(/^text\/plain/i, payloadParts)?.body?.data || ''
  )

  const htmlBody = maybeB64Decode(
    getRecursivePart(/^text\/html/i, payloadParts)?.body?.data || ''
  )

  debug(`textBody`, { textBody }).log('auxiliary.google.mail.getMessageDetails')
  debug(`htmlBody`, { htmlBody }).log('auxiliary.google.mail.getMessageDetails')

  let body = textBody?.trim() || html2text(htmlBody)

  if (!body && payloadBody) {
    body = maybeB64Decode(payloadBody.data || '')
  }

  const message: {
    id: string
    threadId: string
    snippet?: string
    subject?: string
    from?: string
    to?: string
    replyTo?: string
    unsubscribe: boolean
    body?: string
    labelIds?: string[]
  } = {
    id,

    threadId,

    snippet,

    subject,

    from,
    to,
    replyTo,

    // @note the unsubscribe link is just too long to be useful
    // @todo maybe use the internal link shortener to make it more useful
    // @note instead of showing the unsubscribe link, we are now just showing
    // whether the email has an unsubscribe link or not
    unsubscribe: unsubscribe ? true : false,

    body,

    labelIds,
  }

  debug(`message`, { message }).log('auxiliary.google.mail.getMessageDetails')

  return message
}

// --- Handler Names ---

export const USER_PROFILE_FETCH_HANDLER_NAME = 'user/profile/fetch'
export const DRAFT_CREATE_HANDLER_NAME = 'draft/create'
export const DRAFT_FETCH_HANDLER_NAME = 'draft/fetch'
export const DRAFT_LIST_HANDLER_NAME = 'draft/list'
export const DRAFT_SEND_HANDLER_NAME = 'draft/send'
export const DRAFT_DELETE_HANDLER_NAME = 'draft/delete'
export const MESSAGE_FETCH_HANDLER_NAME = 'message/fetch'
export const MESSAGE_LIST_HANDLER_NAME = 'message/list'
export const MESSAGE_SEND_HANDLER_NAME = 'message/send'
export const MESSAGE_TRASH_HANDLER_NAME = 'message/trash'
export const MESSAGE_LABEL_HANDLER_NAME = 'message/label'
export const THREAD_FETCH_HANDLER_NAME = 'thread/fetch'
export const THREAD_LIST_HANDLER_NAME = 'thread/list'
export const THREAD_TRASH_HANDLER_NAME = 'thread/trash'
export const LABEL_LIST_HANDLER_NAME = 'label/list'
export const LABEL_CREATE_HANDLER_NAME = 'label/create'
export const LABEL_DELETE_HANDLER_NAME = 'label/delete'

// --- Constants ---

const CONCURRENCY = 5

function normalizeRecipientList(value: string): string[] {
  const recipients = value
    .split(',')
    .map((recipient) => recipient.trim())
    .filter(Boolean)

  if (!recipients.length) {
    throw new UserInputError('Invalid recipient email address')
  }

  for (const recipient of recipients) {
    const parsedRecipient = z.string().email().safeParse(recipient)

    if (!parsedRecipient.success) {
      throw new UserInputError('Invalid recipient email address')
    }
  }

  return recipients
}

// --- Schemas ---

export const draftCreateSchema = z.object({
  threadId: z.string().optional(),
  to: z
    .string()
    .trim()
    .refine(
      (value) => {
        try {
          normalizeRecipientList(value)

          return true
        } catch {
          return false
        }
      },
      {
        message: 'Invalid recipient email address',
      }
    ),
  subject: z.string(),
  content: z.string(),
  attachments: z.string().optional(),
})

export type DraftCreateSchema = z.infer<typeof draftCreateSchema>

export const draftFetchSchema = z.object({
  id: z.string(),
})

export type DraftFetchSchema = z.infer<typeof draftFetchSchema>

export const messageFetchSchema = z.object({
  id: z.string(),
})

export type MessageFetchSchema = z.infer<typeof messageFetchSchema>

export const messageListSchema = z.object({
  q: z.string().optional(),
  maxResults: z.number().min(1).optional().default(25),
  returnMessageText: z.boolean().optional().default(false),
  filterPending: z.boolean().optional().default(false),
})

export type MessageListSchema = z.infer<typeof messageListSchema>

export const messageSendSchema = z.object({
  threadId: z.string().optional(),
  to: z
    .string()
    .trim()
    .refine(
      (value) => {
        try {
          normalizeRecipientList(value)

          return true
        } catch {
          return false
        }
      },
      {
        message: 'Invalid recipient email address',
      }
    ),
  subject: z.string(),
  content: z.string(),
  attachments: z.string().optional(),
})

export type MessageSendSchema = z.infer<typeof messageSendSchema>

export const threadFetchSchema = z.object({
  id: z.string(),
})

export type ThreadFetchSchema = z.infer<typeof threadFetchSchema>

export const threadListSchema = z.object({
  q: z.string().optional(),
  maxResults: z.number().min(1).optional().default(25),
  returnMessageText: z.boolean().optional().default(false),
  filterPending: z.boolean().optional().default(false),
})

export type ThreadListSchema = z.infer<typeof threadListSchema>

// --- User Profile Schema ---

export const userProfileFetchSchema = z.object({})

export type UserProfileFetchSchema = z.infer<typeof userProfileFetchSchema>

// --- Draft List/Search/Send/Delete Schemas ---

export const draftListSchema = z.object({
  q: z.string().optional(),
  maxResults: z.number().min(1).optional().default(25),
})

export type DraftListSchema = z.infer<typeof draftListSchema>

export const draftSendSchema = z.object({
  id: z.string(),
})

export type DraftSendSchema = z.infer<typeof draftSendSchema>

export const draftDeleteSchema = z.object({
  id: z.string(),
})

export type DraftDeleteSchema = z.infer<typeof draftDeleteSchema>

// --- Message Trash/Label Schemas ---

export const messageTrashSchema = z.object({
  id: z.string(),
})

export type MessageTrashSchema = z.infer<typeof messageTrashSchema>

export const messageLabelSchema = z.object({
  id: z.string(),
  addLabelId: z.string().optional(),
})

export type MessageLabelSchema = z.infer<typeof messageLabelSchema>

// --- Thread Trash Schema ---

export const threadTrashSchema = z.object({
  id: z.string(),
})

export type ThreadTrashSchema = z.infer<typeof threadTrashSchema>

// --- Label Schemas ---

export const labelListSchema = z.object({})

export type LabelListSchema = z.infer<typeof labelListSchema>

export const labelCreateSchema = z.object({
  name: z.string(),
})

export type LabelCreateSchema = z.infer<typeof labelCreateSchema>

export const labelDeleteSchema = z.object({
  id: z.string(),
})

export type LabelDeleteSchema = z.infer<typeof labelDeleteSchema>

// --- Helper Functions ---

/**
 * Get access token from headers or throw authentication error
 *
 * @throws {Error} If access token is not provided in headers
 */
function getAccessToken(headers: Headers): string {
  const token = headers.get('x-access-token')

  if (!token) {
    return throwNotAuthenticated()
  }

  return token
}

async function getUserEmailAddress(token: string): Promise<string> {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/profile`)

  const response = await call(url.href, {
    method: 'GET',
    headers: {
      Authorization: token,
    },
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  const data = await response.json()

  const { emailAddress } = z
    .object({
      emailAddress: z.string().email(),
    })
    .parse(data)

  return emailAddress
}

/**
 * Fetch reply headers (In-Reply-To, References) from the last message of a
 * thread so that a draft/reply renders as a proper reply in mail clients.
 *
 * Returns null if the thread cannot be fetched or has no usable Message-ID -
 * callers should fall back to creating the message without reply headers.
 */
async function getThreadReplyHeaders(
  token: string,
  threadId: string
): Promise<{ inReplyTo: string; references: string } | null> {
  const url = new URL(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}`
  )

  url.searchParams.set('format', 'metadata')
  url.searchParams.append('metadataHeaders', 'Message-ID')
  url.searchParams.append('metadataHeaders', 'References')

  const response = await call(url.href, {
    method: 'GET',
    headers: { Authorization: token },
  })

  if (!response.ok) {
    return null
  }

  const data = (await response.json()) as {
    messages?: { payload?: { headers?: GmailPayloadHeader[] } }[]
  }

  const messages = data.messages || []
  const lastMessage = messages[messages.length - 1]
  const headers = lastMessage?.payload?.headers || []

  // @note Gmail returns this as `Message-ID` but some servers use `Message-Id`
  const messageId = headers.find(
    ({ name }) => name.toLowerCase() === 'message-id'
  )?.value

  if (!messageId) {
    return null
  }

  const existingReferences = headers.find(
    ({ name }) => name.toLowerCase() === 'references'
  )?.value

  const references = existingReferences
    ? `${existingReferences} ${messageId}`
    : messageId

  return { inReplyTo: messageId, references }
}

/**
 * Create and encode a MIME message with optional attachments
 *
 * @todo Add support for CC and BCC recipients
 * @todo Add support for HTML content (currently only plain text)
 * @todo Add support for inline images
 */
async function createEncodedMimeMessage(options: {
  from: string
  to: string
  subject: string
  content: string
  attachments?: string
  inReplyTo?: string
  references?: string
}): Promise<string> {
  const { from, to, subject, content, attachments, inReplyTo, references } =
    options
  const recipients = normalizeRecipientList(to)

  const msg = createMimeMessage()

  msg.setSender(from)

  try {
    msg.setRecipient(recipients.length === 1 ? recipients[0] : recipients)
  } catch {
    throw new UserInputError('Invalid recipient email address')
  }

  msg.setSubject(subject)

  if (inReplyTo) {
    msg.setHeader('In-Reply-To', inReplyTo)
  }

  if (references) {
    msg.setHeader('References', references)
  }

  msg.addMessage({
    contentType: 'text/plain',
    data: content,
  })

  if (attachments) {
    for (const attachment of attachments
      .split(/\s/)
      .map((a) => a.trim())
      .filter(Boolean)) {
      let attachmentUrl: URL

      try {
        attachmentUrl = new URL(attachment)
      } catch {
        throw new UserInputError('Invalid attachment URL')
      }

      const response = await call(attachmentUrl.href)

      if (!response.ok) {
        throw await getCallError(response)
      }

      const blob = await response.blob()

      msg.addAttachment({
        inline: false,
        filename: filename(attachmentUrl.href) || typeToFileName(blob.type),
        contentType: blob.type,
        data: encodeUint8ArrayB64(new Uint8Array(await blob.arrayBuffer())),
      })
    }
  }

  return msg.asEncoded()
}

// --- Draft Handlers ---

async function draftCreateHandler(
  _session: Session,
  parameters: DraftCreateSchema,
  headers: Headers
) {
  debug(`google/mail/draft/create`, { parameters, headers }).log(
    'sensitive:sensitive:auxiliary.google.mail.draftCreateHandler'
  )

  const { threadId, to, subject, content, attachments } = parameters

  const token = getAccessToken(headers)

  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/drafts`)

  const [from, replyHeaders] = await Promise.all([
    getUserEmailAddress(token),
    threadId ? getThreadReplyHeaders(token, threadId) : Promise.resolve(null),
  ])

  const raw = await createEncodedMimeMessage({
    from,
    to,
    subject,
    content,
    attachments,
    inReplyTo: replyHeaders?.inReplyTo,
    references: replyHeaders?.references,
  })

  debug(`raw`, { raw }).log('auxiliary.google.mail.draftCreateHandler')

  let draftId: string
  let newThreadId: string

  {
    const response = await call(url.href, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          threadId: threadId || undefined,
          raw: raw,
        },
      }),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const data = await response.json()

    draftId = data.id
    newThreadId = data.threadId
  }

  return {
    id: draftId,

    link: newThreadId
      ? `https://mail.google.com/mail/ca/u/0/#drafts/${newThreadId}`
      : `https://mail.google.com/mail/ca/u/0/#drafts`,
  }
}

async function draftFetchHandler(
  _session: Session,
  parameters: DraftFetchSchema,
  headers: Headers
) {
  debug(`google/mail/draft/fetch`, { parameters, headers }).log(
    'sensitive:auxiliary.google.mail.draftFetchHandler'
  )

  const { id: draftId } = parameters

  const token = getAccessToken(headers)

  const url = new URL(
    `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${draftId}`
  )

  const response = await call(url.href, {
    method: 'GET',
    headers: {
      Authorization: token,
    },
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  const data = await response.json()

  debug(`data`, { data }).log('auxiliary.google.mail.draftFetchHandler')

  const draft = getMessageDetails(data.message)

  delete draft.snippet

  return {
    draft: {
      ...draft,

      link: `https://mail.google.com/mail/ca/u/0/#drafts/${draft.threadId}`,
    },
  }
}

// --- Message Handlers ---

async function messageFetchHandler(
  _session: Session,
  parameters: MessageFetchSchema,
  headers: Headers
) {
  debug(`google/mail/message/fetch`, { parameters, headers }).log(
    'sensitive:auxiliary.google.mail.messageFetchHandler'
  )

  const { id: messageId } = parameters

  const token = getAccessToken(headers)

  const url = new URL(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`
  )

  url.searchParams.append('format', 'full')

  const response = await call(url.href, {
    method: 'GET',
    headers: {
      Authorization: token,
    },
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  const data = await response.json()

  debug(`data`, { data }).log('auxiliary.google.mail.messageFetchHandler')

  const message = getMessageDetails(data)

  delete message.snippet

  return {
    message: {
      ...message,

      link: `https://mail.google.com/mail/u/0/#inbox/${message.threadId}`,
    },
  }
}

async function messageListHandler(
  _session: Session,
  parameters: MessageListSchema,
  headers: Headers
) {
  // @todo consider cleaning up the response text to remove quoted replies,
  // signatures, long links etc to make it shorter, more concise and easier to
  // read for the LLM

  debug(`google/mail/message/list`, { parameters, headers }).log(
    'sensitive:auxiliary.google.mail.messageListHandler'
  )

  const { q, maxResults, returnMessageText, filterPending } = parameters

  const token = getAccessToken(headers)

  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages`)

  // @note when filterPending is true, we expand the query to filter personal inbox messages

  if (filterPending) {
    const pendingQuery =
      'in:inbox category:personal -from:noreply -from:no-reply'

    url.searchParams.set('q', q ? `${q} ${pendingQuery}` : pendingQuery)
  } else if (q) {
    url.searchParams.set('q', q)
  }

  if (maxResults) {
    url.searchParams.set('maxResults', maxResults.toString())
  }

  const response = await call(url.href, {
    method: 'GET',
    headers: {
      Authorization: token,
    },
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  const data = await response.json()

  debug(`data`, { data }).log('auxiliary.google.mail.messageListHandler')

  const { messages: listMessages } = z
    .object({
      messages: z
        .array(
          z.object({
            id: z.string(),
            threadId: z.string(),
          })
        )
        .default([]),
    })
    .parse(data)

  const filteredMessages = filterPending
    ? await runTasksMap(
        CONCURRENCY,
        it(listMessages.filter(Boolean)),
        async (message) => {
          // @todo we can filter messages that are from automated systems here

          const threadUrl = new URL(
            `https://gmail.googleapis.com/gmail/v1/users/me/threads/${message.threadId}`
          )

          threadUrl.searchParams.set('format', 'metadata')

          const response = await call(threadUrl.href, {
            headers: {
              Authorization: token,
            },
          })

          if (!response.ok) {
            return message
          }

          const data = await response.json()

          debug(`data`, { data }).log(
            'auxiliary.google.mail.messageListHandler'
          )

          const {
            messages: threadMessages,
          }: { messages: { labelIds: string[] }[] } = data

          const lastMessage = threadMessages[threadMessages.length - 1]

          if (lastMessage) {
            const isSent = lastMessage.labelIds.includes('SENT')
            const isDraft = lastMessage.labelIds.includes('DRAFT')

            if (!isSent && !isDraft) {
              return message
            }
          }
        }
      )
    : listMessages.filter(Boolean)

  const messages = await runTasksMap(
    CONCURRENCY,
    it(filteredMessages.filter(Boolean)),
    async (message) => {
      if (!message) {
        return
      }

      // @todo we can filter messages that are from automated systems here

      const messageUrl = new URL(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`
      )

      messageUrl.searchParams.append('format', 'full')

      const response = await call(messageUrl.href, {
        headers: {
          Authorization: token,
        },
      })

      if (!response.ok) {
        return
      }

      const data = await response.json()

      debug(`data`, { data }).log('auxiliary.google.mail.messageListHandler')

      const details = getMessageDetails(data)

      if (returnMessageText) {
        delete details.snippet
      } else {
        delete details.body
      }

      return {
        ...details,

        link: `https://mail.google.com/mail/u/0/#inbox/${details.threadId}`,
      }
    }
  )

  debug(`messages`, { messages }).log(
    'auxiliary.google.mail.messageListHandler'
  )

  return { messages: messages.filter(Boolean) }
}

/**
 * @todo Return a link to the sent message similar to draftCreateHandler
 * @todo Add support for scheduling emails to be sent later
 */
async function messageSendHandler(
  _session: Session,
  parameters: MessageSendSchema,
  headers: Headers
) {
  debug(`google/mail/message/send`, { parameters, headers }).log(
    'sensitive:auxiliary.google.mail.messageSendHandler'
  )

  const { threadId, to, subject, content, attachments } = parameters

  const token = getAccessToken(headers)

  const url = new URL(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`
  )

  const [from, replyHeaders] = await Promise.all([
    getUserEmailAddress(token),
    threadId ? getThreadReplyHeaders(token, threadId) : Promise.resolve(null),
  ])

  const raw = await createEncodedMimeMessage({
    from,
    to,
    subject,
    content,
    attachments,
    inReplyTo: replyHeaders?.inReplyTo,
    references: replyHeaders?.references,
  })

  debug(`raw`, { raw }).log('auxiliary.google.mail.messageSendHandler')

  let messageId: string

  {
    const response = await call(url.href, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        threadId: threadId || undefined,
        raw: raw,
      }),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const data = await response.json()

    messageId = data.id
  }

  return { id: messageId }
}

// --- Thread Handlers ---

async function threadFetchHandler(
  _session: Session,
  parameters: ThreadFetchSchema,
  headers: Headers
) {
  debug(`google/mail/thread/fetch`, { parameters, headers }).log(
    'sensitive:auxiliary.google.mail.threadFetchHandler'
  )

  const { id: threadId } = parameters

  const token = getAccessToken(headers)

  const url = new URL(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}`
  )

  url.searchParams.append('format', 'full')

  const response = await call(url.href, {
    method: 'GET',
    headers: {
      Authorization: token,
    },
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  const data = await response.json()

  debug(`data`, { data }).log('auxiliary.google.mail.threadFetchHandler')

  const messages = (data.messages || []).map(
    (message: Record<string, unknown>) => getMessageDetails(message)
  )

  return {
    thread: {
      ...data,

      messages,

      link: `https://mail.google.com/mail/u/0/#inbox/${threadId}`,
    },
  }
}

async function threadListHandler(
  _session: Session,
  parameters: ThreadListSchema,
  headers: Headers
) {
  // @todo consider cleaning up the response text to remove quoted replies,
  // signatures, long links etc to make it shorter, more concise and easier to
  // read for the LLM

  debug(`google/mail/thread/list`, { parameters, headers }).log(
    'sensitive:auxiliary.google.mail.threadListHandler'
  )

  const { q, maxResults, returnMessageText, filterPending } = parameters

  const token = getAccessToken(headers)

  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/threads`)

  // @note when filterPending is true, we expand the query to filter personal inbox messages

  if (filterPending) {
    const pendingQuery =
      'in:inbox category:personal -from:noreply -from:no-reply'

    url.searchParams.set('q', q ? `${q} ${pendingQuery}` : pendingQuery)
  } else if (q) {
    url.searchParams.set('q', q)
  }

  if (maxResults) {
    url.searchParams.set('maxResults', maxResults.toString())
  }

  const response = await call(url.href, {
    method: 'GET',
    headers: {
      Authorization: token,
    },
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  const data = await response.json()

  debug(`data`, { data }).log('auxiliary.google.mail.threadListHandler')

  const { threads: listThreads } = z
    .object({
      threads: z
        .array(
          z.object({
            id: z.string(),
            snippet: z.string(),
          })
        )
        .default([]),
    })
    .parse(data)

  const filteredThreads = filterPending
    ? await runTasksMap(
        CONCURRENCY,
        it(listThreads.filter(Boolean)),
        async (thread) => {
          if (!thread) {
            return
          }

          // @todo we can filter messages that are from automated systems here

          const threadUrl = new URL(
            `https://gmail.googleapis.com/gmail/v1/users/me/threads/${thread.id}`
          )

          threadUrl.searchParams.set('format', 'metadata')

          const response = await call(threadUrl.href, {
            headers: {
              Authorization: token,
            },
          })

          if (!response.ok) {
            return thread
          }

          const data = await response.json()

          debug(`data`, { data }).log('auxiliary.google.mail.threadListHandler')

          const {
            messages: threadMessages,
          }: { messages: { labelIds: string[] }[] } = data

          const lastMessage = threadMessages[threadMessages.length - 1]

          if (lastMessage) {
            const isSent = lastMessage.labelIds.includes('SENT')
            const isDraft = lastMessage.labelIds.includes('DRAFT')

            if (!isSent && !isDraft) {
              return thread
            }
          }
        }
      )
    : listThreads.filter(Boolean)

  const threads = await runTasksMap(
    CONCURRENCY,
    it(filteredThreads.filter(Boolean)),
    async (thread) => {
      if (!thread) {
        return
      }

      const threadUrl = new URL(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${thread.id}`
      )

      threadUrl.searchParams.append('format', 'full')

      const response = await call(threadUrl.href, {
        headers: {
          Authorization: token,
        },
      })

      if (!response.ok) {
        return
      }

      const data = await response.json()

      debug(`data`, { data }).log('auxiliary.google.mail.threadListHandler')

      const messages = (data.messages || []).map(
        (message: Record<string, unknown>) => {
          const details = getMessageDetails(message)

          if (returnMessageText) {
            delete details.snippet
          } else {
            delete details.body
          }

          return details
        }
      )

      return {
        ...data,

        messages,

        link: `https://mail.google.com/mail/u/0/#inbox/${thread.id}`,
      }
    }
  )

  debug(`threads`, { threads }).log('auxiliary.google.mail.threadListHandler')

  return { threads: threads.filter(Boolean) }
}

// --- User Profile Handler ---

async function userProfileFetchHandler(
  _session: Session,
  _parameters: UserProfileFetchSchema,
  headers: Headers
) {
  debug(`google/mail/user/profile/fetch`, { headers }).log(
    'auxiliary.google.mail.userProfileFetchHandler'
  )

  const token = getAccessToken(headers)

  const emailAddress = await getUserEmailAddress(token)

  return {
    emailAddress,
  }
}

// --- Additional Draft Handlers ---

/**
 * @todo Fetch full draft details similar to messageListHandler instead of returning raw API response
 * @todo Add returnMessageText option for consistency with message/thread list handlers
 */
async function draftListHandler(_session: Session, parameters: DraftListSchema, headers: Headers) {
  debug(`google/mail/draft/list`, { parameters, headers }).log(
    'sensitive:auxiliary.google.mail.draftListHandler'
  )

  const { q, maxResults } = parameters

  const token = getAccessToken(headers)

  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/drafts`)

  if (q) {
    url.searchParams.set('q', q)
  }

  if (maxResults) {
    url.searchParams.set('maxResults', maxResults.toString())
  }

  const response = await call(url.href, {
    method: 'GET',
    headers: {
      Authorization: token,
    },
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  const data = await response.json()

  debug(`data`, { data }).log('auxiliary.google.mail.draftListHandler')

  return data
}

async function draftSendHandler(_session: Session, parameters: DraftSendSchema, headers: Headers) {
  debug(`google/mail/draft/send`, { parameters, headers }).log(
    'sensitive:auxiliary.google.mail.draftSendHandler'
  )

  const { id } = parameters

  const token = getAccessToken(headers)

  const url = new URL(
    `https://gmail.googleapis.com/gmail/v1/users/me/drafts/send`
  )

  const response = await call(url.href, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id }),
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  const data = await response.json()

  debug(`data`, { data }).log('auxiliary.google.mail.draftSendHandler')

  return data
}

async function draftDeleteHandler(
  _session: Session,
  parameters: DraftDeleteSchema,
  headers: Headers
) {
  debug(`google/mail/draft/delete`, { parameters, headers }).log(
    'sensitive:auxiliary.google.mail.draftDeleteHandler'
  )

  const { id } = parameters

  const token = getAccessToken(headers)

  const url = new URL(
    `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${id}`
  )

  const response = await call(url.href, {
    method: 'DELETE',
    headers: {
      Authorization: token,
    },
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  return { success: true }
}

// --- Additional Message Handlers ---

async function messageTrashHandler(
  _session: Session,
  parameters: MessageTrashSchema,
  headers: Headers
) {
  debug(`google/mail/message/trash`, { parameters, headers }).log(
    'sensitive:auxiliary.google.mail.messageTrashHandler'
  )

  const { id } = parameters

  const token = getAccessToken(headers)

  const url = new URL(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/trash`
  )

  const response = await call(url.href, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  const data = await response.json()

  debug(`data`, { data }).log('auxiliary.google.mail.messageTrashHandler')

  return data
}

/**
 * @todo Add support for removing labels (removeLabelIds parameter)
 * @todo Add support for adding/removing multiple labels at once
 */
async function messageLabelHandler(
  _session: Session,
  parameters: MessageLabelSchema,
  headers: Headers
) {
  debug(`google/mail/message/label`, { parameters, headers }).log(
    'sensitive:auxiliary.google.mail.messageLabelHandler'
  )

  const { id, addLabelId } = parameters

  const token = getAccessToken(headers)

  const url = new URL(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`
  )

  const response = await call(url.href, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      addLabelIds: addLabelId ? [addLabelId] : [],
      removeLabelIds: [],
    }),
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  const data = await response.json()

  debug(`data`, { data }).log('auxiliary.google.mail.messageLabelHandler')

  return data
}

// --- Additional Thread Handlers ---

async function threadTrashHandler(
  _session: Session,
  parameters: ThreadTrashSchema,
  headers: Headers
) {
  debug(`google/mail/thread/trash`, { parameters, headers }).log(
    'sensitive:auxiliary.google.mail.threadTrashHandler'
  )

  const { id } = parameters

  const token = getAccessToken(headers)

  const url = new URL(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${id}/trash`
  )

  const response = await call(url.href, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  const data = await response.json()

  debug(`data`, { data }).log('auxiliary.google.mail.threadTrashHandler')

  return data
}

// --- Label Handlers ---

async function labelListHandler(
  _session: Session,
  _parameters: LabelListSchema,
  headers: Headers
) {
  debug(`google/mail/label/list`, { headers }).log(
    'auxiliary.google.mail.labelListHandler'
  )

  const token = getAccessToken(headers)

  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/labels`)

  const response = await call(url.href, {
    method: 'GET',
    headers: {
      Authorization: token,
    },
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  const data = await response.json()

  debug(`data`, { data }).log('auxiliary.google.mail.labelListHandler')

  // @note filter out system labels and return only id and name
  const labels = (data.labels || [])
    .filter((label: { type?: string }) => label.type !== 'system')
    .map((label: { id: string; name: string }) => ({
      id: label.id,
      name: label.name,
    }))

  return labels
}

async function labelCreateHandler(
  _session: Session,
  parameters: LabelCreateSchema,
  headers: Headers
) {
  debug(`google/mail/label/create`, { parameters, headers }).log(
    'sensitive:auxiliary.google.mail.labelCreateHandler'
  )

  const { name } = parameters

  const token = getAccessToken(headers)

  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/labels`)

  const response = await call(url.href, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
      name,
    }),
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  const data = await response.json()

  debug(`data`, { data }).log('auxiliary.google.mail.labelCreateHandler')

  return data
}

async function labelDeleteHandler(
  _session: Session,
  parameters: LabelDeleteSchema,
  headers: Headers
) {
  debug(`google/mail/label/delete`, { parameters, headers }).log(
    'sensitive:auxiliary.google.mail.labelDeleteHandler'
  )

  const { id } = parameters

  const token = getAccessToken(headers)

  const url = new URL(
    `https://gmail.googleapis.com/gmail/v1/users/me/labels/${id}`
  )

  const response = await call(url.href, {
    method: 'DELETE',
    headers: {
      Authorization: token,
    },
  })

  if (!response.ok) {
    throw await getCallError(response)
  }

  return { success: true }
}

// --- Export Multi Handler ---

export default authenticatedMultiHandler({
  [USER_PROFILE_FETCH_HANDLER_NAME]: {
    schema: userProfileFetchSchema,
    fn: userProfileFetchHandler,
  },
  [DRAFT_CREATE_HANDLER_NAME]: {
    schema: draftCreateSchema,
    fn: draftCreateHandler,
  },
  [DRAFT_FETCH_HANDLER_NAME]: {
    schema: draftFetchSchema,
    fn: draftFetchHandler,
  },
  [DRAFT_LIST_HANDLER_NAME]: {
    schema: draftListSchema,
    fn: draftListHandler,
  },
  [DRAFT_SEND_HANDLER_NAME]: {
    schema: draftSendSchema,
    fn: draftSendHandler,
  },
  [DRAFT_DELETE_HANDLER_NAME]: {
    schema: draftDeleteSchema,
    fn: draftDeleteHandler,
  },
  [MESSAGE_FETCH_HANDLER_NAME]: {
    schema: messageFetchSchema,
    fn: messageFetchHandler,
  },
  [MESSAGE_LIST_HANDLER_NAME]: {
    schema: messageListSchema,
    fn: messageListHandler,
  },
  [MESSAGE_SEND_HANDLER_NAME]: {
    schema: messageSendSchema,
    fn: messageSendHandler,
  },
  [MESSAGE_TRASH_HANDLER_NAME]: {
    schema: messageTrashSchema,
    fn: messageTrashHandler,
  },
  [MESSAGE_LABEL_HANDLER_NAME]: {
    schema: messageLabelSchema,
    fn: messageLabelHandler,
  },
  [THREAD_FETCH_HANDLER_NAME]: {
    schema: threadFetchSchema,
    fn: threadFetchHandler,
  },
  [THREAD_LIST_HANDLER_NAME]: {
    schema: threadListSchema,
    fn: threadListHandler,
  },
  [THREAD_TRASH_HANDLER_NAME]: {
    schema: threadTrashSchema,
    fn: threadTrashHandler,
  },
  [LABEL_LIST_HANDLER_NAME]: {
    schema: labelListSchema,
    fn: labelListHandler,
  },
  [LABEL_CREATE_HANDLER_NAME]: {
    schema: labelCreateSchema,
    fn: labelCreateHandler,
  },
  [LABEL_DELETE_HANDLER_NAME]: {
    schema: labelDeleteSchema,
    fn: labelDeleteHandler,
  },
})
