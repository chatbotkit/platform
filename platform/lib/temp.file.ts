import cuid from '@/lib/cuid'
import debug, { createSpan } from '@/lib/debug'
import fetch, { getFetchError } from '@/lib/fetch'
import { joinName } from '@/lib/file.helpers'
import mime, { reconcileTypeAndExt } from '@/lib/mime2'
import { throwLimitsReached } from '@/lib/response'
import { getTempShortURL } from '@/lib/short'
import { getObjectDownloadUrl, putObject } from '@/lib/storage'
import type { StorageScope } from '@/lib/storage'
import { tryExtname } from '@/lib/url'

interface TempFileUploadInformation {
  tempId: string
  fileId: string
  fileName: string
  ext: string | null
  type: string | null
  scope: StorageScope
  key: string
}

/**
 * Get file upload path.
 *
 * @todo capture the original file name which will be useful for the LLM
 */
export function getTempFileUploadInformation(
  tempId: string,
  ext?: string | null
): TempFileUploadInformation {
  const fileId = cuid()

  const normalizedExt = ext === undefined ? undefined : ext

  const type = normalizedExt ? mime.getType(normalizedExt) : null

  const fileName = joinName(fileId, normalizedExt)

  const scope: StorageScope = 'temp'

  const key = `${tempId}/${fileName}`

  return {
    tempId,

    fileId: fileId,
    fileName: fileName,

    ext: normalizedExt === undefined ? null : normalizedExt || null,
    type,

    scope,
    key,
  }
}

interface UploadOptions {
  maxSize?: number
}

interface TempFileUploadResult {
  tempId: string
  fileId: string
  fileName: string
  scope: StorageScope
  key: string
}

/**
 * Uploads an file to S3.
 */
export async function uploadTempFile(
  tempId: string,
  data: string | Uint8Array,
  type?: string | null,
  ext?: string | null,
  options?: UploadOptions
): Promise<TempFileUploadResult> {
  debug(`uploading temp file`, {
    tempId,
    // data,
    type,
    ext,
    options,
  })

  let dataBytes: Uint8Array

  if (typeof data === 'string') {
    dataBytes = new TextEncoder().encode(data)
  } else {
    dataBytes = data
  }

  if (dataBytes.byteLength > (options?.maxSize || 0)) {
    throwLimitsReached(`File is too large`)
  }

  const span = createSpan({ name: 'uploadTempFile' })

  try {
    const {
      fileId,
      fileName,

      scope,
      key,
    } = getTempFileUploadInformation(tempId, ext)

    // @todo set the expiration to temp expiration

    await putObject(scope, key, dataBytes, {
      contentType: type || undefined,
    })

    return {
      tempId,

      fileId,
      fileName,

      scope,
      key,
    }
  } finally {
    span.finish()
  }
}

/**
 * Fetches the URL and uploads it to S3 as an file.
 */
export async function uploadTempFileFromURL(
  tempId: string,
  url: string,
  headers?: Record<string, string>,
  options?: UploadOptions
): Promise<TempFileUploadResult> {
  debug(`uploading temp file from URL`, {
    tempId,
    url,
    options,
  })

  const span = createSpan({ name: 'uploadTempFileFromURL' })

  try {
    const response = await fetch(url, { headers })

    if (!response.ok) {
      throw await getFetchError(response)
    }

    const data = new Uint8Array(await response.arrayBuffer())

    const typeAndExt = reconcileTypeAndExt(
      response.headers.get('content-type') || null,
      tryExtname(url)?.slice(1) || null
    )

    let type = typeAndExt.type

    const ext = typeAndExt.ext

    if (!type) {
      type = 'application/octet-stream'
    }

    const {
      fileId,
      fileName,

      scope,
      key,
    } = await uploadTempFile(tempId, data, type, ext, options)

    return {
      tempId,

      fileId,
      fileName,

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
 */
export async function getTempFileDownloadURL(
  tempId: string,
  fileName: string
): Promise<string> {
  // @todo check if there is a non-expired URL for this file already and
  // return that instead - this will ensure that we don't fill the short URL
  // db with duplicate URLs and the models will have a non-changing URL to
  // reference

  debug(`getting file URL`, { tempId, fileName })

  const span = createSpan({ name: 'getFileURL' })

  try {
    const tempURL = await getObjectDownloadUrl(
      'temp',
      `${tempId}/${fileName}`
    )

    return tempURL
  } finally {
    span.finish()
  }
}

/**
 * Get the file download URL. Note that we don't require the id but the
 * name which is the id plus the extension.
 */
export async function getTempFileTempDownloadURL(
  tempId: string,
  fileName: string
): Promise<string> {
  // @todo check if there is a non-expired URL for this file already and
  // return that instead - this will ensure that we don't fill the short URL
  // db with duplicate URLs and the models will have a non-changing URL to
  // reference

  debug(`getting file URL`, { tempId, fileName })

  const span = createSpan({ name: 'getFileURL' })

  try {
    const tempURL = await getObjectDownloadUrl(
      'temp',
      `${tempId}/${fileName}`
    )

    const shortURL = await getTempShortURL(tempURL)

    return shortURL
  } finally {
    span.finish()
  }
}

interface UploadBlobOptions {
  maxSize?: number
  short?: boolean
}

/**
 * Upload a blob and return a download URL for it.
 */
export async function uploadTempBlob(
  blob: Blob,
  options?: UploadBlobOptions
): Promise<URL> {
  debug(`uploading temp blob`, { blob })

  const span = createSpan({ name: 'uploadTempBlob' })

  try {
    const { tempId, type, ext } = getTempFileUploadInformation(
      cuid(),
      blob.type ? mime.getExtension(blob.type) : '.bin'
    )

    const { fileName } = await uploadTempFile(
      tempId,
      new Uint8Array(await blob.arrayBuffer()),
      type,
      ext,
      options
    )

    const url = options?.short
      ? await getTempFileTempDownloadURL(tempId, fileName)
      : await getTempFileDownloadURL(tempId, fileName)

    debug(`url`, { url }).log('temp.file.uploadTempBlob')

    return new URL(url)
  } finally {
    span.finish()
  }
}
