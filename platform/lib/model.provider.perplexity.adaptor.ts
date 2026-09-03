import { chunkFile } from '@/lib/chunk'
import { dataURLToBlob } from '@/lib/dataurl.parse'
import type { ChatMessage } from '@/lib/model.provider.openai'
import {
  createChatCompletion as createDirectChatCompletion,
  createChatCompletionStream as createDirectChatCompletionStream,
} from '@/lib/model.provider.perplexity'
import { parseAndRevealLanguageModel } from '@/lib/model.utils'

type ChatCompletionOptions = Parameters<typeof createDirectChatCompletion>[0]
type ChatCompletionStreamOptions = Parameters<
  typeof createDirectChatCompletionStream
>[0]

/**
 * Resolves the provider-side model name for the Perplexity API.
 */
export function getModel(options: ChatCompletionOptions): string {
  const model = options.model

  // @note use providerModel if configured, as it holds the exact provider-side
  // identifier

  try {
    const { config } = parseAndRevealLanguageModel(model)

    if ('providerModel' in config && config.providerModel) {
      return config.providerModel as string
    }
  } catch {
    // fall through
  }

  return model
}

/**
 * The sonar models are very primitive so we need to convert the messages to the
 * format expected by the API.
 */
export async function convertMessages(
  messages: ChatMessage[]
): Promise<ChatMessage[]> {
  const convertedMessages = messages.slice(0)

  // handle different file types which sonar models do not support
  {
    messages = convertedMessages.slice(0)

    convertedMessages.length = 0

    for (let message of messages) {
      message = { ...message }

      if (Array.isArray(message.content)) {
        const content = message.content

        message.content = await Promise.all(
          content.map(async (part) => {
            switch (true) {
              // @note we need to convert the image_url to something that
              // the model can understand
              // @todo revise this decision after 2025/08/01

              case part.type === 'image_url': {
                // @todo add code here

                break
              }

              // @note we need to convert file data to user messages because
              // the Sonar compatibility API do not support file inputs yet
              // @todo revise this decision after 2025/08/01

              case part.type === 'file': {
                if (part.file.file_id) {
                  // @todo fetch file by file id from ChatBotKit
                } else if (part.file.file_data) {
                  const blob = dataURLToBlob(part.file.file_data)

                  const chunks = await chunkFile(blob, {
                    size: Number.MAX_SAFE_INTEGER,
                    overlap: 0,
                  })

                  const text = chunks.items.map(({ text }) => text).join('\n\n')

                  part = {
                    type: 'text',
                    text: `filename: ${part.file.filename}\nfiletype: ${blob.type}\n\n${text}`,
                  }
                }

                break
              }
            }

            return part
          })
        )
      }

      convertedMessages.push(message)
    }
  }

  // consolidate contingent message blocks of the same type
  {
    messages = convertedMessages.slice(0)

    convertedMessages.length = 0

    // @note the sonar models do not like when the messages are split into
    // multiple blocks of the same type. This is a workaround for that.

    const supportedMessages = messages.filter(
      (message) =>
        message.role === 'system' ||
        message.role === 'developer' ||
        message.role === 'assistant' ||
        message.role === 'user' ||
        message.role === 'tool'
    )

    const consolidatedMessages: Array<
      (typeof supportedMessages)[number] & { content: string }
    > = []

    let lastMessage:
      | ((typeof supportedMessages)[number] & { content: string })
      | undefined

    for (const message of supportedMessages) {
      const role = message.role === 'tool' ? 'assistant' : message.role

      let contentStr = ''

      if (typeof message.content === 'string') {
        contentStr = message.content
      } else if (Array.isArray(message.content)) {
        contentStr = message.content
          .filter(
            (item) => item.type === 'text' && typeof item.text === 'string'
          )
          .map((item) => item.text)
          .join('\n\n')
      }

      if (lastMessage) {
        if (role === lastMessage.role) {
          if (contentStr) {
            lastMessage.content = lastMessage.content
              ? lastMessage.content + '\n\n' + contentStr
              : contentStr
          }
        } else {
          const nextMessage = {
            ...message,

            role,

            content: contentStr,
          }

          lastMessage = nextMessage

          consolidatedMessages.push(nextMessage)
        }
      } else {
        const nextMessage = {
          ...message,

          role,

          content: contentStr,
        }

        lastMessage = nextMessage

        consolidatedMessages.push(nextMessage)
      }
    }

    convertedMessages.push(...consolidatedMessages)
  }

  return convertedMessages
}

/**
 * Builds the chat messages payload for the Perplexity API.
 */
export async function getChatMessages<
  T extends {
    messages?: ChatMessage[]
  },
>(options: T): Promise<T['messages']> {
  if (!options.messages) {
    return options.messages
  }

  return (await convertMessages(options.messages)) as T['messages']
}

/**
 * Creates a chat completion with converted messages for Perplexity API
 */
export async function createChatCompletion(
  options: ChatCompletionOptions
): ReturnType<typeof createDirectChatCompletion> {
  options = { ...options, messages: await getChatMessages(options) }

  return createDirectChatCompletion({
    ...options,

    model: getModel(options),
  })
}

/**
 * Creates a streaming chat completion with converted messages for Perplexity API
 */
export async function* createChatCompletionStream(
  options: ChatCompletionStreamOptions
): ReturnType<typeof createDirectChatCompletionStream> {
  options = { ...options, messages: await getChatMessages(options) }

  yield* createDirectChatCompletionStream({
    ...options,

    model: getModel(options),
  })
}
