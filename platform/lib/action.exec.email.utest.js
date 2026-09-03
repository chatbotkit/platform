import { render } from 'react-email'

import { sendEmailAction } from '@chatbotkit-dev/email'

import { getConfigBySchema } from '@/lib/action.config'
import { executeEmailAction } from '@/lib/action.exec.email'
import { isValidEmail } from '@/lib/email.validation'
import { UserInputError } from '@/lib/error'
import { accountLimitsOk } from '@/lib/limit.core'
import { recordEmailUsage } from '@/lib/usage.record'
import { fastGetUserById } from '@/lib/user.get'

jest.mock('@/lib/action.config', () => ({
  getConfigBySchema: jest.fn(),
}))

jest.mock('@/lib/email.validation', () => ({
  isValidEmail: jest.fn(),
}))

jest.mock('@/lib/user.get', () => ({
  fastGetUserById: jest.fn(),
}))

jest.mock('@/lib/limit.core', () => ({
  accountLimitsOk: jest.fn(),
}))

jest.mock('@chatbotkit-dev/email', () => ({
  sendEmailAction: jest.fn(),
}))

jest.mock('@/lib/usage.record', () => ({
  recordEmailUsage: jest.fn(),
}))

jest.mock('react-email', () => ({
  render: jest.fn(),
}))

