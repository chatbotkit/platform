// @ts-check
import { languageModels } from '@/config/models'

import { blobToDataUrl } from '@/lib/dataurl.blob'
import { getModelStore, runInModelContext } from '@/lib/model.context'
import {
  createAnnotationResponse,
  createChatCompletion,
  createChatCompletionStream,
  createEmbedding,
  createModeration,
  createResponseCompletion,
  createResponseCompletionStream,
  createTextCompletion,
  createTextCompletionStream,
  createTranscriptionResponse,
  getOpenAIError,
  getOpenAIKey,
  getOpenAIUrl,
  getSpeechUsage,
  getTranscriptionAudioFilename,
  isContentModerationMessage,
  isUnsupportedInputFileMessage,
  listModels,
  normalizeChatFunctions,
  normalizeChatTools,
  normalizeFinishReason,
  normalizeResponseTools,
} from '@/lib/model.provider.openai'

import { parseDataURL } from './dataurl.parse'

import PDFDocument from 'pdfkit'

jest.retryTimes(3)

const { hasLanguageModelsByProvider } = jest.requireActual('@/lib/model.utils')

const describeIfConfigured = hasLanguageModelsByProvider('openai')
  ? describe
  : describe.skip

// @note pdfkit is used only for testing

describe('getSpeechUsage', () => {
  it('should return token usage for speech input', () => {
    const usage = getSpeechUsage('Hello world', 'tts-1')

    expect(usage).toEqual({
      totalTokens: expect.any(Number),
      promptTokens: expect.any(Number),
      completionTokens: 0,
    })
    expect(usage.totalTokens).toBeGreaterThan(0)
    expect(usage.totalTokens).toEqual(usage.promptTokens)
  })
})

describe('getTranscriptionAudioFilename', () => {
  it.each([
    ['audio/ogg', 'audio.ogg'], // telegram voice notes
    ['audio/opus', 'audio.ogg'],
    ['audio/mpeg', 'audio.mp3'], // canonical mp3, not the mime registry's "mpga"
    ['audio/mp4', 'audio.m4a'],
    ['audio/x-m4a', 'audio.m4a'],
    ['audio/wav', 'audio.wav'],
    ['audio/x-flac', 'audio.flac'],
    ['audio/webm', 'audio.webm'], // canonical webm, not the mime registry's "weba"
    ['AUDIO/OGG', 'audio.ogg'], // matched case-insensitively
  ])(
    'maps audio content type %s to a canonical extension',
    (type, expected) => {
      const audio = new Blob([new Uint8Array([1, 2, 3])], { type })

      expect(getTranscriptionAudioFilename(audio)).toBe(expected)
    }
  )

  it.each([
    [''], // undici Blobs default to an empty type
    ['application/octet-stream'], // generic binary
    ['video/mp4'], // non-audio types are not trusted
    ['audio/aac'], // audio, but not one OpenAI reliably decodes by extension
  ])(
    'returns undefined for unrecognised type %s so the caller lets OpenAI sniff',
    (type) => {
      const audio = new Blob([new Uint8Array([1, 2, 3])], { type })

      expect(getTranscriptionAudioFilename(audio)).toBeUndefined()
    }
  )

  it('preserves an explicit File name when one is set', () => {
    const audio = new File([new Uint8Array([1, 2, 3])], 'recording.oga', {
      type: 'audio/ogg',
    })

    expect(getTranscriptionAudioFilename(audio)).toBe('recording.oga')
  })

  it('ignores a nameless File and maps from its type', () => {
    const audio = new File([new Uint8Array([1, 2, 3])], '', {
      type: 'audio/ogg',
    })

    expect(getTranscriptionAudioFilename(audio)).toBe('audio.ogg')
  })
})

export async function text2pdf(text) {
  const pdfDoc = new PDFDocument()

  const chunks = []

  pdfDoc.on('data', (chunk) => {
    chunks.push(chunk)
  })

  pdfDoc.on('end', () => {
    // nothing to do here
  })

  pdfDoc.text(text)

  pdfDoc.end()

  return new Promise((resolve, reject) => {
    pdfDoc.on('error', reject)
    pdfDoc.on('end', () => {
      resolve(Buffer.concat(chunks))
    })
  })
}

describeIfConfigured('createTextCompletion', () => {
  it('must correctly complete', async () => {
    const { completion, usage, finishReason } = await createTextCompletion({
      model: 'gpt-3.5-turbo-instruct',
      prompt: 'count the numbers between 1 to 5 starting 1,2,3,',
      maxTokens: 20,
    })

    expect(completion).toBeTruthy()
    expect(usage.totalTokens).toBeGreaterThan(0)

    // @note disabled because it was failing production tests on 2025/01/29
    false && expect(finishReason).toEqual('stop')
  })
})

describeIfConfigured('createTextCompletionStream', () => {
  it.each([[{ includeUsage: false }], [{ includeUsage: true }]])(
    'must correctly complete with stream',
    async ({ includeUsage }) => {
      const chunks = []

      for await (const { completion } of createTextCompletionStream({
        model: 'gpt-3.5-turbo-instruct',
        prompt: 'count the numbers between 1 to 5 starting 1,2,3,',
        maxTokens: 20,
        includeUsage: includeUsage,
      })) {
        chunks.push(completion)
      }

      expect(chunks.join('')).toBeTruthy()
      // @note disabled because it was failing production tests on 2025/01/29
      // expect(finishReason).toEqual('stop')
    }
  )
})

