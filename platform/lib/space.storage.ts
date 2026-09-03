// @ts-check
import { decode, encode } from '@/lib/b64'
import debug from '@/lib/debug'
import { join as joinPaths } from '@/lib/path'
import { badRequest } from '@/lib/response'
import type {
  StorageObject,
  StorageScope,
  StorageWritableBody,
} from '@/lib/storage'
import {
  copyObject,
  deleteObject,
  deleteObjects,
  getObject,
  getObjectDownloadUrl,
  getObjectUploadUrl,
  headObject,
  listObjects,
  moveObject,
  putObject,
  sanitizeObjectKey,
} from '@/lib/storage'
import { tryPathname } from '@/lib/url'

// @note customer data files are stored in this subfolder to keep the bucket
// root available for metadata files (manifests, etc.) not exposed to customers

const DATA_FOLDER_PREFIX = 'data'

// @todo consider adding a different storage backend backed by a filesystem for
// more native file handling

/**
 * Represents a file or directory in space storage.
 */
export interface StorageItem {
  path: string
  pathId: string
  size: number
  contentType?: string
  metadata?: Record<string, string>
  updatedAt: number
  isDirectory: boolean
}

/**
 * Base options that are common to all storage operations.
 */
type BaseStorageOptions = {
  spaceId: string
}

/**
 * Path options - either path or pathId must be provided.
 */
type PathOptions =
  | { path: string; pathId?: never }
  | { path?: never; pathId: string }

/**
 * Destination options - either destinationPath or destinationPathId must be provided.
 */
type DestinationPathOptions =
  | { destinationPath: string; destinationPathId?: never }
  | { destinationPath?: never; destinationPathId: string }

/**
 * Get space root (the actual S3 prefix for the space, without data folder).
 *
 * @returns the root prefix for the space
 */
export function getSpaceStorageRoot(options: BaseStorageOptions): string {
  const { spaceId } = options

  return `space-${spaceId}`
}

/**
 * Get space data root (the S3 prefix for customer data files).
 *
 * @returns the data folder prefix so customers only see their data files
 */
export function getSpaceStorageDataRoot(options: BaseStorageOptions): string {
  const { spaceId } = options

  return joinPaths(getSpaceStorageRoot({ spaceId }), DATA_FOLDER_PREFIX)
}

/**
 * Bucket mount information for sandboxed environments.
 */
export interface SpaceStorageBucketInfo {
  scope: StorageScope
  prefix: string
}

/**
 * Gets the S3 bucket and prefix for a space's storage.
 *
 * @returns the data folder prefix so customers only see their data files
 */
export function getSpaceStorageMountConfig(
  options: BaseStorageOptions
): SpaceStorageBucketInfo {
  const { spaceId } = options

  return {
    scope: 'space',
    prefix: getSpaceStorageDataRoot({ spaceId }),
  }
}

/**
 * Gets the S3 key prefix for a space's storage.
 *
 * @returns path relative to the data folder where customer files are stored
 */
export function resolveSpaceStorageDataKey(
  options: BaseStorageOptions & PathOptions
): string {
  const { spaceId, path, pathId } = options

  const dataRoot = getSpaceStorageDataRoot({ spaceId })

  let resolvedPath: string

  {
    if (pathId) {
      resolvedPath = decode(pathId)
    } else {
      resolvedPath = path || ''
    }

    // use tryPathname to handle URL-like paths and decode percent-encoding
    {
      resolvedPath = tryPathname(resolvedPath, 'file://') || ''
    }

    // decode URL-encoded characters to allow spaces and other safe special chars
    {
      try {
        resolvedPath = decodeURIComponent(resolvedPath)
      } catch {
        // @note if decoding fails, use the original path
      }
    }

    // sanitize the path according to S3 best practices
    {
      resolvedPath = sanitizeObjectKey(resolvedPath)
    }

    // normalize path by removing leading slashes
    {
      resolvedPath = resolvedPath.replace(/^\/+/, '')
    }
  }

  if (!resolvedPath) {
    return dataRoot + '/'
  }

  return joinPaths(dataRoot, resolvedPath)
}

