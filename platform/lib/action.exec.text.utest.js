import { executeTextAction } from '@/lib/action.exec.text'
import { accountLimitsOk } from '@/lib/limit.core'
import { logEvent } from '@/lib/log'
import { execPrompt } from '@/lib/prompt'
import { recordLanguageTokenUsage } from '@/lib/usage.record'
import { fastGetUserById } from '@/lib/user.get'

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

    defaultLanguageModel: 'gpt-3.5-turbo',

    // @note add Claude models so tests don't depend on a vercel credential
    languageModels: {
      ...actual.languageModels,

      'gpt-3.5-turbo': languageModel(0.0833),
      'gpt-4': languageModel(3.3333),
      'gpt-4o': languageModel(0.5),

      'claude-3.7-sonnet': {
        pricing: { tokenRatio: 1.0 },
        provider: 'vercel',
      },

      'claude-3.5-sonnet': {
        deprecated: true,
        proxyToModel: 'claude-3.7-sonnet',
        pricing: { tokenRatio: 1.0 },
        provider: 'vercel',
      },

      'claude-4.5-sonnet': {
        pricing: { tokenRatio: 1.0 },
        provider: 'vercel',
      },
    },
  }
})

jest.mock('@/lib/limit.core', () => ({
  accountLimitsOk: jest.fn(),
}))

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

jest.mock('@/lib/prompt', () => ({
  execPrompt: jest.fn(),
}))

jest.mock('@/lib/usage.record', () => ({
  recordLanguageTokenUsage: jest.fn(),
}))

jest.mock('@/lib/user.get', () => ({
  fastGetUserById: jest.fn(),
}))

