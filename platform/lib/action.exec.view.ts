import { defaultLanguageModel } from '@/config/models'
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
import { createAnnotationResponse } from '@/lib/model.provider.openai'
import { Usage } from '@/lib/usage.model'
import { fastGetUserById } from '@/lib/user.get'
import { z } from '@/lib/zod.schema'

// @todo translate data/abilities/catalogue/cbk.view.yaml to ts

/**
 * Schema for view action parameters
 */
export const executeViewSchema = z.object({
  url: z.string().describe('The URL to view'),
  instructions: z
    .string()
    .nullable()
    .optional()
    .describe('Instructions to guide the viewing process'),
  instruction: z
    .string()
    .nullable()
    .optional()
    .describe('Instructions to guide the viewing process'),
  directions: z
    .string()
    .nullable()
    .optional()
    .describe('Directions to guide the viewing process'),
  direction: z
    .string()
    .nullable()
    .optional()
    .describe('Directions to guide the viewing process'),
})

/**
 * Executes a view action. This action is used to view a specific URL using a
 * vision model.
 */
export async function executeViewAction(
  input: ActionInput,
  params: ActionParams,
  options: ActionOptions
): Promise<ActionReturn> {
  debug(`executeViewAction`, { input, params, options }).log(
    'action.exec.view.executeViewAction'
  )

  const user = await fastGetUserById(options.userId)

  if (!user) {
    throw new Error(`User not found`)
  }

  if (!(await accountLimitsOk(user, ['token']))) {
    const error = 'You have reached your token limit.'

    return {
      error: error,
    }
  }

  debug(`using`, { input, params, options }).log(
    'action.exec.view.executeViewAction'
  )

  await logEvent({
    user: { id: options.userId },
    type: 'action.view',
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
      schema: executeViewSchema,
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

        const { text, usage } = await createAnnotationResponse({
          image: await response.blob(),

          instructions: finalInstructions || undefined,

          model: defaultLanguageModel,

          user: options.userId,
        })

        // @todo add better usage recording

        await defer(
          Usage.createAndRecord({
            user: { id: options.userId },
            token: usage.totalTokens,
            model: defaultLanguageModel,
            meta: {
              ...options.usageMeta,

              reason: 'action/view',
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

  debug(`result`, { result }).log('action.exec.view.executeViewAction')

  return {
    result: result,
  }
}

/**
 * @doc Skillsets
 * @index 44
 *
 * ## View Action - Image Analysis
 *
 * The view action uses a vision model to describe and analyze images from external URLs. The input for the action must contain a URL string and optionally some description or instructions for what to look for in the image.
 *
 * This action is useful for:
 * - Describing images for accessibility
 * - Extracting text from images (OCR)
 * - Identifying objects, people, or scenes
 * - Answering questions about image content
 * - Verifying image content matches requirements
 *
 * The view action will analyze the image at the provided URL and return a detailed description based on the vision model's capabilities.
 *
 * ### Example
 *
 * `````markdown
 * ```view
 * url: $[url! ys|the URL of the image to analyze]
 * instructions: $[instructions ys|what to look for in the image]
 * ```
 * `````
 */
