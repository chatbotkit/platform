import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import { imageModels } from '@/config/models'

import { getConfigBySchema } from '@/lib/action.config'
import type {
  ActionInput,
  ActionOptions,
  ActionParams,
  ActionReturn,
} from '@/lib/action.exec.all'
import debug from '@/lib/debug'
import defer from '@/lib/defer'
import { BotInputError, captureException } from '@/lib/error'
import fetch from '@/lib/egress.fetch'
import { createImage, editImage } from '@/lib/image'
import { accountLimitsOk } from '@/lib/limit.core'
import { logEvent } from '@/lib/log'
import { buildImageModel } from '@/lib/model.utils'
import { joinTrimmedNotEmpty } from '@/lib/string'
import { Usage } from '@/lib/usage.model'
import { recordImageUsage } from '@/lib/usage.record'
import { fastGetUserById } from '@/lib/user.get'
import { z } from '@/lib/zod.schema'

// @see data/abilities/catalogue/cbk.image.ts for ability definitions related
// to these schemas

/**
 * Valid image model names derived from the config.
 *
 * @note this tuple type is used to ensure Zod enum validation accepts all
 * configured image models, preventing schema validation errors when users
 * specify legacy models like 'dalle3'.
 */
export const imageModelNames = Object.keys(imageModels) as [string, ...string[]]

/**
 * Valid image sizes for generation and editing.
 */
export const imageSizes = [
  'auto',
  '1024x1024',
  '1536x1024',
  '1024x1536',
  '256x256',
  '512x512',
] as const

/**
 * Valid image regions.
 */
export const imageRegions = ['us'] as const

/**
 * MIME types accepted as input by the image-edit providers (OpenAI's
 * images/edits endpoint only accepts these). Inputs the bot supplies in any
 * other format (e.g. SVG) are rejected up front so we surface a clear, model-
 * actionable error instead of a wasted provider round-trip that 400s.
 */
export const imageEditInputMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

/**
 * Schema for image creation action parameters.
 */
export const imageCreateSchema = z.object({
  directions: z
    .string()
    .optional()
    .nullable()
    .describe('Detailed directions for how to generate the image'),
  prompt: z.string().describe('The prompt to use for image generation'),
  model: z.enum(imageModelNames).describe('The image model to use'),
  size: z.enum(imageSizes).optional().describe('The dimensions of the image'),
  region: z.enum(imageRegions).optional().describe('The region for processing'),
})

/**
 * Inferred type for image create schema.
 */
export type ImageCreateSchema = z.infer<typeof imageCreateSchema>

/**
 * Schema for image edit action parameters.
 */
export const imageEditSchema = z.object({
  directions: z
    .string()
    .optional()
    .nullable()
    .describe('Detailed directions for how to modify the image'),
  prompt: z.string().describe('The prompt to use for image modification'),
  images: z
    .array(z.string().nullable())
    .transform((arr) => arr.filter(Boolean))
    .describe('URLs of the images to edit'),
  mask: z.string().optional().describe('URL of the mask image for inpainting'),
  model: z.enum(imageModelNames).describe('The image model to use'),
  size: z.enum(imageSizes).optional().describe('The dimensions of the image'),
  region: z.enum(imageRegions).optional().describe('The region for processing'),
})

/**
 * Inferred type for image edit schema.
 */
export type ImageEditSchema = z.infer<typeof imageEditSchema>

// @note operation name constants for compile-time validation in action.tags.ts
export const IMAGE_CREATE_OPERATION_NAME = 'create'
export const IMAGE_EDIT_OPERATION_NAME = 'edit'

