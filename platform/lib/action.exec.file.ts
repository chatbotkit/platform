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
import debug from '@/lib/debug'
import { chunkUrl } from '@/lib/dsd2'
import {
  applyLineEdit,
  describeRangeBounds,
  extractLineRange,
  summarizeEdit,
} from '@/lib/edit'
import { UserInputError } from '@/lib/error'
import { canUseFile } from '@/lib/file.access'
import {
  downloadFileObject,
  fileObjectExists,
  getFileObjectDownloadUrl,
  uploadFileObject,
} from '@/lib/file.storage'
import { logEvent } from '@/lib/log'
import { z } from '@/lib/zod.schema'

// @see data/abilities/catalogue/cbk.file.ts for ability definitions related
// to these schemas

export const fileReadSchema = z.object({
  fileId: z.string().min(1).optional(),
  id: z.string().min(1).optional(),
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

export type FileReadSchema = z.infer<typeof fileReadSchema>

export const fileWriteSchema = z.object({
  fileId: z.string().min(1).optional(),
  id: z.string().min(1).optional(),
  text: z.string(),
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

export type FileWriteSchema = z.infer<typeof fileWriteSchema>

export const filePrependSchema = z.object({
  fileId: z.string().min(1).optional(),
  id: z.string().min(1).optional(),
  text: z.string().min(1),
})

export type FilePrependSchema = z.infer<typeof filePrependSchema>

export const fileAppendSchema = z.object({
  fileId: z.string().min(1).optional(),
  id: z.string().min(1).optional(),
  text: z.string().min(1),
})

export type FileAppendSchema = z.infer<typeof fileAppendSchema>

export const fileReplaceSchema = z.object({
  fileId: z.string().min(1).optional(),
  id: z.string().min(1).optional(),
  search: z.string().min(1),
  replace: z.string(),
  count: z.number().optional(),
})

export type FileReplaceSchema = z.infer<typeof fileReplaceSchema>

export const fileRwSchema = z.object({
  fileId: z.string().min(1).optional(),
  id: z.string().min(1).optional(),
  mode: z.enum(['read', 'write']).describe('The operation mode: read or write'),
  text: z
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

export type FileRwSchema = z.infer<typeof fileRwSchema>

// @note operation name constants for compile-time validation in action.tags.ts
export const FILE_READ_OPERATION_NAME = 'read'
export const FILE_WRITE_OPERATION_NAME = 'write'
export const FILE_PREPEND_OPERATION_NAME = 'prepend'
export const FILE_APPEND_OPERATION_NAME = 'append'
export const FILE_REPLACE_OPERATION_NAME = 'replace'
export const FILE_RW_OPERATION_NAME = 'rw'

interface FileActionParams {
  input: string
  params: ActionParams
  options: ActionOptions
}

export async function doReadFile({
  input,
  params,
  options,
}: FileActionParams): Promise<ActionReturn> {
  debug(`do file read`, { input, params, options }).log(
    'action.exec.file.doReadFile'
  )

  await logEvent({
    user: { id: options.userId },
    type: 'action.file.read',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  const config = getConfigBySchema({
    input,
    params,
    initial: {},
    schema: fileReadSchema,
    options,
  })

  const resolvedFileId = config.fileId || config.id

  const { startLine, endLine } = config

  if (!resolvedFileId) {
    throw new UserInputError(`Missing 'fileId' or 'id' parameter`)
  }

  const file = await prisma.file.findUnique({
    where: {
      id: resolvedFileId,
    },
  })

  if (!file) {
    throw new UserInputError(`File not found`)
  }

  if (!canUseFile(options.userId, file)) {
    throw new UserInputError(`Cannot use file`)
  }

  // @note check if file content exists before attempting to read

  if (!(await fileObjectExists(file.id))) {
    throw new UserInputError(
      `File content not found. The file may not have been uploaded yet.`
    )
  }

  const url = await getFileObjectDownloadUrl(file.id)

  const chunks = await chunkUrl(new URL(url), {
    size: Number.MAX_SAFE_INTEGER,
    overlap: 0,
  })

  const fullText = chunks.items.map(({ text }) => text).join('\n\n')

  // @note extract line range if specified

  const { outputContent, totalLines } = extractLineRange(
    fullText,
    startLine,
    endLine
  )

  debug(`using text`, {
    text: outputContent,
    totalLines,
    startLine,
    endLine,
  }).log('action.exec.file.doReadFile')

  return {
    result: {
      text: outputContent,
      totalLines,
      startLine: startLine ?? 1,
      endLine: endLine ?? totalLines,
    },
    messages: [],
  }
}

export async function doWriteFile({
  input,
  params,
  options,
}: FileActionParams): Promise<ActionReturn> {
  debug(`do file write`, { input, params, options }).log(
    'action.exec.file.doWriteFile'
  )

  await logEvent({
    user: { id: options.userId },
    type: 'action.file.write',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  const config = getConfigBySchema({
    input,
    params,
    initial: {
      text: input,
    },
    schema: fileWriteSchema,
    options,
  })

  const resolvedFileId = config.fileId || config.id

  if (!resolvedFileId) {
    throw new UserInputError(`Missing 'fileId' or 'id' parameter`)
  }

  const { text, startLine, endLine } = config

  const file = await prisma.file.findUnique({
    where: {
      id: resolvedFileId,
    },
  })

  if (!file) {
    throw new UserInputError(`File not found`)
  }

  if (!canUseFile(options.userId, file)) {
    throw new UserInputError(`Cannot use file`)
  }

  let finalText: string
  let beforeText = ''

  // @note determine write mode based on parameters:
  // - no startLine, no endLine: overwrite entire file
  // - startLine only: insert before that line
  // - startLine and endLine: replace lines in range

  const isRangeEdit = !(startLine === undefined && endLine === undefined)

  if (!isRangeEdit) {
    // @note overwrite entire file

    finalText = text
  } else {
    // @note check if file content exists before attempting to read for line-based operations

    if (!(await fileObjectExists(file.id))) {
      throw new UserInputError(
        `File content not found. The file may not have been uploaded yet.`
      )
    }

    // @note need to read existing content for line-based operations

    const url = await getFileObjectDownloadUrl(file.id)
    const chunks = await chunkUrl(new URL(url), {
      size: Number.MAX_SAFE_INTEGER,
      overlap: 0,
    })

    beforeText = chunks.items.map(({ text }) => text).join('\n\n')

    const { finalText: editedText } = applyLineEdit(
      beforeText,
      text,
      startLine,
      endLine
    )

    finalText = editedText
  }

  debug(`using`, { text, startLine, endLine, finalText }).log(
    'action.exec.file.doWriteFile'
  )

  await uploadFileObject(file.id, finalText, { contentType: 'text/plain' })

  // @note build a self-verification summary (changed range, preview, balance
  // warning) plus an out-of-range warning so the agent can confirm the edit
  // landed where intended without a second read

  const summary = summarizeEdit(beforeText, finalText, {
    warnOnBalance: isRangeEdit,
  })

  const rangeWarning = isRangeEdit
    ? describeRangeBounds(beforeText.split('\n').length, startLine, endLine)
    : undefined

  const warning =
    [rangeWarning, summary.warning].filter(Boolean).join(' ') || undefined

  return {
    result: {
      startLine,
      endLine,
      changed: summary.changed,
      affectedStartLine: summary.changedStartLine,
      affectedEndLine: summary.changedEndLine,
      preview: summary.preview,
      warning,
    },
    messages: [],
  }
}

export async function doPrependFile({
  input,
  params,
  options,
}: FileActionParams): Promise<ActionReturn> {
  debug(`do file prepend`, { input, params, options }).log(
    'action.exec.file.doPrependFile'
  )

  await logEvent({
    user: { id: options.userId },
    type: 'action.file.prepend',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  const config = getConfigBySchema({
    input,
    params,
    initial: {
      text: input,
    },
    schema: filePrependSchema,
    options,
  })

  const resolvedFileId = config.fileId || config.id

  if (!resolvedFileId) {
    throw new UserInputError(`Missing 'fileId' or 'id' parameter`)
  }

  const { text } = config

  const file = await prisma.file.findUnique({
    where: {
      id: resolvedFileId,
    },
  })

  if (!file) {
    throw new UserInputError(`File not found`)
  }

  if (!canUseFile(options.userId, file)) {
    throw new UserInputError(`Cannot use file`)
  }

  let currentText = ''

  try {
    const response = await downloadFileObject(file.id)

    if (response.body) {
      const buf = await response.body.arrayBuffer()

      currentText = buf2str(buf)
    }
  } catch (e: unknown) {
    // @note treat missing S3 object as empty file content
    if ((e as { name?: string }).name !== 'NoSuchKey') {
      throw e
    }
  }

  debug(`using`, { text, currentText }).log('action.exec.file.doPrependFile')

  await uploadFileObject(file.id, text + currentText, {
    contentType: 'text/plain',
  })

  return {
    result: {},
    messages: [],
  }
}

export async function doAppendFile({
  input,
  params,
  options,
}: FileActionParams): Promise<ActionReturn> {
  // @todo investigate if possible to use https://docs.aws.amazon.com/AmazonS3/latest/userguide/directory-buckets-objects-append.html instead

  debug(`do file append`, { input, params, options }).log(
    'action.exec.file.doAppendFile'
  )

  await logEvent({
    user: { id: options.userId },
    type: 'action.file.append',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  const config = getConfigBySchema({
    input,
    params,
    initial: {
      text: input,
    },
    schema: fileAppendSchema,
    options,
  })

  const resolvedFileId = config.fileId || config.id

  if (!resolvedFileId) {
    throw new UserInputError(`Missing 'fileId' or 'id' parameter`)
  }

  const { text } = config

  const file = await prisma.file.findUnique({
    where: {
      id: resolvedFileId,
    },
  })

  if (!file) {
    throw new UserInputError(`File not found`)
  }

  if (!canUseFile(options.userId, file)) {
    throw new UserInputError(`Cannot use file`)
  }

  let currentText = ''

  try {
    const response = await downloadFileObject(file.id)

    if (response.body) {
      const buf = await response.body.arrayBuffer()

      currentText = buf2str(buf)
    }
  } catch (e: unknown) {
    // @note treat missing S3 object as empty file content
    if ((e as { name?: string }).name !== 'NoSuchKey') {
      throw e
    }
  }

  debug(`using`, { text, currentText }).log('action.exec.file.doAppendFile')

  await uploadFileObject(file.id, currentText + text, {
    contentType: 'text/plain',
  })

  return {
    result: {},
    messages: [],
  }
}

export async function doReplaceFile({
  input,
  params,
  options,
}: FileActionParams): Promise<ActionReturn> {
  debug(`do file replace`, { input, params, options }).log(
    'action.exec.file.doReplaceFile'
  )

  await logEvent({
    user: { id: options.userId },
    type: 'action.file.replace',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  const config = getConfigBySchema({
    input,
    params,
    initial: {},
    schema: fileReplaceSchema,
    options,
  })

  const resolvedFileId = config.fileId || config.id

  if (!resolvedFileId) {
    throw new UserInputError(`Missing 'fileId' or 'id' parameter`)
  }

  const { search, replace, count } = config

  const file = await prisma.file.findUnique({
    where: {
      id: resolvedFileId,
    },
  })

  if (!file) {
    throw new UserInputError(`File not found`)
  }

  if (!canUseFile(options.userId, file)) {
    throw new UserInputError(`Cannot use file`)
  }

  let currentText = ''

  try {
    const response = await downloadFileObject(file.id)

    if (response.body) {
      const buf = await response.body.arrayBuffer()

      currentText = buf2str(buf)
    }
  } catch (e: unknown) {
    // @note treat missing S3 object as empty file content
    if ((e as { name?: string }).name !== 'NoSuchKey') {
      throw e
    }
  }

  // @note replace occurrences using a plain index scan (no RegExp) to avoid
  // ReDoS from user-controlled search input and to keep matching literal

  let newText: string
  let replacements = 0

  if (typeof count === 'number' && count > 0) {
    let from = 0
    let assembled = ''

    while (replacements < count) {
      const found = currentText.indexOf(search, from)

      if (found === -1) {
        break
      }

      assembled += currentText.slice(from, found) + replace
      from = found + search.length
      replacements++
    }

    newText = assembled + currentText.slice(from)
  } else {
    const segments = currentText.split(search)

    replacements = segments.length - 1
    newText = segments.join(replace)
  }

  // @note nothing matched - surface this explicitly so the agent does not
  // mistake a no-op for a successful edit

  if (replacements === 0) {
    return {
      result: {
        replacements: 0,
        changed: false,
        warning: `search text not found - no replacements were made`,
      },
      messages: [],
    }
  }

  debug(`using`, { search, replace, count, currentText, newText }).log(
    'action.exec.file.doReplaceFile'
  )

  await uploadFileObject(file.id, newText, {
    contentType: 'text/plain',
  })

  // @note build a self-verification summary (changed range, preview, balance
  // warning) so the agent can confirm the replacement landed as intended

  const summary = summarizeEdit(currentText, newText)

  return {
    result: {
      replacements,
      changed: summary.changed,
      affectedStartLine: summary.changedStartLine,
      affectedEndLine: summary.changedEndLine,
      preview: summary.preview,
      warning: summary.warning,
    },
    messages: [],
  }
}

export async function doRwFile({
  input,
  params,
  options,
}: FileActionParams): Promise<ActionReturn> {
  debug(`do file read/write`, { input, params, options }).log(
    'action.exec.file.doRwFile'
  )

  await logEvent({
    user: { id: options.userId },
    type: 'action.file.rw',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  const config = getConfigBySchema({
    input,
    params,
    initial: {},
    schema: fileRwSchema,
    options,
  })

  const resolvedFileId = config.fileId || config.id

  if (!resolvedFileId) {
    throw new UserInputError(`Missing 'fileId' or 'id' parameter`)
  }

  const { mode, text, startLine, endLine } = config

  const file = await prisma.file.findUnique({
    where: {
      id: resolvedFileId,
    },
  })

  if (!file) {
    throw new UserInputError(`File not found`)
  }

  if (!canUseFile(options.userId, file)) {
    throw new UserInputError(`Cannot use file`)
  }

  if (mode === 'read') {
    // @note check if file content exists before attempting to read

    if (!(await fileObjectExists(file.id))) {
      throw new UserInputError(
        `File content not found. The file may not have been uploaded yet.`
      )
    }

    const url = await getFileObjectDownloadUrl(file.id)

    const chunks = await chunkUrl(new URL(url), {
      size: Number.MAX_SAFE_INTEGER,
      overlap: 0,
    })

    const fullText = chunks.items.map(({ text }) => text).join('\n\n')

    // @note extract line range if specified

    const { outputContent, totalLines } = extractLineRange(
      fullText,
      startLine,
      endLine
    )

    debug(`using text`, {
      text: outputContent,
      totalLines,
      startLine,
      endLine,
    }).log('action.exec.file.doRwFile')

    return {
      result: {
        text: outputContent,
        totalLines,
        startLine: startLine ?? 1,
        endLine: endLine ?? totalLines,
      },
      messages: [],
    }
  } else {
    // @note write mode

    if (text === undefined) {
      throw new UserInputError(`Missing 'text' parameter for write mode`)
    }

    let finalText: string
    let beforeText = ''

    // @note determine write mode based on parameters:
    // - no startLine, no endLine: overwrite entire file
    // - startLine only: insert before that line
    // - startLine and endLine: replace lines in range

    const isRangeEdit = !(startLine === undefined && endLine === undefined)

    if (!isRangeEdit) {
      // @note overwrite entire file

      finalText = text
    } else {
      // @note check if file content exists before attempting to read for line-based operations

      if (!(await fileObjectExists(file.id))) {
        throw new UserInputError(
          `File content not found. The file may not have been uploaded yet.`
        )
      }

      // @note need to read existing content for line-based operations

      const url = await getFileObjectDownloadUrl(file.id)
      const chunks = await chunkUrl(new URL(url), {
        size: Number.MAX_SAFE_INTEGER,
        overlap: 0,
      })

      beforeText = chunks.items.map(({ text }) => text).join('\n\n')

      const { finalText: editedText } = applyLineEdit(
        beforeText,
        text,
        startLine,
        endLine
      )

      finalText = editedText
    }

    debug(`using`, { text, startLine, endLine, finalText }).log(
      'action.exec.file.doRwFile'
    )

    await uploadFileObject(file.id, finalText, { contentType: 'text/plain' })

    // @note build a self-verification summary plus an out-of-range warning so
    // the agent can confirm the edit without a second read

    const summary = summarizeEdit(beforeText, finalText, {
      warnOnBalance: isRangeEdit,
    })

    const rangeWarning = isRangeEdit
      ? describeRangeBounds(beforeText.split('\n').length, startLine, endLine)
      : undefined

    const warning =
      [rangeWarning, summary.warning].filter(Boolean).join(' ') || undefined

    return {
      result: {
        startLine,
        endLine,
        changed: summary.changed,
        affectedStartLine: summary.changedStartLine,
        affectedEndLine: summary.changedEndLine,
        preview: summary.preview,
        warning,
      },
      messages: [],
    }
  }
}

/**
 * Executes a file action on a specific file. This action is used to
 * apply a file to a specific input.
 */
export async function executeFileAction(
  input: ActionInput,
  params: ActionParams,
  options: ActionOptions
): Promise<ActionReturn> {
  debug(`execute file action`, { input, params, options }).log(
    'action.exec.file.executeFileAction'
  )

  let operation:
    | typeof FILE_READ_OPERATION_NAME
    | typeof FILE_WRITE_OPERATION_NAME
    | typeof FILE_PREPEND_OPERATION_NAME
    | typeof FILE_APPEND_OPERATION_NAME
    | typeof FILE_REPLACE_OPERATION_NAME
    | typeof FILE_RW_OPERATION_NAME

  {
    switch (true) {
      case 'read' in params: {
        operation = FILE_READ_OPERATION_NAME

        break
      }

      case 'write' in params: {
        operation = FILE_WRITE_OPERATION_NAME

        break
      }

      case 'prepend' in params: {
        operation = FILE_PREPEND_OPERATION_NAME

        break
      }

      case 'append' in params: {
        operation = FILE_APPEND_OPERATION_NAME

        break
      }

      case 'replace' in params: {
        operation = FILE_REPLACE_OPERATION_NAME

        break
      }

      case 'rw' in params: {
        operation = FILE_RW_OPERATION_NAME

        break
      }

      default: {
        throw new UserInputError(`Unknown operation`)
      }
    }
  }

  let response: ActionReturn

  switch (operation) {
    case FILE_READ_OPERATION_NAME: {
      response = await doReadFile({ input, params, options })

      break
    }

    case FILE_WRITE_OPERATION_NAME: {
      response = await doWriteFile({ input, params, options })

      break
    }

    case FILE_PREPEND_OPERATION_NAME: {
      response = await doPrependFile({ input, params, options })

      break
    }

    case FILE_APPEND_OPERATION_NAME: {
      response = await doAppendFile({ input, params, options })

      break
    }

    case FILE_REPLACE_OPERATION_NAME: {
      response = await doReplaceFile({ input, params, options })

      break
    }

    case FILE_RW_OPERATION_NAME: {
      response = await doRwFile({ input, params, options })

      break
    }

    default: {
      assertUnreachable(operation)
    }
  }

  return response
}

/**
 * @doc Skillsets
 * @index 49
 *
 * ## File Action - Reading and Writing Files
 *
 * The file action lets your bot read and modify files stored in your ChatBotKit account. You can link a file to an ability and then read its contents, write new content, append or prepend text, replace specific text, or perform a combined read-write in a single step.
 *
 * File abilities require you to link a file when setting up the ability. The linked file is referenced automatically during execution.
 *
 * ### Operations
 *
 * - **file/read**: Read a file's contents. Use `startLine` and `endLine` to read a specific range of lines (1-indexed). Prefer reading larger chunks (100+ lines) rather than many small reads.
 * - **file/write**: Write content to a file. Without line parameters, the entire file is replaced. With `startLine` only, content is inserted before that line. With both `startLine` and `endLine`, the specified line range is replaced.
 * - **file/prepend**: Insert content at the beginning of a file.
 * - **file/append**: Add content to the end of a file.
 * - **file/replace**: Find and replace text within a file. Use `count` to limit the number of replacements (omit to replace all occurrences).
 * - **file/rw**: Combined read-write in one step. Set `mode` to `read` or `write`. Useful for agentic workflows where a bot reads, modifies, and writes in a single ability invocation.
 *
 * ### Example - Read a File
 *
 * `````markdown
 * ```file/read
 * id: ((fileId! ys|the file ID to read))
 * startLine: $[startLine ys|line to start reading from]
 * endLine: $[endLine ys|line to stop reading at, inclusive]
 * ```
 * `````
 *
 * ### Example - Append to a File
 *
 * `````markdown
 * ```file/append
 * id: ((fileId! ys|the file ID to append to))
 * text: $[content! ys|the text to append]
 * ```
 * `````
 */
