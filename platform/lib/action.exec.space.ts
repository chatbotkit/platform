import { buf2str } from '@chatbotkit-dev/buffer'
import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import prisma from '@/prisma/client'

import { getConfigBySchema } from '@/lib/action.config'
import type {
  ActionInput,
  ActionOptions,
  ActionParams,
  ActionReturn,
} from '@/lib/action.exec.all'
import { getScopedResourceFilter } from '@/lib/action.filter'
import { isBinary } from '@/lib/binary'
import debug from '@/lib/debug'
import { chunkUrl } from '@/lib/dsd2'
import { applyLineEdit, extractLineRange } from '@/lib/edit'
import {
  BotInputError,
  UserInputError,
  UserResourceNotFoundError,
} from '@/lib/error'
import { fetchPlusPlus as fetch } from '@/lib/egress.fetch'
import { download } from '@/lib/fetch'
import { getContentTypeHeader } from '@/lib/header'
import { logEvent } from '@/lib/log'
import { isPath } from '@/lib/path'
import { getTempShortURL } from '@/lib/short'
import {
  copyStorageFile,
  deleteStorageFile,
  downloadStorageFile,
  getStorageFileDownloadUrl,
  listStorage,
  moveStorageFile,
  searchStorageFiles,
  storageFileExists,
  uploadStorageFile,
} from '@/lib/space.storage'
import { z } from '@/lib/zod.schema'

// @see data/abilities/catalogue/cbk.space.ts for ability definitions related to
// these schemas

/**
 * Access scope
 */
const scope = z
  .enum(['user', 'blueprint', 'contact'])
  .describe('The access scope')

/**
 * Schema for listing spaces
 */
export const spaceListSchema = z.object({
  '@scope': scope,
})

/**
 * Schema for fetching a space
 */
export const spaceFetchSchema = z.object({
  '@scope': scope,
  spaceId: z.string().min(1).describe('The space ID'),
})

/**
 * Schema for creating a space
 */
export const spaceCreateSchema = z.object({
  '@scope': scope,
  name: z.string().min(1).describe('The name of the space'),
  description: z.string().optional().describe('The description of the space'),
})

/**
 * Schema for updating a space
 */
export const spaceUpdateSchema = z.object({
  '@scope': scope,
  spaceId: z.string().min(1).describe('The space ID'),
  name: z.string().optional().describe('The updated name of the space'),
  description: z
    .string()
    .optional()
    .describe('The updated description of the space'),
})

/**
 * Schema for deleting a space
 */
export const spaceDeleteSchema = z.object({
  '@scope': scope,
  spaceId: z.string().min(1).describe('The space ID'),
})

/**
 * Schema for listing space storage - requires space ID
 */
export const spaceStorageListSchema = z.object({
  '@scope': scope,
  spaceId: z.string().min(1).describe('The space ID'),
  path: z.string().optional().describe('The path to list'),
  recursive: z.boolean().optional().describe('Whether to list recursively'),
})

/**
 * Schema for reading space storage - requires space ID and path
 */
export const spaceStorageReadSchema = z.object({
  '@scope': scope,
  spaceId: z.string().min(1).describe('The space ID'),
  path: z.string().min(1).describe('The file path to read'),
  startLine: z.coerce
    .number()
    .int()
    .min(1)
    .positive()
    .optional()
    .describe('The line number to start reading from (1-indexed)'),
  endLine: z.coerce
    .number()
    .int()
    .min(1)
    .positive()
    .optional()
    .describe('The line number to end reading at, inclusive (1-indexed)'),
})

/**
 * Schema for writing space storage - requires space ID, path and content
 */
export const spaceStorageWriteSchema = z.object({
  '@scope': scope,
  spaceId: z.string().min(1).describe('The space ID'),
  path: z.string().min(1).describe('The file path to write'),
  content: z.string().describe('The content to write'),
  startLine: z.coerce
    .number()
    .int()
    .min(1)
    .positive()
    .optional()
    .describe('The line number to start writing at (1-indexed)'),
  endLine: z.coerce
    .number()
    .int()
    .min(1)
    .positive()
    .optional()
    .describe('The line number to end writing at, inclusive (1-indexed)'),
})

/**
 * Schema for read/write space storage - combines read and write operations
 */
export const spaceStorageRwSchema = z.object({
  '@scope': scope,
  spaceId: z.string().min(1).describe('The space ID'),
  path: z.string().min(1).describe('The file path to read from or write to'),
  mode: z.enum(['read', 'write']).describe('The operation mode: read or write'),
  content: z
    .string()
    .optional()
    .describe('The content to write (required for write mode)'),
  startLine: z.coerce
    .number()
    .int()
    .min(1)
    .positive()
    .optional()
    .describe('The line number to start from (1-indexed)'),
  endLine: z.coerce
    .number()
    .int()
    .min(1)
    .positive()
    .optional()
    .describe('The line number to end at, inclusive (1-indexed)'),
})