/**
 * Gets the file name from a path.
 *
 * @returns the file name portion of the path
 * @throws {Error}
 */
export function getSpaceStorageFileName(
  options: BaseStorageOptions & PathOptions
): string {
  const key = resolveSpaceStorageDataKey(options)

  const indexOf = key.lastIndexOf('/')

  if (indexOf === -1) {
    throw new Error('Invalid path, cannot determine file name')
  }

  return key.substring(indexOf + 1)
}

/**
 * Gets the directory name from a path.
 *
 * @returns the directory portion of the path
 * @throws {Error}
 */
export function getSpaceStorageDirectoryName(
  options: BaseStorageOptions & PathOptions
): string {
  const key = resolveSpaceStorageDataKey(options)

  const indexOf = key.lastIndexOf('/')

  if (indexOf === -1) {
    throw new Error('Invalid path, cannot determine directory name')
  }

  return key.substring(0, indexOf)
}

/**
 * Checks if the provided path is a data root path (of the data folder)
 *
 * @returns true if the path is the data root path
 */
export function isSpaceStorageDataRootPath(
  options: BaseStorageOptions & PathOptions
): boolean {
  const key = resolveSpaceStorageDataKey(options)

  const basePath = `${getSpaceStorageDataRoot(options)}/`

  return key === basePath
}

/**
 * Lists files in the space storage.
 */
export async function listStorage(
  options: BaseStorageOptions &
    PathOptions & {
      recursive?: boolean
      maxKeys?: number
      continuationToken?: string
    }
): Promise<{
  items: StorageItem[]
  nextToken?: string
}> {
  debug(`listing space storage`, { options }).log('space.storage.listStorage')

  const { spaceId, path, pathId, recursive, maxKeys, continuationToken } =
    options

  const prefix = resolveSpaceStorageDataKey({
    spaceId,
    path,
    pathId,
  } as BaseStorageOptions & PathOptions)

  const delimiter = recursive ? undefined : '/'

  const prefixWithSlash = prefix.endsWith('/') ? prefix : `${prefix}/`

  const response = await listObjects(
    'space',
    prefixWithSlash,
    {
      delimiter,
      maxKeys: maxKeys || 1000,
      continuationToken,
    }
  )

  const items: StorageItem[] = []

  // @note add directories (common prefixes)

  for (const prefix of response.prefixes) {
    const relativePath = prefix.replace(prefixWithSlash, '') // @note remove the base prefix to get relative path

    items.push({
      path: relativePath.replace(/\/$/, ''),
      pathId: encode(relativePath.replace(/\/$/, ''), true),
      size: 0,
      updatedAt: 0,
      isDirectory: true,
    })
  }

  // @note add files

  for (const object of response.items) {
    if (object.key === prefixWithSlash) {
      // @note skip the directory marker itself

      continue
    }

    const relativePath = object.key.replace(prefixWithSlash, '') // @note remove the base prefix to get relative path

    items.push({
      path: relativePath,
      pathId: encode(relativePath, true),
      size: object.size,
      updatedAt: object.updatedAt.getTime(),
      isDirectory: false,
    })
  }

  return {
    items,
    nextToken: response.nextToken,
  }
}

/**
 * Gets path metadata for a file or directory in space storage.  For
 * directories, checks if objects exist with the path as a prefix.
 */
