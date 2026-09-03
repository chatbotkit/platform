// @ts-check

import {
  RESPONSE_ACTIVITY_TYPE,
  makeRequestActivityMessage,
  makeResponseActivityMessage,
} from '@/lib/activity'
import cuid from '@/lib/cuid'
import debug, { createSpan } from '@/lib/debug'
import fetch, { getFetchError } from '@/lib/fetch'
import { joinName } from '@/lib/file.helpers'
import { nameToType, reconcileTypeAndExt } from '@/lib/mime2'
import { throwLimitsReached } from '@/lib/response'
import { getTempShortURL } from '@/lib/short'
import {
  getObject,
  getObjectDownloadUrl,
  listObjects,
  putObject,
} from '@/lib/storage'
import { tryExtname } from '@/lib/url'

export const UPLOAD_ATTACHMENT_FUNCTION_NAME = 'uploadAttachment'

/**
 * @typedef {{
 *   maxSize: number
 * }} ConversationAttachmentUploadOptions
 */

/**
 * @typedef {ConversationAttachmentUploadOptions & {
 *   name?: string
 *   type?: string
 * }} ConversationAttachmentURLUploadOptions
 */

/**
 * Bucket mount information for sandboxed environments.
 *
 * @typedef {{
 *   scope: import('@chatbotkit-dev/storage-spec').StorageScope,
 *   prefix: string
 * }} ConversationStorageBucketInfo
 */

/**
 * Gets the store and prefix a conversation's attachments live in.
 * Used by sandboxed environments to mount the conversation storage.
 *
 * @param {string} conversationId
 * @returns {ConversationStorageBucketInfo}
 */
export function getConversationStorageBucketInfo(conversationId) {
  return {
    scope: 'conversation',
    prefix: conversationId,
  }
}

/**
 * Get attachment upload path.
 *
 * @param {string} conversationId
 * @param {string?} ext
 * @returns {{
 *   attachmentId: string,
 *   name: string,
 *   scope: import('@chatbotkit-dev/storage-spec').StorageScope,
 *   key: string
 * }}
 * @todo capture the original attachment name which will be useful for the LLM
 */
export function getConversationAttachmentUploadInformation(
  conversationId,
  ext
) {
  const attachmentId = cuid()

  const name = joinName(attachmentId, ext)

  /** @type {import('@chatbotkit-dev/storage-spec').StorageScope} */
  const scope = 'conversation'

  const key = `${conversationId}/${name}`

  return {
    attachmentId,
    name,
    scope,
    key,
  }
}

/**
 * Lists attachments for a conversation.
 *
 * @param {string} conversationId
 * @param {{
 *   maxKeys?: number
 *   continuationToken?: string
 * }} [options]
 * @returns {Promise<{
 *   items: Array<{
 *     id: string
 *     name: string
 *     description: string
 *     type: string
 *     size: number
 *     createdAt: Date
 *     updatedAt: Date
 *     meta: {
 *       contentType: string
 *       size: number
 *     }
 *   }>
 *   cursor: string|null
 * }>}
 */
export async function listConversationAttachments(conversationId, options) {
  debug(`listing conversation attachments`, { conversationId, options })

  const span = createSpan({ name: 'listConversationAttachments' })

  try {
    const prefix = `${conversationId}/`

    const response = await listObjects(
      'conversation',
      prefix,
      {
        maxKeys: options?.maxKeys || 1000,
        continuationToken: options?.continuationToken,
      }
    )

    return {
      items: response.items
        .filter((object) => object.key !== prefix)
        .map((object) => {
          const name = object.key.replace(prefix, '')
          const id = name.replace(/\.[^.]*$/, '')
          const type = nameToType(name)
          const updatedAt = object.updatedAt
          const size = object.size

          return {
            id,
            name,
            description: name,
            type,
            size,
            createdAt: updatedAt,
            updatedAt,
            meta: {
              contentType: type,
              size,
            },
          }
        }),
      cursor: response.nextToken || null,
    }
  } finally {
    span.finish()
  }
}

/**
 * Uploads an attachment to S3.
 *
 * @param {string} conversationId
 * @param {string|Uint8Array} data
 * @param {string?} type
 * @param {string?} ext
 * @param {ConversationAttachmentUploadOptions} [options]
 * @returns {Promise<{
 *  conversationId: string,
 *  attachmentId: string,
 *  name: string,
 *  scope: import('@chatbotkit-dev/storage-spec').StorageScope,
 *  key: string
 * }>}
 */
export async function uploadConversationAttachment(
  conversationId,
  data,
  type,
  ext,
  options
) {
  debug(`uploading conversation attachment`, {
    conversationId,
    // data,
    type,
    ext,
    options,
  })

  if (typeof data === 'string') {
    data = new TextEncoder().encode(data)
  }

  // @note only enforce a cap when a positive maxSize is provided. A missing
  // maxSize means "no limit". Previously the `|| 0` default made ANY non-empty
  // file exceed the (zero) limit, which silently rejected every attachment for
  // callers that forgot to pass maxSize (telegram/messenger/instagram/whatsapp
  // queues) - the upload threw LIMITS_REACHED, a "known expected" code that is
  // never reported, so the failure was invisible.
  if (options?.maxSize && data.byteLength > options.maxSize) {
    throwLimitsReached(`Attachment is too large`)
  }

  const span = createSpan({ name: 'uploadConversationAttachment' })

  try {
    const { attachmentId, name, scope, key } =
      getConversationAttachmentUploadInformation(conversationId, ext)

    // @todo set the expiration to conversation expiration

    await putObject(scope, key, data, {
      contentType: type || undefined,
    })

    return {
      conversationId,
      attachmentId,

      name,

      scope,
      key,
    }
  } finally {
    span.finish()
  }
}