/**
 * Schema for moving space storage - requires space ID, path and destination
 */
export const spaceStorageMoveSchema = z.object({
  '@scope': scope,
  spaceId: z.string().min(1).describe('The space ID'),
  path: z.string().min(1).describe('The source path'),
  destinationPath: z.string().min(1).describe('The destination path'),
})

/**
 * Schema for copying space storage - requires space ID, path and destination
 */
export const spaceStorageCopySchema = z.object({
  '@scope': scope,
  spaceId: z.string().min(1).describe('The space ID'),
  path: z.string().min(1).describe('The source path'),
  destinationPath: z.string().min(1).describe('The destination path'),
})

/**
 * Schema for deleting space storage - requires space ID and path
 */
export const spaceStorageDeleteSchema = z.object({
  '@scope': scope,
  spaceId: z.string().min(1).describe('The space ID'),
  path: z.string().min(1).describe('The file path to delete'),
})

/**
 * Schema for searching space storage - requires space ID and query
 */
export const spaceStorageSearchSchema = z.object({
  '@scope': scope,
  spaceId: z.string().min(1).describe('The space ID'),
  query: z.string().min(1).describe('The search query'),
})

/**
 * Schema for importing a file from URL into space storage - requires space ID, url, and path
 */
export const spaceStorageImportSchema = z.object({
  '@scope': scope,
  spaceId: z.string().min(1).describe('The space ID'),
  url: z.string().url().describe('The URL to import from'),
  path: z.string().min(1).describe('The destination path in storage'),
})

/**
 * Schema for getting a public link to a file in space storage - requires space ID and path
 */
export const spaceStorageLinkSchema = z.object({
  '@scope': scope,
  spaceId: z.string().min(1).describe('The space ID'),
  path: z.string().min(1).describe('The file path to get a public link for'),
})

/**
 * Inferred type for space list schema
 */
export type SpaceListSchema = z.infer<typeof spaceListSchema>

/**
 * Inferred type for space fetch schema
 */
export type SpaceFetchSchema = z.infer<typeof spaceFetchSchema>

/**
 * Inferred type for space create schema
 */
export type SpaceCreateSchema = z.infer<typeof spaceCreateSchema>

/**
 * Inferred type for space update schema
 */
export type SpaceUpdateSchema = z.infer<typeof spaceUpdateSchema>

/**
 * Inferred type for space delete schema
 */
export type SpaceDeleteSchema = z.infer<typeof spaceDeleteSchema>

/**
 * Inferred type for space storage list schema
 */
export type SpaceStorageListSchema = z.infer<typeof spaceStorageListSchema>

/**
 * Inferred type for space storage read schema
 */
export type SpaceStorageReadSchema = z.infer<typeof spaceStorageReadSchema>

/**
 * Inferred type for space storage write schema
 */
export type SpaceStorageWriteSchema = z.infer<typeof spaceStorageWriteSchema>

/**
 * Inferred type for space storage read/write schema
 */
export type SpaceStorageRwSchema = z.infer<typeof spaceStorageRwSchema>

/**
 * Inferred type for space storage move schema
 */
export type SpaceStorageMoveSchema = z.infer<typeof spaceStorageMoveSchema>

/**
 * Inferred type for space storage copy schema
 */
export type SpaceStorageCopySchema = z.infer<typeof spaceStorageCopySchema>

/**
 * Inferred type for space storage delete schema
 */
export type SpaceStorageDeleteSchema = z.infer<typeof spaceStorageDeleteSchema>

/**
 * Inferred type for space storage search schema
 */
export type SpaceStorageSearchSchema = z.infer<typeof spaceStorageSearchSchema>

/**
 * Inferred type for space storage import schema
 */
export type SpaceStorageImportSchema = z.infer<typeof spaceStorageImportSchema>

/**
 * Inferred type for space storage link schema
 */
export type SpaceStorageLinkSchema = z.infer<typeof spaceStorageLinkSchema>

// @note operation name constants for compile-time validation in action.tags.ts
export const SPACE_LIST_OPERATION_NAME = 'list'
export const SPACE_FETCH_OPERATION_NAME = 'fetch'
export const SPACE_CREATE_OPERATION_NAME = 'create'
export const SPACE_UPDATE_OPERATION_NAME = 'update'
export const SPACE_DELETE_OPERATION_NAME = 'delete'
export const SPACE_STORAGE_SEARCH_OPERATION_NAME = 'storage/search'
export const SPACE_STORAGE_LIST_OPERATION_NAME = 'storage/list'
export const SPACE_STORAGE_READ_OPERATION_NAME = 'storage/read'
export const SPACE_STORAGE_WRITE_OPERATION_NAME = 'storage/write'
export const SPACE_STORAGE_RW_OPERATION_NAME = 'storage/rw'
export const SPACE_STORAGE_MOVE_OPERATION_NAME = 'storage/move'
export const SPACE_STORAGE_COPY_OPERATION_NAME = 'storage/copy'
export const SPACE_STORAGE_DELETE_OPERATION_NAME = 'storage/delete'
export const SPACE_STORAGE_IMPORT_OPERATION_NAME = 'storage/import'
export const SPACE_STORAGE_LINK_OPERATION_NAME = 'storage/link'

