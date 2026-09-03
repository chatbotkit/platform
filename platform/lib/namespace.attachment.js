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
import { reconcileTypeAndExt } from '@/lib/mime2'
import { throwLimitsReached } from '@/lib/response'
import { getTempShortURL } from '@/lib/short'
import { getObject, getObjectDownloadUrl, putObject } from '@/lib/storage'
import { tryExtname } from '@/lib/url'

export const UPLOAD_ATTACHMENT_FUNCTION_NAME = 'uploadAttachment'

/**
 * Get attachment upload path.
 *
 * @param {string} namespace
 * @param {string?} ext
 * @returns {{
 *   attachmentId: string,
 *   name: string,
 *   scope: import('@chatbotkit-dev/storage-spec').StorageScope,
 *   key: string
 * }}
 * @todo capture the original attachment name which will be useful for the LLM
 */
export function getNamespaceAttachmentUploadInformation(namespace, ext) {
  const attachmentId = cuid()

  const name = joinName(attachmentId, ext)

  /** @type {import('@chatbotkit-dev/storage-spec').StorageScope} */
  const scope = 'namespace'

  const key = `${namespace}/${name}`

  return {
    attachmentId,
    name,
    scope,
    key,
  }
}

/**
 * Uploads an attachment to S3.
 *
 * @param {string} namespace
 * @param {string|Uint8Array} data
 * @param {string?} type
 * @param {string?} ext
 * @param {{maxSize: number}} [options]
 * @returns {Promise<{
 *  namespace: string,
 *  attachmentId: string,
 *  name: string,
 *  scope: import('@chatbotkit-dev/storage-spec').StorageScope,
 *  key: string
 * }>}
 */
export async function uploadNamespaceAttachment(
  namespace,
  data,
  type,
  ext,
  options
) {
  debug(`uploading namespace attachment`, {
    namespace,
    // data,
    type,
    ext,
    options,
  })

  if (typeof data === 'string') {
    data = new TextEncoder().encode(data)
  }

  if (data.byteLength > (options?.maxSize || 0)) {
    throwLimitsReached(`Attachment is too large`)
  }

  const span = createSpan({ name: 'uploadNamespaceAttachment' })

  try {
    const { attachmentId, name, scope, key } =
      getNamespaceAttachmentUploadInformation(namespace, ext)

    // @todo set the expiration to namespace expiration

    await putObject(scope, key, data, {
      contentType: type || undefined,
    })

    return {
      namespace,
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
 * @param {string} namespace
 * @param {string} url,
 * @param {Record<string,string>} [headers]
 * @param {{maxSize: number}} [options]
 * @returns {Promise<{
 *   namespace: string,
 *   attachmentId: string,
 *   name: string,
 *   type: string,
 *   scope: import('@chatbotkit-dev/storage-spec').StorageScope,
 *   key: string
 * }>}
 */
export async function uploadNamespaceAttachmentFromURL(
  namespace,
  url,
  headers,
  options
) {
  debug(`uploading namespace attachment from URL`, {
    namespace,
    url,
    options,
  })

  const span = createSpan({ name: 'uploadNamespaceAttachmentFromURL' })

  try {
    const response = await fetch(url, { headers })

    if (!response.ok) {
      throw await getFetchError(response)
    }

    const data = new Uint8Array(await response.arrayBuffer())

    let { type, ext } = reconcileTypeAndExt(
      response.headers.get('content-type') || null,
      tryExtname(url)?.slice(1) || null
    )

    if (!type) {
      type = 'application/octet-stream'
    }

    const {
      attachmentId,

      name,

      scope,
      key,
    } = await uploadNamespaceAttachment(namespace, data, type, ext, options)

    return {
      namespace,
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
 * @param {string} namespace
 * @param {string} attachmentName
 * @returns {Promise<{data: Uint8Array, contentType: string}|null>}
 */
export async function getNamespaceAttachmentData(namespace, attachmentName) {
  debug(`getting attachment data`, { namespace, attachmentName })

  const span = createSpan({ name: 'getAttachmentData' })

  try {
    const response = await getObject(
      'namespace',
      `${namespace}/${attachmentName}`
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
 * @param {string} namespace
 * @param {string} attachmentName
 * @param {boolean} [short=true]
 * @returns {Promise<string>}
 */
export async function getNamespaceAttachmentTempDownloadURL(
  namespace,
  attachmentName,
  short = true
) {
  // @todo check if there is a non-expired URL for this attachment already and
  // return that instead - this will ensure that we don't fill the short URL
  // db with duplicate URLs and the models will have a non-changing URL to
  // reference

  debug(`getting attachment URL`, { namespace, attachmentName, short })

  const span = createSpan({ name: 'getAttachmentURL' })

  try {
    const tempURL = await getObjectDownloadUrl(
      'namespace',
      `${namespace}/${attachmentName}`
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
export function makeNamespaceAttachmentUploadActivityMessages({
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
export function getNamespaceAttachmentUploadActivityMessageDetails({ meta }) {
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