export async function getStoragePathMetadata(
  options: BaseStorageOptions & PathOptions
): Promise<StorageItem> {
  debug(`getting storage path metadata`, { options }).log(
    'space.storage.getStoragePathMetadata'
  )

  const { spaceId, path, pathId } = options

  const key = resolveSpaceStorageDataKey({
    spaceId,
    path,
    pathId,
  } as BaseStorageOptions & PathOptions)

  const keyPath = key.replace(`space-${spaceId}/`, '')

  // @note try to get file metadata first

  try {
    const response = await headObject('space', key)

    // @note check if this is a directory marker (key ends with /)

    const isDirectory = key.endsWith('/')

    return {
      path: keyPath,
      pathId: encode(keyPath, true),
      size: response.size || 0,
      contentType: response.contentType,
      metadata: response.metadata,
      updatedAt: (response.updatedAt || new Date()).getTime(),
      isDirectory: isDirectory,
    }
  } catch (error: unknown) {
    const err = error as {
      name?: string
      $metadata?: { httpStatusCode?: number }
    }

    // @note if object not found, check if it's a directory by listing with prefix

    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      const prefix = key.endsWith('/') ? key : `${key}/`

      const listResponse = await listObjects('space', prefix, {
        maxKeys: 1,
      })

      // @note if we found objects with this prefix, it's a directory

      const hasContents =
        listResponse.items.length > 0 || listResponse.prefixes.length > 0

      if (hasContents) {
        return {
          path: keyPath,
          pathId: encode(keyPath, true),
          size: 0,
          updatedAt: 0,
          isDirectory: true,
        }
      }
    }

    // @note path doesn't exist as file or directory

    throw error
  }
}

/**
 * Gets a presigned download URL for a file in space storage. This method does
 * not check if the file exists.
 */
export async function getStorageFileDownloadUrl(
  options: BaseStorageOptions &
    PathOptions & {
      expiresIn?: number
    }
): Promise<string> {
  debug(`getting storage file download url`, { options }).log(
    'space.storage.getStorageFileDownloadUrl'
  )

  if (isSpaceStorageDataRootPath(options)) {
    // @note root path is special

    throw badRequest('Cannot download from the root path')
  }

  const { spaceId, path, pathId, expiresIn } = options

  const key = resolveSpaceStorageDataKey({
    spaceId,
    path,
    pathId,
  } as BaseStorageOptions & PathOptions)

  return await getObjectDownloadUrl('space', key, {
    expiresIn: expiresIn,
    download: true,
  })
}

/**
 * Gets a presigned upload URL for a file in space storage. This method does
 * not check if the file exists or if the path is a directory.
 */
export async function getStorageFileUploadUrl(
  options: BaseStorageOptions &
    PathOptions & {
      size?: number
      type?: string
      metadata?: Record<string, string>
      expiresIn?: number
    }
): Promise<string> {
  debug(`getting storage file upload url`, { options }).log(
    'space.storage.getStorageFileUploadUrl'
  )

  if (isSpaceStorageDataRootPath(options)) {
    // @note root path is special

    throw badRequest('Cannot upload into the root path')
  }

  const { spaceId, path, pathId, size, type, metadata, expiresIn } = options

  const key = resolveSpaceStorageDataKey({
    spaceId,
    path,
    pathId,
  } as BaseStorageOptions & PathOptions)

  return await getObjectUploadUrl('space', key, {
    size,
    type,
    metadata,
    expiresIn,
  })
}

/**
 * Downloads a file from space storage. This method does not check if the file
 * exists.
 */
export async function downloadStorageFile(
  options: BaseStorageOptions & PathOptions
): Promise<StorageObject> {
  debug(`downloading storage file`, { options }).log(
    'space.storage.downloadStorageFile'
  )

  if (isSpaceStorageDataRootPath(options)) {
    // @note root path is special

    throw badRequest('Cannot download from the root path')
  }

  const { spaceId, path, pathId } = options

  const key = resolveSpaceStorageDataKey({
    spaceId,
    path,
    pathId,
  } as BaseStorageOptions & PathOptions)

  return await getObject('space', key)
}

/**
 * Uploads a file directly to space storage. This method does not check if
 * the file exists or if the path is a directory.
 */
export async function uploadStorageFile(
  options: BaseStorageOptions &
    PathOptions & {
      body: StorageWritableBody
      contentType?: string
      metadata?: Record<string, string>
    }
): Promise<void> {
  debug(`uploading storage file`, { options }).log(
    'space.storage.uploadStorageFile'
  )

  if (isSpaceStorageDataRootPath(options)) {
    // @note root path is special

    throw badRequest('Cannot upload into the root path')
  }

  const { spaceId, path, pathId, body, contentType, metadata } = options

  const key = resolveSpaceStorageDataKey({
    spaceId,
    path,
    pathId,
  } as BaseStorageOptions & PathOptions)

  await putObject('space', key, body, {
    contentType,
    metadata,
  })
}

