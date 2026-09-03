import { blobToDataUrl } from '@/lib/dataurl.blob'
import * as vertex from '@/lib/model.provider.vertex'
import {
  convertMessages,
  createChatCompletion,
  createChatCompletionStream,
} from '@/lib/model.provider.vertex.adaptor'
import { parseAndRevealLanguageModel } from '@/lib/model.utils'

import PDFDocument from 'pdfkit'

jest.mock('@/lib/model.provider.vertex', () => ({
  createChatCompletion: jest.fn(),
  createChatCompletionStream: jest.fn(),
}))

jest.mock('@/lib/model.utils', () => ({
  parseAndRevealLanguageModel: jest.fn(() => {
    throw new Error('model not found')
  }),
}))

jest.retryTimes(3)

const { hasLanguageModelsByProvider } = jest.requireActual('@/lib/model.utils')

const describeIfConfigured = hasLanguageModelsByProvider('vertex')
  ? describe
  : describe.skip

// @note pdfkit is used only for testing

/**
 * @param {string} text
 * @returns {Promise<Uint8Array>}
 */
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

describe('convertMessages', () => {
  it('should pass through plain text messages unchanged', async () => {
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ]

    const result = await convertMessages(messages)

    expect(result).toEqual(messages)
  })

  it('should pass through messages with text content arrays', async () => {
    const messages = [
      { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
    ]

    const result = await convertMessages(messages)

    expect(result).toEqual(messages)
  })

  it('should not mutate the original messages array', async () => {
    const messages = [{ role: 'user', content: 'Hello' }]
    const original = JSON.parse(JSON.stringify(messages))

    await convertMessages(messages)

    expect(messages).toEqual(original)
  })
})

describe('createChatCompletion', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    vertex.createChatCompletion.mockResolvedValue({ completion: 'response' })
  })

  it('should strip parallelToolCalls before calling underlying API', async () => {
    await createChatCompletion({
      model: 'gemini-2.0-flash',
      messages: [{ role: 'user', content: 'Test' }],
      parallelToolCalls: true,
    })

    expect(vertex.createChatCompletion).toHaveBeenCalledWith(
      expect.not.objectContaining({ parallelToolCalls: expect.anything() })
    )
  })

  it('should forward model and other options to underlying API', async () => {
    await createChatCompletion({
      model: 'gemini-2.0-flash',
      messages: [{ role: 'user', content: 'Hello' }],
      temperature: 0.5,
    })

    expect(vertex.createChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-2.0-flash', temperature: 0.5 })
    )
  })

  it('should return the result from the underlying API', async () => {
    const mockResult = { completion: 'hi', usage: {} }

    vertex.createChatCompletion.mockResolvedValue(mockResult)

    const result = await createChatCompletion({
      model: 'gemini-2.0-flash',
      messages: [{ role: 'user', content: 'Hello' }],
    })

    expect(result).toBe(mockResult)
  })

  it('should propagate errors from the underlying API', async () => {
    vertex.createChatCompletion.mockRejectedValue(new Error('API error'))

    await expect(
      createChatCompletion({ model: 'gemini-2.0-flash', messages: [] })
    ).rejects.toThrow('API error')
  })
})

describe('createChatCompletionStream', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    vertex.createChatCompletionStream.mockImplementation(async function* () {
      yield { completion: 'chunk' }
    })
  })

  it('should strip parallelToolCalls before streaming', async () => {
    for await (const _ of createChatCompletionStream({
      model: 'gemini-2.0-flash',
      messages: [{ role: 'user', content: 'Test' }],
      parallelToolCalls: true,
    })) {
      // drain
    }

    expect(vertex.createChatCompletionStream).toHaveBeenCalledWith(
      expect.not.objectContaining({ parallelToolCalls: expect.anything() })
    )
  })

  it('should yield chunks from the underlying stream', async () => {
    const mockChunks = [{ completion: 'Hello' }, { completion: ' world' }]

    vertex.createChatCompletionStream.mockImplementation(async function* () {
      for (const chunk of mockChunks) {
        yield chunk
      }
    })

    const chunks = []

    for await (const chunk of createChatCompletionStream({
      model: 'gemini-2.0-flash',
      messages: [{ role: 'user', content: 'Test' }],
    })) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual(mockChunks)
  })

  it('should propagate stream errors', async () => {
    vertex.createChatCompletionStream.mockImplementation(async function* () {
      throw new Error('stream error')
    })

    const gen = createChatCompletionStream({
      model: 'gemini-2.0-flash',
      messages: [],
    })

    await expect(gen.next()).rejects.toThrow('stream error')
  })
})

describe('providerModel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    vertex.createChatCompletion.mockResolvedValue({ completion: '' })
    vertex.createChatCompletionStream.mockImplementation(async function* () {})
    parseAndRevealLanguageModel.mockImplementation(() => {
      throw new Error('model not found')
    })
  })

  it('should use providerModel when set on the model config', async () => {
    parseAndRevealLanguageModel.mockReturnValue({
      config: { providerModel: 'actual-gemini-model-name' },
    })

    await createChatCompletion({ model: 'my-alias', messages: [] })

    expect(vertex.createChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'actual-gemini-model-name' })
    )
  })

  it('should fall back to the original model name when lookup throws', async () => {
    // default mock already throws

    await createChatCompletion({ model: 'gemini-2.0-flash', messages: [] })

    expect(vertex.createChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-2.0-flash' })
    )
  })

  it('should apply providerModel in streaming mode', async () => {
    parseAndRevealLanguageModel.mockReturnValue({
      config: { providerModel: 'actual-gemini-model-name' },
    })

    for await (const _ of createChatCompletionStream({
      model: 'my-alias',
      messages: [],
    })) {
      // drain
    }

    expect(vertex.createChatCompletionStream).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'actual-gemini-model-name' })
    )
  })
})

describeIfConfigured('createChatCompletion [integration]', () => {
  it('should be able to understand input files', async () => {
    const { completion, usage, finishReason } = await createChatCompletion({
      model: 'gemini-1.5-flash',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              file: {
                filename: 'characters.pdf',
                file_data: await blobToDataUrl(
                  new Blob([await text2pdf('Alice, Bob, Charlie')], {
                    type: 'application/pdf',
                  })
                ),
              },
            },
            {
              type: 'text',
              text: 'What are the names of the characters in the file?',
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
