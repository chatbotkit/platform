import { captureError } from '@/lib/error'
import {
  getObject,
  getObjectDownloadUrl,
  getObjectUploadUrl,
  headObject,
  putObject,
} from '@/lib/storage'
import type {
  ObjectDownloadUrlOptions,
  StorageScope,
  ObjectUploadUrlOptions,
} from '@/lib/storage'
import { joinPaths } from '@/lib/url'
interface FileObjectLocation {
  scope: StorageScope
  key: string
}

/**
 * Gets the store and key a file lives at.
 */
export function getFileObjectLocation(fileId: string): FileObjectLocation {
  return {
    scope: 'file',
    key: joinPaths(fileId, 'original'),
  }
}

/**
 * Gets a presigned upload URL for a file
 */
export async function getFileObjectUploadUrl(
  fileId: string,
  options?: ObjectUploadUrlOptions
): Promise<string> {
  const { scope, key } = getFileObjectLocation(fileId)

  return await getObjectUploadUrl(scope, key, options)
}

/**
 * Gets a presigned download URL for a file
 */
export async function getFileObjectDownloadUrl(
  fileId: string,
  options?: ObjectDownloadUrlOptions
): Promise<string> {
  const { scope, key } = getFileObjectLocation(fileId)

  return await getObjectDownloadUrl(scope, key, options)
}

/**
 * Checks if a file object exists in S3
 */
export async function fileObjectExists(fileId: string): Promise<boolean> {
  const { scope, key } = getFileObjectLocation(fileId)

  try {
    await headObject(scope, key)

    return true
  } catch {
    return false
  }
}

/**
 * Uploads a file to S3
 */
export async function uploadFileObject(
  fileId: string,
  file: Parameters<typeof putObject>[2],
  options?: Parameters<typeof putObject>[3]
): Promise<void> {
  const { scope, key } = getFileObjectLocation(fileId)

  await putObject(scope, key, file, options)
}

/**
 * Downloads a file from S3
 */
export async function downloadFileObject(
  fieId: string
): ReturnType<typeof getObject> {
  const { scope, key } = getFileObjectLocation(fieId)

  return await getObject(scope, key)
}

export interface FileInstance {
  name: string | null
  type: string
  size: number
  arrayBuffer: () => Promise<ArrayBuffer>
  text: () => Promise<string>
}

/**
 * Gets a file instance from S3
 */
export async function getFileInstance(
  fileId: string
): Promise<FileInstance | null> {
  const { scope, key } = getFileObjectLocation(fileId)

  try {
    const headResponse = await headObject(scope, key)

    const contentType = headResponse.contentType || 'application/octet-stream'
    const contentLength = headResponse.size || 0
    const contentDisposition = headResponse.contentDisposition || ''

    // @note extract filename from Content-Disposition header if present

    let fileName: string | null = null

    const filenameMatch = contentDisposition.match(/filename=([^;]+)/)

    if (filenameMatch) {
      fileName = decodeURIComponent(filenameMatch[1].trim())
    }

    return new (class implements FileInstance {
      name = fileName
      type = contentType
      size = contentLength

      async arrayBuffer(): Promise<ArrayBuffer> {
        const { body } = await getObject(scope, key)

        if (!body) {
          throw new Error('Empty response body')
        }

        return await body.arrayBuffer()
      }

      async text(): Promise<string> {
        const { body } = await getObject(scope, key)

        if (!body) {
          throw new Error('Empty response body')
        }

        return await body.text()
      }
    })()
  } catch (e) {
    await captureError(e)

    return null
  }
}
