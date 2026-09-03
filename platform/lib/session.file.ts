import cuid from '@/lib/cuid'
import debug, { createSpan } from '@/lib/debug'
import fetch, { getFetchError } from '@/lib/fetch'
import { joinName } from '@/lib/file.helpers'
import { reconcileTypeAndExt } from '@/lib/mime2'
import { throwLimitsReached } from '@/lib/response'
import { getTempShortURL } from '@/lib/short'
import { getObjectDownloadUrl, putObject } from '@/lib/storage'
import type { StorageScope } from '@/lib/storage'
import { tryExtname } from '@/lib/url'

interface SessionFileUploadInformation {
  fileId: string
  name: string
  scope: StorageScope
  key: string
}

interface UploadOptions {
  maxSize?: number
}

interface SessionFileUploadResult extends SessionFileUploadInformation {
  sessionId: string
}

interface SessionFileUploadFromURLResult extends SessionFileUploadResult {
  type: string
}

/**
 * Get file upload path.
 *
 * @param sessionId - The session identifier
 * @param ext - Optional file extension
 * @returns File upload information including fileId, name, scope, and key
 * @todo capture the original file name which will be useful for the LLM
 */
export function getSessionFileUploadInformation(
  sessionId: string,
  ext?: string | null
): SessionFileUploadInformation {
  const fileId = cuid()

  const name = joinName(fileId, ext)

  const scope: StorageScope = 'session'

  const key = `${sessionId}/${name}`

  return {
    fileId,
    name,
    scope,
    key,
  }
}

/**
 * Uploads a file to S3.
 *
 * @param sessionId - The session identifier
 * @param data - File content as string or Uint8Array
 * @param type - Optional MIME type
 * @param ext - Optional file extension
 * @param options - Upload options including maxSize
 * @returns Promise resolving to upload result
 */
export async function uploadSessionFile(
  sessionId: string,
  data: string | Uint8Array,
  type?: string | null,
  ext?: string | null,
  options?: UploadOptions
): Promise<SessionFileUploadResult> {
  debug(`uploading session file`, {
    sessionId,
    // data,
    type,
    ext,
    options,
  })

  let fileData: Uint8Array

  if (typeof data === 'string') {
    fileData = new TextEncoder().encode(data)
  } else {
    fileData = data
  }

  if (fileData.byteLength > (options?.maxSize || 0)) {
    throwLimitsReached(`File is too large`)
  }

  const span = createSpan({ name: 'uploadSessionFile' })

  try {
    const { fileId, name, scope, key } = getSessionFileUploadInformation(
      sessionId,
      ext
    )

    // @todo set the expiration to session expiration

    await putObject(scope, key, fileData, {
      contentType: type || undefined,
    })

    return {
      sessionId,
      fileId,

      name,

      scope,
      key,
    }
  } finally {
    span.finish()
  }
}

/**
 * Fetches the URL and uploads it to S3 as a file.
 *
 * @param sessionId - The session identifier
 * @param url - The URL to fetch
 * @param headers - Optional HTTP headers
 * @param options - Upload options including maxSize
 * @returns Promise resolving to upload result with type information
 */
export async function uploadSessionFileFromURL(
  sessionId: string,
  url: string,
  headers?: Record<string, string>,
  options?: UploadOptions
): Promise<SessionFileUploadFromURLResult> {
  debug(`uploading session file from URL`, {
    sessionId,
    url,
    options,
  })

  const span = createSpan({ name: 'uploadSessionFileFromURL' })

  try {
    const response = await fetch(url, { headers })

    if (!response.ok) {
      throw await getFetchError(response)
    }

    const data = new Uint8Array(await response.arrayBuffer())

    const { type: _type, ext } = reconcileTypeAndExt(
      response.headers.get('content-type') || null,
      tryExtname(url)?.slice(1) || null
    )

    let type = _type

    if (!type) {
      type = 'application/octet-stream'
    }

    const {
      fileId,

      name,

      scope,
      key,
    } = await uploadSessionFile(sessionId, data, type, ext, options)

    return {
      sessionId,
      fileId,

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
 * Get the file download URL. Note that we don't require the id but the
 * name which is the id plus the extension.
 *
 * @param sessionId - The session identifier
 * @param fileName - The file name (id plus extension)
 * @returns Promise resolving to the temporary download URL
 */
export async function getSessionFileTempDownloadURL(
  sessionId: string,
  fileName: string
): Promise<string> {
  // @todo check if there is a non-expired URL for this file already and
  // return that instead - this will ensure that we don't fill the short URL
  // db with duplicate URLs and the models will have a non-changing URL to
  // reference

  debug(`getting file URL`, { sessionId, fileName })

  const span = createSpan({ name: 'getFileURL' })

  try {
    const tempURL = await getObjectDownloadUrl(
      'session',
      `${sessionId}/${fileName}`
    )

    const shortURL = await getTempShortURL(tempURL)

    return shortURL
  } finally {
    span.finish()
  }
}
