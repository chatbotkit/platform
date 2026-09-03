import { slice } from '@chatbotkit-dev/gpt'
import { template as t } from '@chatbotkit-dev/template'

import { baseLanguageModel } from '@/config/models'

import { MessageType } from '@/prisma/types'

import debug from '@/lib/debug'
import { captureException } from '@/lib/error'
import { extractDataWithSchema } from '@/lib/extract.data'
import { relaxedJsonParse } from '@/lib/json'
import { execPrompt } from '@/lib/prompt'
import { z } from '@/lib/zod.schema'

import extractContactDetailsPromptV1 from '@/prompts/extract_contact_details_v1.yaml'
import extractContactDetailsPromptV2 from '@/prompts/extract_contact_details_v2.yaml'

export const EXTRACT_CONTACT_DETAILS_MAX_MESSAGES = 100
export const EXTRACT_CONTACT_DETAILS_MAX_TOKENS = 2000

interface Message {
  type: MessageType
  text: string
}

interface ContactDetailsV1 {
  firstName: string
  lastName: string
  email: string
}

interface ContactDetailsV2 {
  name: string
  email: string
  summary: string
}

export interface ContactDetailsV3 {
  name: string
  email: string
  conversationName: string
  conversationDescription: string
}

interface ExtractContactDetailsResult<T> {
  details: T | null
  tokensUsed: number
  modelUsed: string
}

interface ExtractOptions {
  user: {
    id: string
  }
  /**
   * Optional deadline/cancellation signal (e.g. the queue handler's hard-timeout
   * monitor signal), forwarded into the extraction completion.
   */
  signal?: AbortSignal
}

export async function extractContactDetails(
  messages: Message[],
  options: ExtractOptions
): Promise<ExtractContactDetailsResult<ContactDetailsV1>> {
  const { user } = options

  let conversation = messages
    .filter(({ type }) =>
      ([MessageType.user, MessageType.bot] as MessageType[]).includes(type)
    )
    .slice(-EXTRACT_CONTACT_DETAILS_MAX_MESSAGES)
    .map(({ type, text }) => {
      return `<|${type.trim()}|>\n${text.trim()}`
    })
    .join('\n')

  if (!conversation) {
    return { details: null, tokensUsed: 0, modelUsed: baseLanguageModel }
  }

  conversation = slice(conversation, 0, EXTRACT_CONTACT_DETAILS_MAX_TOKENS)

  debug(`extracting contact details from conversation`, { conversation })

  let completion = JSON.stringify({ firstName: '', lastName: '', email: '' })
  let tokensUsed = 0
  let modelUsed = baseLanguageModel

  try {
    const response = await execPrompt(
      {
        ...extractContactDetailsPromptV1,

        user: user.id,
      },
      { conversation }
    )

    completion = response.completion
    tokensUsed = response.tokensUsed
    modelUsed = response.modelUsed
  } catch (e) {
    await captureException(e)
  }

  const response = completion.trim()

  debug(`contact details extraction finished`, {
    response,
    tokensUsed,
    modelUsed,
  })

  const details = relaxedJsonParse(response) as ContactDetailsV1 | null

  return {
    details,

    tokensUsed,
    modelUsed,
  }
}

export async function extractContactDetails2(
  messages: Message[],
  options: ExtractOptions
): Promise<ExtractContactDetailsResult<ContactDetailsV2>> {
  const { user } = options

  let conversation = messages
    .filter(({ type }) =>
      ([MessageType.user, MessageType.bot] as MessageType[]).includes(type)
    )
    .slice(-EXTRACT_CONTACT_DETAILS_MAX_MESSAGES)
    .map(({ type, text }) => {
      return `<|${type.trim()}|>\n${text.trim()}`
    })
    .join('\n')

  if (!conversation) {
    return { details: null, tokensUsed: 0, modelUsed: baseLanguageModel }
  }

  conversation = slice(conversation, 0, EXTRACT_CONTACT_DETAILS_MAX_TOKENS)

  debug(`extracting contact details from conversation`, { conversation })

  let completion = JSON.stringify({ name: '', email: '' })
  let tokensUsed = 0
  let modelUsed = baseLanguageModel

  try {
    const response = await execPrompt(
      {
        ...extractContactDetailsPromptV2,

        user: user.id,
      },
      { conversation }
    )

    completion = response.completion
    tokensUsed = response.tokensUsed
    modelUsed = response.modelUsed
  } catch (e) {
    await captureException(e)
  }

  const response = completion.trim()

  debug(`contact details extraction finished`, {
    response,
    tokensUsed,
    modelUsed,
  })

  const details = relaxedJsonParse(response) as ContactDetailsV2 | null

  return {
    details,

    tokensUsed,
    modelUsed,
  }
}

const contactDetailsV3Schema = z.object({
  name: z.string().describe('The name of the user in the conversation'),
  email: z
    .string()
    .describe('The email address of the user in the conversation'),
  conversationName: z
    .string()
    .max(100, 'Conversation name should be at most 100 characters')
    .describe(
      'A short, descriptive name (max 100 characters) for the conversation based on its topic or purpose'
    ),
  conversationDescription: z
    .string()
    .describe(
      'A detailed summary of the conversation including what was discussed and any outcomes'
    ),
})

export async function extractContactDetails3(
  messages: Message[],
  options: ExtractOptions
): Promise<ExtractContactDetailsResult<ContactDetailsV3>> {
  const { user, signal } = options

  const filteredMessages = messages.slice(-EXTRACT_CONTACT_DETAILS_MAX_MESSAGES)

  if (!filteredMessages.length) {
    return { details: null, tokensUsed: 0, modelUsed: baseLanguageModel }
  }

  debug(`extracting contact details v3 from conversation`)

  let data: ContactDetailsV3 | null = null
  let tokensUsed = 0
  let modelUsed = baseLanguageModel

  try {
    const result = await extractDataWithSchema(
      [
        {
          type: MessageType.backstory,
          text: t`
            Extract conversation details from the interaction that follows.
            
            When generating the description do not refer to the user as 
            "the user". Instead, infer a name for the user based on the 
            conversation and use it in the description. If you cannot infer a 
            name, keep the description more generic without mentioning the user.

            Do not include emails or other PII in the description itself.
          `,
        },
        ...filteredMessages,
      ],
      contactDetailsV3Schema,
      {
        user: user,
        functionName: 'extractDetails',
        signal: signal,
        usageMeta: {
          reason: 'conversation/extract-details',
        },
      }
    )

    data = result.data
    tokensUsed = result.usage.token
    modelUsed = result.usage.items[0]?.model || baseLanguageModel
  } catch (e) {
    await captureException(e)
  }

  debug(`contact details v3 extraction finished`, {
    data,
    tokensUsed,
    modelUsed,
  })

  return {
    details: data,
    tokensUsed,
    modelUsed,
  }
}
