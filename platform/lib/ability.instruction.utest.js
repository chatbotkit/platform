import { getRealInstruction } from '@/lib/ability.instruction'
import { getInstructionType } from '@/lib/instruction.type'
import { execPrompt } from '@/lib/prompt'
import { recordLanguageTokenUsage } from '@/lib/usage.record'

jest.mock('@/lib/instruction.type')
jest.mock('@/lib/prompt')
jest.mock('@/lib/usage.record')

describe('getRealInstruction', () => {
  // Setup common test data
  const mockUser = { id: 'test-user-123' }
  const mockResult = 'Generated instruction result'
  const mockTokensUsed = 150
  const mockModelUsed = 'base'

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks()

    // Setup default mock implementations
    recordLanguageTokenUsage.mockResolvedValue(undefined)
  })

  describe('when instruction is undefined', () => {
    it('should return undefined immediately', async () => {
      // Arrange
      const instruction = undefined

      // Act
      const result = await getRealInstruction(mockUser, instruction)

      // Assert
      expect(result).toBeUndefined()
      expect(getInstructionType).not.toHaveBeenCalled()
      expect(execPrompt).not.toHaveBeenCalled()
      expect(recordLanguageTokenUsage).not.toHaveBeenCalled()
    })
  })

  describe('when instruction is empty or whitespace', () => {
    it('should return empty string for empty instruction', async () => {
      // Arrange
      const instruction = ''

      // Act
      const result = await getRealInstruction(mockUser, instruction)

      // Assert
      expect(result).toBe('')
      expect(getInstructionType).not.toHaveBeenCalled()
      expect(execPrompt).not.toHaveBeenCalled()
      expect(recordLanguageTokenUsage).not.toHaveBeenCalled()
    })

    it('should return empty string for whitespace-only instruction', async () => {
      // Arrange
      const instruction = '   \n\t  '

      // Act
      const result = await getRealInstruction(mockUser, instruction)

      // Assert
      expect(result).toBe('')
      expect(getInstructionType).not.toHaveBeenCalled()
      expect(execPrompt).not.toHaveBeenCalled()
      expect(recordLanguageTokenUsage).not.toHaveBeenCalled()
    })
  })

  describe('when instruction type is not automatic', () => {
    it('should return undefined for template instruction', async () => {
      // Arrange
      const instruction = 'template instruction'

      getInstructionType.mockReturnValue('template')

      // Act
      const result = await getRealInstruction(mockUser, instruction)

      // Assert
      expect(result).toBeUndefined()
      expect(getInstructionType).toHaveBeenCalledWith('template instruction')
      expect(execPrompt).not.toHaveBeenCalled()
      expect(recordLanguageTokenUsage).not.toHaveBeenCalled()
    })

    it('should return undefined for complex instruction', async () => {
      // Arrange
      const instruction = 'complex instruction'

      getInstructionType.mockReturnValue('complex')

      // Act
      const result = await getRealInstruction(mockUser, instruction)

      // Assert
      expect(result).toBeUndefined()
      expect(getInstructionType).toHaveBeenCalledWith('complex instruction')
      expect(execPrompt).not.toHaveBeenCalled()
      expect(recordLanguageTokenUsage).not.toHaveBeenCalled()
    })

    it('should return undefined for simple instruction', async () => {
      // Arrange
      const instruction = 'simple instruction'

      getInstructionType.mockReturnValue('simple')

      // Act
      const result = await getRealInstruction(mockUser, instruction)

      // Assert
      expect(result).toBeUndefined()
      expect(getInstructionType).toHaveBeenCalledWith('simple instruction')
      expect(execPrompt).not.toHaveBeenCalled()
      expect(recordLanguageTokenUsage).not.toHaveBeenCalled()
    })
  })

  describe('when instruction type is automatic', () => {
    beforeEach(() => {
      getInstructionType.mockReturnValue('automatic')
      execPrompt.mockResolvedValue({
        completion: mockResult,
        tokensUsed: mockTokensUsed,
        modelUsed: mockModelUsed,
      })
    })

    it('should process automatic instruction and return generated result', async () => {
      // Arrange
      const instruction = 'automatic instruction text'

      // Act
      const result = await getRealInstruction(mockUser, instruction)

      // Assert
      expect(result).toBe(mockResult)
      expect(getInstructionType).toHaveBeenCalledWith(
        'automatic instruction text'
      )
      expect(execPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          user: mockUser.id,
        }),
        {
          input: 'automatic instruction text',
        }
      )

      expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
        user: mockUser,
        count: 150,
        model: 'base',
        meta: expect.objectContaining({
          reason: 'instruction/generate',
          lineItems: expect.arrayContaining([
            expect.objectContaining({
              tokens: mockTokensUsed,
              model: mockModelUsed,
              type: 'default',
              debit: 150,
              ratio: 1,
            }),
          ]),
        }),
      })
    })

    it('should trim whitespace from instruction before processing', async () => {
      // Arrange
      const instruction = '  \n  automatic instruction with whitespace  \t  '

      // Act
      const result = await getRealInstruction(mockUser, instruction)

      // Assert
      expect(result).toBe(mockResult)
      expect(getInstructionType).toHaveBeenCalledWith(
        'automatic instruction with whitespace'
      )
      expect(execPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          user: mockUser.id,
        }),
        {
          input: 'automatic instruction with whitespace',
        }
      )
    })

    it('should handle long result text correctly', async () => {
      // Arrange
      const longResult = 'x'.repeat(500)

      execPrompt.mockResolvedValue({
        completion: longResult,
        tokensUsed: mockTokensUsed,
        modelUsed: mockModelUsed,
      })

      const instruction = 'automatic instruction'

      // Act
      const result = await getRealInstruction(mockUser, instruction)

      // Assert
      expect(result).toBe(longResult)
    })

    it('should handle execPrompt errors gracefully', async () => {
      // Arrange
      const instruction = 'automatic instruction'
      const error = new Error('Prompt execution failed')

      execPrompt.mockRejectedValue(error)

      // Act & Assert
      await expect(getRealInstruction(mockUser, instruction)).rejects.toThrow(
        'Prompt execution failed'
      )
      expect(recordLanguageTokenUsage).not.toHaveBeenCalled()
    })

    it('should handle recordLanguageTokenUsage errors gracefully', async () => {
      // Arrange
      const instruction = 'automatic instruction'
      const usageError = new Error('Usage recording failed')

      recordLanguageTokenUsage.mockRejectedValue(usageError)

      // Act & Assert
      await expect(getRealInstruction(mockUser, instruction)).rejects.toThrow(
        'Usage recording failed'
      )
      expect(execPrompt).toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle user object with different structure', async () => {
      // Arrange
      const userWithExtraProps = {
        id: 'user-456',
        name: 'Test User',
        email: 'test@example.com',
      }

      const instruction = 'automatic instruction'

      getInstructionType.mockReturnValue('automatic')
      execPrompt.mockResolvedValue({
        completion: mockResult,
        tokensUsed: mockTokensUsed,
        modelUsed: mockModelUsed,
      })

      // Act
      const result = await getRealInstruction(userWithExtraProps, instruction)

      // Assert
      expect(result).toBe(mockResult)
      expect(execPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          user: 'user-456',
        }),
        {
          input: 'automatic instruction',
        }
      )
    })

    it('should handle zero tokens used', async () => {
      // Arrange
      const instruction = 'automatic instruction'

      getInstructionType.mockReturnValue('automatic')
      execPrompt.mockResolvedValue({
        completion: mockResult,
        tokensUsed: 0,
        modelUsed: mockModelUsed,
      })

      // Act
      const result = await getRealInstruction(mockUser, instruction)

      // Assert
      expect(result).toBe(mockResult)
      expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
        user: { id: mockUser.id },
        count: 0,
        model: 'base',
        meta: {
          reason: 'instruction/generate',
          lineItems: [],
        },
      })
    })

    it('should handle empty string result from execPrompt', async () => {
      // Arrange
      const instruction = 'automatic instruction'

      getInstructionType.mockReturnValue('automatic')
      execPrompt.mockResolvedValue({
        completion: '',
        tokensUsed: mockTokensUsed,
        modelUsed: mockModelUsed,
      })

      // Act
      const result = await getRealInstruction(mockUser, instruction)

      // Assert
      expect(result).toBe('')
      expect(recordLanguageTokenUsage).toHaveBeenCalled()
    })
  })
})
