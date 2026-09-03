import {
  baseLanguageModel,
  imageModels,
  languageModels,
  videoModels,
} from '@/config/models'

import {
  convertLanguageModelTokenCount,
  getBaseImageModelTokenCount,
  getBaseLanguageModelTokenCount,
  getBaseVideoModelTokenCount,
  getImageModelTokenRatio,
  getVideoModelTokenRatio,
} from '@/lib/model.utils'
import { Usage } from '@/lib/usage.model'
import { recordLanguageTokenUsage } from '@/lib/usage.record'

jest.mock('@/config/models', () => {
  const actual = jest.requireActual('@/config/models')
  const base = actual.languageModels.base

  const languageModel = (tokenRatio) => ({
    ...base,
    provider: 'openai',
    family: 'gpt',
    pricing: {
      tokenRatio,
      inputTokenRatio: tokenRatio,
      outputTokenRatio: tokenRatio,
    },
  })

  return {
    ...actual,
    __esModule: true,
    languageModels: {
      ...actual.languageModels,
      'gpt-3.5-turbo': languageModel(0.0833),
      'gpt-4': languageModel(3.3333),
      'gpt-4o': languageModel(0.5),
      'gpt-4-turbo': languageModel(2),
      'gpt-5.4': languageModel(0.8333),
    },
    imageModels: {
      ...actual.imageModels,
      'gpt-image-1.5': {
        provider: 'openai',
        pricing: {
          tokenRatio: 1,
          inputTokenRatio: 2,
          outputTokenRatio: 3,
        },
      },
    },
    videoModels: {
      ...actual.videoModels,
      'veo-3.1': {
        provider: 'vercel',
        pricing: {
          tokenRatio: 1,
          inputTokenRatio: 2,
          outputTokenRatio: 3,
        },
      },
    },
  }
})

jest.mock('@/lib/usage.record', () => {
  return {
    recordLanguageTokenUsage: jest.fn(),
  }
})

jest.mock('@/lib/model.utils', () => ({
  ...jest.requireActual('@/lib/model.utils'),

  getBaseLanguageModelTokenCount: jest.fn(
    jest.requireActual('@/lib/model.utils').getBaseLanguageModelTokenCount
  ),
}))

