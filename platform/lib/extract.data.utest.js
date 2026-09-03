import { getStatelessConversationEngine } from '@/lib/conversation.engine'
import {
  extractData,
  extractDataFromInputWithSchema,
  extractDataWithSchema,
} from '@/lib/extract.data'
import { Usage } from '@/lib/usage.model'
import { recordLanguageTokenUsage } from '@/lib/usage.record'

import { z } from 'zod'

jest.mock('@/lib/conversation.engine', () => ({
  getStatelessConversationEngine: jest.fn(),
}))

jest.mock('@/lib/usage.record', () => ({
  recordLanguageTokenUsage: jest.fn(),
}))

const user = { id: '123' }

const testLanguageModel = 'custom/name=test/provider=openai/credentials=sk-test'

const testLanguageModelName = 'custom'

function setupMockEngine(mockData, mockUsage = new Usage()) {
  let capturedSink = null

  getStatelessConversationEngine.mockImplementation(async (config) => {
    capturedSink = config.options.sink

    return {
      complete: jest.fn(async () => {
        if (capturedSink && mockData !== undefined) {
          await capturedSink.push('message', {
            type: 'activity',
            meta: {
              activity: {
                type: 'request',
                function: {
                  name: config.options.forceFunction || 'extractData',
                  arguments: { data: mockData },
                },
              },
            },
          })
        }

        return { usage: mockUsage }
      }),
      dispose: jest.fn(async () => undefined),
    }
  })
}

describe('extractData', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return null data and empty usage for empty messages', async () => {
    const { data, usage } = await extractData([], { properties: {} }, { user })

    expect(data).toBeNull()
    expect(usage).toBeInstanceOf(Usage)
    expect(getStatelessConversationEngine).not.toHaveBeenCalled()
  })

  it('should extract data when function returns valid result', async () => {
    const mockUsage = new Usage()

    setupMockEngine({ name: 'Bob', email: 'bob@bob.com' }, mockUsage)

    const { data, usage } = await extractData(
      [
        { type: 'bot', text: 'What is your contact info?' },
        { type: 'user', text: 'Bob, bob@bob.com' },
      ],
      {
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
        },
      },
      { user }
    )

    expect(data).toEqual({ name: 'Bob', email: 'bob@bob.com' })
    expect(usage).toBe(mockUsage)
  })

  it('should return null when function returns null data', async () => {
    setupMockEngine(null)

    const { data } = await extractData(
      [{ type: 'user', text: 'Why?' }],
      { properties: { name: { type: 'string' } }, required: ['name'] },
      { user }
    )

    expect(data).toBeNull()
  })

  it('should pass schema properties to engine', async () => {
    setupMockEngine({ name: 'Test' })

    await extractData(
      [{ type: 'user', text: 'Hello' }],
      {
        properties: { name: { type: 'string', description: 'User name' } },
        required: ['name'],
      },
      { user }
    )

    expect(getStatelessConversationEngine).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          functions: expect.arrayContaining([
            expect.objectContaining({
              parameters: expect.objectContaining({
                properties: expect.objectContaining({
                  data: expect.objectContaining({
                    properties: {
                      name: { type: 'string', description: 'User name' },
                    },
                    required: ['name'],
                  }),
                }),
              }),
            }),
          ]),
        }),
      })
    )
  })

  it('should not declare data as a nullable union in function parameters', async () => {
    setupMockEngine({ name: 'Test' })

    await extractData(
      [{ type: 'user', text: 'Hello' }],
      {
        properties: { name: { type: 'string', description: 'User name' } },
        required: ['name'],
      },
      { user }
    )

    expect(getStatelessConversationEngine).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          functions: expect.arrayContaining([
            expect.objectContaining({
              parameters: expect.objectContaining({
                properties: expect.objectContaining({
                  data: expect.objectContaining({
                    type: 'object',
                    properties: {
                      name: { type: 'string', description: 'User name' },
                    },
                    required: ['name'],
                  }),
                }),
              }),
            }),
          ]),
        }),
      })
    )
  })

  it('should use custom model when provided', async () => {
    setupMockEngine({ name: 'Test' })

    await extractData(
      [{ type: 'user', text: 'Hello' }],
      { properties: {} },
      { user, model: 'gpt-4o' }
    )

    expect(getStatelessConversationEngine).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4o' })
    )
  })

  it('should use custom function name when provided', async () => {
    setupMockEngine({ name: 'Test' })

    await extractData(
      [{ type: 'user', text: 'Hello' }],
      { properties: {} },
      { user, functionName: 'customExtract' }
    )

    expect(getStatelessConversationEngine).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          forceFunction: 'customExtract',
          functions: expect.arrayContaining([
            expect.objectContaining({ name: 'customExtract' }),
          ]),
        }),
      })
    )
  })

  it('should cap the extraction sub-conversation to a single iteration', async () => {
    // @note regression guard for extraction is single-shot, so
    // the engine must run exactly one round. Without maxIterations the forced
    // tool-choice reverts to `auto` after the first call and some models keep
    // re-calling the function with identical args until the cycle guard stops
    // them - wasting tokens and tripping "thread cycle max reached".
    setupMockEngine({ name: 'Test' })

    await extractData(
      [{ type: 'user', text: 'Hello' }],
      { properties: {} },
      { user }
    )

    expect(getStatelessConversationEngine).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          maxIterations: 1,
        }),
      })
    )
  })

  it('should pass usageMeta and usageReferences to engine', async () => {
    setupMockEngine({ name: 'Test' })

    await extractData(
      [{ type: 'user', text: 'Hello' }],
      { properties: {} },
      {
        user,
        usageMeta: { reason: 'slack/auto-respond' },
        usageReferences: { slackIntegrationId: 'slack_123' },
      }
    )

    expect(getStatelessConversationEngine).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          usageMeta: { reason: 'slack/auto-respond' },
          usageReferences: { slackIntegrationId: 'slack_123' },
        }),
      })
    )
  })
})

