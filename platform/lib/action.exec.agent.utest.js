/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'
import { MessageType } from '@/prisma/types'

import { getConfigBySchema } from '@/lib/action.config'
import { doAgentSpawn, executeAgentAction } from '@/lib/action.exec.agent'
import { getConversationDetailsField } from '@/lib/bot.conversation'
import { getAutoEngine } from '@/lib/conversation.engine'
import { UserInputError, captureError } from '@/lib/error'
import { accountLimitsOk } from '@/lib/limit.core'
import { logEvent } from '@/lib/log'
import { fastGetUserById } from '@/lib/user.get'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@prisma/client', () => ({
  MessageType: {
    user: 'user',
    assistant: 'assistant',
    system: 'system',
  },
}))

jest.mock('@/lib/action.config', () => ({
  getConfigBySchema: jest.fn(),
}))

jest.mock('@/lib/bot.conversation', () => ({
  getConversationDetailsField: jest.fn(),
}))

jest.mock('@/lib/conversation.engine', () => ({
  getAutoEngine: jest.fn(),
}))

jest.mock('@/lib/error', () => ({
  UserInputError: jest.fn().mockImplementation((message) => {
    const error = new Error(message)

    error.name = 'UserInputError'

    return error
  }),
  captureError: jest.fn(),
}))

jest.mock('@/lib/limit.core', () => ({
  accountLimitsOk: jest.fn(),
}))

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

jest.mock('@/lib/user.get', () => ({
  fastGetUserById: jest.fn(),
}))