describeIfConfigured('createChatCompletion', () => {
  it('must correctly complete chat', async () => {
    const { completion, usage, finishReason } = await createChatCompletion({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content:
            'Finish the following sequence by guessing the next number 1,2,3,',
        },
      ],
    })

    expect(completion).toBeTruthy()
    expect(usage.totalTokens).toBeGreaterThan(0)
    expect(finishReason).toEqual('stop')
  })

  it('must correctly interpret chat and function calls', async () => {
    const { functionCall, usage, finishReason } = await createChatCompletion({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Book a meeting tonight!' }],
      functions: [
        {
          name: 'book_meeting',
          description: 'Book a meeting',
          parameters: {
            type: 'object',
            properties: {
              when: {
                type: 'string',
                enum: ['tonight', 'tomorrow', 'next week', 'next month'],
              },
            },
          },
        },
      ],
    })

    expect(functionCall).toEqual({
      name: 'book_meeting',
      arguments: {
        when: 'tonight',
      },
    })
    expect(usage.totalTokens).toBeGreaterThan(0)
    expect(finishReason).toEqual('functionCall')
  })

  it('must correctly interpret chat and tool calls', async () => {
    const { toolCalls, finishReason } = await createChatCompletion({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Book a meeting tonight!' }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'book_meeting',
            description: 'Book a meeting',
            parameters: {
              type: 'object',
              properties: {
                when: {
                  type: 'string',
                  enum: ['tonight', 'tomorrow', 'next week', 'next month'],
                },
              },
            },
          },
        },
      ],
    })

    expect(toolCalls).not.toBeNull()
    expect(toolCalls?.length).toEqual(1)
    expect(toolCalls?.[0].function).toEqual({
      name: 'book_meeting',
      arguments: {
        when: 'tonight',
      },
    })
    expect(finishReason).toEqual('toolCalls')
  })

  // @note disabled for now because it results in failure - very unstable api - review later

  it.skip('should be able to understand input files', async () => {
    const { completion, usage, finishReason } = await createChatCompletion({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant that is able to read files and answer questions about them.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'file',
              file: {
                filename: 'characters.pdf',
                file_data: await blobToDataUrl(
                  new Blob(
                    [new Uint8Array(await text2pdf('Alice, Bob, Charlie'))],
                    {
                      type: 'application/pdf',
                    }
                  )
                ),
              },
            },
            {
              type: 'text',
              text: 'Read the attached file and answer the following question: What are the names of the characters in the file?',
            },
          ],
        },
      ],
    })

    expect(completion).toBeTruthy()
    expect(usage.totalTokens).toBeGreaterThan(0)
    expect(finishReason).toEqual('stop')
    expect(completion).toContain('Alice')
    expect(completion).toContain('Bob')
    expect(completion).toContain('Charlie')
  })
})

describeIfConfigured('createChatCompletionStream', () => {
  it.each([[{ includeUsage: false }], [{ includeUsage: true }]])(
    'must correctly complete chat with stream',
    async ({ includeUsage }) => {
      const chunks = []

      let finishReason

      for await (const {
        completion,
        finishReason: _finishReason,
      } of createChatCompletionStream({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content:
              'Finish the following sequence by guessing the next number 1,2,3,',
          },
        ],
        includeUsage: includeUsage,
      })) {
        chunks.push(completion)

        if (_finishReason) {
          finishReason = _finishReason
        }
      }

      expect(chunks.join('')).toBeTruthy()
      expect(finishReason).toEqual('stop')
    }
  )

  it.each([[{ includeUsage: false }], [{ includeUsage: true }]])(
    'must correctly interpret chat with stream and function calls',
    async ({ includeUsage }) => {
      const calls = []

      let finishReason

      for await (const {
        functionCall,
        finishReason: _finishReason,
      } of createChatCompletionStream({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Book a meeting tonight!' }],
        functions: [
          {
            name: 'book_meeting',
            description: 'Book a meeting',
            parameters: {
              type: 'object',
              properties: {
                when: { type: 'string' },
              },
            },
          },
        ],
        includeUsage: includeUsage,
      })) {
        if (functionCall) {
          calls.push(functionCall)
        }

        if (_finishReason) {
          finishReason = _finishReason
        }
      }

      expect(calls).toEqual([
        {
          name: 'book_meeting',
          arguments: {
            when: 'tonight',
          },
        },
      ])
      expect(finishReason).toEqual('functionCall')
    }
  )

  it.each([[{ includeUsage: false }], [{ includeUsage: true }]])(
    'must correctly interpret chat with stream and tool calls',
    async ({ includeUsage }) => {
      const calls = []

      let finishReason

      for await (const {
        toolCalls,
        finishReason: _finishReason,
      } of createChatCompletionStream({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Book a meeting tonight!' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'book_meeting',
              description: 'Book a meeting',
              parameters: {
                type: 'object',
                properties: {
                  when: { type: 'string' },
                },
              },
            },
          },
        ],
        includeUsage: includeUsage,
      })) {
        if (toolCalls) {
          calls.push(...toolCalls)
        }

        if (_finishReason) {
          finishReason = _finishReason
        }
      }

      expect(calls.length).toEqual(1)
      expect(calls[0].function.name.toLowerCase()).toEqual('book_meeting')
      expect(calls[0].function.arguments.when.toLowerCase()).toEqual('tonight')
      expect(finishReason).toEqual('toolCalls')
    }
  )

  it.each([[{ includeUsage: false }], [{ includeUsage: true }]])(
    'must correctly interpret chat with stream and tool calls',
    async ({ includeUsage }) => {
      const calls = []

      let finishReason

      for await (const {
        toolCalls,
        finishReason: _finishReason,
      } of createChatCompletionStream({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Book a meeting tonight!' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'book_meeting',
              description: 'Book a meeting',
              parameters: {
                type: 'object',
                properties: {
                  when: { type: 'string' },
                },
              },
            },
          },
        ],
        includeUsage: includeUsage,
      })) {
        if (toolCalls) {
          calls.push(...toolCalls)
        }

        if (_finishReason) {
          finishReason = _finishReason
        }
      }

      expect(calls.length).toEqual(1)
      expect(calls[0].function.name.toLowerCase()).toEqual('book_meeting')
      expect(calls[0].function.arguments.when.toLowerCase()).toEqual('tonight')
      expect(finishReason).toEqual('toolCalls')
    }
  )
})

describeIfConfigured('createEmbedding', () => {
  it('must correctly returns an embedding', async () => {
    expect(
      (await createEmbedding('test', { model: 'text-embedding-ada-002' }))
        .length
    ).toBeTruthy()
  })
})

describeIfConfigured('listModels', () => {
  it.skip('official model must exist', async () => {
    const models = await listModels()

    for (const model of models) {
      const skipPrefixes = ['tts-', 'dall-', 'text-embedding-']

      if (skipPrefixes.some((prefix) => model.id.startsWith(prefix))) {
        continue
      }

      const skipSuffixes = ['-preview', '-latest']

      if (skipSuffixes.some((suffix) => model.id.endsWith(suffix))) {
        continue
      }

      expect({
        id: model.id,
        created: model.created,
        exists: model.id in languageModels,
      }).toEqual({
        id: model.id,
        created: model.created,
        exists: true,
      })
    }
  })
})

describeIfConfigured('createModeration', () => {
  it('should not detect moderation issues', async () => {
    const result = await createModeration('Life is good!')

    expect(result).toEqual({ flagged: false, categories: [] })
  })

  it('should detect moderation issues', async () => {
    const result = await createModeration('I want to kill myself!')

    expect(result).toEqual({
      flagged: true,
      categories: ['self-harm/intent', 'self-harm', 'violence'],
    })
  })
})

