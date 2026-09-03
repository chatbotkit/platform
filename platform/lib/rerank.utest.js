import { rerank as rerankVercel } from '@/lib/model.provider.vercel.adaptor'
import { rerank } from '@/lib/rerank'

jest.mock('@/lib/model.provider.vercel.adaptor', () => ({
  rerank: jest.fn(),
}))

const documents = [
  { id: 'a', text: 'alpha' },
  { id: 'b', text: 'beta' },
]

describe('rerank', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // @ts-ignore
    rerankVercel.mockResolvedValue({
      documents: [
        { id: 'b', index: 1, score: 0.9 },
        { id: 'a', index: 0, score: 0.2 },
      ],
      usage: {
        model: 'cohere/rerank-v4-fast',
        inputTokens: 0,
        outputTokens: 1,
      },
    })
  })

  it('dispatches to the vercel adaptor with the resolved model name and inputs', async () => {
    await rerank('q', documents, { model: 'rerank-v4-pro', topN: 2 })

    expect(rerankVercel).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'rerank-v4-pro',
        query: 'q',
        documents,
        topN: 2,
      })
    )
  })

  it('returns the reranked documents and stamps the resolved model onto usage', async () => {
    const result = await rerank('q', documents, { model: 'rerank-v4-pro' })

    expect(result.documents).toEqual([
      { id: 'b', index: 1, score: 0.9 },
      { id: 'a', index: 0, score: 0.2 },
    ])

    // @note usage.model is overwritten with the resolved platform model name
    // (not the provider-side id the adaptor reports) for consistent accounting.
    expect(result.usage).toEqual({
      model: 'rerank-v4-pro',
      inputTokens: 0,
      outputTokens: 1,
    })
  })

  it('falls back to the default rerank model when none is provided', async () => {
    await rerank('q', documents)

    expect(rerankVercel).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'rerank-v4-fast' })
    )
  })
})