/**
 * Deletes a file from space storage. This method does not check if the file
 * exists.
 */
export async function deleteStorageFile(
  options: BaseStorageOptions & PathOptions
): Promise<void> {
  debug(`deleting storage file`, { options }).log(
    'space.storage.deleteStorageFile'
  )

  if (isSpaceStorageDataRootPath(options)) {
    // @note root path is special

    throw badRequest('Cannot delete the root path')
  }

  const { spaceId, path, pathId } = options

  const key = resolveSpaceStorageDataKey({
    spaceId,
    path,
    pathId,
  } as BaseStorageOptions & PathOptions)

  await deleteObject('space', key)
}

/**
 * Deletes a directory and all its contents from space storage. This method
 * does not check if the directory exists.
 */
export async function deleteStorageDirectory(
  options: BaseStorageOptions & PathOptions
): Promise<void> {
  debug(`deleting storage directory`, { options }).log(
    'space.storage.deleteStorageDirectory'
  )

  if (isSpaceStorageDataRootPath(options)) {
    // @note root path is special

    throw badRequest('Cannot delete the root path')
  }

  const { spaceId, path, pathId } = options

  let prefix = resolveSpaceStorageDataKey({
    spaceId,
    path,
    pathId,
  } as BaseStorageOptions & PathOptions)

  if (!prefix.endsWith('/')) {
    // @note ensure prefix ends with slash for directory deletion

    prefix += '/'
  }

  // @note deleteObjects helper handles pagination automatically

  await deleteObjects('space', prefix)
}

/**
 * Copies a file in space storage. This method does not check if the source file
 * exists or if the destination path is a directory.
 */
export async function copyStorageFile(
  options: BaseStorageOptions & PathOptions & DestinationPathOptions
): Promise<void> {
  debug(`copying storage file`, { options }).log(
    'space.storage.copyStorageFile'
  )

  if (isSpaceStorageDataRootPath(options)) {
    // @note root path is special

    throw badRequest('Cannot copy the root path')
  }

  const { spaceId, path, pathId, destinationPath, destinationPathId } = options

  const sourceKey = resolveSpaceStorageDataKey({
    spaceId,
    path,
    pathId,
  } as BaseStorageOptions & PathOptions)

  const destinationKey = resolveSpaceStorageDataKey({
    spaceId: spaceId,
    path: destinationPath,
    pathId: destinationPathId,
  } as BaseStorageOptions & PathOptions)

  await copyObject('space', sourceKey, destinationKey)
}

/**
 * Moves (renames) a file in space storage. This method does not check if the
 * source file exists or if the destination path is a directory.
 */
export async function moveStorageFile(
  options: BaseStorageOptions & PathOptions & DestinationPathOptions
): Promise<void> {
  debug(`moving storage file`, { options }).log('space.storage.moveStorageFile')

  if (isSpaceStorageDataRootPath(options)) {
    // @note root path always exists

    throw badRequest('Cannot move the root path')
  }

  const { spaceId, path, pathId, destinationPath, destinationPathId } = options

  const sourceKey = resolveSpaceStorageDataKey({
    spaceId,
    path,
    pathId,
  } as BaseStorageOptions & PathOptions)

  const destinationKey = resolveSpaceStorageDataKey({
    spaceId: spaceId,
    path: destinationPath,
    pathId: destinationPathId,
  } as BaseStorageOptions & PathOptions)

  await moveObject('space', sourceKey, destinationKey)

  // @todo change the content-disposition metadata to reflect the new name
}

/**
 * Checks if a file or directory exists in space storage.
 */
export async function storagePathExists(
  options: BaseStorageOptions & PathOptions
): Promise<boolean> {
  debug(`checking if storage path exists`, { options }).log(
    'space.storage.storagePathExists'
  )

  if (isSpaceStorageDataRootPath(options)) {
    // @note root path always exists

    return true
  }

  const { spaceId, path, pathId } = options

  try {
    const object = await getStoragePathMetadata({
      spaceId,
      path,
      pathId,
    } as BaseStorageOptions & PathOptions)

    return object !== null
  } catch (error: unknown) {
    const err = error as {
      name?: string
      $metadata?: { httpStatusCode?: number }
    }

    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      return false
    }

    throw error
  }
}