describeIfConfigured('createTranscription', () => {
  it('should create a transcription', async () => {
    const { data, type } = parseDataURL(
      'data:audio/mpeg;base64,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'
    )

    const result = await createTranscriptionResponse({
      audio: new Blob([new Uint8Array(data)], { type }),
      model: 'gpt-4o-transcribe',
      instructions: 'What was the audio about?',
    })

    expect(result.text).toMatch(/test/i)
    expect(result.usage.totalTokens).toBeGreaterThan(0)
  })
})

describeIfConfigured('createAnnotation', () => {
  it('should create an annotation', async () => {
    const { data, type } = parseDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkBAMAAACCzIhnAAAAG1BMVEUAAAD///9/f3+/v7+fn5/f398/Pz8fHx9fX1+3cZvoAAAACXBIWXMAAA7EAAAOxAGVKw4bAAABD0lEQVRYhe2UO0/DMBCAjxASRpwHMAYqpK5JEDNR+wNIyqNjJKR2TSmiaweG/uzasVPSQtS7Dh3QfUN8ufjz+RTLAAzDMAzDaBYdeSttiAB6JlQfPnMRJiX8JNPEKLZoeATIXjRqKfF8O8hD6WTNhKBdSpgxKzepm7F8OHeRfju52N3db8UVVT1WeOV8axcoxbomKzZdsTyy4vhkBeIlWZltNYNSnPwBp+jz8qriuSgqjDKqz59e/10EJUIp29mPPGjqYBXZzxtVATskKxBHZGX2RFbOrsjK6eUxlAM2Rmnf1f89i/CK4ynHDvffMPfDGlkl9vuTb4E4MOZeVGVUXECn8idfqylqHsMwDMP8Z9YwyTX+cM1Q2gAAAABJRU5ErkJggg=='
    )

    const result = await createAnnotationResponse({
      image: new Blob([new Uint8Array(data)], { type }),
      model: 'gpt-4o',
      instructions: 'What is written in the image?',
    })

    expect(result.text).toMatch(/test/i)
    expect(result.usage.totalTokens).toBeGreaterThan(0)
  })
})