/**
 * The parameters for space actions.
 */
interface SpaceActionParams {
  input: string
  params: ActionParams
  options: ActionOptions
}

/**
 * This function performs space listing logic.
 */
async function doSpaceList({
  input,
  params,
  options,
}: SpaceActionParams): Promise<ActionReturn> {
  debug(`do space list`, {
    input,
    params,
    options,
  }).log('action.exec.space.doSpaceList')

  await logEvent({
    user: { id: options.userId },
    type: 'action.space.list',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  // @todo implement this function

  throw new UserInputError(`Space listing is not yet available`)
}

/**
 * This function performs space fetching logic.
 */
async function doSpaceFetch({
  input,
  params,
  options,
}: SpaceActionParams): Promise<ActionReturn> {
  debug(`do space fetch`, {
    input,
    params,
    options,
  }).log('action.exec.space.doSpaceFetch')

  await logEvent({
    user: { id: options.userId },
    type: 'action.space.fetch',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  // @todo implement this function

  throw new UserInputError(`Space fetching is not yet available`)
}

/**
 * This function performs space creation logic.
 */
async function doSpaceCreate({
  input,
  params,
  options,
}: SpaceActionParams): Promise<ActionReturn> {
  debug(`do space create`, {
    input,
    params,
    options,
  }).log('action.exec.space.doSpaceCreate')

  await logEvent({
    user: { id: options.userId },
    type: 'action.space.create',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  // @todo implement this function

  throw new UserInputError(`Space creation is not yet available`)
}

/**
 * This function performs space updating logic.
 */
async function doSpaceUpdate({
  input,
  params,
  options,
}: SpaceActionParams): Promise<ActionReturn> {
  debug(`do space update`, {
    input,
    params,
    options,
  }).log('action.exec.space.doSpaceUpdate')

  await logEvent({
    user: { id: options.userId },
    type: 'action.space.update',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  // @todo implement this function

  throw new UserInputError(`Space updating is not yet available`)
}

/**
 * This function performs space deletion logic.
 */
async function doSpaceDelete({
  input,
  params,
  options,
}: SpaceActionParams): Promise<ActionReturn> {
  debug(`do space delete`, {
    input,
    params,
    options,
  }).log('action.exec.space.doSpaceDelete')

  await logEvent({
    user: { id: options.userId },
    type: 'action.space.delete',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  // @todo implement this function

  throw new UserInputError(`Space deletion is not yet available`)
}

/**
 * This function performs storage listing logic.
 */
async function doSpaceStorageList({
  input,
  params,
  options,
}: SpaceActionParams): Promise<ActionReturn> {
  debug(`do space storage list`, {
    input,
    params,
    options,
  }).log('action.exec.space.doSpaceStorageList')

  await logEvent({
    user: { id: options.userId },
    type: 'action.space.storage.list',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
      spaceId: options.linkedResources?.spaceId,
    },
    meta: {
      params,
    },
  })

  const {
    '@scope': scope,
    spaceId,
    path,
    recursive = false,
  } = getConfigBySchema({
    input,
    params,
    initial: {
      path: isPath(input) ? input : '.',
    },
    schema: spaceStorageListSchema,
    options,
  })

  debug(`vars`, { scope, spaceId, path, recursive }).log(
    'action.exec.space.doSpaceStorageList'
  )

  const space = await prisma.space.findFirst({
    where: {
      ...getScopedResourceFilter({
        userId: options.userId,
        scope: scope,
        linkedResources: options.linkedResources,
        contextResources: options.contextResources,
      }),

      id: spaceId,

      userId: options.userId, // @note added for more security
    },
    select: {
      id: true,
    },
  })

  if (!space) {
    throw new UserResourceNotFoundError(`Space not found`)
  }

  const result = await listStorage({
    spaceId: space.id,
    path: path || '.',
    recursive: recursive,
  })

  return {
    result: result.items.map((item) => ({
      path: item.path,
      // @note disabled because it takes a lot of tokens
      // pathId: item.pathId,
      size: item.size,
      updatedAt: item.updatedAt,
      isDirectory: item.isDirectory,
    })),
    messages: [],
  }
}

/**
 * This function performs storage read logic.
 */
export async function doSpaceStorageRead({
  input,
  params,
  options,
}: SpaceActionParams): Promise<ActionReturn> {
  debug(`do space storage read`, {
    input,
    params,
    options,
  }).log('action.exec.space.doSpaceStorageRead')

  await logEvent({
    user: { id: options.userId },
    type: 'action.space.storage.read',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
      spaceId: options.linkedResources?.spaceId,
    },
    meta: {
      params,
    },
  })

  const {
    '@scope': scope,
    spaceId,
    path,
    startLine,
    endLine,
  } = getConfigBySchema({
    input,
    params,
    initial: {
      path: input,
    },
    schema: spaceStorageReadSchema,
    options,
  })

  debug(`vars`, { scope, spaceId, path, startLine, endLine }).log(
    'action.exec.space.doSpaceStorageRead'
  )

  const space = await prisma.space.findFirst({
    where: {
      ...getScopedResourceFilter({
        userId: options.userId,
        scope: scope,
        linkedResources: options.linkedResources,
        contextResources: options.contextResources,
      }),

      id: spaceId,

      userId: options.userId, // @note added for more security
    },
    select: {
      id: true,
    },
  })

  if (!space) {
    throw new UserResourceNotFoundError(`Space not found`)
  }

  // @note check if file exists before attempting to download

  if (!(await storageFileExists({ spaceId: space.id, path }))) {
    throw new UserInputError(`File not found at path: ${path}`)
  }

  const file = await downloadStorageFile({
    spaceId: space.id,
    path: path,
  })

  let content = ''

  {
    if (file.body) {
      const buf = await file.body.arrayBuffer()

      // @todo optimize to detect binary before downloading the whole file from
      // the storage

      if (isBinary(buf)) {
        const url = await getStorageFileDownloadUrl({
          spaceId: space.id,
          path: path,
        })

        const chunks = await chunkUrl(new URL(url), {
          size: Number.MAX_SAFE_INTEGER,
          overlap: 0,
        })

        if (chunks.items.length === 0) {
          content = ''
        } else {
          content = chunks.items[0].text
        }
      } else {
        content = buf2str(buf)
      }
    }
  }

  // @note extract line range if specified

  const { outputContent, totalLines } = extractLineRange(
    content,
    startLine,
    endLine
  )

  return {
    result: {
      path,
      content: outputContent,
      totalLines,
      startLine: startLine ?? 1,
      endLine: endLine ?? totalLines,
    },
    messages: [],
  }
}

/**
 * This function performs storage write logic.
 */
export async function doSpaceStorageWrite({
  input,
  params,
  options,
}: SpaceActionParams): Promise<ActionReturn> {
  debug(`do space storage write`, {
    input,
    params,
    options,
  }).log('action.exec.space.doSpaceStorageWrite')

  await logEvent({
    user: { id: options.userId },
    type: 'action.space.storage.write',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
      spaceId: options.linkedResources?.spaceId,
    },
    meta: {
      params,
    },
  })

  const {
    '@scope': scope,
    spaceId,
    path,
    content,
    startLine,
    endLine,
  } = getConfigBySchema({
    input,
    params,
    initial: {
      content: input,
    },
    schema: spaceStorageWriteSchema,
    options,
  })

  debug(`vars`, { scope, spaceId, path, content, startLine, endLine }).log(
    'action.exec.space.doSpaceStorageWrite'
  )

  const space = await prisma.space.findFirst({
    where: {
      ...getScopedResourceFilter({
        userId: options.userId,
        scope: scope,
        linkedResources: options.linkedResources,
        contextResources: options.contextResources,
      }),

      id: spaceId,

      userId: options.userId, // @note added for more security
    },
    select: {
      id: true,
    },
  })

  if (!space) {
    throw new UserResourceNotFoundError(`Space not found`)
  }

  let finalContent: string

  // @note determine write mode based on parameters:
  // - no startLine, no endLine: overwrite entire file
  // - startLine only: insert before that line
  // - startLine and endLine: replace lines in range

  if (startLine === undefined && endLine === undefined) {
    // @note overwrite entire file
    finalContent = content
  } else {
    // @note check if file exists before attempting to read for line-based operations

    if (!(await storageFileExists({ spaceId: space.id, path }))) {
      throw new UserInputError(`File not found at path: ${path}`)
    }

    // @note need to read existing content for line-based operations

    const file = await downloadStorageFile({
      spaceId: space.id,
      path: path,
    })

    let currentContent = ''

    if (file.body) {
      const buf = await file.body.arrayBuffer()

      currentContent = buf2str(buf)
    }

    const { finalText } = applyLineEdit(
      currentContent,
      content,
      startLine,
      endLine
    )

    finalContent = finalText
  }

  await uploadStorageFile({
    spaceId: space.id,
    path: path,
    body: finalContent,
    contentType: 'text/plain',
  })

  return {
    result: { path, startLine, endLine },
    messages: [],
  }
}

/**
 * This function performs storage read/write logic with mode parameter.
 */
export async function doSpaceStorageRw({
  input,
  params,
  options,
}: SpaceActionParams): Promise<ActionReturn> {
  debug(`do space storage read/write`, {
    input,
    params,
    options,
  }).log('action.exec.space.doSpaceStorageRw')

  await logEvent({
    user: { id: options.userId },
    type: 'action.space.storage.rw',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
      spaceId: options.linkedResources?.spaceId,
    },
    meta: {
      params,
    },
  })

  const {
    '@scope': scope,
    spaceId,
    path,
    mode,
    content,
    startLine,
    endLine,
  } = getConfigBySchema({
    input,
    params,
    initial: {},
    schema: spaceStorageRwSchema,
    options,
  })

  debug(`vars`, {
    scope,
    spaceId,
    path,
    mode,
    content,
    startLine,
    endLine,
  }).log('action.exec.space.doSpaceStorageRw')

  const space = await prisma.space.findFirst({
    where: {
      ...getScopedResourceFilter({
        userId: options.userId,
        scope: scope,
        linkedResources: options.linkedResources,
        contextResources: options.contextResources,
      }),

      id: spaceId,

      userId: options.userId, // @note added for more security
    },
    select: {
      id: true,
    },
  })

  if (!space) {
    throw new UserResourceNotFoundError(`Space not found`)
  }

  if (mode === 'read') {
    // @note check if file exists before attempting to download

    if (!(await storageFileExists({ spaceId: space.id, path }))) {
      throw new UserInputError(`File not found at path: ${path}`)
    }

    const file = await downloadStorageFile({
      spaceId: space.id,
      path: path,
    })

    let fileContent = ''

    {
      if (file.body) {
        const buf = await file.body.arrayBuffer()

        // @todo optimize to detect binary before downloading the whole file from
        // the storage

        if (isBinary(buf)) {
          const url = await getStorageFileDownloadUrl({
            spaceId: space.id,
            path: path,
          })

          const chunks = await chunkUrl(new URL(url), {
            size: Number.MAX_SAFE_INTEGER,
            overlap: 0,
          })

          if (chunks.items.length === 0) {
            fileContent = ''
          } else {
            fileContent = chunks.items[0].text
          }
        } else {
          fileContent = buf2str(buf)
        }
      }
    }

    // @note extract line range if specified

    const { outputContent, totalLines } = extractLineRange(
      fileContent,
      startLine,
      endLine
    )

    return {
      result: {
        path,
        content: outputContent,
        totalLines,
        startLine: startLine ?? 1,
        endLine: endLine ?? totalLines,
      },
      messages: [],
    }
  } else {
    // @note write mode

    if (content === undefined) {
      throw new UserInputError(`Missing 'content' parameter for write mode`)
    }

    let finalContent: string

    // @note determine write mode based on parameters:
    // - no startLine, no endLine: overwrite entire file
    // - startLine only: insert before that line
    // - startLine and endLine: replace lines in range

    if (startLine === undefined && endLine === undefined) {
      // @note overwrite entire file
      finalContent = content
    } else {
      // @note check if file exists before attempting to read for line-based operations

      if (!(await storageFileExists({ spaceId: space.id, path }))) {
        throw new UserInputError(`File not found at path: ${path}`)
      }

      // @note need to read existing content for line-based operations

      const file = await downloadStorageFile({
        spaceId: space.id,
        path: path,
      })

      let currentContent = ''

      if (file.body) {
        const buf = await file.body.arrayBuffer()

        currentContent = buf2str(buf)
      }

      const { finalText } = applyLineEdit(
        currentContent,
        content,
        startLine,
        endLine
      )

      finalContent = finalText
    }

    await uploadStorageFile({
      spaceId: space.id,
      path: path,
      body: finalContent,
      contentType: 'text/plain',
    })

    return {
      result: { path, startLine, endLine },
      messages: [],
    }
  }
}

/**
 * This function performs storage move logic.
 */
export async function doSpaceStorageMove({
  input,
  params,
  options,
}: SpaceActionParams): Promise<ActionReturn> {
  debug(`do space storage move`, {
    input,
    params,
    options,
  }).log('action.exec.space.doSpaceStorageMove')

  await logEvent({
    user: { id: options.userId },
    type: 'action.space.storage.move',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
      spaceId: options.linkedResources?.spaceId,
    },
    meta: {
      params,
    },
  })

  const {
    '@scope': scope,
    spaceId,
    path,
    destinationPath,
  } = getConfigBySchema({
    input,
    params,
    schema: spaceStorageMoveSchema,
    options,
  })

  debug(`vars`, { scope, spaceId, path, destinationPath }).log(
    'action.exec.space.doSpaceStorageMove'
  )

  const space = await prisma.space.findFirst({
    where: {
      ...getScopedResourceFilter({
        userId: options.userId,
        scope: scope,
        linkedResources: options.linkedResources,
        contextResources: options.contextResources,
      }),

      id: spaceId,

      userId: options.userId, // @note added for more security
    },
    select: {
      id: true,
    },
  })

  if (!space) {
    throw new UserResourceNotFoundError(`Space not found`)
  }

  // @note check if source file exists before attempting to move

  if (!(await storageFileExists({ spaceId: space.id, path }))) {
    throw new UserInputError(`File not found at path: ${path}`)
  }

  await moveStorageFile({
    spaceId: space.id,
    path: path,
    destinationPath: destinationPath,
  })

  return {
    result: { path, destinationPath },
    messages: [],
  }
}

/**
 * This function performs storage copy logic.
 */
export async function doSpaceStorageCopy({
  input,
  params,
  options,
}: SpaceActionParams): Promise<ActionReturn> {
  debug(`do space storage copy`, {
    input,
    params,
    options,
  }).log('action.exec.space.doSpaceStorageCopy')

  await logEvent({
    user: { id: options.userId },
    type: 'action.space.storage.copy',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
      spaceId: options.linkedResources?.spaceId,
    },
    meta: {
      params,
    },
  })

  const {
    '@scope': scope,
    spaceId,
    path,
    destinationPath,
  } = getConfigBySchema({
    input,
    params,
    schema: spaceStorageCopySchema,
    options,
  })

  debug(`vars`, { scope, spaceId, path, destinationPath }).log(
    'action.exec.space.doSpaceStorageCopy'
  )

  const space = await prisma.space.findFirst({
    where: {
      ...getScopedResourceFilter({
        userId: options.userId,
        scope: scope,
        linkedResources: options.linkedResources,
        contextResources: options.contextResources,
      }),

      id: spaceId,

      userId: options.userId, // @note added for more security
    },
    select: {
      id: true,
    },
  })

  if (!space) {
    throw new UserResourceNotFoundError(`Space not found`)
  }

  // @note check if source file exists before attempting to copy

  if (!(await storageFileExists({ spaceId: space.id, path }))) {
    throw new UserInputError(`File not found at path: ${path}`)
  }

  await copyStorageFile({
    spaceId: space.id,
    path: path,
    destinationPath: destinationPath,
  })

  return {
    result: { path, destinationPath },
    messages: [],
  }
}

/**
 * This function performs storage delete logic.
 */
export async function doSpaceStorageDelete({
  input,
  params,
  options,
}: SpaceActionParams): Promise<ActionReturn> {
  debug(`do space storage delete`, {
    input,
    params,
    options,
  }).log('action.exec.space.doSpaceStorageDelete')

  await logEvent({
    user: { id: options.userId },
    type: 'action.space.storage.delete',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
      spaceId: options.linkedResources?.spaceId,
    },
    meta: {
      params,
    },
  })

  const {
    '@scope': scope,
    spaceId,
    path,
  } = getConfigBySchema({
    input,
    params,
    initial: {
      path: input,
    },
    schema: spaceStorageDeleteSchema,
    options,
  })

  debug(`vars`, { scope, spaceId, path }).log(
    'action.exec.space.doSpaceStorageDelete'
  )

  const space = await prisma.space.findFirst({
    where: {
      ...getScopedResourceFilter({
        userId: options.userId,
        scope: scope,
        linkedResources: options.linkedResources,
        contextResources: options.contextResources,
      }),

      id: spaceId,

      userId: options.userId, // @note added for more security
    },
    select: {
      id: true,
    },
  })

  if (!space) {
    throw new UserResourceNotFoundError(`Space not found`)
  }

  await deleteStorageFile({
    spaceId: space.id,
    path: path,
  })

  return {
    result: { path },
    messages: [],
  }
}

/**
 * This function performs storage search logic.
 */
export async function doSpaceStorageSearch({
  input,
  params,
  options,
}: SpaceActionParams): Promise<ActionReturn> {
  debug(`do space storage search`, {
    input,
    params,
    options,
  }).log('action.exec.space.doSpaceStorageSearch')

  await logEvent({
    user: { id: options.userId },
    type: 'action.space.storage.search',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
      spaceId: options.linkedResources?.spaceId,
    },
    meta: {
      params,
    },
  })

  const {
    '@scope': scope,
    spaceId,
    query,
  } = getConfigBySchema({
    input,
    params,
    schema: spaceStorageSearchSchema,
    options,
  })

  debug(`vars`, { scope, spaceId, query }).log(
    'action.exec.space.doSpaceStorageSearch'
  )

  const space = await prisma.space.findFirst({
    where: {
      ...getScopedResourceFilter({
        userId: options.userId,
        scope: scope,
        linkedResources: options.linkedResources,
        contextResources: options.contextResources,
      }),

      id: spaceId,

      userId: options.userId, // @note added for more security
    },
    select: {
      id: true,
    },
  })

  if (!space) {
    throw new UserResourceNotFoundError(`Space not found`)
  }

  const results = await searchStorageFiles({
    spaceId: space.id,
    query: query,
  })

  return {
    result: { query, results },
    messages: [],
  }
}

/**
 * This function performs storage import from URL logic.
 */
export async function doSpaceStorageImport({
  input,
  params,
  options,
}: SpaceActionParams): Promise<ActionReturn> {
  debug(`do space storage import`, {
    input,
    params,
    options,
  }).log('action.exec.space.doSpaceStorageImport')

  await logEvent({
    user: { id: options.userId },
    type: 'action.space.storage.import',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
      spaceId: options.linkedResources?.spaceId,
    },
    meta: {
      params,
    },
  })

  const {
    '@scope': scope,
    spaceId,
    url,
    path,
  } = getConfigBySchema({
    input,
    params,
    initial: {
      url: input,
    },
    schema: spaceStorageImportSchema,
    options,
  })

  debug(`vars`, { scope, spaceId, url, path }).log(
    'action.exec.space.doSpaceStorageImport'
  )

  const space = await prisma.space.findFirst({
    where: {
      ...getScopedResourceFilter({
        userId: options.userId,
        scope: scope,
        linkedResources: options.linkedResources,
        contextResources: options.contextResources,
      }),

      id: spaceId,

      userId: options.userId, // @note added for more security
    },
    select: {
      id: true,
    },
  })

  if (!space) {
    throw new UserResourceNotFoundError(`Space not found`)
  }

  // @note fetch the content from the URL

  const response = await fetch(url)

  if (!response.ok) {
    throw new BotInputError(`Failed to fetch URL: ${response.statusText}`)
  }

  const contentType =
    getContentTypeHeader(response) || 'application/octet-stream'

  const buffer = await download(response, 50 * 1024 * 1024 /* 50 MB */)

  // @note upload the fetched content to space storage

  await uploadStorageFile({
    spaceId: space.id,
    path: path,
    body: Buffer.from(buffer),
    contentType: contentType,
  })

  return {
    result: { url, path },
    messages: [],
  }
}

/**
 * This function performs storage link (get public URL) logic.
 */
export async function doSpaceStorageLink({
  input,
  params,
  options,
}: SpaceActionParams): Promise<ActionReturn> {
  debug(`do space storage link`, {
    input,
    params,
    options,
  }).log('action.exec.space.doSpaceStorageLink')

  await logEvent({
    user: { id: options.userId },
    type: 'action.space.storage.link',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
      spaceId: options.linkedResources?.spaceId,
    },
    meta: {
      params,
    },
  })

  const {
    '@scope': scope,
    spaceId,
    path,
  } = getConfigBySchema({
    input,
    params,
    initial: {
      path: input,
    },
    schema: spaceStorageLinkSchema,
    options,
  })

  debug(`vars`, { scope, spaceId, path }).log(
    'action.exec.space.doSpaceStorageLink'
  )

  const space = await prisma.space.findFirst({
    where: {
      ...getScopedResourceFilter({
        userId: options.userId,
        scope: scope,
        linkedResources: options.linkedResources,
        contextResources: options.contextResources,
      }),

      id: spaceId,

      userId: options.userId, // @note added for more security
    },
    select: {
      id: true,
    },
  })

  if (!space) {
    throw new UserResourceNotFoundError(`Space not found`)
  }

  // @note check if file exists before generating download URL

  if (!(await storageFileExists({ spaceId: space.id, path }))) {
    throw new UserInputError(`File not found at path: ${path}`)
  }

  // @note generate presigned download URL (valid for 24 hours by default)

  const presignedUrl = await getStorageFileDownloadUrl({
    spaceId: space.id,
    path: path,
  })

  // @note create temporary short URL (1 hour expiration) for the presigned URL

  const url = await getTempShortURL(presignedUrl)

  return {
    result: { path, url },
    messages: [],
  }
}