describe('Usage', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('constructor and basic properties', () => {
    it('should initialize with zero base tokens', () => {
      const usage = new Usage()

      expect(usage.token).toBe(0)
    })

    it('should initialize with hasRecorded as false', () => {
      const usage = new Usage()

      expect(usage.hasRecorded).toBe(false)
    })
  })

  describe('hasRecorded', () => {
    it('should return false before recording', () => {
      const usage = new Usage()

      usage.addTokens(100, baseLanguageModel)

      expect(usage.hasRecorded).toBe(false)
    })

    it('should return true after recording once', async () => {
      const usage = new Usage()

      usage.addTokens(100, baseLanguageModel)

      await usage.recordBaseTokens({ user: { id: 'user123' } })

      expect(usage.hasRecorded).toBe(true)
    })

    it('should remain true after recording multiple times', async () => {
      const usage = new Usage()

      usage.addTokens(100, baseLanguageModel)

      await usage.recordBaseTokens({ user: { id: 'user123' } })

      expect(usage.hasRecorded).toBe(true)

      await usage.recordBaseTokens({ user: { id: 'user123' } })

      expect(usage.hasRecorded).toBe(true)
    })
  })

  describe('addTokens', () => {
    it('should add the correct number of tokens to the usage', () => {
      const usage = new Usage()

      usage.addTokens(100, baseLanguageModel)

      expect(usage.token).toBe(100)

      const model = 'gpt-4o'

      const tokenRatio = languageModels[model].pricing.tokenRatio

      expect(usage.token).toBe(100)

      expect(baseLanguageModel !== model).toBe(true)

      expect(
        languageModels[baseLanguageModel].pricing.tokenRatio >
          languageModels[model].pricing.tokenRatio
      ).toBe(true)

      usage.addTokens(50, model)

      expect(usage.token).toBe(Math.round(100 + 50 * tokenRatio))
    })

    it('should handle zero tokens', () => {
      const usage = new Usage()

      usage.addTokens(0, 'gpt-4o')

      expect(usage.token).toBe(0)
    })

    it('should handle negative tokens', () => {
      const usage = new Usage()

      usage.addTokens(-10, 'base')

      expect(usage.token).toBe(0)
    })

    it('should accumulate tokens from multiple additions', () => {
      const usage = new Usage()

      usage.addTokens(50, 'gpt-4')
      usage.addTokens(30, 'gpt-3.5-turbo')
      usage.addTokens(20, baseLanguageModel)

      let sum = 0

      sum += Math.round(50 * 3.3333)
      sum += Math.round(30 * 0.0833)
      sum += Math.round(20 * 1)

      expect(usage.token).toBe(sum)
      expect(usage.items.length).toBe(3)
    })

    it('should use getBaseLanguageModelTokenCount correctly', () => {
      const usage = new Usage()

      usage.addTokens(100, 'gpt-4')

      expect(getBaseLanguageModelTokenCount).toHaveBeenCalledWith(
        'gpt-4',
        100,
        'default'
      )

      expect(usage.token).toBe(Math.round(100 * 3.3333))
    })
  })

  describe('addVideoTokens', () => {
    it('calibrates raw video tokens into base tokens using the model ratio', () => {
      const usage = new Usage()
      const ratio = videoModels['veo-3.1'].pricing.tokenRatio

      usage.addVideoTokens(4, 'veo-3.1')

      expect(usage.token).toBe(Math.round(4 * ratio))
    })

    it('uses the inputTokenRatio for type "input"', () => {
      const usage = new Usage()
      const ratio = videoModels['veo-3.1'].pricing.inputTokenRatio

      usage.addVideoTokens(3, 'veo-3.1', 'input')

      expect(usage.token).toBe(Math.round(3 * ratio))
    })

    it('uses the outputTokenRatio for type "output"', () => {
      const usage = new Usage()
      const ratio = videoModels['veo-3.1'].pricing.outputTokenRatio

      usage.addVideoTokens(4, 'veo-3.1', 'output')

      expect(usage.token).toBe(Math.round(4 * ratio))
    })

    it('pushes a line item with the calibrated debit, raw tokens, model, type and ratio', () => {
      const usage = new Usage()
      const ratio = videoModels['veo-3.1'].pricing.outputTokenRatio
      const debit = Math.max(1, Math.round(4 * ratio))

      usage.addVideoTokens(4, 'veo-3.1', 'output')

      expect(usage.items).toEqual([
        {
          tokens: 4,
          model: 'veo-3.1',
          type: 'output',
          debit,
          ratio,
        },
      ])
    })

    it('accumulates separate input and output line items', () => {
      const usage = new Usage()
      const inputRatio = videoModels['veo-3.1'].pricing.inputTokenRatio
      const outputRatio = videoModels['veo-3.1'].pricing.outputTokenRatio

      usage.addVideoTokens(2, 'veo-3.1', 'input')
      usage.addVideoTokens(4, 'veo-3.1', 'output')

      expect(usage.token).toBe(
        Math.round(2 * inputRatio) + Math.round(4 * outputRatio)
      )
      expect(usage.items).toHaveLength(2)
      expect(usage.items[0]).toMatchObject({ tokens: 2, type: 'input' })
      expect(usage.items[1]).toMatchObject({ tokens: 4, type: 'output' })
    })

    it('is a no-op for zero tokens', () => {
      const usage = new Usage()

      usage.addVideoTokens(0, 'veo-3.1', 'output')

      expect(usage.token).toBe(0)
      expect(usage.items).toEqual([])
    })

    it('is a no-op for negative tokens', () => {
      const usage = new Usage()

      usage.addVideoTokens(-5, 'veo-3.1', 'output')

      expect(usage.token).toBe(0)
      expect(usage.items).toEqual([])
    })

    it('keeps debit at a minimum of 1 even when the raw rounding would drop it', () => {
      const usage = new Usage()

      // veo-3.1 has very large ratios (~11k) so even 1 raw token will yield a
      // large debit. We assert the line-item debit honours the Math.max(1,...)
      // guard regardless of raw rounding behaviour.
      usage.addVideoTokens(1, 'veo-3.1', 'output')

      expect(usage.items[0].debit).toBeGreaterThanOrEqual(1)
    })

    it('records as CHATBOTKIT_BASE_TOKEN (via baseLanguageModel) with calibrated count and line items', async () => {
      const usage = new Usage()
      const ratio = videoModels['veo-3.1'].pricing.outputTokenRatio
      const expectedBase = Math.round(4 * ratio)

      usage.addVideoTokens(4, 'veo-3.1', 'output')

      await usage.recordBaseTokens({
        user: { id: 'user-1' },
        meta: { reason: 'video/create' },
      })

      expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
        user: { id: 'user-1' },
        count: expectedBase,
        model: baseLanguageModel,
        meta: {
          reason: 'video/create',
          lineItems: [
            {
              tokens: 4,
              model: 'veo-3.1',
              type: 'output',
              debit: expectedBase,
              ratio,
            },
          ],
        },
      })
    })

    it('agrees with getBaseVideoModelTokenCount / getVideoModelTokenRatio for each type', () => {
      for (const type of ['default', 'input', 'output']) {
        const usage = new Usage()

        usage.addVideoTokens(7, 'veo-3.1', type)

        expect(usage.token).toBe(
          getBaseVideoModelTokenCount('veo-3.1', 7, type)
        )
        expect(usage.items[0].ratio).toBe(
          getVideoModelTokenRatio('veo-3.1', type)
        )
      }
    })
  })

  describe('addImageTokens', () => {
    it('calibrates raw image tokens into base tokens using the model ratio', () => {
      const usage = new Usage()
      const ratio = imageModels['gpt-image-1.5'].pricing.tokenRatio

      usage.addImageTokens(100, 'gpt-image-1.5')

      expect(usage.token).toBe(Math.round(100 * ratio))
    })

    it('uses the inputTokenRatio for type "input"', () => {
      const usage = new Usage()
      const ratio = imageModels['gpt-image-1.5'].pricing.inputTokenRatio

      usage.addImageTokens(100, 'gpt-image-1.5', 'input')

      expect(usage.token).toBe(Math.round(100 * ratio))
    })

    it('uses the outputTokenRatio for type "output"', () => {
      const usage = new Usage()
      const ratio = imageModels['gpt-image-1.5'].pricing.outputTokenRatio

      usage.addImageTokens(100, 'gpt-image-1.5', 'output')

      expect(usage.token).toBe(Math.round(100 * ratio))
    })

    it('pushes a line item with the calibrated debit, raw tokens, model, type and ratio', () => {
      const usage = new Usage()
      const ratio = imageModels['gpt-image-1.5'].pricing.outputTokenRatio
      const debit = Math.max(1, Math.round(100 * ratio))

      usage.addImageTokens(100, 'gpt-image-1.5', 'output')

      expect(usage.items).toEqual([
        {
          tokens: 100,
          model: 'gpt-image-1.5',
          type: 'output',
          debit,
          ratio,
        },
      ])
    })

    it('accumulates separate input and output line items', () => {
      const usage = new Usage()
      const inputRatio = imageModels['gpt-image-1.5'].pricing.inputTokenRatio
      const outputRatio = imageModels['gpt-image-1.5'].pricing.outputTokenRatio

      usage.addImageTokens(30, 'gpt-image-1.5', 'input')
      usage.addImageTokens(100, 'gpt-image-1.5', 'output')

      expect(usage.token).toBe(
        Math.round(30 * inputRatio) + Math.round(100 * outputRatio)
      )
      expect(usage.items).toHaveLength(2)
      expect(usage.items[0]).toMatchObject({ tokens: 30, type: 'input' })
      expect(usage.items[1]).toMatchObject({ tokens: 100, type: 'output' })
    })

    it('is a no-op for zero tokens', () => {
      const usage = new Usage()

      usage.addImageTokens(0, 'gpt-image-1.5', 'output')

      expect(usage.token).toBe(0)
      expect(usage.items).toEqual([])
    })

    it('is a no-op for negative tokens', () => {
      const usage = new Usage()

      usage.addImageTokens(-5, 'gpt-image-1.5', 'output')

      expect(usage.token).toBe(0)
      expect(usage.items).toEqual([])
    })

    it('records as CHATBOTKIT_BASE_TOKEN with calibrated count and line items', async () => {
      const usage = new Usage()
      const ratio = imageModels['gpt-image-1.5'].pricing.outputTokenRatio
      const expectedBase = Math.round(100 * ratio)

      usage.addImageTokens(100, 'gpt-image-1.5', 'output')

      await usage.recordBaseTokens({
        user: { id: 'user-1' },
        meta: { reason: 'image/create' },
      })

      expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
        user: { id: 'user-1' },
        count: expectedBase,
        model: baseLanguageModel,
        meta: {
          reason: 'image/create',
          lineItems: [
            {
              tokens: 100,
              model: 'gpt-image-1.5',
              type: 'output',
              debit: expectedBase,
              ratio,
            },
          ],
        },
      })
    })

    it('agrees with getBaseImageModelTokenCount / getImageModelTokenRatio for each type', () => {
      for (const type of ['default', 'input', 'output']) {
        const usage = new Usage()

        usage.addImageTokens(50, 'gpt-image-1.5', type)

        expect(usage.token).toBe(
          getBaseImageModelTokenCount('gpt-image-1.5', 50, type)
        )
        expect(usage.items[0].ratio).toBe(
          getImageModelTokenRatio('gpt-image-1.5', type)
        )
      }
    })
  })

  describe('addUsage', () => {
    it('should add another usage object tokens', () => {
      const otherUsage = new Usage()

      otherUsage.addTokens(50, 'gpt-4')

      const usage = new Usage()

      usage.addUsage(otherUsage)

      expect(usage.token).toBe(otherUsage.token)
    })

    it('should handle empty usage objects', () => {
      const otherUsage = new Usage()

      const usage = new Usage()

      usage.addUsage(otherUsage)

      expect(usage.token).toBe(0)
    })

    it('should handle multiple usage additions', () => {
      const usage1 = new Usage()

      usage1.addTokens(25, 'gpt-4')

      const usage2 = new Usage()

      usage2.addTokens(75, 'gpt-3.5-turbo')

      const usage = new Usage()

      usage.addUsage(usage1)
      usage.addUsage(usage2)

      expect(usage.token).toBe(usage1.token + usage2.token)
    })
  })

  describe('recordTokens', () => {
    let usage

    beforeEach(() => {
      usage = new Usage()

      usage.addTokens(100, baseLanguageModel)
    })

    it('should record the correct token amount with the default model', async () => {
      await usage.recordTokens({ user: { id: 'user123' } })

      expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
        user: { id: 'user123' },
        count: 100,
        model: baseLanguageModel,
        meta: {
          lineItems: [
            {
              model: 'base',
              tokens: 100,
              type: 'default',
              debit: 100,
              ratio: 1,
            },
          ],
        },
      })
    })

    it("should adjust token count based on the advanced model's token ratio", async () => {
      const model = 'gpt-4o'

      await usage.recordTokens({ user: { id: 'user123' }, model, meta: {} })

      expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
        user: { id: 'user123' },
        count: convertLanguageModelTokenCount(
          baseLanguageModel,
          usage.token,
          model
        ),
        model: model,
        meta: {
          lineItems: [
            {
              model: 'base',
              tokens: 100,
              type: 'default',
              debit: 100,
              ratio: 1,
            },
          ],
        },
      })
    })

    it('should handle usage with zero tokens', async () => {
      const newUsage = new Usage()

      newUsage.addTokens(0, 'gpt-3.5-turbo')

      await newUsage.recordTokens({ user: { id: 'user0' } })

      expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
        user: { id: 'user0' },
        count: 0,
        model: baseLanguageModel,
        meta: {
          lineItems: [],
        },
      })
    })

    it('should handle usage with negative tokens gracefully', async () => {
      const newUsage = new Usage()

      newUsage.addTokens(-50, 'gpt-3.5-turbo')

      await newUsage.recordTokens({ user: { id: 'userNeg' } })

      expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
        user: { id: 'userNeg' },
        count: 0,
        model: baseLanguageModel,
        meta: {
          lineItems: [],
        },
      })
    })

    it('should use provided model instead of default', async () => {
      const customModel = 'gpt-4-turbo'

      await usage.recordTokens({
        user: { id: 'user456' },
        model: customModel,
        meta: { custom: 'meta' },
      })

      expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
        user: { id: 'user456' },
        count: convertLanguageModelTokenCount(
          baseLanguageModel,
          usage.token,
          customModel
        ),
        model: customModel,
        meta: {
          lineItems: [
            {
              model: 'base',
              tokens: 100,
              type: 'default',
              debit: 100,
              ratio: 1,
            },
          ],
          custom: 'meta',
        },
      })
    })

    it('should handle undefined meta parameter', async () => {
      await usage.recordTokens({ user: { id: 'user789' }, model: 'gpt-4' })

      expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
        user: { id: 'user789' },
        count: expect.any(Number),
        model: 'gpt-4',
        meta: {
          lineItems: [
            {
              model: 'base',
              tokens: 100,
              type: 'default',
              debit: 100,
              ratio: 1,
            },
          ],
        },
      })
    })

    it('should preserve meta data', async () => {
      const meta = { sessionId: 'abc123', feature: 'chat' }

      await usage.recordTokens({
        user: { id: 'user999' },
        model: 'gpt-3.5-turbo',
        meta,
      })

      expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
        user: { id: 'user999' },
        count: expect.any(Number),
        model: 'gpt-3.5-turbo',
        meta: {
          lineItems: [
            {
              model: 'base',
              tokens: 100,
              type: 'default',
              debit: 100,
              ratio: 1,
            },
          ],
          ...meta,
        },
      })
    })
  })

  describe('toValue', () => {
    it('should return usage as value object', () => {
      const usage = new Usage()

      usage.addTokens(100, 'gpt-4')

      const result = usage.toValue()

      expect(result).toEqual({
        token: Math.round(100 * 3.3333),
      })
    })

    it('should return zero for empty usage', () => {
      const emptyUsage = new Usage()

      const result = emptyUsage.toValue()

      expect(result).toEqual({
        token: 0,
      })
    })

    it('should handle negative tokens', () => {
      const negativeUsage = new Usage()

      negativeUsage.addTokens(-100, 'gpt-4')

      const result = negativeUsage.toValue()

      expect(result).toEqual({
        token: 0,
      })
    })
  })

  describe('toTokenModelObject', () => {
    it('should return token model object with base model', () => {
      const usage = new Usage()

      usage.addTokens(100, baseLanguageModel)

      const result = usage.toTokenModelObject()

      expect(result).toEqual({
        token: 100,
        model: baseLanguageModel,
      })
    })

    it('should work with empty usage', () => {
      const emptyUsage = new Usage()

      const result = emptyUsage.toTokenModelObject()

      expect(result).toEqual({
        token: 0,
        model: baseLanguageModel,
      })
    })
  })

  describe('fromTokenAndModel static method', () => {
    it('should create usage from token count and model', () => {
      const result = Usage.fromTokenAndModel(200, 'gpt-4')

      expect(result).toBeInstanceOf(Usage)
      expect(result.token).toBe(Math.round(200 * 3.3333))
    })

    it('should handle zero tokens', () => {
      const result = Usage.fromTokenAndModel(0, 'gpt-3.5-turbo')

      expect(result.token).toBe(0)
    })

    it('should handle negative tokens', () => {
      const result = Usage.fromTokenAndModel(-50, 'gpt-4')

      expect(result.token).toBe(0)
    })

    it('should work with different models', () => {
      const result1 = Usage.fromTokenAndModel(100, 'gpt-4')
      const result2 = Usage.fromTokenAndModel(100, 'gpt-3.5-turbo')

      expect(result1.token).toBe(Math.round(100 * 3.3333))
      expect(result2.token).toBe(Math.round(100 * 0.0833))
    })
  })

  describe('createAndRecord static method', () => {
    it('should create usage and record tokens in a single call', async () => {
      const userId = 'user123'
      const token = 100
      const model = 'gpt-4'

      const usage = await Usage.createAndRecord({
        user: { id: userId },
        token,
        model,
      })

      expect(usage).toBeInstanceOf(Usage)
      expect(usage.token).toBe(Math.round(100 * 3.3333))
      expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
        user: { id: userId },
        count: Math.round(100 * 3.3333),
        model: 'base',
        meta: {
          lineItems: [
            {
              model: 'gpt-4',
              tokens: 100,
              type: 'default',
              debit: Math.round(100 * 3.3333),
              ratio: 3.3333,
            },
          ],
        },
      })
    })

    it('should handle createAndRecord with custom type', async () => {
      const userId = 'user456'
      const token = 200
      const model = 'gpt-4o'
      const type = 'input'

      const usage = await Usage.createAndRecord({
        user: { id: userId },
        token,
        model,
        type,
      })

      expect(usage).toBeInstanceOf(Usage)
      expect(recordLanguageTokenUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          user: { id: userId },
          model: 'base',
        })
      )
    })

    it('should handle createAndRecord with output type', async () => {
      const userId = 'user789'
      const token = 150
      const model = 'gpt-3.5-turbo'
      const type = 'output'

      const usage = await Usage.createAndRecord({
        user: { id: userId },
        token,
        model,
        type,
      })

      expect(usage).toBeInstanceOf(Usage)
      expect(recordLanguageTokenUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          user: { id: userId },
          model: 'base',
        })
      )
    })

    it('should handle createAndRecord with meta data', async () => {
      const userId = 'user999'
      const token = 50
      const model = 'gpt-4-turbo'
      const meta = { sessionId: 'abc123', feature: 'chat' }

      const usage = await Usage.createAndRecord({
        user: { id: userId },
        token,
        model,
        meta,
      })

      expect(usage).toBeInstanceOf(Usage)
      expect(recordLanguageTokenUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          user: { id: userId },
          model: 'base',
          meta: expect.objectContaining({
            sessionId: 'abc123',
            feature: 'chat',
          }),
        })
      )
    })

    it('should handle createAndRecord with zero tokens', async () => {
      const userId = 'user000'
      const token = 0
      const model = 'gpt-4'

      const usage = await Usage.createAndRecord({
        user: { id: userId },
        token,
        model,
      })

      expect(usage).toBeInstanceOf(Usage)
      expect(usage.token).toBe(0)
      expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
        user: { id: userId },
        count: 0,
        model: 'base',
        meta: {
          lineItems: [],
        },
      })
    })

    it('should handle createAndRecord with negative tokens', async () => {
      const userId = 'userNeg'
      const token = -100
      const model = 'gpt-3.5-turbo'

      const usage = await Usage.createAndRecord({
        user: { id: userId },
        token,
        model,
      })

      expect(usage).toBeInstanceOf(Usage)
      expect(usage.token).toBe(0)
      expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
        user: { id: userId },
        count: 0,
        model: 'base',
        meta: {
          lineItems: [],
        },
      })
    })

    it('should handle createAndRecord with base model', async () => {
      const userId = 'userBase'
      const token = 100
      const model = baseLanguageModel

      const usage = await Usage.createAndRecord({
        user: { id: userId },
        token,
        model,
      })

      expect(usage).toBeInstanceOf(Usage)
      expect(usage.token).toBe(100)
      expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
        user: { id: userId },
        count: 100,
        model: baseLanguageModel,
        meta: {
          lineItems: [
            {
              model: 'base',
              tokens: 100,
              type: 'default',
              debit: 100,
              ratio: 1,
            },
          ],
        },
      })
    })

    it('should handle createAndRecord with all parameters', async () => {
      const userId = 'userFull'
      const token = 250
      const model = 'gpt-5.4'
      const type = 'output'
      const meta = {
        conversationId: 'conv123',
        messageId: 'msg456',
        feature: 'completion',
      }

      const usage = await Usage.createAndRecord({
        user: { id: userId },
        token,
        model,
        type,
        meta,
      })

      expect(usage).toBeInstanceOf(Usage)
      expect(usage.token).toBeGreaterThan(0)
      expect(recordLanguageTokenUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          user: { id: userId },
          model: 'base',
          meta: expect.objectContaining({
            conversationId: 'conv123',
            messageId: 'msg456',
            feature: 'completion',
            lineItems: expect.any(Array),
          }),
        })
      )
    })

    it('should return the usage instance for further operations', async () => {
      const usage = await Usage.createAndRecord({
        userId: 'userChain',
        token: 100,
        model: 'gpt-4',
      })

      // Should be able to use the returned usage object
      expect(usage.token).toBeGreaterThan(0)
      expect(usage.toValue()).toEqual({ token: usage.token })
      expect(usage.toTokenModelObject()).toEqual({
        token: usage.token,
        model: baseLanguageModel,
      })
    })

    it('should handle async errors from recordLanguageTokenUsage', async () => {
      recordLanguageTokenUsage.mockRejectedValueOnce(
        new Error('Database error')
      )

      await expect(
        Usage.createAndRecord({
          userId: 'userError',
          token: 100,
          model: 'gpt-4',
        })
      ).rejects.toThrow('Database error')
    })
  })

  describe('integration tests', () => {
    it('should handle complex usage scenarios', () => {
      const complexUsage = new Usage()

      complexUsage.addTokens(100, 'gpt-4')
      complexUsage.addTokens(50, 'gpt-3.5-turbo')

      const additionalUsage = Usage.fromTokenAndModel(75, 'gpt-5.4')

      complexUsage.addUsage(additionalUsage)

      let sum = 0

      sum += Math.round(100 * 3.3333)
      sum += Math.round(50 * 0.0833)
      sum += Math.round(75 * 0.8333)

      expect(complexUsage.token).toBe(sum)

      expect(complexUsage.toValue()).toEqual({ token: sum })
      expect(complexUsage.toTokenModelObject()).toEqual({
        token: sum,
        model: baseLanguageModel,
      })
    })

    it('should maintain state across multiple operations', async () => {
      let sum = 0

      const statefulUsage = new Usage()

      expect(statefulUsage.token).toBe(sum)

      statefulUsage.addTokens(100, 'gpt-4')

      sum += Math.round(100 * 3.3333)

      expect(statefulUsage.token).toBe(sum)

      statefulUsage.addTokens(25, 'gpt-3.5-turbo')

      sum += Math.round(25 * 0.0833)

      expect(statefulUsage.token).toBe(sum)

      await statefulUsage.recordTokens('user123', 'gpt-4')

      expect(statefulUsage.token).toBe(sum)

      const otherUsage = Usage.fromTokenAndModel(50, 'gpt-5.4')

      statefulUsage.addUsage(otherUsage)

      sum += otherUsage.token

      expect(statefulUsage.token).toBe(sum)
    })
  })
})