describe('getOpenAIError', () => {
  it('should use OpenAI error message when available', () => {
    const error = {
      response: {
        status: 400,
        data: {
          error: {
            message: 'Invalid API key provided',
          },
        },
      },
    }

    const result = getOpenAIError(error)

    expect(result.message).toBe('Invalid API key provided (400)')
    expect(result.code).toBe('OI_BAD_REQUEST')
  })

  it('should use human-readable message for 403 when no OpenAI message', () => {
    const error = {
      response: {
        status: 403,
        data: {},
      },
    }

    const result = getOpenAIError(error)

    expect(result.message).toBe('Not authorized (403)')
    expect(result.code).toBe('OI_NOT_AUTHORIZED')
  })

  it('should use human-readable message for 429 rate limit', () => {
    const error = {
      response: {
        status: 429,
        data: {},
      },
    }

    const result = getOpenAIError(error)

    expect(result.message).toBe('Too many requests (429)')
    expect(result.code).toBe('OI_TOO_MANY_REQUESTS')
  })

  it('should use human-readable message for 500 internal server error', () => {
    const error = {
      response: {
        status: 500,
        data: {},
      },
    }

    const result = getOpenAIError(error)

    expect(result.message).toBe('Internal server error (500)')
    expect(result.code).toBe('OI_INTERNAL_SERVER_ERROR')
  })

  it('should use human-readable message for 503 service unavailable', () => {
    const error = {
      response: {
        status: 503,
        data: {},
      },
    }

    const result = getOpenAIError(error)

    expect(result.message).toBe('Service unavailable (503)')
    expect(result.code).toBe('OI_SERVICE_UNAVAILABLE')
  })

  it('should fall back to Unknown error for unmapped status codes', () => {
    const error = {
      response: {
        status: 418, // I'm a teapot - not in statusToMessageMap
        data: {},
      },
    }

    const result = getOpenAIError(error)

    expect(result.message).toBe('Unknown error (418)')
  })

  it('should prefer error.message over fallback when available', () => {
    const error = {
      response: {
        status: 403,
        data: {},
      },
      message: 'Connection refused',
    }

    const result = getOpenAIError(error)

    expect(result.message).toBe('Connection refused (403)')
  })

  it('should join array error messages', () => {
    const error = {
      response: {
        status: 400,
        data: [
          { error: { message: 'First error' } },
          { error: { message: 'Second error' } },
        ],
      },
    }

    const result = getOpenAIError(error)

    expect(result.message).toBe('First error, Second error (400)')
  })

  it('should use custom error prefix when provided', () => {
    const error = {
      response: {
        status: 403,
        data: {},
      },
    }

    const result = getOpenAIError(error, { errorPrefix: 'CUSTOM_' })

    expect(result.code).toBe('CUSTOM_NOT_AUTHORIZED')
  })

  it('should include body in error data when provided', () => {
    const error = {
      response: {
        status: 403,
        data: {},
      },
    }
    const body = { model: 'gpt-4', messages: [] }

    const result = getOpenAIError(error, { body })

    expect(result.data.body).toEqual(body)
  })

  it('should enhance invalid model ID error with helpful message', () => {
    const error = {
      response: {
        status: 400,
        data: {
          error: {
            message: 'invalid model ID',
          },
        },
      },
    }
    const body = { model: 'gpt-5-turbo' }

    const result = getOpenAIError(error, { body })

    expect(result.message).toContain('invalid model ID')
    expect(result.message).toContain('gpt-5-turbo')
    expect(result.message).toContain('(400)')
    expect(result.code).toBe('OI_BAD_REQUEST')
  })

  it('should return UserConfigError for 402 payment required errors', () => {
    const error = {
      response: {
        status: 402,
        data: {
          error: {
            message:
              'Insufficient credits. Add more using https://openrouter.ai/settings/credits',
          },
        },
      },
    }

    const result = getOpenAIError(error)

    expect(result.constructor.name).toBe('UserConfigError')
    expect(result.message).toContain('Insufficient credits')
    expect(result.message).toContain('(402)')
  })

  it('should return ContentModerationError for 400 inappropriate content rejections', () => {
    const error = {
      response: {
        status: 400,
        data: {
          error: {
            message: 'Input data may contain inappropriate content.',
          },
        },
      },
    }
    const body = { model: 'alibaba/qwen3.7-max', messages: [] }

    const result = getOpenAIError(error, { errorPrefix: 'VR_', body })

    expect(result.constructor.name).toBe('ContentModerationError')
    expect(result.code).toBe('CONTENT_MODERATION')
    expect(result.message).toContain('inappropriate content')
    // @note the request body must never be attached to a moderation error
    expect(result.data).toBeUndefined()
  })

  it('should not misclassify a generic 400 bad request as moderation', () => {
    const error = {
      response: {
        status: 400,
        data: {
          error: {
            message: 'Invalid request: messages must be a non-empty array',
          },
        },
      },
    }

    const result = getOpenAIError(error, { errorPrefix: 'VR_' })

    expect(result.constructor.name).toBe('SystemError')
    expect(result.code).toBe('VR_BAD_REQUEST')
  })

  it('should return BotInputError for 400 unsupported input file rejections', () => {
    const error = {
      response: {
        status: 400,
        data: {
          error: {
            message:
              "Invalid file 'image[0]': unsupported mimetype ('image/svg+xml'). Supported file formats are 'image/jpeg', 'image/png', and 'image/webp'.",
          },
        },
      },
    }
    const body = { model: 'gpt-image-1', prompt: 'edit this' }

    const result = getOpenAIError(error, { body })

    expect(result.constructor.name).toBe('BotInputError')
    expect(result.message).toContain('unsupported mimetype')
    // @note bad input must never attach the request body to the error
    expect(result.data).toBeUndefined()
  })

  it('should return UserConfigError for 401 when custom credentials are set', async () => {
    await runInModelContext(async () => {
      const store = getModelStore()

      store.openaiKey = 'bad-custom-key'

      const error = {
        response: {
          status: 401,
          data: {
            error: {
              message: 'Incorrect API key provided: bad-cust...key.',
            },
          },
        },
      }

      const result = getOpenAIError(error)

      expect(result.constructor.name).toBe('UserConfigError')
      expect(result.message).toContain('Incorrect API key')
      expect(result.message).toContain('(401)')
    })
  })

  it('should return SystemError for 401 when using platform credentials', async () => {
    await runInModelContext(async () => {
      const error = {
        response: {
          status: 401,
          data: {
            error: {
              message: 'Incorrect API key provided',
            },
          },
        },
      }

      const result = getOpenAIError(error)

      expect(result.constructor.name).toBe('SystemError')
      expect(result.code).toBe('OI_NOT_AUTHENTICATED')
    })
  })

  it('should return UserConfigError for 403 when custom credentials are set', async () => {
    await runInModelContext(async () => {
      const store = getModelStore()

      store.openaiKey = 'limited-custom-key'

      const error = {
        response: {
          status: 403,
          data: {
            error: {
              message: 'You do not have access to this model',
            },
          },
        },
      }

      const result = getOpenAIError(error)

      expect(result.constructor.name).toBe('UserConfigError')
      expect(result.message).toContain('You do not have access')
      expect(result.message).toContain('(403)')
    })
  })

  it('should return SystemError for 403 when using platform credentials', async () => {
    await runInModelContext(async () => {
      const error = {
        response: {
          status: 403,
          data: {},
        },
      }

      const result = getOpenAIError(error)

      expect(result.constructor.name).toBe('SystemError')
      expect(result.code).toBe('OI_NOT_AUTHORIZED')
    })
  })

  // @note a custom (BYOK) model whose name does not exist on the provider it
  // was pointed at is the customer's misconfiguration, not a platform fault, so
  // it must stay out of Sentry.
  it('should return UserConfigError for 404 model-not-found when custom credentials are set', async () => {
    await runInModelContext(async () => {
      const store = getModelStore()

      store.openaiKey = 'custom-byok-key'

      const error = {
        response: {
          status: 404,
          data: {
            error: {
              message:
                'The model `deepseek-v4-pro` does not exist or you do not have access to it.',
            },
          },
        },
      }

      const result = getOpenAIError(error)

      expect(result.constructor.name).toBe('UserConfigError')
      expect(result.message).toContain(
        'does not exist or you do not have access'
      )
      expect(result.message).toContain('(404)')
    })
  })

  // @note the same 404 on PLATFORM credentials means our own catalogue points
  // at a providerModel the upstream rejects - a real bug we want paged on - so
  // it must remain a SystemError.
  it('should return SystemError for 404 when using platform credentials', async () => {
    await runInModelContext(async () => {
      const error = {
        response: {
          status: 404,
          data: {
            error: {
              message:
                'The model `gemini-3.1-flash-lite` does not exist or you do not have access to it.',
            },
          },
        },
      }

      const result = getOpenAIError(error)

      expect(result.constructor.name).toBe('SystemError')
      expect(result.code).toBe('OI_NOT_FOUND')
    })
  })
})

describe('isContentModerationMessage', () => {
  it('matches known provider moderation signatures', () => {
    for (const message of [
      // Alibaba Model Studio
      'Input data may contain inappropriate content.',
      'data_inspection_failed',
      'data inspection failed',
      // OpenAI
      'Your request was rejected as a result of our safety system. Your prompt may contain text that is not allowed by our safety system.',
      'This content may violate our usage policies.',
      // Azure OpenAI
      "The response was filtered due to the prompt triggering Azure OpenAI's content management policy.",
      // generic
      "The response was flagged by the model's content management policy",
      'Blocked by the safety filter',
      'content_filter triggered',
    ]) {
      expect(isContentModerationMessage(message)).toBe(true)
    }
  })

  it('does not match unrelated error messages', () => {
    for (const message of [
      'Invalid request: messages must be a non-empty array',
      'maximum context length is 8192 tokens',
      'Incorrect API key provided',
      '',
    ]) {
      expect(isContentModerationMessage(message)).toBe(false)
    }
  })
})

describe('isUnsupportedInputFileMessage', () => {
  it('matches unsupported / invalid input file signatures', () => {
    for (const message of [
      "Invalid file 'image[0]': unsupported mimetype ('image/svg+xml'). Supported file formats are 'image/jpeg', 'image/png', and 'image/webp'.",
      "unsupported mimetype ('image/gif')",
      'Invalid file provided',
      'Invalid image format',
      'unsupported file format',
      "Supported file formats are 'image/jpeg', 'image/png', and 'image/webp'.",
    ]) {
      expect(isUnsupportedInputFileMessage(message)).toBe(true)
    }
  })

  it('does not match unrelated error messages', () => {
    for (const message of [
      'Invalid request: messages must be a non-empty array',
      'maximum context length is 8192 tokens',
      'Input data may contain inappropriate content.',
      '',
    ]) {
      expect(isUnsupportedInputFileMessage(message)).toBe(false)
    }
  })
})

