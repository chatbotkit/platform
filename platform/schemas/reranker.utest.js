import rerankerSchema from '@/schemas/reranker'

describe('rerankerSchema', () => {
  it('should validate null values', async () => {
    const result = await rerankerSchema.validateAsync(null)

    expect(result).toBeNull()
  })

  it('should validate empty strings', async () => {
    const result = await rerankerSchema.validateAsync('')

    expect(result).toBe('')
  })

  it('should validate undefined values', async () => {
    const result = await rerankerSchema.validateAsync(undefined)

    expect(result).toBeUndefined()
  })

  it('should validate valid reranker model strings', async () => {
    const validRerankers = ['rerank-v4-fast', 'rerank-v4-pro']

    for (const reranker of validRerankers) {
      const result = await rerankerSchema.validateAsync(reranker)

      expect(result).toBe(reranker)
    }
  })

  it('should validate a reranker model string with config', async () => {
    const result = await rerankerSchema.validateAsync(
      'rerank-v4-fast/maxRecords=50'
    )

    expect(result).toBe('rerank-v4-fast/maxRecords=50')
  })

  it('should reject invalid reranker model names', async () => {
    const invalidRerankers = [
      'invalid-reranker',
      'custom-reranker',
      'bge-v2-m3', // legacy reranker, removed
      'sprout-v0', // legacy reranker, removed
      'cohere-3.5', // legacy reranker, removed
      'rerank-v3.5', // removed: Bedrock-only on the gateway and broken there
    ]

    for (const reranker of invalidRerankers) {
      await expect(rerankerSchema.validateAsync(reranker)).rejects.toThrow(
        'must be one of'
      )
    }
  })

  it('should handle case sensitivity', async () => {
    await expect(
      rerankerSchema.validateAsync('RERANK-V4-FAST')
    ).rejects.toThrow('must be one of')
    await expect(
      rerankerSchema.validateAsync('Rerank-V4-Fast')
    ).rejects.toThrow('must be one of')
  })

  it('should reject non-string values', async () => {
    await expect(rerankerSchema.validateAsync(123)).rejects.toThrow()
  })

  it('should reject arrays', async () => {
    await expect(
      rerankerSchema.validateAsync(['rerank-v4-fast'])
    ).rejects.toThrow()
  })

  it('should reject objects', async () => {
    await expect(
      rerankerSchema.validateAsync({ name: 'rerank-v4-fast' })
    ).rejects.toThrow()
  })
})
