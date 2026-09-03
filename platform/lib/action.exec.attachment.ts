import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import { getConfigBySchema } from '@/lib/action.config'
import type {
  ActionInput,
  ActionOptions,
  ActionParams,
  ActionReturn,
} from '@/lib/action.exec.all'
import { executeListenAction } from '@/lib/action.exec.listen'
import { executeViewAction } from '@/lib/action.exec.view'
import {
  getContextConversation,
  getContextNamespace,
} from '@/lib/context.store'
import { getConversationAttachmentDownloadURL } from '@/lib/conversation.attachment'
import debug from '@/lib/debug'
import { chunkUrl } from '@/lib/dsd2'
import { UserInputError } from '@/lib/error'
import { logEvent } from '@/lib/log'
import { getNamespaceAttachmentTempDownloadURL } from '@/lib/namespace.attachment'
import { z } from '@/lib/zod.schema'

// @todo translate data/abilities/catalogue/cbk.attachment.yaml to ts

// @note operation name constants for compile-time validation in action.tags.ts
export const ATTACHMENT_READ_OPERATION_NAME = 'read'

// @note image extensions that are handled via vision instead of chunking
const IMAGE_EXTENSION_RE = /\.(png|jpe?g|gif|webp|bmp|tiff?|svg)$/i

// @note audio extensions that are handled via transcription instead of chunking.
// Telegram voice notes arrive as `.oga` (audio/ogg); other channels and manual
// uploads use the rest. Chunking cannot extract text from audio, so route these
// to the listen action (gpt-4o-transcribe) which supports all of them.
const AUDIO_EXTENSION_RE = /\.(mp3|mpga|m4a|wav|ogg|oga|opus|flac|aac|weba)$/i

interface DoReadAttachmentParams {
  name: string
  input: string
  params: ActionParams
  options: ActionOptions
}

export async function doReadAttachment({
  name,
  input,
  params,
  options,
}: DoReadAttachmentParams): Promise<ActionReturn> {
  debug(`do attachment read`, { name, input, options })

  await logEvent({
    user: { id: options.userId },
    type: 'action.attachment.read',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  let url: string | undefined

  if (!url) {
    const conversation = getContextConversation()

    if (conversation) {
      url = await getConversationAttachmentDownloadURL(
        conversation.id,
        name,
        false
      )
    }
  }

  if (!url) {
    const namespace = getContextNamespace()

    if (namespace) {
      url = await getNamespaceAttachmentTempDownloadURL(namespace, name, false)
    }
  }

  if (!url) {
    throw new UserInputError(`Attachment not found`)
  }

  // @note images are not supported by chunking - use vision instead
  if (IMAGE_EXTENSION_RE.test(name)) {
    return executeViewAction(url, params, options)
  }

  // @note audio is not supported by chunking - transcribe instead
  if (AUDIO_EXTENSION_RE.test(name)) {
    return executeListenAction(url, params, options)
  }

  const result = await chunkUrl(new URL(url), {
    size: Infinity, // @note we want to read the whole attachment
    overlap: 0,
  })

  const text = result.items.map((item) => item.text).join('')

  debug(`using text`, { text })

  return {
    result: { text },
    messages: [],
  }
}

/**
 * Executes a attachment action on a specific attachment. This action is used to
 * apply a attachment to a specific input.
 */
export async function executeAttachmentAction(
  input: ActionInput,
  params: ActionParams,
  options: ActionOptions
): Promise<ActionReturn> {
  const { name } = getConfigBySchema({
    input,
    params,
    initial: {
      name: input,
    },
    schema: z.object({
      name: z.string(),
    }),
    options,
  })

  if (!name) {
    throw new UserInputError(`Missing 'name' parameter`)
  }

  let operation: typeof ATTACHMENT_READ_OPERATION_NAME

  {
    switch (true) {
      case 'read' in params: {
        operation = ATTACHMENT_READ_OPERATION_NAME

        break
      }

      default: {
        throw new UserInputError(`Unknown operation`)
      }
    }
  }

  let response: ActionReturn

  switch (operation) {
    case ATTACHMENT_READ_OPERATION_NAME: {
      response = await doReadAttachment({ name, input, params, options })

      break
    }

    default: {
      assertUnreachable(operation)
    }
  }

  return response
}