describe('action.exec.email', () => {
  const mockUser = {
    id: 'user-123',
    email: 'sender@example.com',
  }

  const mockInput = 'This is the email content'
  const mockOptions = {
    userId: 'user-123',
    linkedResources: {
      blueprintId: 'blueprint-123',
    },
    usageMeta: { source: 'test' },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('executeEmailAction', () => {
    describe('successful email sending', () => {
      it('should send email with valid to address', async () => {
        const mockParams = { to: 'recipient@example.com' }

        getConfigBySchema.mockReturnValue({
          to: 'recipient@example.com',
          content: mockInput,
        })
        isValidEmail.mockReturnValue(true)
        fastGetUserById.mockResolvedValue(mockUser)
        accountLimitsOk.mockResolvedValue(true)
        render
          .mockResolvedValueOnce('Plain text content')
          .mockResolvedValueOnce('<html>HTML content</html>')
        sendEmailAction.mockResolvedValue({ success: true })
        recordEmailUsage.mockResolvedValue(undefined)

        const result = await executeEmailAction(
          mockInput,
          mockParams,
          mockOptions
        )

        expect(getConfigBySchema).toHaveBeenCalledWith({
          input: mockInput,
          params: mockParams,
          initial: {
            content: mockInput,
          },
          schema: expect.any(Object),
        })
        expect(isValidEmail).toHaveBeenCalledWith('recipient@example.com')
        expect(fastGetUserById).toHaveBeenCalledWith('user-123')
        expect(accountLimitsOk).toHaveBeenCalledWith(mockUser, ['email'])
        expect(render).toHaveBeenCalledTimes(2)
        // @note the sending identity is the email provider's, so there is no
        // `from` here and no dependence on a configured sending domain

        expect(sendEmailAction).toHaveBeenCalledWith({
          subject: expect.any(String),
          content: {
            text: 'Plain text content',
            html: '<html>HTML content</html>',
          },
          to: 'recipient@example.com',
          replyTo: undefined,
        })
        expect(recordEmailUsage).toHaveBeenCalledWith({
          user: mockUser,
          count: 1,
          meta: {
            reason: 'action/email',
          },
        })
        expect(result).toEqual({
          result: {
            status: 'success',
          },
        })
      })

      it('should send email with replyTo address', async () => {
        const mockParams = {
          to: 'recipient@example.com',
          replyTo: 'reply@example.com',
        }

        getConfigBySchema.mockReturnValue({
          to: 'recipient@example.com',
          replyTo: 'reply@example.com',
          content: mockInput,
        })
        isValidEmail.mockReturnValue(true)
        fastGetUserById.mockResolvedValue(mockUser)
        accountLimitsOk.mockResolvedValue(true)
        render
          .mockResolvedValueOnce('Plain text')
          .mockResolvedValueOnce('<html>HTML</html>')
        sendEmailAction.mockResolvedValue({ success: true })
        recordEmailUsage.mockResolvedValue(undefined)

        const result = await executeEmailAction(
          mockInput,
          mockParams,
          mockOptions
        )

        expect(isValidEmail).toHaveBeenCalledWith('recipient@example.com')
        expect(isValidEmail).toHaveBeenCalledWith('reply@example.com')
        expect(sendEmailAction).toHaveBeenCalledWith(
          expect.objectContaining({
            replyTo: 'reply@example.com',
          })
        )
        expect(result.result.status).toBe('success')
      })

      it('should send email with custom subject', async () => {
        const mockParams = {
          to: 'recipient@example.com',
          subject: 'Custom Subject Line',
        }

        getConfigBySchema.mockReturnValue({
          to: 'recipient@example.com',
          subject: 'Custom Subject Line',
          content: mockInput,
        })
        isValidEmail.mockReturnValue(true)
        fastGetUserById.mockResolvedValue(mockUser)
        accountLimitsOk.mockResolvedValue(true)
        render
          .mockResolvedValueOnce('text')
          .mockResolvedValueOnce('<html>html</html>')
        sendEmailAction.mockResolvedValue({ success: true })
        recordEmailUsage.mockResolvedValue(undefined)

        await executeEmailAction(mockInput, mockParams, mockOptions)

        expect(sendEmailAction).toHaveBeenCalledWith(
          expect.objectContaining({
            subject: 'Custom Subject Line',
          })
        )
      })

      it('should use content from input as default', async () => {
        const customContent = 'Custom email content'
        const mockParams = { to: 'recipient@example.com' }

        getConfigBySchema.mockReturnValue({
          to: 'recipient@example.com',
          content: customContent,
        })
        isValidEmail.mockReturnValue(true)
        fastGetUserById.mockResolvedValue(mockUser)
        accountLimitsOk.mockResolvedValue(true)
        render
          .mockResolvedValueOnce('text')
          .mockResolvedValueOnce('<html>html</html>')
        sendEmailAction.mockResolvedValue({ success: true })
        recordEmailUsage.mockResolvedValue(undefined)

        await executeEmailAction(customContent, mockParams, mockOptions)

        expect(getConfigBySchema).toHaveBeenCalledWith(
          expect.objectContaining({
            initial: {
              content: customContent,
            },
          })
        )
      })
    })

    describe('email validation', () => {
      it('should throw error for invalid to email', async () => {
        const mockParams = { to: 'invalid-email' }

        getConfigBySchema.mockReturnValue({
          to: 'invalid-email',
          content: mockInput,
        })
        isValidEmail.mockReturnValue(false)

        await expect(
          executeEmailAction(mockInput, mockParams, mockOptions)
        ).rejects.toThrow(UserInputError)

        await expect(
          executeEmailAction(mockInput, mockParams, mockOptions)
        ).rejects.toThrow("Invalid 'to' parameter")
      })

      it('should throw error for missing to parameter', async () => {
        const mockParams = {}

        getConfigBySchema.mockReturnValue({
          to: null,
          content: mockInput,
        })

        await expect(
          executeEmailAction(mockInput, mockParams, mockOptions)
        ).rejects.toThrow(UserInputError)

        await expect(
          executeEmailAction(mockInput, mockParams, mockOptions)
        ).rejects.toThrow("Missing 'to' parameter")
      })

      it('should throw error for undefined to parameter', async () => {
        const mockParams = {}

        getConfigBySchema.mockReturnValue({
          to: undefined,
          content: mockInput,
        })

        await expect(
          executeEmailAction(mockInput, mockParams, mockOptions)
        ).rejects.toThrow(UserInputError)
      })

      it('should throw error for empty string to parameter', async () => {
        const mockParams = { to: '' }

        getConfigBySchema.mockReturnValue({
          to: '',
          content: mockInput,
        })

        await expect(
          executeEmailAction(mockInput, mockParams, mockOptions)
        ).rejects.toThrow(UserInputError)
      })

      it('should throw error for invalid replyTo email', async () => {
        const mockParams = {
          to: 'valid@example.com',
          replyTo: 'invalid-reply',
        }

        getConfigBySchema.mockReturnValue({
          to: 'valid@example.com',
          replyTo: 'invalid-reply',
          content: mockInput,
        })
        isValidEmail
          .mockReturnValueOnce(true)
          .mockReturnValueOnce(false)
          .mockReturnValueOnce(true)
          .mockReturnValueOnce(false)

        await expect(
          executeEmailAction(mockInput, mockParams, mockOptions)
        ).rejects.toThrow(UserInputError)

        await expect(
          executeEmailAction(mockInput, mockParams, mockOptions)
        ).rejects.toThrow("Invalid 'replyTo' parameter")
      })
    })

    describe('user validation', () => {
      it('should throw error when user is not found', async () => {
        const mockParams = { to: 'recipient@example.com' }

        getConfigBySchema.mockReturnValue({
          to: 'recipient@example.com',
          content: mockInput,
        })
        isValidEmail.mockReturnValue(true)
        fastGetUserById.mockResolvedValue(null)

        await expect(
          executeEmailAction(mockInput, mockParams, mockOptions)
        ).rejects.toThrow('User not found')

        expect(fastGetUserById).toHaveBeenCalledWith('user-123')
      })

      it('should throw error when user is undefined', async () => {
        const mockParams = { to: 'recipient@example.com' }

        getConfigBySchema.mockReturnValue({
          to: 'recipient@example.com',
          content: mockInput,
        })
        isValidEmail.mockReturnValue(true)
        fastGetUserById.mockResolvedValue(undefined)

        await expect(
          executeEmailAction(mockInput, mockParams, mockOptions)
        ).rejects.toThrow('User not found')
      })
    })

    describe('account limit checks', () => {
      it('should return error when email limit is reached', async () => {
        const mockParams = { to: 'recipient@example.com' }

        getConfigBySchema.mockReturnValue({
          to: 'recipient@example.com',
          content: mockInput,
        })
        isValidEmail.mockReturnValue(true)
        fastGetUserById.mockResolvedValue(mockUser)
        accountLimitsOk.mockResolvedValue(false)

        const result = await executeEmailAction(
          mockInput,
          mockParams,
          mockOptions
        )

        expect(accountLimitsOk).toHaveBeenCalledWith(mockUser, ['email'])
        expect(result).toEqual({
          error: 'You have reached your email limit.',
        })
        expect(sendEmailAction).not.toHaveBeenCalled()
      })
    })

    describe('edge cases', () => {
      it('should handle empty content', async () => {
        const mockParams = { to: 'recipient@example.com' }

        getConfigBySchema.mockReturnValue({
          to: 'recipient@example.com',
          content: '',
        })
        isValidEmail.mockReturnValue(true)
        fastGetUserById.mockResolvedValue(mockUser)
        accountLimitsOk.mockResolvedValue(true)
        render.mockResolvedValueOnce('').mockResolvedValueOnce('<html></html>')
        sendEmailAction.mockResolvedValue({ success: true })
        recordEmailUsage.mockResolvedValue(undefined)

        const result = await executeEmailAction('', mockParams, mockOptions)

        expect(result.result.status).toBe('success')
      })

      it('should handle very long content', async () => {
        const longContent = 'Long content '.repeat(10000)
        const mockParams = { to: 'recipient@example.com' }

        getConfigBySchema.mockReturnValue({
          to: 'recipient@example.com',
          content: longContent,
        })
        isValidEmail.mockReturnValue(true)
        fastGetUserById.mockResolvedValue(mockUser)
        accountLimitsOk.mockResolvedValue(true)
        render
          .mockResolvedValueOnce('text')
          .mockResolvedValueOnce('<html>html</html>')
        sendEmailAction.mockResolvedValue({ success: true })
        recordEmailUsage.mockResolvedValue(undefined)

        const result = await executeEmailAction(
          longContent,
          mockParams,
          mockOptions
        )

        expect(result.result.status).toBe('success')
      })

      it('should handle multiple email addresses format', async () => {
        const mockParams = { to: 'user+tag@example.com' }

        getConfigBySchema.mockReturnValue({
          to: 'user+tag@example.com',
          content: mockInput,
        })
        isValidEmail.mockReturnValue(true)
        fastGetUserById.mockResolvedValue(mockUser)
        accountLimitsOk.mockResolvedValue(true)
        render
          .mockResolvedValueOnce('text')
          .mockResolvedValueOnce('<html>html</html>')
        sendEmailAction.mockResolvedValue({ success: true })
        recordEmailUsage.mockResolvedValue(undefined)

        const result = await executeEmailAction(
          mockInput,
          mockParams,
          mockOptions
        )

        expect(result.result.status).toBe('success')
      })
    })

    describe('error handling', () => {
      it('should propagate render errors', async () => {
        const mockParams = { to: 'recipient@example.com' }

        getConfigBySchema.mockReturnValue({
          to: 'recipient@example.com',
          content: mockInput,
        })
        isValidEmail.mockReturnValue(true)
        fastGetUserById.mockResolvedValue(mockUser)
        accountLimitsOk.mockResolvedValue(true)
        render.mockRejectedValue(new Error('Rendering failed'))

        await expect(
          executeEmailAction(mockInput, mockParams, mockOptions)
        ).rejects.toThrow('Rendering failed')
      })

      it('should propagate sendEmailAction errors', async () => {
        const mockParams = { to: 'recipient@example.com' }

        getConfigBySchema.mockReturnValue({
          to: 'recipient@example.com',
          content: mockInput,
        })
        isValidEmail.mockReturnValue(true)
        fastGetUserById.mockResolvedValue(mockUser)
        accountLimitsOk.mockResolvedValue(true)
        render
          .mockResolvedValueOnce('text')
          .mockResolvedValueOnce('<html>html</html>')
        sendEmailAction.mockRejectedValue(new Error('Send failed'))

        await expect(
          executeEmailAction(mockInput, mockParams, mockOptions)
        ).rejects.toThrow('Send failed')
      })

      it('should propagate recordEmailUsage errors', async () => {
        const mockParams = { to: 'recipient@example.com' }

        getConfigBySchema.mockReturnValue({
          to: 'recipient@example.com',
          content: mockInput,
        })
        isValidEmail.mockReturnValue(true)
        fastGetUserById.mockResolvedValue(mockUser)
        accountLimitsOk.mockResolvedValue(true)
        render
          .mockResolvedValueOnce('text')
          .mockResolvedValueOnce('<html>html</html>')
        sendEmailAction.mockResolvedValue({ success: true })
        recordEmailUsage.mockRejectedValue(new Error('Usage recording failed'))

        await expect(
          executeEmailAction(mockInput, mockParams, mockOptions)
        ).rejects.toThrow('Usage recording failed')
      })
    })
  })
})