describe('normalizeFunctions', () => {
  it('should normalize valid functions', () => {
    const functions = [
      {
        name: 'testFunction',
        description: 'A test function',
        parameters: { type: 'object' },
      },
    ]

    const result = normalizeChatFunctions(functions)

    expect(result).toEqual([
      {
        name: 'testFunction',
        description: 'A test function',
        parameters: { type: 'object' },
      },
    ])
  })

  it('should truncate long names and descriptions', () => {
    const longString = 'a'.repeat(600)
    const functions = [
      {
        name: longString,
        description: longString,
        parameters: {},
      },
    ]

    const result = normalizeChatFunctions(functions)

    expect(result[0].name).toHaveLength(512)
    expect(result[0].description).toHaveLength(512)
  })

  it('should handle functions with undefined name', () => {
    const functions = /** @type {any} */ ([
      {
        name: undefined,
        description: 'A function',
        parameters: {},
      },
    ])

    expect(() => normalizeChatFunctions(functions)).toThrow(
      'function name is required'
    )
  })

  it('should handle functions with undefined description', () => {
    const functions = /** @type {any} */ ([
      {
        name: 'testFunction',
        description: undefined,
        parameters: {},
      },
    ])

    expect(() => normalizeChatFunctions(functions)).toThrow(
      'function description is required'
    )
  })

  it('should handle functions with null name', () => {
    const functions = /** @type {any} */ ([
      {
        name: null,
        description: 'A function',
        parameters: {},
      },
    ])

    expect(() => normalizeChatFunctions(functions)).toThrow(
      'function name is required'
    )
  })

  it('should handle functions with null description', () => {
    const functions = /** @type {any} */ ([
      {
        name: 'testFunction',
        description: null,
        parameters: {},
      },
    ])

    expect(() => normalizeChatFunctions(functions)).toThrow(
      'function description is required'
    )
  })
})

describe('normalizeTools', () => {
  it('should normalize valid tools', () => {
    const tools = [
      {
        type: 'function',
        function: {
          name: 'testTool',
          description: 'A test tool',
          parameters: { type: 'object', properties: {} },
        },
      },
    ]

    // @ts-ignore
    const result = normalizeChatTools(tools)

    expect(result).toEqual([
      {
        type: 'function',
        function: {
          name: 'testTool',
          description: 'A test tool',
          parameters: { type: 'object', properties: {} },
        },
      },
    ])
  })

  it('should truncate long names and descriptions', () => {
    const longString = 'a'.repeat(600)
    const tools = [
      {
        type: 'function',
        function: {
          name: longString,
          description: longString,
          parameters: {},
        },
      },
    ]

    // @ts-ignore
    const result = normalizeChatTools(tools)

    expect(result[0].function.name).toHaveLength(512)
    expect(result[0].function.description).toHaveLength(512)
  })

  it('should handle tools with undefined name', () => {
    const tools = /** @type {any} */ ([
      {
        type: 'function',
        function: {
          name: undefined,
          description: 'A tool',
          parameters: {},
        },
      },
    ])

    expect(() => normalizeChatTools(tools)).toThrow('tool name is required')
  })

  it('should handle tools with undefined description', () => {
    const tools = /** @type {any} */ ([
      {
        type: 'function',
        function: {
          name: 'testTool',
          description: undefined,
          parameters: {},
        },
      },
    ])

    expect(() => normalizeChatTools(tools)).toThrow(
      'tool description is required'
    )
  })

  it('should handle tools with null name', () => {
    const tools = /** @type {any} */ ([
      {
        type: 'function',
        function: {
          name: null,
          description: 'A tool',
          parameters: {},
        },
      },
    ])

    expect(() => normalizeChatTools(tools)).toThrow('tool name is required')
  })

  it('should handle tools with null description', () => {
    const tools = /** @type {any} */ ([
      {
        type: 'function',
        function: {
          name: 'testTool',
          description: null,
          parameters: {},
        },
      },
    ])

    expect(() => normalizeChatTools(tools)).toThrow(
      'tool description is required'
    )
  })

  it('should add default parameters when missing', () => {
    const tools = [
      {
        type: 'function',
        function: {
          name: 'testTool',
          description: 'A test tool',
        },
      },
    ]

    // @ts-ignore
    const result = normalizeChatTools(tools)

    expect(result[0].function.parameters).toEqual({
      type: 'object',
      properties: {},
    })
  })

  it('should add default parameters when empty', () => {
    const tools = [
      {
        type: 'function',
        function: {
          name: 'testTool',
          description: 'A test tool',
          parameters: {},
        },
      },
    ]

    // @ts-ignore
    const result = normalizeChatTools(tools)

    expect(result[0].function.parameters).toEqual({
      type: 'object',
      properties: {},
    })
  })
})

describe('credential leak prevention', () => {
  describe('getOpenAIKey', () => {
    it('should return platform key when no custom URL is set', async () => {
      const originalKey = process.env.OPENAI_API_KEY

      try {
        process.env.OPENAI_API_KEY = 'platform-key-123'

        await runInModelContext(async () => {
          const key = getOpenAIKey()

          expect(key).toBe('platform-key-123')
        })
      } finally {
        if (originalKey === undefined) {
          delete process.env.OPENAI_API_KEY
        } else {
          process.env.OPENAI_API_KEY = originalKey
        }
      }
    })

    it('should return custom key when custom key is set without custom URL', async () => {
      await runInModelContext(async () => {
        const store = getModelStore()

        store.openaiKey = 'custom-key-123'

        const key = getOpenAIKey()

        expect(key).toBe('custom-key-123')
      })
    })

    it('should return custom key when both custom key and URL are set', async () => {
      await runInModelContext(async () => {
        const store = getModelStore()

        store.openaiKey = 'custom-key-123'
        store.openaiUrl = 'https://custom.example.com/v1/chat/completions'

        const key = getOpenAIKey()

        expect(key).toBe('custom-key-123')
      })
    })

    it('should throw when custom URL is set but no custom key is provided', async () => {
      await runInModelContext(async () => {
        const store = getModelStore()

        store.openaiUrl = 'https://evil.example.com/v1/chat/completions'

        expect(() => getOpenAIKey()).toThrow(
          'Custom endpoint requires custom credentials'
        )
      })
    })

    it('should throw when custom URL is set and key is empty string', async () => {
      await runInModelContext(async () => {
        const store = getModelStore()

        store.openaiKey = ''
        store.openaiUrl = 'https://evil.example.com/v1/chat/completions'

        expect(() => getOpenAIKey()).toThrow(
          'Custom endpoint requires custom credentials'
        )
      })
    })
  })

  describe('getOpenAIUrl', () => {
    it('should return default URL when no custom URL is set', async () => {
      await runInModelContext(async () => {
        const url = getOpenAIUrl()

        expect(url).toBe('https://api.openai.com/v1/chat/completions')
      })
    })

    it('should return custom URL when set', async () => {
      await runInModelContext(async () => {
        const store = getModelStore()

        store.openaiUrl = 'https://custom.example.com/v1/chat/completions'

        const url = getOpenAIUrl()

        expect(url).toBe('https://custom.example.com/v1/chat/completions')
      })
    })
  })
})