describe('extractDataWithSchema', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should convert zod schema to json schema and extract data', async () => {
    const mockUsage = new Usage()

    setupMockEngine({ name: 'Alice', email: 'alice@example.com' }, mockUsage)

    const ContactSchema = z.object({
      name: z.string(),
      email: z.string().email(),
    })

    const { data, usage } = await extractDataWithSchema(
      [{ type: 'user', text: 'I am Alice, alice@example.com' }],
      ContactSchema,
      { user }
    )

    expect(data).toEqual({ name: 'Alice', email: 'alice@example.com' })
    expect(usage).toBe(mockUsage)
  })

  it('should return null when extraction returns null', async () => {
    const mockUsage = new Usage()

    setupMockEngine(null, mockUsage)

    const ContactSchema = z.object({
      name: z.string(),
    })

    const { data, usage } = await extractDataWithSchema(
      [{ type: 'user', text: 'Hello' }],
      ContactSchema,
      { user }
    )

    expect(data).toBeNull()
    expect(usage).toBe(mockUsage)
  })

  it('should return null when zod validation fails', async () => {
    const mockUsage = new Usage()

    setupMockEngine({ name: 'Bob', age: 'not-a-number' }, mockUsage)

    const PersonSchema = z.object({
      name: z.string(),
      age: z.number(),
    })

    const { data, usage } = await extractDataWithSchema(
      [{ type: 'user', text: 'Bob is thirty' }],
      PersonSchema,
      { user }
    )

    expect(data).toBeNull()
    expect(usage).toBe(mockUsage)
  })

  it('should handle optional fields correctly', async () => {
    setupMockEngine({ name: 'Carol' })

    const PersonSchema = z.object({
      name: z.string(),
      nickname: z.string().optional(),
    })

    const { data } = await extractDataWithSchema(
      [{ type: 'user', text: 'My name is Carol' }],
      PersonSchema,
      { user }
    )

    expect(data).toEqual({ name: 'Carol' })
  })

  it('should apply zod transforms to extracted data', async () => {
    setupMockEngine({ name: '  alice  ' })

    const TrimmedSchema = z.object({
      name: z.string().transform((s) => s.trim()),
    })

    const { data } = await extractDataWithSchema(
      [{ type: 'user', text: 'Alice' }],
      TrimmedSchema,
      { user }
    )

    expect(data).toEqual({ name: 'alice' })
  })
})

describe('extractDataFromInputWithSchema', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should convert input to user message and extract data', async () => {
    const mockUsage = new Usage()

    setupMockEngine({ name: 'Diana', age: 28 }, mockUsage)

    const PersonSchema = z.object({
      name: z.string(),
      age: z.number(),
    })

    const input = 'My name is Diana and I am 28'

    const { data } = await extractDataFromInputWithSchema(input, PersonSchema, {
      user,
    })

    expect(getStatelessConversationEngine).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          {
            type: 'backstory',
            text: expect.stringContaining('data extraction assistant'),
          },
          {
            type: 'user',
            text: expect.stringContaining(input),
          },
        ],
      })
    )

    expect(data).toEqual({ name: 'Diana', age: 28 })
  })

  it('should skip model extraction for empty input', async () => {
    const PersonSchema = z.object({
      name: z.string(),
    })

    const { data, usage } = await extractDataFromInputWithSchema(
      '',
      PersonSchema,
      {
        user,
      }
    )

    expect(data).toBeNull()
    expect(usage).toBeInstanceOf(Usage)
    expect(getStatelessConversationEngine).not.toHaveBeenCalled()
  })

  it('should return null when zod validation fails', async () => {
    setupMockEngine({ email: 'invalid-email' })

    const EmailSchema = z.object({
      email: z.string().email(),
    })

    const { data } = await extractDataFromInputWithSchema(
      'Contact me at invalid-email',
      EmailSchema,
      { user }
    )

    expect(data).toBeNull()
  })
})

