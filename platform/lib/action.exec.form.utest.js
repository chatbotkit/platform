import { MessageType } from '@/prisma/types'

import { accountLimitsOk } from '@/lib/limit.core'
import { logEvent } from '@/lib/log'
import { execPrompt } from '@/lib/prompt'
import { Usage } from '@/lib/usage.model'
import { fastGetUserById } from '@/lib/user.get'

import { executeFormAction } from './action.exec.form'

jest.mock('@/lib/user.get', () => ({
  fastGetUserById: jest.fn(),
}))

jest.mock('@/lib/limit.core', () => ({
  accountLimitsOk: jest.fn(),
}))

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

jest.mock('@/lib/prompt', () => ({
  execPrompt: jest.fn(),
}))

jest.mock('@/lib/usage.model', () => ({
  Usage: {
    createAndRecord: jest.fn(),
  },
}))

describe('action.exec.form', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  }

  const mockInput = 'Generate a contact form'
  const mockParams = { formType: 'contact' }
  const mockOptions = {
    userId: 'user-123',
    linkedResources: {},
    contextResources: {
      blueprintId: 'blueprint-123',
      skillsetId: 'skillset-123',
      abilityId: 'ability-123',
    },
    usageMeta: { source: 'test' },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('executeFormAction', () => {
    describe('successful form generation', () => {
      it('should execute form action with valid input and return result', async () => {
        const mockResult = '<form><input type="text" name="name" /></form>'
        const mockTokensUsed = 100
        const mockModelUsed = 'gpt-4'

        fastGetUserById.mockResolvedValue(mockUser)
        accountLimitsOk.mockResolvedValue(true)
        execPrompt.mockResolvedValue({
          completion: mockResult,
          tokensUsed: mockTokensUsed,
          modelUsed: mockModelUsed,
        })
        logEvent.mockResolvedValue(undefined)
        Usage.createAndRecord.mockResolvedValue({ id: 'usage-123' })

        const result = await executeFormAction(
          mockInput,
          mockParams,
          mockOptions
        )

        expect(fastGetUserById).toHaveBeenCalledWith('user-123')
        expect(accountLimitsOk).toHaveBeenCalledWith(mockUser, ['token'])
        expect(logEvent).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          type: 'action.form',
          relations: {
            blueprintId: 'blueprint-123',
            skillsetId: 'skillset-123',
            abilityId: 'ability-123',
          },
          meta: mockParams,
        })
        expect(execPrompt).toHaveBeenCalledWith(
          expect.objectContaining({
            user: 'user-123',
          }),
          { input: mockInput }
        )
        expect(Usage.createAndRecord).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          token: mockTokensUsed,
          model: mockModelUsed,
          meta: {
            source: 'test',
            reason: 'action/form',
          },
          references: {
            ...mockOptions.linkedResources,
            ...mockOptions.contextResources,
          },
        })
        expect(result).toEqual({
          result: mockResult,
          hintMessages: [
            {
              type: MessageType.context,
              text: 'Return the HTML form as is to be rendered in the browser. Do not use markdown codeblocks.',
            },
          ],
        })
      })

      it('should handle empty params object', async () => {
        const mockResult = '<form></form>'

        fastGetUserById.mockResolvedValue(mockUser)
        accountLimitsOk.mockResolvedValue(true)
        execPrompt.mockResolvedValue({
          completion: mockResult,
          tokensUsed: 50,
          modelUsed: 'gpt-3.5-turbo',
        })
        logEvent.mockResolvedValue(undefined)
        Usage.createAndRecord.mockResolvedValue({ id: 'usage-123' })

        const result = await executeFormAction(mockInput, {}, mockOptions)

        expect(result.result).toBe(mockResult)
        expect(logEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            meta: {},
          })
        )
      })

      it('should handle options without linkedResources', async () => {
        const mockResult = '<form></form>'
        const optionsWithoutLinked = {
          userId: 'user-123',
          usageMeta: {},
        }

        fastGetUserById.mockResolvedValue(mockUser)
        accountLimitsOk.mockResolvedValue(true)
        execPrompt.mockResolvedValue({
          completion: mockResult,
          tokensUsed: 50,
          modelUsed: 'gpt-3.5-turbo',
        })
        logEvent.mockResolvedValue(undefined)
        Usage.createAndRecord.mockResolvedValue({ id: 'usage-123' })

        const result = await executeFormAction(
          mockInput,
          mockParams,
          optionsWithoutLinked
        )

        expect(result.result).toBe(mockResult)
        expect(logEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            relations: {
              blueprintId: undefined,
              skillsetId: undefined,
              abilityId: undefined,
            },
          })
        )
      })
    })

    describe('user validation', () => {
      it('should throw error when user is not found', async () => {
        fastGetUserById.mockResolvedValue(null)

        await expect(
          executeFormAction(mockInput, mockParams, mockOptions)
        ).rejects.toThrow('User not found')

        expect(fastGetUserById).toHaveBeenCalledWith('user-123')
        expect(accountLimitsOk).not.toHaveBeenCalled()
      })

      it('should handle undefined user', async () => {
        fastGetUserById.mockResolvedValue(undefined)

        await expect(
          executeFormAction(mockInput, mockParams, mockOptions)
        ).rejects.toThrow('User not found')
      })
    })

    describe('account limit checks', () => {
      it('should return error when token limit is reached', async () => {
        fastGetUserById.mockResolvedValue(mockUser)
        accountLimitsOk.mockResolvedValue(false)

        const result = await executeFormAction(
          mockInput,
          mockParams,
          mockOptions
        )

        expect(accountLimitsOk).toHaveBeenCalledWith(mockUser, ['token'])
        expect(result).toEqual({
          error: 'You have reached your token limit.',
        })
        expect(execPrompt).not.toHaveBeenCalled()
      })
    })

    describe('edge cases', () => {
      it('should handle empty string input', async () => {
        const mockResult = '<form></form>'

        fastGetUserById.mockResolvedValue(mockUser)
        accountLimitsOk.mockResolvedValue(true)
        execPrompt.mockResolvedValue({
          completion: mockResult,
          tokensUsed: 10,
          modelUsed: 'gpt-3.5-turbo',
        })
        logEvent.mockResolvedValue(undefined)
        Usage.createAndRecord.mockResolvedValue({ id: 'usage-123' })

        const result = await executeFormAction('', mockParams, mockOptions)

        expect(execPrompt).toHaveBeenCalledWith(expect.any(Object), {
          input: '',
        })
        expect(result.result).toBe(mockResult)
      })

      it('should handle very long input', async () => {
        const longInput = 'Generate form '.repeat(1000)
        const mockResult = '<form></form>'

        fastGetUserById.mockResolvedValue(mockUser)
        accountLimitsOk.mockResolvedValue(true)
        execPrompt.mockResolvedValue({
          completion: mockResult,
          tokensUsed: 500,
          modelUsed: 'gpt-4',
        })
        logEvent.mockResolvedValue(undefined)
        Usage.createAndRecord.mockResolvedValue({ id: 'usage-123' })

        const result = await executeFormAction(
          longInput,
          mockParams,
          mockOptions
        )

        expect(result.result).toBe(mockResult)
      })

      it('should handle large token usage', async () => {
        const mockResult = '<form></form>'
        const largeTokenCount = 100000

        fastGetUserById.mockResolvedValue(mockUser)
        accountLimitsOk.mockResolvedValue(true)
        execPrompt.mockResolvedValue({
          completion: mockResult,
          tokensUsed: largeTokenCount,
          modelUsed: 'gpt-4',
        })
        logEvent.mockResolvedValue(undefined)
        Usage.createAndRecord.mockResolvedValue({ id: 'usage-123' })

        await executeFormAction(mockInput, mockParams, mockOptions)

        expect(Usage.createAndRecord).toHaveBeenCalledWith(
          expect.objectContaining({
            token: largeTokenCount,
          })
        )
      })
    })

    describe('error handling', () => {
      it('should propagate execPrompt errors', async () => {
        fastGetUserById.mockResolvedValue(mockUser)
        accountLimitsOk.mockResolvedValue(true)
        logEvent.mockResolvedValue(undefined)
        execPrompt.mockRejectedValue(new Error('Prompt execution failed'))

        await expect(
          executeFormAction(mockInput, mockParams, mockOptions)
        ).rejects.toThrow('Prompt execution failed')
      })

      it('should propagate logEvent errors', async () => {
        fastGetUserById.mockResolvedValue(mockUser)
        accountLimitsOk.mockResolvedValue(true)
        logEvent.mockRejectedValue(new Error('Logging failed'))

        await expect(
          executeFormAction(mockInput, mockParams, mockOptions)
        ).rejects.toThrow('Logging failed')
      })

      it('should propagate Usage.createAndRecord errors', async () => {
        fastGetUserById.mockResolvedValue(mockUser)
        accountLimitsOk.mockResolvedValue(true)
        execPrompt.mockResolvedValue({
          completion: '<form></form>',
          tokensUsed: 100,
          modelUsed: 'gpt-4',
        })
        logEvent.mockResolvedValue(undefined)
        Usage.createAndRecord.mockRejectedValue(
          new Error('Usage recording failed')
        )

        await expect(
          executeFormAction(mockInput, mockParams, mockOptions)
        ).rejects.toThrow('Usage recording failed')
      })
    })
  })
})