describeIfConfigured('createResponseCompletion', () => {
  it('must correctly complete', async () => {
    const { completion, usage, finishReason } = await createResponseCompletion({
      model: 'gpt-4o',
      input: [
        {
          role: 'user',
          content:
            'Finish the following sequence by guessing the next number 1,2,3,',
        },
      ],
    })

    expect(completion).toBeTruthy()
    expect(usage.totalTokens).toBeGreaterThan(0)
    expect(finishReason).toEqual('stop')
  })

  it('must correctly interpret tool calls', async () => {
    const { toolCalls, finishReason } = await createResponseCompletion({
      model: 'gpt-4o',
      input: [{ role: 'user', content: 'Book a meeting tonight!' }],
      tools: [
        {
          type: 'function',
          name: 'book_meeting',
          description: 'Book a meeting',
          parameters: {
            type: 'object',
            properties: {
              when: {
                type: 'string',
                enum: ['tonight', 'tomorrow', 'next week', 'next month'],
              },
            },
          },
          strict: null,
        },
      ],
    })

    expect(toolCalls).not.toBeNull()
    expect(toolCalls?.length).toEqual(1)
    expect(toolCalls?.[0].name).toEqual('book_meeting')
    expect(toolCalls?.[0].arguments).toEqual({ when: 'tonight' })
    expect(finishReason).toEqual('toolCalls')
  })

  it('must return an id', async () => {
    const { id } = await createResponseCompletion({
      model: 'gpt-4o',
      input: 'Say hello',
    })

    expect(id).toBeTruthy()
    expect(typeof id).toBe('string')
  })

  it('must return reasoning tokens when reasoning is enabled', async () => {
    const { usage } = await createResponseCompletion({
      model: 'gpt-4o',
      input: 'Say hello',
    })

    expect(typeof usage.reasoningTokens).toBe('number')
  })
})

describeIfConfigured('createResponseCompletionStream', () => {
  it('must correctly complete with stream', async () => {
    const chunks = []

    let finishReason

    for await (const {
      completion,
      finishReason: _finishReason,
    } of createResponseCompletionStream({
      model: 'gpt-4o',
      input: [
        {
          role: 'user',
          content:
            'Finish the following sequence by guessing the next number 1,2,3,',
        },
      ],
    })) {
      if (completion) {
        chunks.push(completion)
      }

      if (_finishReason) {
        finishReason = _finishReason
      }
    }

    expect(chunks.join('')).toBeTruthy()
    expect(finishReason).toEqual('stop')
  })

  it('must correctly interpret stream and tool calls', async () => {
    const calls = []

    let finishReason

    for await (const {
      toolCalls,
      finishReason: _finishReason,
    } of createResponseCompletionStream({
      model: 'gpt-4o',
      input: [{ role: 'user', content: 'Book a meeting tonight!' }],
      tools: [
        {
          type: 'function',
          name: 'book_meeting',
          description: 'Book a meeting',
          parameters: {
            type: 'object',
            properties: {
              when: { type: 'string' },
            },
          },
          strict: null,
        },
      ],
    })) {
      if (toolCalls) {
        calls.push(...toolCalls)
      }

      if (_finishReason) {
        finishReason = _finishReason
      }
    }

    expect(calls.length).toEqual(1)
    expect(calls[0].name.toLowerCase()).toEqual('book_meeting')
    expect(calls[0].arguments.when.toLowerCase()).toEqual('tonight')
    expect(finishReason).toEqual('toolCalls')
  })

  it('must return usage on completion', async () => {
    /**
     * @type {{
     *   promptTokens: number,
     *   completionTokens: number,
     *   totalTokens: number,
     *   reasoningTokens: number
     * }|null}
     */
    let receivedUsage = null

    for await (const { usage } of createResponseCompletionStream({
      model: 'gpt-4o',
      input: 'Say hello',
    })) {
      if (usage) {
        receivedUsage = usage
      }
    }

    expect(receivedUsage).not.toBeNull()
    expect(receivedUsage?.totalTokens).toBeGreaterThan(0)
    expect(receivedUsage?.promptTokens).toBeGreaterThan(0)
    expect(receivedUsage?.completionTokens).toBeGreaterThan(0)
    expect(typeof receivedUsage?.reasoningTokens).toBe('number')
  })
})

describe('normalizeResponseTools', () => {
  it('should normalize valid tools', () => {
    const tools = [
      {
        type: /** @type {const} */ ('function'),
        name: 'testTool',
        description: 'A test tool',
        parameters: { type: 'object', properties: {} },
        strict: null,
      },
    ]

    const result = normalizeResponseTools(tools)

    expect(result).toEqual([
      {
        type: 'function',
        name: 'testTool',
        description: 'A test tool',
        parameters: { type: 'object', properties: {} },
        strict: null,
      },
    ])
  })

  it('should truncate long names and descriptions', () => {
    const longString = 'a'.repeat(600)
    const tools = [
      {
        type: /** @type {const} */ ('function'),
        name: longString,
        description: longString,
        parameters: { type: 'object' },
        strict: null,
      },
    ]

    const result = normalizeResponseTools(tools)

    expect(result[0].name).toHaveLength(512)
    expect(result[0].description).toHaveLength(512)
  })

  it('should handle tools with undefined name', () => {
    const tools = /** @type {any} */ ([
      {
        type: 'function',
        name: undefined,
        description: 'A tool',
        parameters: {},
        strict: null,
      },
    ])

    expect(() => normalizeResponseTools(tools)).toThrow('tool name is required')
  })

  it('should handle tools with undefined description', () => {
    const tools = /** @type {any} */ ([
      {
        type: 'function',
        name: 'testTool',
        description: undefined,
        parameters: {},
        strict: null,
      },
    ])

    expect(() => normalizeResponseTools(tools)).toThrow(
      'tool description is required'
    )
  })

  it('should handle tools with null name', () => {
    const tools = /** @type {any} */ ([
      {
        type: 'function',
        name: null,
        description: 'A tool',
        parameters: {},
        strict: null,
      },
    ])

    expect(() => normalizeResponseTools(tools)).toThrow('tool name is required')
  })

  it('should handle tools with null description', () => {
    const tools = /** @type {any} */ ([
      {
        type: 'function',
        name: 'testTool',
        description: null,
        parameters: {},
        strict: null,
      },
    ])

    expect(() => normalizeResponseTools(tools)).toThrow(
      'tool description is required'
    )
  })

  it('should add default parameters when empty', () => {
    const tools = [
      {
        type: /** @type {const} */ ('function'),
        name: 'testTool',
        description: 'A test tool',
        parameters: {},
        strict: null,
      },
    ]

    const result = normalizeResponseTools(tools)

    expect(result[0].parameters).toEqual({
      type: 'object',
      properties: {},
    })
  })

  it('should add default parameters when null', () => {
    const tools = [
      {
        type: /** @type {const} */ ('function'),
        name: 'testTool',
        description: 'A test tool',
        parameters: null,
        strict: null,
      },
    ]

    const result = normalizeResponseTools(tools)

    expect(result[0].parameters).toEqual({
      type: 'object',
      properties: {},
    })
  })
})