/**
 * The main router for the space action.
 */
export async function executeSpaceAction(
  input: ActionInput,
  params: ActionParams,
  options: ActionOptions
): Promise<ActionReturn> {
  debug(`execute space action`, { input, params, options }).log(
    'action.exec.space.executeSpaceAction'
  )

  type SpaceOperation =
    | typeof SPACE_LIST_OPERATION_NAME
    | typeof SPACE_FETCH_OPERATION_NAME
    | typeof SPACE_CREATE_OPERATION_NAME
    | typeof SPACE_UPDATE_OPERATION_NAME
    | typeof SPACE_DELETE_OPERATION_NAME
    | typeof SPACE_STORAGE_SEARCH_OPERATION_NAME
    | typeof SPACE_STORAGE_LIST_OPERATION_NAME
    | typeof SPACE_STORAGE_READ_OPERATION_NAME
    | typeof SPACE_STORAGE_WRITE_OPERATION_NAME
    | typeof SPACE_STORAGE_RW_OPERATION_NAME
    | typeof SPACE_STORAGE_MOVE_OPERATION_NAME
    | typeof SPACE_STORAGE_COPY_OPERATION_NAME
    | typeof SPACE_STORAGE_DELETE_OPERATION_NAME
    | typeof SPACE_STORAGE_IMPORT_OPERATION_NAME
    | typeof SPACE_STORAGE_LINK_OPERATION_NAME

  let operation: SpaceOperation

  {
    switch (true) {
      case !('storage' in params) && 'list' in params: {
        operation = SPACE_LIST_OPERATION_NAME

        break
      }

      case !('storage' in params) && 'fetch' in params: {
        operation = SPACE_FETCH_OPERATION_NAME

        break
      }

      case !('storage' in params) && 'create' in params: {
        operation = SPACE_CREATE_OPERATION_NAME

        break
      }

      case !('storage' in params) && 'update' in params: {
        operation = SPACE_UPDATE_OPERATION_NAME

        break
      }

      case !('storage' in params) && 'delete' in params: {
        operation = SPACE_DELETE_OPERATION_NAME

        break
      }

      case 'storage' in params && 'search' in params: {
        operation = SPACE_STORAGE_SEARCH_OPERATION_NAME

        break
      }

      case 'storage' in params && 'list' in params: {
        operation = SPACE_STORAGE_LIST_OPERATION_NAME

        break
      }

      case 'storage' in params && 'read' in params: {
        operation = SPACE_STORAGE_READ_OPERATION_NAME

        break
      }

      case 'storage' in params && 'write' in params: {
        operation = SPACE_STORAGE_WRITE_OPERATION_NAME

        break
      }

      case 'storage' in params && 'rw' in params: {
        operation = SPACE_STORAGE_RW_OPERATION_NAME

        break
      }

      case 'storage' in params && 'move' in params: {
        operation = SPACE_STORAGE_MOVE_OPERATION_NAME

        break
      }

      case 'storage' in params && 'copy' in params: {
        operation = SPACE_STORAGE_COPY_OPERATION_NAME

        break
      }

      case 'storage' in params && 'delete' in params: {
        operation = SPACE_STORAGE_DELETE_OPERATION_NAME

        break
      }

      case 'storage' in params && 'import' in params: {
        operation = SPACE_STORAGE_IMPORT_OPERATION_NAME

        break
      }

      case 'storage' in params && 'link' in params: {
        operation = SPACE_STORAGE_LINK_OPERATION_NAME

        break
      }

      default: {
        throw new UserInputError(`Unknown operation`)
      }
    }
  }

  let response: ActionReturn

  const actionParams = { input, params, options }

  switch (operation) {
    case SPACE_LIST_OPERATION_NAME: {
      response = await doSpaceList(actionParams)

      break
    }

    case SPACE_FETCH_OPERATION_NAME: {
      response = await doSpaceFetch(actionParams)

      break
    }

    case SPACE_CREATE_OPERATION_NAME: {
      response = await doSpaceCreate(actionParams)

      break
    }

    case SPACE_UPDATE_OPERATION_NAME: {
      response = await doSpaceUpdate(actionParams)

      break
    }

    case SPACE_DELETE_OPERATION_NAME: {
      response = await doSpaceDelete(actionParams)

      break
    }

    case SPACE_STORAGE_SEARCH_OPERATION_NAME: {
      response = await doSpaceStorageSearch(actionParams)

      break
    }

    case SPACE_STORAGE_LIST_OPERATION_NAME: {
      response = await doSpaceStorageList(actionParams)

      break
    }

    case SPACE_STORAGE_READ_OPERATION_NAME: {
      response = await doSpaceStorageRead(actionParams)

      break
    }

    case SPACE_STORAGE_WRITE_OPERATION_NAME: {
      response = await doSpaceStorageWrite(actionParams)

      break
    }

    case SPACE_STORAGE_RW_OPERATION_NAME: {
      response = await doSpaceStorageRw(actionParams)

      break
    }

    case SPACE_STORAGE_MOVE_OPERATION_NAME: {
      response = await doSpaceStorageMove(actionParams)

      break
    }

    case SPACE_STORAGE_COPY_OPERATION_NAME: {
      response = await doSpaceStorageCopy(actionParams)

      break
    }

    case SPACE_STORAGE_DELETE_OPERATION_NAME: {
      response = await doSpaceStorageDelete(actionParams)

      break
    }

    case SPACE_STORAGE_IMPORT_OPERATION_NAME: {
      response = await doSpaceStorageImport(actionParams)

      break
    }

    case SPACE_STORAGE_LINK_OPERATION_NAME: {
      response = await doSpaceStorageLink(actionParams)

      break
    }

    default: {
      assertUnreachable(operation)
    }
  }

  return response
}