describe('Usage recording behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('when extractData returns usage and caller records it', () => {
    it('should record with base model type when recordBaseTokens is called', async () => {
      // Setup: engine returns usage with tokens added for a non-base model
      const mockUsage = new Usage()

      mockUsage.addTokens(100, testLanguageModel, 'input')
      mockUsage.addTokens(50, testLanguageModel, 'output')

      setupMockEngine({ name: 'Test' }, mockUsage)

      const { usage } = await extractData(
        [{ type: 'user', text: 'Hello' }],
        { properties: {} },
        { user, model: testLanguageModel }
      )

      // Caller records usage with recordBaseTokens (like Slack queue does)
      await usage.recordBaseTokens({
        user: { id: user.id },
        meta: { reason: 'test/extract' },
        references: {},
      })

      // Verify: should be recorded with 'base', not the source model
      expect(recordLanguageTokenUsage).toHaveBeenCalledTimes(1)
      expect(recordLanguageTokenUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'base',
          meta: expect.objectContaining({
            reason: 'test/extract',
            lineItems: expect.arrayContaining([
              expect.objectContaining({ model: testLanguageModelName }),
            ]),
          }),
        })
      )
    })

    it('should NOT record with actual model type when recordBaseTokens is used', async () => {
      const mockUsage = new Usage()

      mockUsage.addTokens(100, testLanguageModel, 'input')

      setupMockEngine({ name: 'Test' }, mockUsage)

      const { usage } = await extractData(
        [{ type: 'user', text: 'Hello' }],
        { properties: {} },
        { user, model: testLanguageModel }
      )

      await usage.recordBaseTokens({
        user: { id: user.id },
        meta: {},
        references: {},
      })

      // Should NOT have recorded with the source model
      expect(recordLanguageTokenUsage).not.toHaveBeenCalledWith(
        expect.objectContaining({
          model: testLanguageModel,
        })
      )
    })

    it('should include lineItems in meta when recorded through Usage class', async () => {
      const mockUsage = new Usage()

      mockUsage.addTokens(200, testLanguageModel, 'input')
      mockUsage.addTokens(100, testLanguageModel, 'output')

      setupMockEngine({ name: 'Test' }, mockUsage)

      const { usage } = await extractData(
        [{ type: 'user', text: 'Hello' }],
        { properties: {} },
        { user }
      )

      await usage.recordBaseTokens({
        user: { id: user.id },
        meta: { reason: 'slack/auto-respond' },
        references: { slackIntegrationId: 'slack_123' },
      })

      expect(recordLanguageTokenUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({
            lineItems: expect.arrayContaining([
              expect.objectContaining({
                tokens: 200,
                model: testLanguageModelName,
                type: 'input',
              }),
              expect.objectContaining({
                tokens: 100,
                model: testLanguageModelName,
                type: 'output',
              }),
            ]),
          }),
        })
      )
    })
  })

  describe('direct recordTokens behavior', () => {
    it('should record with specified model when recordTokens is called with model', async () => {
      const usage = new Usage()

      usage.addTokens(100, testLanguageModel, 'input')

      // This is what happens if someone calls recordTokens with explicit model
      await usage.recordTokens({
        user: { id: user.id },
        model: testLanguageModel, // Explicitly passing the model
        meta: {},
        references: {},
      })

      // This records against the explicit source model, which is wrong here.
      expect(recordLanguageTokenUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          model: testLanguageModel,
        })
      )
    })

    it('should record with base model when recordTokens is called without model', async () => {
      const usage = new Usage()

      usage.addTokens(100, testLanguageModel, 'input')

      // When no model specified, defaults to base
      await usage.recordTokens({
        user: { id: user.id },
        meta: {},
        references: {},
      })

      expect(recordLanguageTokenUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'base',
        })
      )
    })
  })

  describe('Usage.createAndRecord behavior (regression test)', () => {
    it('should record with base model type, not the input model', async () => {
      // This is a regression test to ensure Usage.createAndRecord uses
      // recordBaseTokens instead of recordTokens with the actual model.
      // Historical bug: old code was calling recordTokens(userId, model, meta)
      // which recorded against the source model instead of CHATBOTKIT_BASE_TOKEN

      await Usage.createAndRecord({
        user: { id: user.id },
        token: 100,
        model: testLanguageModel,
        type: 'input',
        meta: { reason: 'test/create-and-record' },
        references: {},
      })

      // MUST be recorded with 'base', not the source model
      expect(recordLanguageTokenUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'base',
          meta: expect.objectContaining({
            reason: 'test/create-and-record',
            lineItems: expect.arrayContaining([
              expect.objectContaining({
                model: testLanguageModelName,
              }),
            ]),
          }),
        })
      )
    })
  })
})