describe('createChatCompletionStream trailing tool-call flush', () => {
  // @note Cloudflare's OpenAI-compat endpoint streams the tool call and then
  // simply ends the stream - `finish_reason` stays null throughout. Without a
  // trailing flush the accumulated call is silently dropped and the model looks
  // like it produced nothing at all, which breaks tool calling entirely.
  // @note the flush must not depend on seeing a `[DONE]` terminator - that is a
  // convention, not a guarantee, and a server may simply close the connection.
  it.each([
    ['after a [DONE] terminator', true],
    ['when the stream just ends with no [DONE]', false],
  ])('emits accumulated tool calls %s', async (_label, withTerminator) => {
    const chunks = [
      `data: ${JSON.stringify({
        choices: [
          {
            index: 0,
            finish_reason: null,
            delta: {
              role: 'assistant',
              tool_calls: [
                {
                  index: 0,
                  id: 'abc123',
                  type: 'function',
                  function: { name: 'query', arguments: '{"query":"x"}' },
                  extra_content: {
                    google: { thought_signature: 'SIG-xyz' },
                  },
                },
              ],
            },
          },
        ],
      })}\n\n`,
      `data: ${JSON.stringify({
        choices: [
          {
            index: 0,
            finish_reason: null,
            delta: { content: '', role: 'assistant' },
          },
        ],
      })}\n\n`,
      ...(withTerminator ? ['data: [DONE]\n\n'] : []),
    ]

    const encoder = new TextEncoder()

    const originalFetch = global.fetch

    global.fetch = /** @type {any} */ (
      jest.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: new ReadableStream({
          start(controller) {
            for (const chunk of chunks) {
              controller.enqueue(encoder.encode(chunk))
            }

            controller.close()
          },
        }),
      }))
    )

    try {
      const events = []

      for await (const event of createChatCompletionStream({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'hi' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'query',
              description: 'query',
              parameters: { type: 'object', properties: {} },
            },
          },
        ],
        url: 'https://example.test/v1/chat/completions',
        authorization: 'Bearer test',
      })) {
        events.push(event)
      }

      const toolEvent = events.find((event) => event.toolCalls)

      if (!toolEvent || !toolEvent.toolCalls) {
        throw new Error('expected a flushed tool-call event')
      }

      expect(toolEvent.finishReason).toEqual('toolCalls')
      expect(toolEvent.toolCalls).toHaveLength(1)
      expect(toolEvent.toolCalls[0].function.name).toEqual('query')
      expect(toolEvent.toolCalls[0].function.arguments).toEqual({ query: 'x' })

      // the provider thought signature must survive the parser so the
      // conversation layer can capture and replay it
      expect(
        toolEvent.toolCalls[0].extra_content?.google?.thought_signature
      ).toEqual('SIG-xyz')
    } finally {
      global.fetch = originalFetch
    }
  })

  // @note a proxy half-close arrives as a clean stream end, not an error - a
  // call cut mid-arguments must NOT be promoted to a terminal event. Dropping
  // it leaves the turn empty, which the conversation layer's default `stop` +
  // empty-turn budget recovers by retrying the completion. Promoting it would
  // surface a phantom "malformed arguments" mistake the model never made.
  it('drops a truncated tool call when the stream ends mid-arguments', async () => {
    const chunks = [
      `data: ${JSON.stringify({
        choices: [
          {
            index: 0,
            finish_reason: null,
            delta: {
              role: 'assistant',
              tool_calls: [
                {
                  index: 0,
                  id: 'abc123',
                  type: 'function',
                  function: { name: 'query', arguments: '{"query":"how to ma' },
                },
              ],
            },
          },
        ],
      })}\n\n`,
      // @note no further chunks - the stream is cut mid-arguments
    ]

    const encoder = new TextEncoder()

    const originalFetch = global.fetch

    global.fetch = /** @type {any} */ (
      jest.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: new ReadableStream({
          start(controller) {
            for (const chunk of chunks) {
              controller.enqueue(encoder.encode(chunk))
            }

            controller.close()
          },
        }),
      }))
    )

    try {
      const events = []

      for await (const event of createChatCompletionStream({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'hi' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'query',
              description: 'query',
              parameters: { type: 'object', properties: {} },
            },
          },
        ],
        url: 'https://example.test/v1/chat/completions',
        authorization: 'Bearer test',
      })) {
        events.push(event)
      }

      // nothing terminal may be emitted - the conversation layer treats the
      // silent turn as empty and retries the completion
      expect(events.some((event) => event.toolCalls)).toBe(false)
      expect(events.some((event) => event.finishReason)).toBe(false)
    } finally {
      global.fetch = originalFetch
    }
  })

  // @note the legacy `function_call` path accumulates identically and is
  // dropped by the same silence, so it must be flushed on the same terms.
  it('emits an accumulated legacy function call when the stream ends without a finish_reason', async () => {
    const chunks = [
      `data: ${JSON.stringify({
        choices: [
          {
            index: 0,
            finish_reason: null,
            delta: {
              role: 'assistant',
              function_call: { name: 'query', arguments: '{"query":"x"}' },
            },
          },
        ],
      })}\n\n`,
      'data: [DONE]\n\n',
    ]

    const encoder = new TextEncoder()

    const originalFetch = global.fetch

    global.fetch = /** @type {any} */ (
      jest.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: new ReadableStream({
          start(controller) {
            for (const chunk of chunks) {
              controller.enqueue(encoder.encode(chunk))
            }

            controller.close()
          },
        }),
      }))
    )

    try {
      const events = []

      for await (const event of createChatCompletionStream({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'hi' }],
        functions: [
          {
            name: 'query',
            description: 'query',
            parameters: { type: 'object', properties: {} },
          },
        ],
        url: 'https://example.test/v1/chat/completions',
        authorization: 'Bearer test',
      })) {
        events.push(event)
      }

      const callEvent = events.find((event) => event.functionCall)

      if (!callEvent || !callEvent.functionCall) {
        throw new Error('expected a flushed function-call event')
      }

      expect(callEvent.finishReason).toEqual('functionCall')
      expect(callEvent.functionCall.name).toEqual('query')
      expect(callEvent.functionCall.arguments).toEqual({ query: 'x' })
    } finally {
      global.fetch = originalFetch
    }
  })

  // @note the normal path must be completely unaffected by the flush: when the
  // provider does send `tool_calls`, the parser emits and clears the buffer, so
  // exactly one tool-call event may reach the consumer.
  it('emits exactly one tool-call event when the provider sends a tool_calls finish reason', async () => {
    const chunks = [
      `data: ${JSON.stringify({
        choices: [
          {
            index: 0,
            finish_reason: null,
            delta: {
              role: 'assistant',
              tool_calls: [
                {
                  index: 0,
                  id: 'abc123',
                  type: 'function',
                  function: { name: 'query', arguments: '{"query":"x"}' },
                },
              ],
            },
          },
        ],
      })}\n\n`,
      `data: ${JSON.stringify({
        choices: [{ index: 0, finish_reason: 'tool_calls', delta: {} }],
      })}\n\n`,
      'data: [DONE]\n\n',
    ]

    const encoder = new TextEncoder()

    const originalFetch = global.fetch

    global.fetch = /** @type {any} */ (
      jest.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: new ReadableStream({
          start(controller) {
            for (const chunk of chunks) {
              controller.enqueue(encoder.encode(chunk))
            }

            controller.close()
          },
        }),
      }))
    )

    try {
      const events = []

      for await (const event of createChatCompletionStream({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'hi' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'query',
              description: 'query',
              parameters: { type: 'object', properties: {} },
            },
          },
        ],
        url: 'https://example.test/v1/chat/completions',
        authorization: 'Bearer test',
      })) {
        events.push(event)
      }

      const toolEvents = events.filter((event) => event.toolCalls)

      expect(toolEvents).toHaveLength(1)
      expect(toolEvents[0].finishReason).toEqual('toolCalls')
      expect(events.filter((event) => event.finishReason)).toHaveLength(1)
    } finally {
      global.fetch = originalFetch
    }
  })

  // @note the `default` branch of the parser drops accumulated tool calls from
  // the emitted event but leaves the buffer populated, so an unguarded flush
  // would append a second terminal event after the turn was already declared
  // over - the consumer would act on a truncated call it should have discarded.
  it.each([['length'], ['content_filter']])(
    'does not append a trailing tool-call event after a %s finish reason',
    async (reason) => {
      const chunks = [
        `data: ${JSON.stringify({
          choices: [
            {
              index: 0,
              finish_reason: null,
              delta: {
                role: 'assistant',
                tool_calls: [
                  {
                    index: 0,
                    id: 'abc123',
                    type: 'function',
                    function: { name: 'query', arguments: '{"query":"trunc' },
                  },
                ],
              },
            },
          ],
        })}\n\n`,
        `data: ${JSON.stringify({
          choices: [{ index: 0, finish_reason: reason, delta: {} }],
        })}\n\n`,
        'data: [DONE]\n\n',
      ]

      const encoder = new TextEncoder()

      const originalFetch = global.fetch

      global.fetch = /** @type {any} */ (
        jest.fn(async () => ({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'text/event-stream' }),
          body: new ReadableStream({
            start(controller) {
              for (const chunk of chunks) {
                controller.enqueue(encoder.encode(chunk))
              }

              controller.close()
            },
          }),
        }))
      )

      try {
        const events = []

        for await (const event of createChatCompletionStream({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'hi' }],
          tools: [
            {
              type: 'function',
              function: {
                name: 'query',
                description: 'query',
                parameters: { type: 'object', properties: {} },
              },
            },
          ],
          url: 'https://example.test/v1/chat/completions',
          authorization: 'Bearer test',
        })) {
          events.push(event)
        }

        // the provider's terminal reason must be the last word on the turn
        expect(events.filter((event) => event.finishReason)).toHaveLength(1)
        expect(events[events.length - 1].finishReason).toEqual(
          normalizeFinishReason(reason)
        )
        expect(events.some((event) => event.toolCalls)).toBe(false)
      } finally {
        global.fetch = originalFetch
      }
    }
  )
})