/**
 * Checks if a file exists in space storage.
 */
export async function storageFileExists(
  options: BaseStorageOptions & PathOptions
): Promise<boolean> {
  debug(`checking if storage file exists`, { options }).log(
    'space.storage.storageFileExists'
  )

  if (isSpaceStorageDataRootPath(options)) {
    // @note root path always exists

    return true
  }

  const { spaceId, path, pathId } = options

  try {
    const object = await getStoragePathMetadata({
      spaceId,
      path,
      pathId,
    } as BaseStorageOptions & PathOptions)

    return object.isDirectory === false
  } catch (error: unknown) {
    const err = error as {
      name?: string
      $metadata?: { httpStatusCode?: number }
    }

    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      return false
    }

    throw error
  }
}

/**
 * Check if a directory exists in space storage.
 */
export async function storageDirectoryExists(
  options: BaseStorageOptions & PathOptions
): Promise<boolean> {
  debug(`checking if storage directory exists`, { options }).log(
    'space.storage.storageDirectoryExists'
  )

  if (isSpaceStorageDataRootPath(options)) {
    // @note root path always exists

    return true
  }

  const { spaceId, path, pathId } = options

  try {
    const object = await getStoragePathMetadata({
      spaceId,
      path,
      pathId,
    } as BaseStorageOptions & PathOptions)

    return object.isDirectory === true
  } catch (error: unknown) {
    const err = error as {
      name?: string
      $metadata?: { httpStatusCode?: number }
    }

    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      return false
    }

    throw error
  }
}

/**
 * Result from a storage file search.
 */
export interface StorageSearchResult {
  path: string
  pathId: string
  size: number
  updatedAt: number
  score: number
}

/**
 * Searches for files in space storage by matching query against file paths.
 * Returns files ranked by relevance score.
 */
export async function searchStorageFiles(
  options: BaseStorageOptions & {
    query: string
    maxResults?: number
  }
): Promise<StorageSearchResult[]> {
  debug(`searching storage files`, { options }).log(
    'space.storage.searchStorageFiles'
  )

  const { spaceId, query, maxResults = 50 } = options

  // @note normalize query for case-insensitive matching

  const normalizedQuery = query.toLowerCase().trim()

  if (!normalizedQuery) {
    return []
  }

  // @note list all files recursively from the root

  const { items } = await listStorage({
    spaceId,
    path: '.',
    recursive: true,
    maxKeys: 10000, // @note limit to prevent excessive results
  })

  // @note filter and score files based on query match

  const results: StorageSearchResult[] = []

  for (const item of items) {
    if (item.isDirectory) {
      // @note skip directories

      continue
    }

    const normalizedPath = item.path.toLowerCase()

    // @note check if query matches the path

    if (normalizedPath.includes(normalizedQuery)) {
      // @note calculate relevance score based on match position and type

      let score = 0

      // @note exact match gets highest score

      if (normalizedPath === normalizedQuery) {
        score = 100
      }
      // @note filename match gets high score
      else {
        const fileName = item.path.split('/').pop()?.toLowerCase() || ''

        if (fileName === normalizedQuery) {
          score = 90
        } else if (fileName.startsWith(normalizedQuery)) {
          score = 80
        } else if (fileName.includes(normalizedQuery)) {
          score = 70
        }
        // @note path match gets medium score
        else if (normalizedPath.startsWith(normalizedQuery)) {
          score = 60
        } else if (normalizedPath.includes(normalizedQuery)) {
          score = 50
        }
      }

      if (score > 0) {
        results.push({
          path: item.path,
          pathId: item.pathId,
          size: item.size,
          updatedAt: item.updatedAt,
          score,
        })
      }
    }
  }

  // @note sort by score descending, then by path alphabetically

  results.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score
    }

    return a.path.localeCompare(b.path)
  })

  // @note limit results to maxResults

  return results.slice(0, maxResults)
}
