import _fetch from '@/lib/fetch'
import { rerank } from '@/lib/model.provider.vercel'

jest.mock('@/lib/fetch', () => {
  const actual = jest.fn()

  // @ts-ignore
  actual.withRetry = jest.fn((fn) => fn)
  // @ts-ignore
  actual.withTimeout = jest.fn((fn) => fn)
  // @ts-ignore
  actual.withBodyTimeout = jest.fn((fn) => fn)

  return {
    __esModule: true,
    default: actual,
    // @ts-ignore
    withRetry: actual.withRetry,
    // @ts-ignore
    withTimeout: actual.withTimeout,
    // @ts-ignore
    withBodyTimeout: actual.withBodyTimeout,
  }
})

jest.mock('@/lib/model.context', () => ({
  getSafeModelStore: () => ({}),
}))

jest.mock('@/lib/model.provider.openai', () => ({
  createChatCompletion: jest.fn(),
  createChatCompletionStream: jest.fn(),
  throwOpenAIError: jest.fn(),
}))

function mockRerankResponse(ranking) {
  return {
    ok: true,
    json: async () => ({ ranking }),
  }
}

const documents = [
  { id: 'a', text: 'Paris is the capital of France.' },
  { id: 'b', text: 'Berlin is the capital of Germany.' },
  { id: 'c', text: 'Madrid is the capital of Spain.' },
]

describe('rerank', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    process.env.VERCEL_MODELS_API_KEY = 'test-vercel-key'

    // @ts-ignore
    _fetch.mockResolvedValue(
      mockRerankResponse([
        { index: 2, relevanceScore: 0.9 },
        { index: 0, relevanceScore: 0.1 },
      ])
    )
  })

  it('must map gateway ranking indices back to document ids', async () => {
    const result = await rerank({
      query: 'What is the capital of France?',
      documents,
      model: 'cohere/rerank-v4-fast',
    })

    expect(result.documents).toEqual([
      { id: 'c', index: 2, score: 0.9 },
      { id: 'a', index: 0, score: 0.1 },
    ])
  })

  it('must send the tagged document object, query and topN to the reranking model', async () => {
    await rerank({
      query: 'What is the capital of France?',
      documents,
      model: 'cohere/rerank-v4-fast',
      topN: 2,
    })

    const [url, init] = _fetch.mock.calls[0]

    expect(url).toBe('https://ai-gateway.vercel.sh/v4/ai/reranking-model')
    expect(init.headers['ai-model-id']).toBe('cohere/rerank-v4-fast')
    expect(init.headers['ai-reranking-model-specification-version']).toBe('4')

    // @note the gateway reranking-model protocol takes the candidates as a
    // tagged object ({ type: 'text', values: string[] }), not a bare string
    // array - see lib/model.provider.vercel.ts rerank().
    expect(JSON.parse(init.body)).toEqual({
      query: 'What is the capital of France?',
      documents: {
        type: 'text',
        values: [
          'Paris is the capital of France.',
          'Berlin is the capital of Germany.',
          'Madrid is the capital of Spain.',
        ],
      },
      topN: 2,
    })
  })

  it('must forward model options as provider options', async () => {
    await rerank({
      query: 'q',
      documents,
      model: 'cohere/rerank-v4-fast',
      modelOptions: { cohere: { maxTokensPerDocument: 4096 } },
    })

    expect(JSON.parse(_fetch.mock.calls[0][1].body)).toEqual(
      expect.objectContaining({
        providerOptions: { cohere: { maxTokensPerDocument: 4096 } },
      })
    )
  })

  it('must bill a single search unit per request regardless of document count', async () => {
    const result = await rerank({
      query: 'q',
      documents,
      model: 'cohere/rerank-v4-fast',
    })

    expect(result.usage).toEqual({
      model: 'cohere/rerank-v4-fast',
      inputTokens: 0,
      outputTokens: 1,
    })
  })

  it('must drop out-of-range ranking indices', async () => {
    // @ts-ignore
    _fetch.mockResolvedValue(
      mockRerankResponse([
        { index: 5, relevanceScore: 0.99 },
        { index: 1, relevanceScore: 0.4 },
      ])
    )

    const result = await rerank({
      query: 'q',
      documents,
      model: 'cohere/rerank-v4-fast',
    })

    expect(result.documents).toEqual([{ id: 'b', index: 1, score: 0.4 }])
  })

  it('must short-circuit empty documents without calling the gateway', async () => {
    const result = await rerank({
      query: 'q',
      documents: [],
      model: 'cohere/rerank-v4-fast',
    })

    expect(_fetch).not.toHaveBeenCalled()

    expect(result).toEqual({
      documents: [],
      usage: {
        model: 'cohere/rerank-v4-fast',
        inputTokens: 0,
        outputTokens: 0,
      },
    })
  })
})
