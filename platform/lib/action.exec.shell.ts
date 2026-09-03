import { ONE_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'
import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import limits from '@/config/limits'

import prisma from '@/prisma/client'

import {
  getAbilityFunctionDescription,
  getAbilityFunctionName,
  getAbilityFunctionParameters,
} from '@/lib/ability.function'
import { getConfigBySchema } from '@/lib/action.config'
import type {
  ActionInput,
  ActionOptions,
  ActionParams,
  ActionReturn,
} from '@/lib/action.exec.all'
import call from '@/lib/call'
import {
  getContextContact,
  getContextConversation,
  getContextNamespace,
} from '@/lib/context.store'
import debug from '@/lib/debug'
import {
  applyLineEdit,
  describeRangeBounds,
  extractLineRange,
  summarizeEdit,
} from '@/lib/edit'
import { UserInputError } from '@/lib/error'
import { withLimit, withRetry, withTimeout } from '@/lib/fetch'
import { getExternalAPIHostURL } from '@/lib/host'
import { logEvent } from '@/lib/log'
import { exec, readFile, runCode, writeFile } from '@/lib/sandbox.shell'
import { getTemporaryUserToken } from '@/lib/session.temp'
import { getActiveSkillsetAbilities } from '@/lib/skillset.abilities'
import { canUseSkillset } from '@/lib/skillset.access'
import { toKebabCase } from '@/lib/string'
import { Usage } from '@/lib/usage.model'
import { fastGetUserById } from '@/lib/user.get'
import { revealUserPlan } from '@/lib/user.plan'
import { stringify as stringifyYaml } from '@/lib/yaml'
import { z } from '@/lib/zod.schema'

import { v5 as uuidv5 } from 'uuid'

/**
 * Mounted storage location info for AI model awareness
 */
type MountInfo =
  | { folder: string; spaceId: string }
  | { folder: string; conversationId: string }

/**
 * Builds storage info from mount array for AI model awareness
 */
function buildStorageInfo(mounts: MountInfo[]) {
  if (mounts.length === 0) {
    return undefined
  }

  // @todo maybe use the space/conversation names and descriptions too

  return mounts.map((mount) => ({
    path: mount.folder,
    ...('spaceId' in mount
      ? { spaceId: mount.spaceId }
      : { conversationId: mount.conversationId }),
    description:
      mount.folder === '/space'
        ? 'persistent storage for the attached space'
        : mount.folder === '/conversation'
          ? 'persistent storage for conversation attachments'
          : 'mounted storage',
    driver: 's3fs',
    hint: 'it may be slow so use sparingly and prefer batch operations when possible',
  }))
}

// @note minimum timeout when buckets are involved since s3fs mount can take 30-60s

const MIN_BUCKET_TIMEOUT_MS = 90000

// @note agents can return markdown fenced code blocks, unwrap them before execution

const FENCED_CODE_BLOCK_PATTERN =
  /^\s*(```|~~~)[^\n\r]*\r?\n([\s\S]*?)\r?\n?\1\s*$/

/**
 * Ensures timeout is at least MIN_BUCKET_TIMEOUT_MS when buckets will be mounted
 */
function getEffectiveTimeout(
  timeout: number | undefined,
  hasBuckets: boolean
): number | undefined {
  if (!hasBuckets) {
    return timeout
  }

  // @note if no timeout specified, let sandbox.shell.ts handle the default

  if (timeout === undefined) {
    return undefined
  }

  // @note enforce minimum timeout when buckets are involved

  return Math.max(timeout, MIN_BUCKET_TIMEOUT_MS)
}

/**
 * Unwraps markdown fenced code blocks when the payload is entirely fenced.
 */
function normalizeExecutableCode(value: string): string {
  const match = value.match(FENCED_CODE_BLOCK_PATTERN)

  if (!match) {
    return value
  }

  return match[2]
}

/**
 * Resolves the shell execution session scope from context. This prefers the
 * regular namespace when available, but can fall back to the current
 * conversation ID for a stable sandbox scope in untrusted flows.
 *
 * @throws Error if neither namespace nor conversation ID is available
 */
function getShellExecutionSession(options: ActionOptions): string {
  const parts: string[] = []

  if (options.contextResources?.blueprintId) {
    parts.push(`blueprint[${options.contextResources.blueprintId}]`)
  }

  if (options.contextResources?.skillsetId) {
    parts.push(`skillset[${options.contextResources.skillsetId}]`)
  }

  // @note we are not adding the ability because we want to make sure that
  // different abilities on the same skillset share the same session
  // if (options.contextResources?.abilityId) {
  //   parts.push(`ability[${options.contextResources.abilityId}]`)
  // }

  const scope = uuidv5(
    parts.join(':'),

    // @note changing the namespace is generally safe but should be avoided as
    // it will cause temporary loss of access to existing sandboxes
    'bfd2884d-3cc7-4d40-98fe-a496de43f3a4'
  )

  const namespace = getContextNamespace()

  if (namespace) {
    return `${scope}-${namespace}`
  }

  const conversation = getContextConversation()

  if (conversation?.id) {
    return `${scope}-${conversation.id}`
  }

  throw new Error(`Missing namespace`)
}

// @see data/abilities/catalogue/cbk.shell.ts for ability definitions related
// to these schemas

/**
 * Shell exec schema defines the parameters for executing shell commands.
 */
export const shellExecSchema = z.object({
  cmd: z.string().min(1).describe('The shell command to execute'),
  files: z
    .array(
      z.object({
        path: z.string().min(1).describe('The file path'),
        contents: z.string().min(1).describe('The file contents'),
      })
    )
    .optional()
    .describe('Optional files to write before executing the command'),
  timeout: z.coerce
    .number()
    .int()
    .positive()
    .max(300000)
    .optional()
    .describe('Optional timeout in milliseconds'),
  sessionId: z
    .string()
    .optional()
    .describe('Optional custom session ID for the sandbox'),
  spaceId: z.string().optional().describe('Optional space ID to link with'),
})

export type ShellExecSchema = z.infer<typeof shellExecSchema>

/**
 * Shell script schema defines parameters for executing a script file via
 * runtime from a temporary absolute path.
 */
export const shellScriptSchema = z.object({
  source: z.string().min(1).describe('The script source code'),
  runtime: z
    .enum(['python', 'node'])
    .describe('The runtime to execute the script with'),
  timeout: z.coerce
    .number()
    .int()
    .positive()
    .max(300000)
    .optional()
    .describe('Optional timeout in milliseconds'),
  sessionId: z
    .string()
    .optional()
    .describe('Optional custom session ID for the sandbox'),
  spaceId: z.string().optional().describe('Optional space ID to link with'),
})

export type ShellScriptSchema = z.infer<typeof shellScriptSchema>

/**
 * Shell eval schema defines the parameters for evaluating code.
 */
export const shellEvalSchema = z.object({
  code: z.string().min(1).describe('The code to evaluate'),
  runtime: z
    .enum(['python', 'node'])
    .describe('The runtime to evaluate the code with'),
  timeout: z.coerce
    .number()
    .int()
    .positive()
    .max(300000)
    .optional()
    .describe('Optional timeout in milliseconds'),
  sessionId: z
    .string()
    .optional()
    .describe('Optional custom session ID for the sandbox'),
  spaceId: z.string().optional().describe('Optional space ID to link with'),
})

export type ShellEvalSchema = z.infer<typeof shellEvalSchema>

/**
 * Shell read schema defines the parameters for reading files via shell.
 */
export const shellReadSchema = z.object({
  file: z.string().min(1).describe('The file path to read'),
  startLine: z.coerce
    .number()
    .int()
    .min(1)
    .optional()
    .describe(
      'The line number to start reading from (1-indexed, line 1 is the first line)'
    ),
  endLine: z.coerce
    .number()
    .int()
    .min(1)
    .optional()
    .describe(
      'The line number to end reading at, inclusive (1-indexed). Prefer reading at least 100 lines or more per request to minimize round trips'
    ),
  sessionId: z
    .string()
    .optional()
    .describe('Optional custom session ID for the sandbox'),
  spaceId: z.string().optional().describe('Optional space ID to link with'),
})

export type ShellReadSchema = z.infer<typeof shellReadSchema>

/**
 * Shell write schema defines the parameters for writing files via shell.
 */
export const shellWriteSchema = z.object({
  file: z.string().min(1).describe('The file path to write'),
  contents: z.string().describe('The contents to write to the file'),
  startLine: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .describe('The line number to start writing at (1-indexed)'),
  endLine: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .describe('The line number to end writing at, inclusive (1-indexed)'),
  sessionId: z
    .string()
    .optional()
    .describe('Optional custom session ID for the sandbox'),
  spaceId: z.string().optional().describe('Optional space ID to link with'),
})

export type ShellWriteSchema = z.infer<typeof shellWriteSchema>

/**
 * Shell read/write schema defines the parameters for combined read/write operations via shell.
 */
export const shellRwSchema = z.object({
  file: z.string().min(1).describe('The file path to read from or write to'),
  mode: z.enum(['read', 'write']).describe('The operation mode: read or write'),
  contents: z
    .string()
    .optional()
    .describe('The contents to write to the file (required for write mode)'),
  startLine: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .describe('The line number to start from (1-indexed)'),
  endLine: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .describe('The line number to end at, inclusive (1-indexed)'),
  sessionId: z
    .string()
    .optional()
    .describe('Optional custom session ID for the sandbox'),
  spaceId: z.string().optional().describe('Optional space ID to link with'),
})

export type ShellRwSchema = z.infer<typeof shellRwSchema>

/**
 * Shell replace schema defines the parameters for find-and-replace edits in a
 * file in the shell environment.
 */
export const shellReplaceSchema = z.object({
  file: z.string().min(1).describe('The file path to edit'),
  search: z.string().min(1).describe('The text to search for'),
  replace: z.string().describe('The text to replace matches with'),
  count: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      'The number of occurrences to replace (optional, replaces all if not specified)'
    ),
  sessionId: z
    .string()
    .optional()
    .describe('Optional custom session ID for the sandbox'),
  spaceId: z.string().optional().describe('Optional space ID to link with'),
})

export type ShellReplaceSchema = z.infer<typeof shellReplaceSchema>

/**
 * Shell import schema defines the parameters for importing data from a URL and
 * writing it to a file in the shell environment.
 */
export const shellImportSchema = z.object({
  url: z.string().min(1).describe('The URL to import data from'),
  path: z
    .string()
    .min(1)
    .describe('The file path to save the imported data to'),
  headers: z
    .record(z.string())
    .optional()
    .describe('Optional HTTP headers to send with the request'),
  sessionId: z
    .string()
    .optional()
    .describe('Optional custom session ID for the sandbox'),
  spaceId: z.string().optional().describe('Optional space ID to link with'),
})

export type ShellImportSchema = z.infer<typeof shellImportSchema>

/**
 * Shell skillset install schema defines the parameters for installing a
 * skillset command into the shell environment.
 */
export const shellSkillsetInstallSchema = z.object({
  skillsetId: z
    .string()
    .min(1)
    .describe('The ID of the skillset to install as a shell command'),
  sessionId: z
    .string()
    .optional()
    .describe('Optional custom session ID for the sandbox'),
  spaceId: z.string().optional().describe('Optional space ID to link with'),
})

export type ShellSkillsetInstallSchema = z.infer<
  typeof shellSkillsetInstallSchema
>

// @note operation name constants for compile-time validation in action.tags.ts

export const SHELL_EXEC_OPERATION_NAME = 'exec'
export const SHELL_SCRIPT_OPERATION_NAME = 'script'
export const SHELL_EVAL_OPERATION_NAME = 'eval'
export const SHELL_READ_OPERATION_NAME = 'read'
export const SHELL_WRITE_OPERATION_NAME = 'write'
export const SHELL_RW_OPERATION_NAME = 'rw'
export const SHELL_REPLACE_OPERATION_NAME = 'replace'
export const SHELL_IMPORT_OPERATION_NAME = 'import'
export const SHELL_SKILLSET_INSTALL_OPERATION_NAME = 'skillset/install'

/**
 * Parameters for shell actions.
 */
interface ShellActionParams {
  session: string
  input: string
  params: ActionParams
  options: ActionOptions
  shellLimits: { memoryMb: number; diskMb: number }
}

/**
 * Executes a shell command based on the provided parameters.
 *
 * @param param - The parameters for the shell action.
 * @returns
 */
export async function doShellExec({
  session,
  input,
  params,
  options,
  shellLimits,
}: ShellActionParams): Promise<ActionReturn> {
  debug(`do shell exec`, { input, params, options }).log(
    'action.exec.shell.doShellExec'
  )

  await logEvent({
    user: { id: options.userId },
    type: 'action.shell.exec',
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
    initial: { cmd: input, spaceId: options.linkedResources?.spaceId },
    schema: shellExecSchema,
    options,
  })

  const { cmd, files, timeout, sessionId, spaceId } = config

  debug(`vars`, { cmd, files, timeout, sessionId, spaceId }).log(
    'action.exec.shell.doShellExec'
  )

  const contextConversation = getContextConversation()

  // @note determine if buckets will be mounted

  const hasBuckets = !!(
    spaceId ||
    contextConversation?.spaceId ||
    contextConversation?.id
  )

  // @todo record better usage

  const usagePromise = Usage.createAndRecord({
    user: { id: options.userId },
    token: 1,
    model: 'base',
    meta: {
      ...options.usageMeta,

      reason: 'shell/exec',
    },
    references: {
      ...options.linkedResources,
      ...options.contextResources,
    },
  })

  const response = await exec({
    sandboxId: `session-${session}`,
    sessionId: sessionId,
    spaceId: spaceId ?? contextConversation?.spaceId ?? undefined,
    conversationId: contextConversation?.id,
    cmd: cmd,
    files: files ?? [],
    timeout: getEffectiveTimeout(timeout, hasBuckets),
    ...shellLimits,
  })

  debug(`response`, {
    success: response.success,
    exitCode: response.exitCode,
    stdoutLength: response.stdout.length,
    stderrLength: response.stderr.length,
    errorDetail: response.errorDetail,
    mounts: response.mounts,
  }).log('action.exec.shell.doShellExec')

  await usagePromise

  // @note return structured result for better AI agent debugging

  return {
    result: stringifyYaml({
      success: response.success,

      exitCode: response.exitCode,
      stdout: response.stdout.trim(),
      stderr: response.stderr.trim() || undefined,

      // @note keep errorDetail internal and expose only stable error summaries to model-facing results
      error: response.error || undefined,

      storage: buildStorageInfo(response.mounts),
    }),
    messages: [],
  }
}

/**
 * Executes a script by writing it to /tmp and running it within a sandbox
 * session using the selected runtime.
 */
export async function doShellScript({
  session,
  input,
  params,
  options,
  shellLimits,
}: ShellActionParams): Promise<ActionReturn> {
  debug(`do shell script`, { input, params, options }).log(
    'action.exec.shell.doShellScript'
  )

  await logEvent({
    user: { id: options.userId },
    type: 'action.shell.script',
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
    initial: { source: input, spaceId: options.linkedResources?.spaceId },
    schema: shellScriptSchema,
    options,
  })

  const { source, runtime, timeout, sessionId, spaceId } = config

  const normalizedSource = normalizeExecutableCode(source)

  const commandRuntime = { python: 'python', node: 'node' }[runtime]
  const extension = { python: 'py', node: 'js' }[runtime]
  const scriptPath = `/tmp/cbk-script-${runtime}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`
  const effectiveSessionId = sessionId ?? `script-${runtime}`

  debug(`vars`, {
    source,
    runtime,
    commandRuntime,
    scriptPath,
    timeout,
    sessionId,
    effectiveSessionId,
    spaceId,
  }).log('action.exec.shell.doShellScript')

  const contextConversation = getContextConversation()

  const hasBuckets = !!(
    spaceId ||
    contextConversation?.spaceId ||
    contextConversation?.id
  )

  const usagePromise = Usage.createAndRecord({
    user: { id: options.userId },
    token: 1,
    model: 'base',
    meta: {
      ...options.usageMeta,

      reason: 'shell/script',
    },
    references: {
      ...options.linkedResources,
      ...options.contextResources,
    },
  })

  const response = await exec({
    sandboxId: `session-${session}`,
    sessionId: effectiveSessionId,
    sessionType: 'bash', // use bash to execute the shell command, not the script runtime
    spaceId: spaceId ?? contextConversation?.spaceId ?? undefined,
    conversationId: contextConversation?.id,
    cmd: `${commandRuntime} ${scriptPath}`,
    files: [
      {
        path: scriptPath,
        contents: normalizedSource,
      },
    ],
    timeout: getEffectiveTimeout(timeout, hasBuckets),
    ...shellLimits,
  })

  debug(`response`, {
    success: response.success,
    exitCode: response.exitCode,
    stdoutLength: response.stdout.length,
    stderrLength: response.stderr.length,
    errorDetail: response.errorDetail,
    mounts: response.mounts,
  }).log('action.exec.shell.doShellScript')

  await usagePromise

  return {
    result: stringifyYaml({
      success: response.success,

      exitCode: response.exitCode,
      stdout: response.stdout.trim(),
      stderr: response.stderr.trim() || undefined,

      // @note keep errorDetail internal and expose only stable error summaries to model-facing results
      error: response.error || undefined,

      runtime: runtime,
      scriptPath: scriptPath,

      storage: buildStorageInfo(response.mounts),
    }),
    messages: [],
  }
}

/**
 * Executes a shell eval command based on the provided parameters.
 *
 * @param param - The parameters for the shell eval action.
 * @returns
 */
export async function doShellEval({
  session,
  input,
  params,
  options,
  shellLimits,
}: ShellActionParams): Promise<ActionReturn> {
  debug(`do shell eval`, { input, params, options }).log(
    'action.exec.shell.doShellEval'
  )

  await logEvent({
    user: { id: options.userId },
    type: 'action.shell.eval',
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
    initial: { code: input, spaceId: options.linkedResources?.spaceId },
    schema: shellEvalSchema,
    options,
  })

  const { code, runtime, timeout, sessionId, spaceId } = config

  const normalizedCode = normalizeExecutableCode(code)

  const language = runtime === 'node' ? 'javascript' : 'python'

  debug(`vars`, {
    code,
    runtime,
    language,
    timeout,
    sessionId,
    spaceId,
    normalizedChanged: code !== normalizedCode,
  }).log('action.exec.shell.doShellEval')

  const contextConversation = getContextConversation()

  // @note determine if buckets will be mounted

  const hasBuckets = !!(
    spaceId ||
    contextConversation?.spaceId ||
    contextConversation?.id
  )

  // @todo record better usage

  const usagePromise = Usage.createAndRecord({
    user: { id: options.userId },
    token: 1,
    model: 'base',
    meta: {
      ...options.usageMeta,

      reason: 'shell/eval',
    },
    references: {
      ...options.linkedResources,
      ...options.contextResources,
    },
  })

  const response = await runCode({
    sandboxId: `session-${session}`,
    sessionId: sessionId,
    spaceId: spaceId ?? contextConversation?.spaceId ?? undefined,
    conversationId: contextConversation?.id,
    code: normalizedCode,
    language,
    timeout: getEffectiveTimeout(timeout, hasBuckets),
    ...shellLimits,
  })

  debug(`response`, {
    success: response.success,
    outputLength: response.output.length,
    error: response.error,
    errorDetail: response.errorDetail,
    mounts: response.mounts,
  }).log('action.exec.shell.doShellEval')

  await usagePromise

  // @note return structured result for better AI agent debugging

  return {
    result: stringifyYaml({
      success: response.success,

      output: response.output.trim(),

      // @note keep errorDetail internal and expose only stable error summaries to model-facing results
      error: response.error || undefined,

      storage: buildStorageInfo(response.mounts),
    }),
    messages: [],
  }
}

/**
 * Executes a shell read command based on the provided parameters.
 *
 * @param param - The parameters for the shell read action.
 * @returns
 */
export async function doShellRead({
  session,
  input,
  params,
  options,
  shellLimits,
}: ShellActionParams): Promise<ActionReturn> {
  debug(`do shell read`, { input, params, options }).log(
    'action.exec.shell.doShellRead'
  )

  await logEvent({
    user: { id: options.userId },
    type: 'action.shell.read',
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
    initial: { file: input, spaceId: options.linkedResources?.spaceId },
    schema: shellReadSchema,
    options,
  })

  const { file, startLine, endLine, sessionId, spaceId } = config

  debug(`vars`, { file, startLine, endLine, sessionId, spaceId }).log(
    'action.exec.shell.doShellRead'
  )

  const contextConversation = getContextConversation()

  // @todo record better usage

  const usagePromise = Usage.createAndRecord({
    user: { id: options.userId },
    token: 1,
    model: 'base',
    meta: {
      ...options.usageMeta,

      reason: 'shell/read',
    },
    references: {
      ...options.linkedResources,
      ...options.contextResources,
    },
  })

  const response = await readFile({
    sandboxId: `session-${session}`,
    sessionId: sessionId,
    spaceId: spaceId ?? contextConversation?.spaceId ?? undefined,
    conversationId: contextConversation?.id,
    path: file,
    ...shellLimits,
  })

  debug(`response`, {
    success: response.success,
    contentsLength: response.contents.length,
    error: response.error,
  }).log('action.exec.shell.doShellRead')

  await usagePromise

  // @note extract line range if specified

  const { outputContent, totalLines } = extractLineRange(
    response.contents,
    startLine,
    endLine
  )

  // @note return structured result for better AI agent debugging

  return {
    result: stringifyYaml({
      success: response.success,

      path: file,
      contents: outputContent.trim(),

      totalLines: totalLines,

      startLine: startLine ?? 1,
      endLine: endLine ?? totalLines,

      error: response.error || undefined,
    }),
    messages: [],
  }
}

/**
 * Executes a shell write command based on the provided parameters.
 *
 * @param param - The parameters for the shell write action.
 * @returns
 */
export async function doShellWrite({
  session,
  input,
  params,
  options,
  shellLimits,
}: ShellActionParams): Promise<ActionReturn> {
  debug(`do shell write`, { input, params, options }).log(
    'action.exec.shell.doShellWrite'
  )

  await logEvent({
    user: { id: options.userId },
    type: 'action.shell.write',
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
    initial: { spaceId: options.linkedResources?.spaceId },
    schema: shellWriteSchema,
    options,
  })

  const { file, contents, startLine, endLine, sessionId, spaceId } = config

  debug(`vars`, { file, contents, startLine, endLine, sessionId, spaceId }).log(
    'action.exec.shell.doShellWrite'
  )

  const contextConversation = getContextConversation()

  // @todo record better usage

  const usagePromise = Usage.createAndRecord({
    user: { id: options.userId },
    token: 1,
    model: 'base',
    meta: {
      ...options.usageMeta,

      reason: 'shell/write',
    },
    references: {
      ...options.linkedResources,
      ...options.contextResources,
    },
  })

  let finalContents: string
  let beforeContents = ''

  // @note determine write mode based on parameters:
  // - no startLine, no endLine: overwrite entire file
  // - startLine only: insert before that line
  // - startLine and endLine: replace lines in range

  const isRangeEdit = !(startLine === undefined && endLine === undefined)

  if (!isRangeEdit) {
    // @note overwrite entire file

    finalContents = contents
  } else {
    // @note need to read existing content for line-based operations

    const readResponse = await readFile({
      sandboxId: `session-${session}`,
      sessionId: sessionId,
      spaceId: spaceId ?? contextConversation?.spaceId ?? undefined,
      conversationId: contextConversation?.id,
      path: file,
      ...shellLimits,
    })

    beforeContents = readResponse.success ? readResponse.contents : ''

    const { finalText } = applyLineEdit(
      beforeContents,
      contents,
      startLine,
      endLine
    )

    finalContents = finalText
  }

  const response = await writeFile({
    sandboxId: `session-${session}`,
    sessionId: sessionId,
    spaceId: spaceId ?? contextConversation?.spaceId ?? undefined,
    conversationId: contextConversation?.id,
    path: file,
    contents: finalContents,
    ...shellLimits,
  })

  debug(`response`, {
    success: response.success,
    error: response.error,
  }).log('action.exec.shell.doShellWrite')

  await usagePromise

  // @note build a self-verification summary (changed range, preview, balance
  // warning) so the agent can confirm the edit landed where intended - even
  // when the supplied line range was wrong - without a second read. Only warn
  // about brackets for range edits, where we have the real before-content.

  const summary = response.success
    ? summarizeEdit(beforeContents, finalContents, {
        warnOnBalance: isRangeEdit,
      })
    : undefined

  // @note flag a requested range that fell outside the file (e.g. a startLine
  // past EOF that silently appended instead of replacing)

  const rangeWarning =
    response.success && isRangeEdit
      ? describeRangeBounds(
          beforeContents.split('\n').length,
          startLine,
          endLine
        )
      : undefined

  const warning =
    [rangeWarning, summary?.warning].filter(Boolean).join(' ') || undefined

  // @note return structured result for better AI agent debugging

  return {
    result: stringifyYaml({
      success: response.success,

      path: file,

      bytesWritten: finalContents.length,

      startLine: startLine,
      endLine: endLine,

      changed: summary?.changed,
      affectedStartLine: summary?.changedStartLine,
      affectedEndLine: summary?.changedEndLine,
      preview: summary?.preview,
      warning,

      error: response.error || undefined,
    }),
    messages: [],
  }
}

/**
 * Executes a shell read/write command based on the provided parameters.
 * Combines read and write operations into a single function with a mode parameter.
 *
 * @param param - The parameters for the shell rw action.
 * @returns
 */
export async function doShellRw({
  session,
  input,
  params,
  options,
  shellLimits,
}: ShellActionParams): Promise<ActionReturn> {
  debug(`do shell read/write`, { input, params, options }).log(
    'action.exec.shell.doShellRw'
  )

  await logEvent({
    user: { id: options.userId },
    type: 'action.shell.rw',
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
    initial: { spaceId: options.linkedResources?.spaceId },
    schema: shellRwSchema,
    options,
  })

  const { file, mode, contents, startLine, endLine, sessionId, spaceId } =
    config

  debug(`vars`, {
    file,
    mode,
    contents,
    startLine,
    endLine,
    sessionId,
    spaceId,
  }).log('action.exec.shell.doShellRw')

  const contextConversation = getContextConversation()

  // @todo record better usage

  const usagePromise = Usage.createAndRecord({
    user: { id: options.userId },
    token: 1,
    model: 'base',
    meta: {
      ...options.usageMeta,

      reason: 'shell/rw',
    },
    references: {
      ...options.linkedResources,
      ...options.contextResources,
    },
  })

  if (mode === 'read') {
    const response = await readFile({
      sandboxId: `session-${session}`,
      sessionId: sessionId,
      spaceId: spaceId ?? contextConversation?.spaceId ?? undefined,
      conversationId: contextConversation?.id,
      path: file,
      ...shellLimits,
    })

    debug(`response`, {
      success: response.success,
      contentsLength: response.contents.length,
      error: response.error,
    }).log('action.exec.shell.doShellRw')

    await usagePromise

    // @note extract line range if specified

    const { outputContent, totalLines } = extractLineRange(
      response.contents,
      startLine,
      endLine
    )

    // @note return structured result for better AI agent debugging

    return {
      result: stringifyYaml({
        success: response.success,
        path: file,
        contents: outputContent.trim(),
        totalLines: totalLines,
        startLine: startLine ?? 1,
        endLine: endLine ?? totalLines,
        error: response.error || undefined,
      }),
      messages: [],
    }
  } else {
    // @note write mode

    if (contents === undefined) {
      throw new UserInputError(`Missing 'contents' parameter for write mode`)
    }

    let finalContents: string
    let beforeContents = ''

    // @note determine write mode based on parameters:
    // - no startLine, no endLine: overwrite entire file
    // - startLine only: insert before that line
    // - startLine and endLine: replace lines in range

    const isRangeEdit = !(startLine === undefined && endLine === undefined)

    if (!isRangeEdit) {
      // @note overwrite entire file

      finalContents = contents
    } else {
      // @note need to read existing content for line-based operations

      const readResponse = await readFile({
        sandboxId: `session-${session}`,
        sessionId: sessionId,
        spaceId: spaceId ?? contextConversation?.spaceId ?? undefined,
        conversationId: contextConversation?.id,
        path: file,
        ...shellLimits,
      })

      beforeContents = readResponse.success ? readResponse.contents : ''

      const { finalText } = applyLineEdit(
        beforeContents,
        contents,
        startLine,
        endLine
      )

      finalContents = finalText
    }

    const response = await writeFile({
      sandboxId: `session-${session}`,
      sessionId: sessionId,
      spaceId: spaceId ?? contextConversation?.spaceId ?? undefined,
      conversationId: contextConversation?.id,
      path: file,
      contents: finalContents,
      ...shellLimits,
    })

    debug(`response`, {
      success: response.success,
      error: response.error,
    }).log('action.exec.shell.doShellRw')

    await usagePromise

    // @note build a self-verification summary (changed range, preview, balance
    // warning) so the agent can confirm the edit without a second read

    const summary = response.success
      ? summarizeEdit(beforeContents, finalContents, {
          warnOnBalance: isRangeEdit,
        })
      : undefined

    // @note flag a requested range that fell outside the file

    const rangeWarning =
      response.success && isRangeEdit
        ? describeRangeBounds(
            beforeContents.split('\n').length,
            startLine,
            endLine
          )
        : undefined

    const warning =
      [rangeWarning, summary?.warning].filter(Boolean).join(' ') || undefined

    // @note return structured result for better AI agent debugging

    return {
      result: stringifyYaml({
        success: response.success,

        path: file,

        bytesWritten: finalContents.length,

        startLine: startLine,
        endLine: endLine,

        changed: summary?.changed,
        affectedStartLine: summary?.changedStartLine,
        affectedEndLine: summary?.changedEndLine,
        preview: summary?.preview,
        warning,

        error: response.error || undefined,
      }),
      messages: [],
    }
  }
}

/**
 * Executes a shell find-and-replace edit. Reads the file, replaces matches of a
 * search string with a replacement (all occurrences, or the first `count`), and
 * writes it back. This is a string-anchored alternative to line-range writes,
 * which avoids the off-by-one structural breakage of blind line edits.
 *
 * @param param - The parameters for the shell replace action.
 * @returns
 */
export async function doShellReplace({
  session,
  input,
  params,
  options,
  shellLimits,
}: ShellActionParams): Promise<ActionReturn> {
  debug(`do shell replace`, { input, params, options }).log(
    'action.exec.shell.doShellReplace'
  )

  await logEvent({
    user: { id: options.userId },
    type: 'action.shell.replace',
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
    initial: { spaceId: options.linkedResources?.spaceId },
    schema: shellReplaceSchema,
    options,
  })

  const { file, search, replace, count, sessionId, spaceId } = config

  debug(`vars`, { file, search, replace, count, sessionId, spaceId }).log(
    'action.exec.shell.doShellReplace'
  )

  const contextConversation = getContextConversation()

  // @todo record better usage

  const usagePromise = Usage.createAndRecord({
    user: { id: options.userId },
    token: 1,
    model: 'base',
    meta: {
      ...options.usageMeta,

      reason: 'shell/replace',
    },
    references: {
      ...options.linkedResources,
      ...options.contextResources,
    },
  })

  // @note read the current content so we can replace and report the diff

  const readResponse = await readFile({
    sandboxId: `session-${session}`,
    sessionId: sessionId,
    spaceId: spaceId ?? contextConversation?.spaceId ?? undefined,
    conversationId: contextConversation?.id,
    path: file,
    ...shellLimits,
  })

  if (!readResponse.success) {
    await usagePromise

    return {
      result: stringifyYaml({
        success: false,
        path: file,
        error: readResponse.error || 'Failed to read file',
      }),
      messages: [],
    }
  }

  const beforeContents = readResponse.contents

  // @note replace occurrences using a plain index scan (no RegExp) to avoid
  // ReDoS from user-controlled search input and to keep matching literal

  let newContents: string
  let replacements = 0

  if (typeof count === 'number' && count > 0) {
    let from = 0
    let assembled = ''

    while (replacements < count) {
      const found = beforeContents.indexOf(search, from)

      if (found === -1) {
        break
      }

      assembled += beforeContents.slice(from, found) + replace
      from = found + search.length
      replacements++
    }

    newContents = assembled + beforeContents.slice(from)
  } else {
    const segments = beforeContents.split(search)

    replacements = segments.length - 1
    newContents = segments.join(replace)
  }

  // @note nothing matched - surface this explicitly so the agent does not
  // mistake a no-op for a successful edit

  if (replacements === 0) {
    await usagePromise

    return {
      result: stringifyYaml({
        success: true,
        path: file,
        replacements: 0,
        changed: false,
        warning: `search text not found in ${file} - no replacements were made`,
      }),
      messages: [],
    }
  }

  const response = await writeFile({
    sandboxId: `session-${session}`,
    sessionId: sessionId,
    spaceId: spaceId ?? contextConversation?.spaceId ?? undefined,
    conversationId: contextConversation?.id,
    path: file,
    contents: newContents,
    ...shellLimits,
  })

  debug(`response`, {
    success: response.success,
    replacements,
    error: response.error,
  }).log('action.exec.shell.doShellReplace')

  await usagePromise

  // @note build a self-verification summary (changed range, preview, balance
  // warning) so the agent can confirm the replacement landed as intended

  const summary = response.success
    ? summarizeEdit(beforeContents, newContents)
    : undefined

  return {
    result: stringifyYaml({
      success: response.success,

      path: file,

      replacements,
      bytesWritten: newContents.length,

      changed: summary?.changed,
      affectedStartLine: summary?.changedStartLine,
      affectedEndLine: summary?.changedEndLine,
      preview: summary?.preview,
      warning: summary?.warning,

      error: response.error || undefined,
    }),
    messages: [],
  }
}

// @note import timeout and size limit settings
const SHELL_IMPORT_TIMEOUT = 30000 // 30 second timeout
const SHELL_IMPORT_MAX_SIZE = 50 * 1024 * 1024 // 50 MB max file size

// @note import function with timeout and size limit

const fetchImport = withRetry(
  withTimeout(withLimit(call, { maxSize: SHELL_IMPORT_MAX_SIZE }), {
    timeout: SHELL_IMPORT_TIMEOUT,
  })
)

/**
 * Executes a shell import command to download data from a URL and save it to a
 * file in the shell environment.
 *
 * @param param - The parameters for the shell import action.
 * @returns
 */
export async function doShellImport({
  session,
  input,
  params,
  options,
}: ShellActionParams): Promise<ActionReturn> {
  debug(`do shell import`, { input, params, options }).log(
    'action.exec.shell.doShellImport'
  )

  await logEvent({
    user: { id: options.userId },
    type: 'action.shell.import',
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
    initial: { spaceId: options.linkedResources?.spaceId },
    schema: shellImportSchema,
    options,
  })

  const { url, path, headers, sessionId, spaceId } = config

  debug(`vars`, { url, path, headers, sessionId, spaceId }).log(
    'action.exec.shell.doShellImport'
  )

  // @note validate URL
  let parsedUrl: URL

  try {
    parsedUrl = new URL(url)
  } catch {
    throw new UserInputError(`Invalid URL: ${url}`)
  }

  // @note only allow http and https protocols
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new UserInputError(`Unsupported protocol: ${parsedUrl.protocol}`)
  }

  const contextConversation = getContextConversation()

  // @note import uses 1 token (same as exec/eval) because it involves network I/O
  // which is more resource-intensive than simple read/write operations (0.1 tokens)

  const usagePromise = Usage.createAndRecord({
    user: { id: options.userId },
    token: 1,
    model: 'base',
    meta: {
      ...options.usageMeta,

      reason: 'shell/import',
    },
    references: {
      ...options.linkedResources,
      ...options.contextResources,
    },
  })

  try {
    // @note fetch the data from the URL
    const fetchResponse = await fetchImport(url, {
      method: 'GET',
      headers: headers ?? {},
    })

    if (!fetchResponse.ok) {
      await usagePromise

      return {
        result: stringifyYaml({
          success: false,
          url,
          path,
          error: `HTTP error: ${fetchResponse.status} ${fetchResponse.statusText}`,
        }),
        messages: [],
      }
    }

    // @note get the response as array buffer and convert to string for text files
    // or base64 for binary files
    const arrayBuffer = await fetchResponse.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const contentType = fetchResponse.headers.get('content-type') ?? ''

    // @note determine if content is text-based
    const isTextContent =
      contentType.includes('text/') ||
      contentType.includes('application/json') ||
      contentType.includes('application/xml') ||
      contentType.includes('application/javascript') ||
      contentType.includes('+xml') ||
      contentType.includes('+json')

    let contents: string

    if (isTextContent) {
      contents = buffer.toString('utf-8')
    } else {
      // @note for binary files, use latin1 encoding which preserves byte values
      // this ensures binary data is not corrupted during string conversion
      contents = buffer.toString('latin1')
    }

    // @note write the imported content to the file in the sandbox
    const response = await writeFile({
      sandboxId: `session-${session}`,
      sessionId: sessionId,
      spaceId: spaceId ?? contextConversation?.spaceId ?? undefined,
      conversationId: contextConversation?.id,
      path: path,
      contents: contents,
    })

    debug(`response`, {
      success: response.success,
      error: response.error,
      bytesWritten: contents.length,
    }).log('action.exec.shell.doShellImport')

    await usagePromise

    // @note return structured result for better AI agent debugging

    return {
      result: stringifyYaml({
        success: response.success,
        url,
        path,
        bytesWritten: contents.length,
        contentType: contentType || undefined,
        error: response.error || undefined,
      }),
      messages: [],
    }
  } catch (error) {
    await usagePromise

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred'

    return {
      result: stringifyYaml({
        success: false,

        url,
        path,

        error: errorMessage,
      }),
      messages: [],
    }
  }
}

/**
 * Installs a skillset as a shell command in the sandbox environment. Creates a
 * shell script that exports a temporary CBK API key and calls the cbk skillset
 * ability exec command.
 *
 * @param param - The parameters for the shell skillset install action.
 * @returns
 */
export async function doShellSkillsetInstall({
  session,
  input,
  params,
  options,
}: ShellActionParams): Promise<ActionReturn> {
  debug(`do shell skillset install`, { input, params, options }).log(
    'action.exec.shell.doShellSkillsetInstall'
  )

  await logEvent({
    user: { id: options.userId },
    type: 'action.shell.skillset-install',
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
    initial: { skillsetId: input, spaceId: options.linkedResources?.spaceId },
    schema: shellSkillsetInstallSchema,
    options,
  })

  const { skillsetId, sessionId, spaceId } = config

  debug(`vars`, { skillsetId, sessionId, spaceId }).log(
    'action.exec.shell.doShellSkillsetInstall'
  )

  const user = await fastGetUserById(options.userId)

  if (!user) {
    throw new Error(`User not found`)
  }

  // @note fetch the skillset with its abilities to generate the command

  const skillset = await prisma.skillset.findUniqueByIdentifier(
    user,
    skillsetId,
    {
      select: {
        id: true,

        userId: true,

        name: true,
        description: true,

        visibility: true,

        state: true,

        abilities: {
          select: {
            id: true,

            name: true,
            description: true,

            instruction: true,

            state: true,

            meta: true,
          },
        },
      },
    }
  )

  if (!skillset) {
    return {
      result: stringifyYaml({
        success: false,
        error: `Skillset not found: ${skillsetId}`,
      }),
      messages: [],
    }
  }

  // @note validate that the user has access to this skillset

  if ((await canUseSkillset(options.userId, skillset)) === false) {
    return {
      result: stringifyYaml({
        success: false,
        error: `Cannot use skillset: ${skillsetId}`,
      }),
      messages: [],
    }
  }

  // @note convert skillset name to a valid command name

  let commandName = toKebabCase(skillset.name)

  if (!commandName) {
    return {
      result: stringifyYaml({
        success: false,
        error: `Cannot derive command name from skillset name: ${skillset.name}`,
      }),
      messages: [],
    }
  }

  commandName = `cbk-skillset-${commandName}`

  const contextConversation = getContextConversation()

  // @note generate a temporary API key with 15-minute expiration

  const temporaryToken = await getTemporaryUserToken(options.userId, {
    durationInSeconds: ONE_HOUR_IN_SECONDS,

    allowedRoutes: [
      `/api/v1/skillset/${skillset.id}/ability/*/execute`,
      `/v1/skillset/${skillset.id}/ability/*/execute`,
    ],

    // @note at the moment the only use for this information is inside the
    // schemas for contactId and namespace

    contactId: getContextContact()?.id || undefined,
    namespace: getContextNamespace() || undefined,
  })

  // @note build config object with skillset and ability information

  const scriptConfig = {
    baseUrl: getExternalAPIHostURL(),

    secret: temporaryToken,

    skillsetId: skillset.id,

    skillsetName: skillset.name,
    skillsetDescription: skillset.description,

    abilities: getActiveSkillsetAbilities(skillset).map((ability) => ({
      id: ability.id,
      name: getAbilityFunctionName(ability),
      description: getAbilityFunctionDescription(ability),
      parameters: getAbilityFunctionParameters(ability),
    })),
  }

  // @note build the JavaScript file with config and runtime

  const scriptContent = `#!/usr/bin/env -S cbk run
const config = ${JSON.stringify(scriptConfig, null, 2)}

import { Command } from '@chatbotkit/cli'
import { print, printError } from '@chatbotkit/cli/output'
import { ChatBotKit } from '@chatbotkit/sdk'

const client = new ChatBotKit({
  baseUrl: config.baseUrl,
  secret: config.secret,
})

const program = new Command()
  .name('${commandName}')
  .description(config.skillsetDescription)

program.option('--help-all', 'display full help for all commands')

program.on('option:help-all', () => {
  console.log(program.helpInformation())

  for (const cmd of program.commands) {
    console.log('\\n=== ' + cmd.name() + ' ===\\n')
    console.log(cmd.helpInformation())
  }

  process.exit(0)
})

// @todo add output options

for (const ability of config.abilities) {
  const cmd = program.command(ability.name).description(ability.description)

  const inputSchema = ability.parameters?.properties?.input

  if (inputSchema?.type === 'object' && inputSchema.properties) {
    for (const [name, prop] of Object.entries(inputSchema.properties)) {
      const isRequired = inputSchema.required?.includes(name)
      const flag = prop.type === 'boolean' ? \`--\${name}\` : \`--\${name} <value>\`
      const desc = prop.description || name

      if (isRequired) {
        cmd.requiredOption(flag, desc)
      } else {
        cmd.option(flag, desc, prop.default)
      }
    }
  }

  cmd.action(async (options) => {
    try {
      const result = await client.skillset.ability.execute(
        config.skillsetId,
        ability.id,
        { input: JSON.stringify(options) }
      )

      print(result)
    } catch (error) {
      printError(error)

      process.exit(1)
    }
  })
}

program.parse()
`

  const scriptPath = `~/.local/bin/${commandName}`

  // @note record usage

  const usagePromise = Usage.createAndRecord({
    user: { id: options.userId },
    token: 1,
    model: 'base',
    meta: {
      ...options.usageMeta,

      reason: 'shell/skillset/install',
    },
    references: {
      ...options.linkedResources,
      ...options.contextResources,
    },
  })

  // @note write the script to the sandbox with executable mode

  const writeResponse = await writeFile({
    sandboxId: `session-${session}`,
    sessionId: sessionId,
    spaceId: spaceId ?? contextConversation?.spaceId ?? undefined,
    conversationId: contextConversation?.id,
    path: scriptPath,
    contents: scriptContent,
    mode: '755',
  })

  if (!writeResponse.success) {
    await usagePromise

    return {
      result: {
        success: writeResponse.success,
        path: scriptPath,
        error: writeResponse.error || 'Failed to write script',
      },
      messages: [],
    }
  }

  // @note get help output to confirm installation

  const installResponse = await exec({
    sandboxId: `session-${session}`,
    sessionId: sessionId,
    spaceId: spaceId ?? contextConversation?.spaceId ?? undefined,
    conversationId: contextConversation?.id,
    cmd: `${scriptPath} --help-all`,
    files: [],
  })

  debug(`install response`, {
    success: installResponse.success,
    exitCode: installResponse.exitCode,
  }).log('action.exec.shell.doShellSkillsetInstall')

  await usagePromise

  // @note return structured result with ability names and full help for LLM awareness

  return {
    result: {
      success: installResponse.success,

      path: scriptPath,

      stdout: installResponse.stdout,
      stderr: installResponse.stderr,
    },
    messages: [],
  }
}

/**
 * Executes a bot action on a specific bot. This action is used to
 * apply a bot to a specific input.
 */
export async function executeShellAction(
  input: ActionInput,
  params: ActionParams,
  options: ActionOptions
): Promise<ActionReturn> {
  debug(`execute shell action`, { input, params, options }).log(
    'action.exec.shell.executeShellAction'
  )

  const session = getShellExecutionSession(options)

  const user = await fastGetUserById(options.userId)

  if (!user) {
    throw new Error(`User not found`)
  }

  const { plan } = await revealUserPlan(user)

  const { memory, disk } = limits[plan].shell

  const shellLimits = { memoryMb: memory, diskMb: disk }

  let operation:
    | typeof SHELL_EXEC_OPERATION_NAME
    | typeof SHELL_SCRIPT_OPERATION_NAME
    | typeof SHELL_EVAL_OPERATION_NAME
    | typeof SHELL_READ_OPERATION_NAME
    | typeof SHELL_WRITE_OPERATION_NAME
    | typeof SHELL_RW_OPERATION_NAME
    | typeof SHELL_REPLACE_OPERATION_NAME
    | typeof SHELL_IMPORT_OPERATION_NAME
    | typeof SHELL_SKILLSET_INSTALL_OPERATION_NAME

  {
    switch (true) {
      case 'script' in params: {
        operation = SHELL_SCRIPT_OPERATION_NAME

        break
      }

      case 'exec' in params: {
        operation = SHELL_EXEC_OPERATION_NAME

        break
      }

      case 'eval' in params: {
        operation = SHELL_EVAL_OPERATION_NAME

        break
      }

      case 'read' in params: {
        operation = SHELL_READ_OPERATION_NAME

        break
      }

      case 'write' in params: {
        operation = SHELL_WRITE_OPERATION_NAME

        break
      }

      case 'rw' in params: {
        operation = SHELL_RW_OPERATION_NAME

        break
      }

      case 'replace' in params: {
        operation = SHELL_REPLACE_OPERATION_NAME

        break
      }

      case 'import' in params: {
        operation = SHELL_IMPORT_OPERATION_NAME

        break
      }

      case 'skillset' in params && 'install' in params: {
        operation = SHELL_SKILLSET_INSTALL_OPERATION_NAME

        break
      }

      default: {
        throw new UserInputError(`Unknown operation`)
      }
    }
  }

  let response: ActionReturn

  switch (operation) {
    case SHELL_SCRIPT_OPERATION_NAME: {
      response = await doShellScript({
        session,
        input,
        params,
        options,
        shellLimits,
      })

      break
    }

    case SHELL_EXEC_OPERATION_NAME: {
      response = await doShellExec({
        session,
        input,
        params,
        options,
        shellLimits,
      })

      break
    }

    case SHELL_EVAL_OPERATION_NAME: {
      response = await doShellEval({
        session,
        input,
        params,
        options,
        shellLimits,
      })

      break
    }

    case SHELL_READ_OPERATION_NAME: {
      response = await doShellRead({
        session,
        input,
        params,
        options,
        shellLimits,
      })

      break
    }

    case SHELL_WRITE_OPERATION_NAME: {
      response = await doShellWrite({
        session,
        input,
        params,
        options,
        shellLimits,
      })

      break
    }

    case SHELL_RW_OPERATION_NAME: {
      response = await doShellRw({
        session,
        input,
        params,
        options,
        shellLimits,
      })

      break
    }

    case SHELL_REPLACE_OPERATION_NAME: {
      response = await doShellReplace({
        session,
        input,
        params,
        options,
        shellLimits,
      })

      break
    }

    case SHELL_IMPORT_OPERATION_NAME: {
      response = await doShellImport({
        session,
        input,
        params,
        options,
        shellLimits,
      })

      break
    }

    case SHELL_SKILLSET_INSTALL_OPERATION_NAME: {
      response = await doShellSkillsetInstall({
        session,
        input,
        params,
        options,
        shellLimits,
      })

      break
    }

    // @todo add append

    default: {
      assertUnreachable(operation)
    }
  }

  return response
}