describe('action.exec.text', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('executeTextAction', () => {
    const mockOptions = {
      userId: 'user-123',
      linkedResources: {},
      contextResources: {
        blueprintId: 'blueprint-456',
        skillsetId: 'skillset-789',
        abilityId: 'ability-012',
      },
      usageMeta: {
        botId: 'bot-123',
        conversationId: 'conv-456',
      },
    }

    beforeEach(() => {
      // Default mocks for successful execution
      fastGetUserById.mockResolvedValue({ id: 'user-123' })
      accountLimitsOk.mockResolvedValue(true)
      logEvent.mockResolvedValue(undefined)
      recordLanguageTokenUsage.mockResolvedValue(undefined)
    })

    describe('user validation', () => {
      it('should throw error when user not found', async () => {
        fastGetUserById.mockResolvedValue(null)

        await expect(
          executeTextAction('Generate text', {}, mockOptions)
        ).rejects.toThrow('User not found')
      })

      it('should return error when account limits exceeded', async () => {
        accountLimitsOk.mockResolvedValue(false)

        const result = await executeTextAction('Generate text', {}, mockOptions)

        expect(result).toEqual({
          error: 'You have reached your token limit.',
        })
      })
    })

    describe('text generation', () => {
      it('should generate text using default model', async () => {
        const input = 'Write a story about a robot'
        const params = {}

        execPrompt.mockResolvedValue({
          completion:
            'Once upon a time, there was a friendly robot named R2...',
          tokensUsed: 150,
          modelUsed: 'gpt-3.5-turbo',
        })

        const result = await executeTextAction(input, params, mockOptions)

        expect(result).toEqual({
          result: 'Once upon a time, there was a friendly robot named R2...',
        })

        expect(execPrompt).toHaveBeenCalledWith(
          {
            prompt: input,
            model: 'gpt-3.5-turbo',
            user: 'user-123',
          },
          params
        )

        expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          count: expect.any(Number),
          model: 'base',
          meta: {
            botId: 'bot-123',
            conversationId: 'conv-456',
            reason: 'action/text',
            lineItems: [
              {
                debit: expect.any(Number),
                model: 'gpt-3.5-turbo',
                tokens: expect.any(Number),
                ratio: expect.any(Number),
                type: 'default',
              },
            ],
          },
          references: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
          },
        })
      })

      it('should generate text using custom model', async () => {
        const input = 'Explain quantum physics'
        const params = { model: 'gpt-4' }

        execPrompt.mockResolvedValue({
          completion:
            'Quantum physics is the branch of physics that studies...',
          tokensUsed: 200,
          modelUsed: 'gpt-4',
        })

        const result = await executeTextAction(input, params, mockOptions)

        expect(result).toEqual({
          result: 'Quantum physics is the branch of physics that studies...',
        })

        expect(execPrompt).toHaveBeenCalledWith(
          {
            prompt: input,
            model: 'gpt-4',
            user: 'user-123',
          },
          params
        )

        expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          count: expect.any(Number),
          model: 'base',
          meta: {
            botId: 'bot-123',
            conversationId: 'conv-456',
            reason: 'action/text',
            lineItems: [
              {
                debit: expect.any(Number),
                model: 'gpt-4',
                tokens: expect.any(Number),
                ratio: expect.any(Number),
                type: 'default',
              },
            ],
          },
          references: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
          },
        })
      })

      it('should handle empty input', async () => {
        const input = ''
        const params = {}

        execPrompt.mockResolvedValue({
          completion: 'I need more information to provide a helpful response.',
          tokensUsed: 50,
          modelUsed: 'gpt-3.5-turbo',
        })

        const result = await executeTextAction(input, params, mockOptions)

        expect(result).toEqual({
          result: 'I need more information to provide a helpful response.',
        })

        expect(execPrompt).toHaveBeenCalledWith(
          {
            prompt: '',
            model: 'gpt-3.5-turbo',
            user: 'user-123',
          },
          params
        )
      })

      it('should handle very long input', async () => {
        const longInput =
          'Write a detailed analysis of '.repeat(100) +
          'artificial intelligence'
        const params = {}

        execPrompt.mockResolvedValue({
          completion:
            'Artificial intelligence is a complex field that encompasses...',
          tokensUsed: 500,
          modelUsed: 'gpt-3.5-turbo',
        })

        const result = await executeTextAction(longInput, params, mockOptions)

        expect(result).toEqual({
          result:
            'Artificial intelligence is a complex field that encompasses...',
        })

        expect(execPrompt).toHaveBeenCalledWith(
          {
            prompt: longInput,
            model: 'gpt-3.5-turbo',
            user: 'user-123',
          },
          params
        )

        expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          count: expect.any(Number),
          model: 'base',
          meta: expect.objectContaining({
            reason: 'action/text',
            lineItems: [
              {
                debit: expect.any(Number),
                model: 'gpt-3.5-turbo',
                tokens: expect.any(Number),
                ratio: expect.any(Number),
                type: 'default',
              },
            ],
          }),
          references: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
          },
        })
      })

      it('should handle very long output with debug truncation', async () => {
        const input = 'Write a long essay'
        const params = {}

        const longCompletion =
          'This is a very long essay that '.repeat(50) +
          'continues for many paragraphs...'

        execPrompt.mockResolvedValue({
          completion: longCompletion,
          tokensUsed: 800,
          modelUsed: 'gpt-3.5-turbo',
        })

        const result = await executeTextAction(input, params, mockOptions)

        expect(result).toEqual({
          result: longCompletion,
        })

        // Debug should truncate output to 256 characters (but result should be full)
        expect(result.result.length).toBeGreaterThan(256)
      })
    })

    describe('parameter handling', () => {
      it('should pass all parameters to execPrompt', async () => {
        const input = 'Generate creative text'
        const params = {
          model: 'gpt-4',
          temperature: 0.8,
          maxTokens: 500,
          topP: 0.9,
          frequencyPenalty: 0.5,
          presencePenalty: 0.3,
          customParameter: 'custom-value',
        }

        execPrompt.mockResolvedValue({
          completion: 'Creative text generated with custom parameters...',
          tokensUsed: 300,
          modelUsed: 'gpt-4',
        })

        const result = await executeTextAction(input, params, mockOptions)

        expect(result).toEqual({
          result: 'Creative text generated with custom parameters...',
        })

        expect(execPrompt).toHaveBeenCalledWith(
          {
            prompt: input,
            model: 'gpt-4',
            user: 'user-123',
          },
          params
        )
      })

      it('should handle null model parameter', async () => {
        const input = 'Generate text'
        const params = { model: null }

        execPrompt.mockResolvedValue({
          completion: 'Text generated with default model...',
          tokensUsed: 100,
          modelUsed: 'gpt-3.5-turbo',
        })

        const result = await executeTextAction(input, params, mockOptions)

        expect(result).toEqual({
          result: 'Text generated with default model...',
        })

        expect(execPrompt).toHaveBeenCalledWith(
          {
            prompt: input,
            model: 'gpt-3.5-turbo', // Should use default when model is null
            user: 'user-123',
          },
          { model: null }
        )
      })

      it('should handle undefined model parameter', async () => {
        const input = 'Generate text'
        const params = {} // No model parameter

        execPrompt.mockResolvedValue({
          completion: 'Text generated with default model...',
          tokensUsed: 100,
          modelUsed: 'gpt-3.5-turbo',
        })

        const result = await executeTextAction(input, params, mockOptions)

        expect(result).toEqual({
          result: 'Text generated with default model...',
        })

        expect(execPrompt).toHaveBeenCalledWith(
          {
            prompt: input,
            model: 'gpt-3.5-turbo', // Should use default when model is undefined
            user: 'user-123',
          },
          {}
        )
      })
    })

    describe('event logging', () => {
      it('should log text action event with correct parameters', async () => {
        const input = 'Generate text'
        const params = { model: 'gpt-4', temperature: 0.5 }

        execPrompt.mockResolvedValue({
          completion: 'Generated text response',
          tokensUsed: 120,
          modelUsed: 'gpt-4',
        })

        await executeTextAction(input, params, mockOptions)

        expect(logEvent).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          type: 'action.text',
          relations: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
          },
          meta: params,
        })
      })

      it('should handle missing linkedResources gracefully', async () => {
        const optionsWithoutResources = {
          userId: 'user-123',
          usageMeta: { botId: 'bot-123' },
        }
        const params = { testParam: 'value' }

        execPrompt.mockResolvedValue({
          completion: 'Text response',
          tokensUsed: 100,
          modelUsed: 'gpt-3.5-turbo',
        })

        await executeTextAction(
          'Generate text',
          params,
          optionsWithoutResources
        )

        expect(logEvent).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          type: 'action.text',
          relations: {
            blueprintId: undefined,
            skillsetId: undefined,
            abilityId: undefined,
          },
          meta: params,
        })
      })
    })

    describe('usage recording', () => {
      it('should record token usage with default usage meta', async () => {
        const input = 'Generate text'
        const params = {}
        const optionsWithoutUsageMeta = {
          userId: 'user-123',
          linkedResources: {},
          contextResources: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
          },
        }

        execPrompt.mockResolvedValue({
          completion: 'Generated text',
          tokensUsed: 150,
          modelUsed: 'gpt-3.5-turbo',
        })

        await executeTextAction(input, params, optionsWithoutUsageMeta)

        expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          count: expect.any(Number),
          model: 'base',
          meta: {
            reason: 'action/text',
            lineItems: [
              {
                debit: expect.any(Number),
                model: 'gpt-3.5-turbo',
                tokens: expect.any(Number),
                ratio: expect.any(Number),
                type: 'default',
              },
            ],
          },
          references: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
          },
        })
      })

      it('should record token usage with custom usage meta', async () => {
        const input = 'Generate text'
        const params = {}
        const customOptions = {
          userId: 'user-123',
          linkedResources: {},
          contextResources: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
          },
          usageMeta: {
            botId: 'bot-456',
            conversationId: 'conv-789',
            customField: 'custom-value',
          },
        }

        execPrompt.mockResolvedValue({
          completion: 'Generated text with custom meta',
          tokensUsed: 200,
          modelUsed: 'gpt-4',
        })

        await executeTextAction(input, params, customOptions)

        expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          count: expect.any(Number),
          model: 'base',
          meta: {
            botId: 'bot-456',
            conversationId: 'conv-789',
            customField: 'custom-value',
            reason: 'action/text',
            lineItems: [
              {
                debit: expect.any(Number),
                model: 'gpt-4',
                tokens: expect.any(Number),
                ratio: expect.any(Number),
                type: 'default',
              },
            ],
          },
          references: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
          },
        })
      })

      it('should handle zero token usage', async () => {
        const input = 'Generate text'
        const params = {}

        execPrompt.mockResolvedValue({
          completion: '',
          tokensUsed: 0,
          modelUsed: 'gpt-3.5-turbo',
        })

        const result = await executeTextAction(input, params, mockOptions)

        expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          count: 0,
          model: 'base',
          meta: expect.objectContaining({
            reason: 'action/text',
            lineItems: [],
          }),
          references: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
          },
        })

        expect(result).toEqual({
          result: '',
        })
      })
    })

    describe('error handling', () => {
      it('should handle execPrompt errors', async () => {
        const input = 'Generate text'
        const params = {}

        execPrompt.mockRejectedValue(new Error('Prompt execution failed'))

        await expect(
          executeTextAction(input, params, mockOptions)
        ).rejects.toThrow('Prompt execution failed')

        expect(execPrompt).toHaveBeenCalledWith(
          {
            prompt: input,
            model: 'gpt-3.5-turbo',
            user: 'user-123',
          },
          params
        )

        // Usage recording should not be called when execPrompt fails
        expect(recordLanguageTokenUsage).not.toHaveBeenCalled()
      })

      it('should handle usage recording errors gracefully', async () => {
        const input = 'Generate text'
        const params = {}

        execPrompt.mockResolvedValue({
          completion: 'Generated text',
          tokensUsed: 150,
          modelUsed: 'gpt-3.5-turbo',
        })

        recordLanguageTokenUsage.mockRejectedValue(
          new Error('Usage recording failed')
        )

        // Should not throw error even if usage recording fails
        await expect(
          executeTextAction(input, params, mockOptions)
        ).rejects.toThrow('Usage recording failed')

        expect(execPrompt).toHaveBeenCalled()
        expect(recordLanguageTokenUsage).toHaveBeenCalled()
      })

      it('should handle logEvent errors gracefully', async () => {
        const input = 'Generate text'
        const params = {}

        logEvent.mockRejectedValue(new Error('Logging failed'))

        // Should propagate the logging error
        await expect(
          executeTextAction(input, params, mockOptions)
        ).rejects.toThrow('Logging failed')

        expect(logEvent).toHaveBeenCalled()
        // execPrompt should not be called if logging fails
        expect(execPrompt).not.toHaveBeenCalled()
      })

      it('should handle model not found errors', async () => {
        const input = 'Generate text'
        const params = { model: 'non-existent-model' }

        execPrompt.mockRejectedValue(
          new Error('Model not found: non-existent-model')
        )

        await expect(
          executeTextAction(input, params, mockOptions)
        ).rejects.toThrow('Model not found: non-existent-model')

        expect(execPrompt).toHaveBeenCalledWith(
          {
            prompt: input,
            model: 'non-existent-model',
            user: 'user-123',
          },
          params
        )
      })
    })

    describe('edge cases', () => {
      it('should handle special characters in input', async () => {
        const input = '特殊字符 & <HTML> "quotes" \'apostrophes\' emojis 🚀'
        const params = {}

        execPrompt.mockResolvedValue({
          completion: 'Response with special characters: 特殊字符 🌟',
          tokensUsed: 80,
          modelUsed: 'gpt-3.5-turbo',
        })

        const result = await executeTextAction(input, params, mockOptions)

        expect(result).toEqual({
          result: 'Response with special characters: 特殊字符 🌟',
        })

        expect(execPrompt).toHaveBeenCalledWith(
          {
            prompt: input,
            model: 'gpt-3.5-turbo',
            user: 'user-123',
          },
          params
        )
      })

      it('should handle newlines and formatting in input', async () => {
        const input = 'Line 1\nLine 2\n\tTabbed line\n\n\nMultiple newlines'
        const params = {}

        execPrompt.mockResolvedValue({
          completion: 'Response\nwith\nmultiple\nlines',
          tokensUsed: 90,
          modelUsed: 'gpt-3.5-turbo',
        })

        const result = await executeTextAction(input, params, mockOptions)

        expect(result).toEqual({
          result: 'Response\nwith\nmultiple\nlines',
        })

        expect(execPrompt).toHaveBeenCalledWith(
          {
            prompt: input,
            model: 'gpt-3.5-turbo',
            user: 'user-123',
          },
          params
        )
      })

      it('should handle different model types', async () => {
        const modelTests = [
          { model: 'gpt-3.5-turbo', expectedCompletion: 'GPT-3.5 response' },
          { model: 'gpt-4', expectedCompletion: 'GPT-4 response' },
          { model: 'claude-3.5-sonnet', expectedCompletion: 'Claude response' },
          {
            model: 'claude-4.5-sonnet',
            expectedCompletion: 'Claude response',
          },
        ]

        for (const { model, expectedCompletion } of modelTests) {
          execPrompt.mockResolvedValue({
            completion: expectedCompletion,
            tokensUsed: 100,
            modelUsed: model,
          })

          const result = await executeTextAction(
            'Test input',
            { model },
            mockOptions
          )

          expect(result).toEqual({
            result: expectedCompletion,
          })

          expect(execPrompt).toHaveBeenCalledWith(
            {
              prompt: 'Test input',
              model: model,
              user: 'user-123',
            },
            { model }
          )

          expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
            user: { id: 'user-123' },
            count: expect.any(Number),
            model: 'base',
            meta: expect.objectContaining({
              reason: 'action/text',
              lineItems: [
                {
                  debit: expect.any(Number),
                  model: model,
                  tokens: expect.any(Number),
                  ratio: expect.any(Number),
                  type: 'default',
                },
              ],
            }),
            references: {
              blueprintId: 'blueprint-456',
              skillsetId: 'skillset-789',
              abilityId: 'ability-012',
            },
          })

          jest.clearAllMocks()

          fastGetUserById.mockResolvedValue({ id: 'user-123' })
          accountLimitsOk.mockResolvedValue(true)
          logEvent.mockResolvedValue(undefined)
          recordLanguageTokenUsage.mockResolvedValue(undefined)
        }
      })
    })

    describe('integration tests', () => {
      it('should handle complete text generation flow', async () => {
        execPrompt.mockResolvedValue({
          completion: 'A comprehensive response to the user request',
          tokensUsed: 250,
          modelUsed: 'gpt-4',
        })

        const result = await executeTextAction(
          'Write a comprehensive analysis of AI trends',
          {
            model: 'gpt-4',
            temperature: 0.7,
            maxTokens: 1000,
          },
          {
            userId: 'user-123',
            linkedResources: {},
            contextResources: {
              blueprintId: 'blueprint-456',
              skillsetId: 'skillset-789',
              abilityId: 'ability-012',
            },
            usageMeta: {
              botId: 'bot-123',
              conversationId: 'conv-456',
              source: 'api',
            },
          }
        )

        expect(result).toEqual({
          result: 'A comprehensive response to the user request',
        })

        expect(fastGetUserById).toHaveBeenCalledWith('user-123')
        expect(accountLimitsOk).toHaveBeenCalledWith({ id: 'user-123' }, [
          'token',
        ])
        expect(logEvent).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          type: 'action.text',
          relations: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
          },
          meta: {
            model: 'gpt-4',
            temperature: 0.7,
            maxTokens: 1000,
          },
        })
        expect(execPrompt).toHaveBeenCalledWith(
          {
            prompt: 'Write a comprehensive analysis of AI trends',
            model: 'gpt-4',
            user: 'user-123',
          },
          {
            model: 'gpt-4',
            temperature: 0.7,
            maxTokens: 1000,
          }
        )
        expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          count: expect.any(Number),
          model: 'base',
          meta: {
            botId: 'bot-123',
            conversationId: 'conv-456',
            source: 'api',
            reason: 'action/text',
            lineItems: [
              {
                debit: expect.any(Number),
                model: 'gpt-4',
                tokens: expect.any(Number),
                ratio: expect.any(Number),
                type: 'default',
              },
            ],
          },
          references: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
          },
        })
      })
    })
  })
})
