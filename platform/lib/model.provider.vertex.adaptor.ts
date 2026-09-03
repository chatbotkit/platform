import { chunkFile } from '@/lib/chunk'
import { dataURLToBlob } from '@/lib/dataurl.parse'
import { responseToDataUrl } from '@/lib/dataurl.response'
import fetch from '@/lib/egress.fetch'
import {
  createChatCompletion as createDirectChatCompletion,
  createChatCompletionStream as createDirectChatCompletionStream,
} from '@/lib/model.provider.vertex'
import { parseAndRevealLanguageModel } from '@/lib/model.utils'
import { getRandomId } from '@/lib/string'

import type { OpenAI } from 'openai'

type ChatCompletionOptions = Parameters<typeof createDirectChatCompletion>[0]
type ChatCompletionStreamOptions = Parameters<
  typeof createDirectChatCompletionStream
>[0]

/**
 * Resolves the provider-side model name for the Vertex API.
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

type OpenAIMessage = OpenAI.Chat.ChatCompletionMessageParam

/**
 * This function converts messages to the format expected by the Vertex API. It
 * is the case that the Gemini models do not support fetching images from URLs
 * and instead require the images to be passed as data URLs.
 */
export async function convertMessages(
  messages: OpenAIMessage[]
): Promise<OpenAIMessage[]> {
  const convertedMessages = messages.slice(0)

  // unlike the OpenAI API, the Gemini models do not support file inputs yet
  // @todo revise this decision after 2025/08/01
  {
    messages = convertedMessages.slice(0)

    convertedMessages.length = 0

    for (let message of messages) {
      message = { ...message }

      if (Array.isArray(message.content)) {
        const content = message.content

        const processedContent = await Promise.all(
          content.map(async (part) => {
            let resultPart = part

            switch (true) {
              // @note we need to convert the image_url to a data URL as a
              // workaround for the fact that the Gemini compatibility API
              // do not support fetching images from URLs
              // @todo revise this decision after 2025/08/01

              case part.type === 'image_url': {
                if (
                  'image_url' in part &&
                  part.image_url.url.match?.(/^https?:\/\//i)
                ) {
                  // @todo find a way to perhaps cache the response and re-use it
                  // in subsequent requests

                  const response = await fetch(part.image_url.url)

                  const dataUrl = await responseToDataUrl(response)

                  resultPart = {
                    ...part,

                    image_url: {
                      url: dataUrl,
                    },
                  }
                }

                break
              }

              // @note we need to convert file data to user messages because
              // the Gemini compatibility API do not support file inputs yet
              // @todo revise this decision after 2025/08/01

              case part.type === 'file': {
                if ('file' in part) {
                  if (part.file.file_id) {
                    // @todo fetch file by file id from ChatBotKit
                  } else if (part.file.file_data) {
                    const blob = dataURLToBlob(part.file.file_data)

                    const chunks = await chunkFile(blob, {
                      size: Number.MAX_SAFE_INTEGER,
                      overlap: 0,
                    })

                    const content = chunks.items
                      .map(({ text }) => text)
                      .join('\n\n')

                    const id = getRandomId(getRandomId()).slice(0, 9)

                    convertedMessages.push({
                      role: 'assistant',

                      tool_calls: [
                        {
                          id: id,
                          type: 'function',
                          function: {
                            name: 'readFile',
                            arguments: JSON.stringify({
                              name: part.file.filename,
                            }),
                          },
                        },
                      ],
                    })

                    convertedMessages.push({
                      role: 'tool',

                      content: JSON.stringify({ content }),

                      tool_call_id: id,
                    })
                  }

                  resultPart = {
                    type: 'text',
                    text: ``,
                  }
                }

                break
              }
            }

            return resultPart
          })
        )

        const filteredContent = processedContent.filter((part) => {
          if (part.type === 'text') {
            return part.text.trim() !== ''
          } else {
            return true
          }
        })

        if (filteredContent.length === 0) {
          continue
        }

        message.content = filteredContent
      }

      convertedMessages.push(message)
    }
  }

  return convertedMessages
}

/**
 * Builds the chat messages payload for the Vertex API.
 */
export async function getChatMessages<
  T extends {
    messages?: OpenAIMessage[]
  },
>(options: T): Promise<T['messages']> {
  if (!options.messages) {
    return options.messages
  }

  return (await convertMessages(options.messages)) as T['messages']
}

export async function createChatCompletion({
  parallelToolCalls: _parallelToolCalls, // @note not supported for now, review after 2025/08/01

  ...options
}: Parameters<typeof createDirectChatCompletion>[0]): ReturnType<
  typeof createDirectChatCompletion
> {
  options = { ...options, messages: await getChatMessages(options) }

  return createDirectChatCompletion({
    ...options,

    model: getModel(options),
  })
}

export async function* createChatCompletionStream({
  parallelToolCalls: _parallelToolCalls, // @note not supported for now, review after 2025/08/01

  ...options
}: ChatCompletionStreamOptions): ReturnType<
  typeof createDirectChatCompletionStream
> {
  options = { ...options, messages: await getChatMessages(options) }

  yield* createDirectChatCompletionStream({
    ...options,

    model: getModel(options),
  })
}