describe('action.exec.agent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockReset(prisma)
  })

  describe('executeAgentAction', () => {
    const mockOptions = {
      userId: 'user-123',
      linkedResources: {},
      contextResources: {
        blueprintId: 'blueprint-456',
        skillsetId: 'skillset-789',
        abilityId: 'ability-012',
      },
    }

    describe('operation detection', () => {
      it('should handle spawn operation', async () => {
        const params = { spawn: true }

        fastGetUserById.mockResolvedValue({ id: 'user-123' })
        accountLimitsOk.mockResolvedValue(true)

        getConfigBySchema.mockReturnValue({
          backstory: 'test backstory',
          model: 'test-model',
          instructions: 'test instructions',
        })

        getConversationDetailsField.mockImplementation(
          (conv, field) => conv[field]
        )

        const mockEngine = {
          process: jest.fn(),
          complete: jest.fn().mockResolvedValue({
            messages: [
              { type: MessageType.activity, text: 'activity message' },
              { type: MessageType.user, text: 'final result' },
            ],
          }),
        }

        getAutoEngine.mockResolvedValue(mockEngine)

        const result = await executeAgentAction(
          'test input',
          params,
          mockOptions
        )

        expect(result).toBeDefined()
        expect(mockEngine.process).toHaveBeenCalled()
        expect(mockEngine.complete).toHaveBeenCalled()
        expect(logEvent).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          type: 'action.agent.spawn',
          relations: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
          },
          meta: params,
        })
      })

      it('should throw UserInputError for unknown operation', async () => {
        const params = { unknown: true }

        await expect(
          executeAgentAction('test input', params, mockOptions)
        ).rejects.toThrow('Unknown operation')

        expect(UserInputError).toHaveBeenCalledWith('Unknown operation')
      })
    })
  })

  describe('doAgentSpawn', () => {
    const mockOptions = {
      userId: 'user-123',
      linkedResources: {
        botId: 'bot-123',
      },
      contextResources: {
        blueprintId: 'blueprint-456',
        skillsetId: 'skillset-789',
        abilityId: 'ability-012',
      },
      messages: [{ type: MessageType.user, text: 'previous message' }],
      usageMeta: { source: 'test' },
    }

    beforeEach(() => {
      fastGetUserById.mockResolvedValue({ id: 'user-123' })

      accountLimitsOk.mockResolvedValue(true)

      getConfigBySchema.mockReturnValue({
        backstory: 'test backstory',
        model: 'test-model',
        instructions: 'test instructions',
      })

      getConversationDetailsField.mockImplementation(
        (conv, field) => conv[field]
      )

      logEvent.mockResolvedValue(undefined)
    })

    describe('user validation', () => {
      it('should throw error when user not found', async () => {
        fastGetUserById.mockResolvedValue(null)

        await expect(
          doAgentSpawn({
            input: 'test input',
            params: {},
            options: mockOptions,
          })
        ).rejects.toThrow('User not found')
      })

      it('should return error when account limits exceeded', async () => {
        accountLimitsOk.mockResolvedValue(false)

        const result = await doAgentSpawn({
          input: 'test input',
          params: {},
          options: mockOptions,
        })

        expect(result).toEqual({
          error: 'You have reached your token limit.',
        })
      })
    })

    describe('configuration handling', () => {
      it('should use input as backstory when no backstory provided', async () => {
        getConfigBySchema.mockReturnValue({
          backstory: undefined,
          model: undefined,
          instructions: 'test instructions',
        })

        const mockEngine = {
          process: jest.fn(),
          complete: jest.fn().mockResolvedValue({
            messages: [{ type: MessageType.user, text: 'result' }],
          }),
        }

        getAutoEngine.mockResolvedValue(mockEngine)

        await doAgentSpawn({
          input: 'test input',
          params: {},
          options: mockOptions,
        })

        expect(getConfigBySchema).toHaveBeenCalledWith({
          input: 'test input',
          params: {},
          initial: {
            backstory: 'test input',
          },
          schema: expect.any(Object),
          options: mockOptions,
        })
      })

      it('should fetch backstory and model from bot when not provided', async () => {
        getConfigBySchema.mockReturnValue({
          backstory: undefined,
          model: undefined,
          instructions: 'test instructions',
        })

        const mockBot = {
          backstory: 'bot backstory',
          model: 'bot-model',
        }

        prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)

        const mockEngine = {
          process: jest.fn(),
          complete: jest.fn().mockResolvedValue({
            messages: [{ type: MessageType.user, text: 'result' }],
          }),
        }

        getAutoEngine.mockResolvedValue(mockEngine)

        await doAgentSpawn({
          input: 'test input',
          params: {},
          options: mockOptions,
        })

        expect(prisma.bot.findUniqueByIdentifier).toHaveBeenCalledWith(
          { id: 'user-123' },
          'bot-123'
        )

        expect(getAutoEngine).toHaveBeenCalledWith({
          options: expect.objectContaining({
            backstory: 'bot backstory',
            model: 'bot-model',
          }),
        })
      })

      it('should use provided backstory and model over bot values', async () => {
        getConfigBySchema.mockReturnValue({
          backstory: 'provided backstory',
          model: 'provided-model',
          instructions: 'test instructions',
        })

        const mockBot = {
          backstory: 'bot backstory',
          model: 'bot-model',
        }

        prisma.bot.findUniqueByIdentifier.mockResolvedValue(mockBot)

        const mockEngine = {
          process: jest.fn(),
          complete: jest.fn().mockResolvedValue({
            messages: [{ type: MessageType.user, text: 'result' }],
          }),
        }

        getAutoEngine.mockResolvedValue(mockEngine)

        await doAgentSpawn({
          input: 'test input',
          params: {},
          options: mockOptions,
        })

        expect(getAutoEngine).toHaveBeenCalledWith({
          options: expect.objectContaining({
            backstory: 'provided backstory',
            model: 'provided-model',
          }),
        })
      })
    })

    describe('pseudo conversation creation', () => {
      it('should create pseudo conversation with all messages and instructions', async () => {
        const mockEngine = {
          process: jest.fn(),
          complete: jest.fn().mockResolvedValue({
            messages: [{ type: MessageType.user, text: 'result' }],
          }),
        }

        getAutoEngine.mockResolvedValue(mockEngine)

        await doAgentSpawn({
          input: 'test input',
          params: {},
          options: mockOptions,
        })

        expect(getAutoEngine).toHaveBeenCalledWith({
          options: expect.objectContaining({
            messages: [
              { type: MessageType.user, text: 'previous message' },
              {
                type: MessageType.instruction,
                text: 'test instructions',
              },
            ],
          }),
        })
      })

      it('should handle missing instructions', async () => {
        getConfigBySchema.mockReturnValue({
          backstory: 'test backstory',
          model: 'test-model',
          instructions: undefined,
        })

        const mockEngine = {
          process: jest.fn(),
          complete: jest.fn().mockResolvedValue({
            messages: [{ type: MessageType.user, text: 'result' }],
          }),
        }

        getAutoEngine.mockResolvedValue(mockEngine)

        await doAgentSpawn({
          input: 'test input',
          params: {},
          options: mockOptions,
        })

        expect(getAutoEngine).toHaveBeenCalledWith({
          options: expect.objectContaining({
            messages: [{ type: MessageType.user, text: 'previous message' }],
          }),
        })
      })

      it('should handle missing previous messages', async () => {
        const optionsWithoutMessages = {
          ...mockOptions,
          messages: undefined,
        }

        const mockEngine = {
          process: jest.fn(),
          complete: jest.fn().mockResolvedValue({
            messages: [{ type: MessageType.user, text: 'result' }],
          }),
        }

        getAutoEngine.mockResolvedValue(mockEngine)

        await doAgentSpawn({
          input: 'test input',
          params: {},
          options: optionsWithoutMessages,
        })

        expect(getAutoEngine).toHaveBeenCalledWith({
          options: expect.objectContaining({
            messages: [
              {
                type: MessageType.instruction,
                text: 'test instructions',
              },
            ],
          }),
        })
      })
    })

    describe('engine execution', () => {
      it('should process and complete engine execution', async () => {
        const mockEngine = {
          process: jest.fn(),
          complete: jest.fn().mockResolvedValue({
            messages: [
              { type: MessageType.activity, text: 'activity message' },
              { type: MessageType.user, text: 'final result' },
            ],
          }),
        }

        getAutoEngine.mockResolvedValue(mockEngine)

        const result = await doAgentSpawn({
          input: 'test input',
          params: {},
          options: mockOptions,
        })

        expect(mockEngine.process).toHaveBeenCalled()
        expect(mockEngine.complete).toHaveBeenCalled()
        expect(result).toEqual({
          result: {
            result: 'final result',
            messages: [
              { type: MessageType.activity, text: 'activity message' },
            ],
          },
        })
      })

      it('should pass abort signal to the engine when timeout is configured', async () => {
        getConfigBySchema.mockReturnValue({
          backstory: 'test backstory',
          model: 'test-model',
          instructions: 'test instructions',
          timeout: 25,
        })

        const mockEngine = {
          process: jest.fn(),
          complete: jest.fn().mockResolvedValue({
            messages: [{ type: MessageType.user, text: 'final result' }],
          }),
        }

        getAutoEngine.mockResolvedValue(mockEngine)

        await doAgentSpawn({
          input: 'test input',
          params: {},
          options: mockOptions,
        })

        expect(getAutoEngine).toHaveBeenCalledWith({
          options: expect.objectContaining({
            signal: expect.any(AbortSignal),
          }),
        })
      })

      it('should return abort result when timeout is exceeded', async () => {
        jest.useFakeTimers()

        getConfigBySchema.mockReturnValue({
          backstory: 'test backstory',
          model: 'test-model',
          instructions: 'test instructions',
          timeout: 25,
        })

        getAutoEngine.mockImplementation(async ({ options }) => ({
          process: jest.fn(async () => {
            await new Promise((resolve) => {
              options.signal.addEventListener('abort', resolve, { once: true })
            })

            throw new Error('aborted')
          }),
          complete: jest.fn(),
        }))

        const resultPromise = doAgentSpawn({
          input: 'test input',
          params: {},
          options: mockOptions,
        })

        await jest.advanceTimersByTimeAsync(25)

        await expect(resultPromise).resolves.toEqual({
          result: {
            result: 'abort',
            messages: [],
          },
        })

        jest.useRealTimers()
      })

      it('should handle empty result from engine', async () => {
        const mockEngine = {
          process: jest.fn(),
          complete: jest.fn().mockResolvedValue({
            messages: [],
          }),
        }

        getAutoEngine.mockResolvedValue(mockEngine)

        const result = await doAgentSpawn({
          input: 'test input',
          params: {},
          options: mockOptions,
        })

        expect(result).toEqual({
          result: {
            result: '',
            messages: [],
          },
        })
      })

      it('should handle engine errors', async () => {
        const mockEngine = {
          process: jest.fn().mockRejectedValue(new Error('Engine error')),
          complete: jest.fn(),
        }

        getAutoEngine.mockResolvedValue(mockEngine)

        const result = await doAgentSpawn({
          input: 'test input',
          params: {},
          options: mockOptions,
        })

        expect(captureError).toHaveBeenCalledWith(expect.any(Error))
        expect(result).toEqual({
          result: {
            result: undefined,
            messages: undefined,
          },
        })
      })
    })

    describe('event logging', () => {
      it('should log process event with correct parameters', async () => {
        const mockEngine = {
          process: jest.fn(),
          complete: jest.fn().mockResolvedValue({
            messages: [{ type: MessageType.user, text: 'result' }],
          }),
        }

        getAutoEngine.mockResolvedValue(mockEngine)

        await doAgentSpawn({
          input: 'test input',
          params: { testParam: 'value' },
          options: mockOptions,
        })

        expect(logEvent).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          type: 'action.agent.spawn',
          relations: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
          },
          meta: { testParam: 'value' },
        })
      })
    })
  })

  describe('integration tests', () => {
    it('should handle complete spawn flow', async () => {
      fastGetUserById.mockResolvedValue({ id: 'user-123' })
      accountLimitsOk.mockResolvedValue(true)
      getConfigBySchema.mockReturnValue({
        backstory: 'test backstory',
        model: 'test-model',
        instructions: 'test instructions',
      })
      getConversationDetailsField.mockImplementation(
        (conv, field) => conv[field]
      )

      const mockEngine = {
        process: jest.fn(),
        complete: jest.fn().mockResolvedValue({
          messages: [
            { type: MessageType.activity, text: 'activity message' },
            { type: MessageType.user, text: 'final result' },
          ],
        }),
      }

      getAutoEngine.mockResolvedValue(mockEngine)

      const result = await executeAgentAction(
        'test input',
        { spawn: true },
        {
          userId: 'user-123',
          linkedResources: {},
          contextResources: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
          },
        }
      )

      expect(result).toEqual({
        result: {
          result: 'final result',
          messages: [{ type: MessageType.activity, text: 'activity message' }],
        },
      })

      expect(fastGetUserById).toHaveBeenCalledWith('user-123')
      expect(accountLimitsOk).toHaveBeenCalledWith({ id: 'user-123' }, [
        'token',
      ])
      expect(logEvent).toHaveBeenCalled()
      expect(getConfigBySchema).toHaveBeenCalled()
      expect(getAutoEngine).toHaveBeenCalled()
      expect(mockEngine.process).toHaveBeenCalled()
      expect(mockEngine.complete).toHaveBeenCalled()
    })

    it('should handle missing bot gracefully', async () => {
      fastGetUserById.mockResolvedValue({ id: 'user-123' })
      accountLimitsOk.mockResolvedValue(true)
      getConfigBySchema.mockReturnValue({
        backstory: undefined,
        model: undefined,
        instructions: 'test instructions',
      })
      getConversationDetailsField.mockImplementation(
        (conv, field) => conv[field]
      )

      prisma.bot.findUniqueByIdentifier.mockResolvedValue(null)

      const mockEngine = {
        process: jest.fn(),
        complete: jest.fn().mockResolvedValue({
          messages: [{ type: MessageType.user, text: 'result' }],
        }),
      }

      getAutoEngine.mockResolvedValue(mockEngine)

      const result = await executeAgentAction(
        'test input',
        { spawn: true },
        {
          userId: 'user-123',
          linkedResources: {
            botId: 'non-existent-bot',
          },
          contextResources: {
            blueprintId: 'blueprint-456',
          },
        }
      )

      expect(result).toBeDefined()
      expect(prisma.bot.findUniqueByIdentifier).toHaveBeenCalledWith(
        { id: 'user-123' },
        'non-existent-bot'
      )
    })
  })

  describe('edge cases', () => {
    beforeEach(() => {
      fastGetUserById.mockResolvedValue({ id: 'user-123' })
      accountLimitsOk.mockResolvedValue(true)
      getConversationDetailsField.mockImplementation(
        (conv, field) => conv[field]
      )
    })

    it('should handle empty input', async () => {
      getConfigBySchema.mockReturnValue({
        backstory: '',
        model: 'test-model',
        instructions: '',
      })

      const mockEngine = {
        process: jest.fn(),
        complete: jest.fn().mockResolvedValue({
          messages: [{ type: MessageType.user, text: '' }],
        }),
      }

      getAutoEngine.mockResolvedValue(mockEngine)

      const result = await executeAgentAction(
        '',
        { spawn: true },
        {
          userId: 'user-123',
        }
      )

      expect(result).toEqual({
        result: {
          result: '',
          messages: [],
        },
      })
    })

    it('should handle very long input', async () => {
      const longInput = 'a'.repeat(10000)

      getConfigBySchema.mockReturnValue({
        backstory: longInput,
        model: 'test-model',
        instructions: 'test instructions',
      })

      const mockEngine = {
        process: jest.fn(),
        complete: jest.fn().mockResolvedValue({
          messages: [{ type: MessageType.user, text: 'processed long input' }],
        }),
      }

      getAutoEngine.mockResolvedValue(mockEngine)

      const result = await executeAgentAction(
        longInput,
        { spawn: true },
        {
          userId: 'user-123',
        }
      )

      expect(result.result.result).toBe('processed long input')
    })

    it('should handle special characters in input', async () => {
      const specialInput = '特殊字符 🚀 \n\t\r"\'\\&<>'

      getConfigBySchema.mockReturnValue({
        backstory: specialInput,
        model: 'test-model',
        instructions: 'test instructions',
      })

      const mockEngine = {
        process: jest.fn(),
        complete: jest.fn().mockResolvedValue({
          messages: [
            { type: MessageType.user, text: 'processed special chars' },
          ],
        }),
      }

      getAutoEngine.mockResolvedValue(mockEngine)

      const result = await executeAgentAction(
        specialInput,
        { spawn: true },
        {
          userId: 'user-123',
        }
      )

      expect(result.result.result).toBe('processed special chars')
    })
  })
})