export async function doImageCreate(
  input: ActionInput,
  params: ActionParams,
  options: ActionOptions
): Promise<ActionReturn> {
  debug(`using`, { input, params, options }).log(
    'action.exec.image.doImageCreate'
  )

  await logEvent({
    user: { id: options.userId },
    type: 'action.image.create',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: params,
  })

  const { directions, prompt, model, size, region } = getConfigBySchema({
    input,
    params,
    initial: {
      prompt: input,
    },
    schema: imageCreateSchema,
    options,
  })

  debug(`using`, { directions, prompt, model, size, region }).log(
    'action.exec.image.doImageCreate'
  )

  const finalPrompt = joinTrimmedNotEmpty(
    [directions, directions ? 'PROMPT:' : '', prompt],
    '\n\n'
  )

  debug(`using`, { finalPrompt }).log('action.exec.image.doImageCreate')

  try {
    const { urls, usage } = await createImage(finalPrompt, {
      model: buildImageModel(model, { size, region }),
      user: options.userId,
    })

    debug(`using urls`, { urls }).log(
      'action.exec.image.doImageCreate.doImageCreate'
    )

    const usageRecorder = new Usage()

    usageRecorder.addImageTokens(usage.inputTokens, usage.model, 'input')
    usageRecorder.addImageTokens(usage.outputTokens, usage.model, 'output')

    await defer(
      usageRecorder.recordBaseTokens({
        user: { id: options.userId },
        meta: {
          reason: 'image/create',
        },
      })
    )

    await defer(
      recordImageUsage({
        user: { id: options.userId },
        count: urls.length,
        model: usage.model,
        meta: {
          reason: 'image/create',
        },
      })
    )

    // @todo attach the images to the conversation

    const alt = prompt.replace(/\[|\]/g, ' ').replace(/\s+/g, ' ').slice(0, 100)

    const result = {
      urls: urls.map((url) => ({
        url,
        alt,
      })),
    }

    debug(`using result`, { result }).log('action.exec.image.doImageCreate')

    return {
      result: result,
    }
  } catch (e) {
    await captureException(e)

    return {
      error: (e as Error).message || String(e),
    }
  }
}

export async function doImageEdit(
  input: ActionInput,
  params: ActionParams,
  options: ActionOptions
): Promise<ActionReturn> {
  debug(`using`, { input, params, options }).log(
    'action.exec.image.doImageEdit'
  )

  await logEvent({
    user: { id: options.userId },
    type: 'action.image.edit',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: params,
  })

  const { directions, prompt, images, mask, model, size, region } =
    getConfigBySchema({
      input,
      params,
      initial: {
        prompt: input,
      },
      schema: imageEditSchema,
      options,
    })

  debug(`using`, { directions, prompt, images, model, size, region }).log(
    'action.exec.image.doImageEdit'
  )

  if (images.length === 0) {
    return {
      error: 'No images provided',
    }
  }

  const finalPrompt = joinTrimmedNotEmpty(
    [directions, directions ? 'PROMPT:' : '', prompt],
    '\n\n'
  )

  debug(`using`, { finalPrompt }).log('action.exec.image.doImageEdit')

  try {
    const imageBlobs = (
      await Promise.all(
        images.map(async (url) => {
          if (!url) {
            return
          }

          const response = await fetch(url)

          if (!response.ok) {
            // @note the bot supplied a URL we could not fetch (commonly a
            // hallucinated or stale link that 404s/403s). This is bad input,
            // not a system fault, so raise it as a BotInputError - the message
            // still reaches the model but it is kept out of Sentry.
            throw new BotInputError(
              `Failed to fetch image from ${url} (${response.status})`
            )
          }

          const blob = await response.blob()

          return blob
        })
      )
    ).filter(Boolean) as Blob[]

    // @note reject unsupported input formats (e.g. SVG) before calling the
    // provider. The provider would 400 on the whole request anyway, so failing
    // fast avoids a wasted round-trip and gives the model a clear, actionable
    // error. Blobs without a known content type are left for the provider to
    // validate so we do not over-reject legitimate images served without one.

    const unsupportedTypes = [
      ...new Set(
        imageBlobs
          .map((blob) => blob.type.toLowerCase().split(';')[0].trim())
          .filter(
            (type) =>
              type &&
              !(imageEditInputMimeTypes as readonly string[]).includes(type)
          )
      ),
    ]

    if (unsupportedTypes.length > 0) {
      return {
        error: `Unsupported image format(s): ${unsupportedTypes.join(
          ', '
        )}. Supported formats are ${imageEditInputMimeTypes.join(', ')}.`,
      }
    }

    const maskBlob = mask
      ? await fetch(mask).then((response) => {
          if (!response.ok) {
            throw new BotInputError(
              `Failed to fetch image from ${mask} (${response.status})`
            )
          }

          return response.blob()
        })
      : undefined

    const { urls, usage } = await editImage(finalPrompt, imageBlobs, {
      model: buildImageModel(model, { size, region }),
      user: options.userId,
      mask: maskBlob,
    })

    debug(`using urls`, { urls }).log('action.exec.image.doImageEdit')

    const usageRecorder = new Usage()

    usageRecorder.addImageTokens(usage.inputTokens, usage.model, 'input')
    usageRecorder.addImageTokens(usage.outputTokens, usage.model, 'output')

    await defer(
      usageRecorder.recordBaseTokens({
        user: { id: options.userId },
        meta: {
          reason: 'image/edit',
        },
      })
    )

    await defer(
      recordImageUsage({
        user: { id: options.userId },
        count: urls.length,
        model: usage.model,
        meta: {
          reason: 'image/edit',
        },
      })
    )

    // @todo attach the images to the conversation

    const alt = prompt.replace(/\[|\]/g, ' ').replace(/\s+/g, ' ').slice(0, 100)

    const result = {
      urls: urls.map((url) => ({
        url,
        alt,
      })),
    }

    debug(`using result`, { result }).log('action.exec.image.doImageEdit')

    return {
      result: result,
    }
  } catch (e) {
    await captureException(e)

    return {
      error: (e as Error).message || String(e),
    }
  }
}

