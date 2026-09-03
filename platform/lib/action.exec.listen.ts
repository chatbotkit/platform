import { getConfigBySchema } from '@/lib/action.config'
import type {
  ActionInput,
  ActionOptions,
  ActionParams,
  ActionReturn,
} from '@/lib/action.exec.all'
import debug from '@/lib/debug'
import defer from '@/lib/defer'
import fetch from '@/lib/egress.fetch'
import { accountLimitsOk } from '@/lib/limit.core'
import { logEvent } from '@/lib/log'
import { createTranscriptionResponse } from '@/lib/model.provider.openai'
import { recordAudioTokenUsage, recordAudioUsage } from '@/lib/usage.record'
import { fastGetUserById } from '@/lib/user.get'
import { z } from '@/lib/zod.schema'

// @todo translate data/abilities/catalogue/cbk.listen.yaml to ts

/**
 * Schema for listen action parameters
 */
export const executeListenSchema = z.object({
  url: z.string().describe('The URL to listen to'),
  instructions: z
    .string()
    .nullable()
    .optional()
    .describe('Instructions to guide the listening process'),
  instruction: z
    .string()
    .nullable()
    .optional()
    .describe('Instructions to guide the listening process'),
  directions: z
    .string()
    .nullable()
    .optional()
    .describe('Directions to guide the listening process'),
  direction: z
    .string()
    .nullable()
    .optional()
    .describe('Directions to guide the listening process'),
})

/**
 * Executes a listen action. This action is used to listen a specific URL using a
 * vision model.
 */
export async function executeListenAction(
  input: ActionInput,
  params: ActionParams,
  options: ActionOptions
): Promise<ActionReturn> {
  debug(`executeListenAction`, { input, params, options }).log(
    'action.exec.listen.executeListenAction'
  )

  const user = await fastGetUserById(options.userId)

  if (!user) {
    throw new Error(`User not found`)
  }

  if (!(await accountLimitsOk(user, ['token', 'audio']))) {
    const error = 'You have reached your token limit.'

    return {
      error: error,
    }
  }

  debug(`using`, { input, params, options }).log(
    'action.exec.listen.executeListenAction'
  )

  await logEvent({
    user: { id: options.userId },
    type: 'action.listen',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: params,
  })

  const { url, instructions, instruction, directions, direction } =
    getConfigBySchema({
      input,
      params,
      initial: {
        url: input,
      },
      schema: executeListenSchema,
      options,
    })

  const finalInstructions =
    instructions || instruction || directions || direction

  const result: string[] = []

  for (let part of url.split(/(https?:\/\/\S+)/)) {
    part = part.trim()

    if (!part) {
      continue
    }

    if (/^https?:\/\//.test(part)) {
      try {
        const url = new URL(part.replace(/[|\s].+/g, '').trim()) // @note strip invalid characters from the URL

        const response = await fetch(url.href)

        if (!response.ok) {
          continue
        }

        const { text, usage } = await createTranscriptionResponse({
          audio: await response.blob(),

          instructions: finalInstructions || undefined,

          model: 'gpt-4o-transcribe',

          user: options.userId,
        })

        await defer(
          recordAudioTokenUsage({
            user: { id: options.userId },
            count: usage.totalTokens,
            model: 'gpt-4o-transcribe',
            meta: {
              ...options.usageMeta,

              reason: 'action/listen',
            },
            references: {
              ...options.linkedResources,
              ...options.contextResources,
            },
          })
        )

        await defer(
          recordAudioUsage({
            user: { id: options.userId },
            count: 1,
            model: 'gpt-4o-transcribe',
            meta: {
              ...options.usageMeta,

              reason: 'action/listen',
            },
            references: {
              ...options.linkedResources,
              ...options.contextResources,
            },
          })
        )

        result.push(text)
      } catch {
        // pass
      }
    } else {
      result.push(part)
    }
  }

  debug(`result`, { result }).log('action.exec.listen.executeListenAction')

  return {
    result: result,
  }
}