/**
 * Fetches the URL and uploads it to S3 as an attachment.
 *
 * @param {string} conversationId
 * @param {string} url,
 * @param {Record<string,string>} [headers]
 * @param {ConversationAttachmentURLUploadOptions} [options]
 * @returns {Promise<{
 *   conversationId: string,
 *   attachmentId: string,
 *   name: string,
 *   type: string,
 *   scope: import('@chatbotkit-dev/storage-spec').StorageScope,
 *   key: string
 * }>}
 */
export async function uploadConversationAttachmentFromURL(
  conversationId,
  url,
  headers,
  options
) {
  debug(`uploading conversation attachment from URL`, {
    conversationId,
    url,
    options,
  })

  const span = createSpan({ name: 'uploadConversationAttachmentFromURL' })

  try {
    const response = await fetch(url, { headers })

    if (!response.ok) {
      throw await getFetchError(response)
    }

    const data = new Uint8Array(await response.arrayBuffer())

    let { type, ext } = reconcileTypeAndExt(
      options?.type || response.headers.get('content-type') || null,
      tryExtname(options?.name || url)?.slice(1) || null
    )

    if (!type) {
      type = 'application/octet-stream'
    }

    const {
      attachmentId,

      name,

      scope,
      key,
    } = await uploadConversationAttachment(
      conversationId,
      data,
      type,
      ext,
      options
    )

    return {
      conversationId,
      attachmentId,

      name,
      type,

      scope,
      key,
    }
  } finally {
    span.finish()
  }
}

/**
 * Get the attachment data.
 *
 * @param {string} conversationId
 * @param {string} attachmentName
 * @returns {Promise<{data: Uint8Array, contentType: string}|null>}
 */
export async function getConversationAttachmentData(
  conversationId,
  attachmentName
) {
  debug(`getting attachment data`, { conversationId, attachmentName })

  const span = createSpan({ name: 'getAttachmentData' })

  try {
    const response = await getObject(
      'conversation',
      `${conversationId}/${attachmentName}`
    )

    if (response.body) {
      const buf = await response.body.arrayBuffer()

      return {
        data: new Uint8Array(buf),
        contentType: response.contentType || 'application/octet-stream',
      }
    } else {
      return null
    }
  } finally {
    span.finish()
  }
}

/**
 * Get the attachment download URL. Note that we don't require the id but the
 * name which is the id plus the extension.
 *
 * @param {string} conversationId
 * @param {string} attachmentName
 * @param {boolean} [short=true]
 * @returns {Promise<string>}
 */
export async function getConversationAttachmentDownloadURL(
  conversationId,
  attachmentName,
  short = true
) {
  // @todo check if there is a non-expired URL for this attachment already and
  // return that instead - this will ensure that we don't fill the short URL
  // db with duplicate URLs and the models will have a non-changing URL to
  // reference

  debug(`getting attachment URL`, { conversationId, attachmentName, short })

  const span = createSpan({ name: 'getAttachmentURL' })

  try {
    const tempURL = await getObjectDownloadUrl(
      'conversation',
      `${conversationId}/${attachmentName}`
    )

    if (short) {
      const shortURL = await getTempShortURL(tempURL)

      return shortURL
    } else {
      return tempURL
    }
  } finally {
    span.finish()
  }
}

/**
 * @param {{
 *  id: string,
 *  name: string,
 *  type: string
 * }} params
 * @returns {{
 *  request: import('@/lib/message').FunctionRequestActivityMessage
 *  response: import('@/lib/message').FunctionResponseActivityMessage
 * }}
 */
export function makeConversationAttachmentUploadActivityMessages({
  id,
  name,
  type,
}) {
  const request = makeRequestActivityMessage(
    UPLOAD_ATTACHMENT_FUNCTION_NAME,
    {}
  )

  const response = makeResponseActivityMessage(
    UPLOAD_ATTACHMENT_FUNCTION_NAME,
    {},
    {
      id,
      name,
      type,
      url: `attachment://${name}`,
    }
  )

  return {
    request,
    response,
  }
}

/**
 * @param {{
 *   meta: Record<string, any>
 * }} message
 * @returns {{
 *   id: string,
 *   name: string,
 *   type: string
 * }|null}
 */
export function getConversationAttachmentUploadActivityMessageDetails({
  meta,
}) {
  const { activity } = meta || {}

  const { type, function: _function } = activity || {}

  // @note matches only the RESPONSE half of the uploadAttachment pair (where the
  // {id,name,type} result lives). The conversation converters currently call
  // this from their REQUEST branch, so it returns null there - a known dead
  // branch; see the @todo in model.provider.openai.conv.ts (convertMessages /
  // convertMessagesToResponseInput).
  if (type === RESPONSE_ACTIVITY_TYPE) {
    if (_function?.name === UPLOAD_ATTACHMENT_FUNCTION_NAME) {
      const { result } = _function

      const { id, name, type } = result || {}

      return {
        id,
        name,
        type,
      }
    }
  }

  return null
}