/**
 * Executes an image action. This action is used to generate images based on
 * the input and the parameters.
 */
export async function executeImageAction(
  input: ActionInput,
  params: ActionParams,
  options: ActionOptions
): Promise<ActionReturn> {
  debug(`execute image action`, { input, params, options }).log(
    'action.exec.image.executeImageAction'
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

  let operation:
    | typeof IMAGE_CREATE_OPERATION_NAME
    | typeof IMAGE_EDIT_OPERATION_NAME

  {
    switch (true) {
      case 'create' in params: {
        operation = IMAGE_CREATE_OPERATION_NAME

        break
      }

      case 'generate' in params: {
        operation = IMAGE_CREATE_OPERATION_NAME

        break
      }

      case 'edit' in params: {
        operation = IMAGE_EDIT_OPERATION_NAME

        break
      }

      case 'modify' in params: {
        operation = IMAGE_EDIT_OPERATION_NAME

        break
      }

      default: {
        operation = IMAGE_CREATE_OPERATION_NAME

        break
      }
    }
  }

  let response: ActionReturn

  switch (operation) {
    case IMAGE_CREATE_OPERATION_NAME: {
      response = await doImageCreate(input, params, options)

      break
    }

    case IMAGE_EDIT_OPERATION_NAME: {
      response = await doImageEdit(input, params, options)

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
 * @index 47
 *
 * ## Image Action - Generating Images
 *
 * The image action generates images using AI models based on text prompts. This is useful for creating visual content, illustrations, logos, product mockups, or any other image-based assets.
 *
 * ### Properties
 *
 * - **model**: Any of the supported ChatBotKit image models, such as `stablediffusion`, `dalle2`, or `dalle3`
 * - **size**: Supported sizes include `256x256`, `512x512`, or `1024x1024`
 *
 * ### Example
 *
 * `````markdown
 * ```image
 * model: ((model ys|the image model to use))
 * size: ((size ys|image dimensions))
 * prompt: $[prompt! ys|the image generation prompt]
 * ```
 * `````
 */
