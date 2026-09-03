import { transformComplexInstruction } from '@/lib/instruction.transform.complex'
import { execPrompt } from '@/lib/prompt'
import { Usage } from '@/lib/usage.model'

jest.mock('@/lib/prompt', () => ({
  execPrompt: jest.fn(),
}))

jest.mock('@/lib/usage.model', () => ({
  Usage: jest.fn(() => ({
    addTokens: jest.fn(),
    toTokenModelObject: jest.fn(() => ({
      token: 100,
      model: 'test-model',
    })),
  })),
}))

jest.mock('@/lib/action.name', () => ({
  ActionName: {
    fetch: 'fetch',
    search: 'search',
    email: 'email',
    echo: 'echo',
  },
}))

describe('transformComplexInstruction', () => {
  let mockExecPrompt
  let mockUsage

  beforeEach(() => {
    jest.clearAllMocks()

    mockExecPrompt = execPrompt
    mockUsage = Usage

    // Setup default mock responses - returns an action block that can be parsed
    mockExecPrompt.mockResolvedValue({
      completion: '```echo\ntransformed instruction content\n```',
      tokensUsed: 50,
      modelUsed: 'gpt-4',
    })
  })

  it('should transform complex instruction successfully', async () => {
    const instruction = `\`\`\`fetch
method: POST
url: /api/test
\`\`\`

Some additional text that makes this complex.`

    const input = 'user input'
    const options = { userId: 'test-user' }

    const result = await transformComplexInstruction(
      instruction,
      input,
      options
    )

    expect(result).toEqual({
      action: 'echo',
      params: {},
      text: 'transformed instruction content',
      usage: {
        tokensUsed: 100,
        modelUsed: 'test-model',
      },
    })

    expect(mockExecPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        user: 'test-user',
        retryTimeout: true,
      }),
      expect.objectContaining({
        availableActions: expect.any(String),
        instruction: instruction,
        input: 'user input',
      }),
      expect.anything()
    )
  })

  it('should handle JSON input correctly', async () => {
    const instruction = 'test instruction'
    const input = { query: 'test', data: 'value' }
    const options = { userId: 'test-user' }

    await transformComplexInstruction(instruction, input, options)

    expect(mockExecPrompt).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        input: JSON.stringify(input),
      }),
      expect.anything()
    )
  })

  it('should handle string input correctly', async () => {
    const instruction = 'test instruction'
    const input = 'plain string input'
    const options = { userId: 'test-user' }

    await transformComplexInstruction(instruction, input, options)

    expect(mockExecPrompt).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        input: 'plain string input',
      }),
      expect.anything()
    )
  })

  it('should track token usage correctly', async () => {
    const instruction = 'test instruction'
    const input = 'test input'
    const options = { userId: 'test-user' }

    const mockUsageInstance = {
      addTokens: jest.fn(),
      toTokenModelObject: jest.fn(() => ({
        token: 150,
        model: 'custom-model',
      })),
    }

    mockUsage.mockReturnValue(mockUsageInstance)

    const result = await transformComplexInstruction(
      instruction,
      input,
      options
    )

    expect(mockUsageInstance.addTokens).toHaveBeenCalledWith(50, 'gpt-4')
    expect(result).toEqual({
      action: 'echo',
      params: {},
      text: 'transformed instruction content',
      usage: {
        tokensUsed: 150,
        modelUsed: 'custom-model',
      },
    })
  })

  it('should trim completion whitespace', async () => {
    mockExecPrompt.mockResolvedValue({
      completion: '  \n  ```echo\ntransformed content\n```  \n  ',
      tokensUsed: 25,
      modelUsed: 'gpt-3.5',
    })

    const instruction = 'test instruction'
    const input = 'test input'
    const options = { userId: 'test-user' }

    const result = await transformComplexInstruction(
      instruction,
      input,
      options
    )

    expect(result.text).toBe('transformed content')
  })

  it('should throw error when no action found in completion', async () => {
    mockExecPrompt.mockResolvedValue({
      completion: 'no action block here',
      tokensUsed: 10,
      modelUsed: 'gpt-4',
    })

    const instruction = 'test instruction'
    const input = 'test input'
    const options = { userId: 'test-user' }

    await expect(
      transformComplexInstruction(instruction, input, options)
    ).rejects.toThrow('No action found in complex instruction')
  })

  it('should handle execPrompt errors', async () => {
    mockExecPrompt.mockRejectedValue(new Error('Prompt execution failed'))

    const instruction = 'test instruction'
    const input = 'test input'
    const options = { userId: 'test-user' }

    await expect(
      transformComplexInstruction(instruction, input, options)
    ).rejects.toThrow('Prompt execution failed')
  })

  it('should pass retryTimeout option correctly', async () => {
    const instruction = 'test instruction'
    const input = 'test input'
    const options = { userId: 'test-user' }

    await transformComplexInstruction(instruction, input, options)

    expect(mockExecPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        retryTimeout: true,
      }),
      expect.anything(),
      expect.anything()
    )
  })
})