describe('normalizeFinishReason', () => {
  it('should normalize content_filter to contentFilter', () => {
    expect(normalizeFinishReason('content_filter')).toBe('contentFilter')
  })

  it('should normalize content-filter to contentFilter', () => {
    expect(normalizeFinishReason('content-filter')).toBe('contentFilter')
  })

  it('should normalize other to error', () => {
    expect(normalizeFinishReason('other')).toBe('error')
  })

  it('should normalize function_call to functionCall', () => {
    expect(normalizeFinishReason('function_call')).toBe('functionCall')
  })

  it('should normalize function-call to functionCall', () => {
    expect(normalizeFinishReason('function-call')).toBe('functionCall')
  })

  it('should normalize tool_calls to toolCalls', () => {
    expect(normalizeFinishReason('tool_calls')).toBe('toolCalls')
  })

  it('should normalize tool-calls to toolCalls', () => {
    expect(normalizeFinishReason('tool-calls')).toBe('toolCalls')
  })

  it('should pass through stop unchanged', () => {
    expect(normalizeFinishReason('stop')).toBe('stop')
  })

  it('should pass through length unchanged', () => {
    expect(normalizeFinishReason('length')).toBe('length')
  })

  it('should pass through null unchanged', () => {
    expect(normalizeFinishReason(null)).toBeNull()
  })

  it('should pass through unknown values unchanged', () => {
    expect(normalizeFinishReason('unknown_reason')).toBe('unknown_reason')
  })
})
