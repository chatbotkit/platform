import { confirm, prompt, script } from './index'

import inquirer from 'inquirer'

jest.mock('inquirer')

describe('script', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('CLI mode', () => {
    it('should parse string options from CLI', async () => {
      const handler = jest.fn()

      await script(
        {
          name: 'test-script',
          description: 'A test script',
          options: {
            email: {
              type: 'string',
              short: 'e',
              description: 'User email',
              required: true,
            },
          },
          handler,
        },
        ['node', 'test', '--email', 'test@example.com']
      )

      expect(handler).toHaveBeenCalledWith({ email: 'test@example.com' })
      expect(inquirer.prompt).not.toHaveBeenCalled()
    })

    it('should parse short flags', async () => {
      const handler = jest.fn()

      await script(
        {
          name: 'test-script',
          description: 'A test script',
          options: {
            email: {
              type: 'string',
              short: 'e',
              description: 'User email',
              required: true,
            },
          },
          handler,
        },
        ['node', 'test', '-e', 'short@example.com']
      )

      expect(handler).toHaveBeenCalledWith({ email: 'short@example.com' })
    })

    it('should parse boolean flags', async () => {
      const handler = jest.fn()

      await script(
        {
          name: 'test-script',
          description: 'A test script',
          options: {
            dryRun: {
              type: 'boolean',
              short: 'd',
              description: 'Dry run mode',
            },
          },
          handler,
        },
        ['node', 'test', '--dryRun']
      )

      expect(handler).toHaveBeenCalledWith({ dryRun: true })
    })

    it('should use default values when not provided', async () => {
      const handler = jest.fn()

      await script(
        {
          name: 'test-script',
          description: 'A test script',
          options: {
            format: {
              type: 'string',
              description: 'Output format',
              default: 'json',
            },
          },
          handler,
        },
        ['node', 'test']
      )

      expect(handler).toHaveBeenCalledWith({ format: 'json' })
    })

    it('should parse multiple options', async () => {
      const handler = jest.fn()

      await script(
        {
          name: 'test-script',
          description: 'A test script',
          options: {
            botId: {
              type: 'string',
              short: 'b',
              description: 'Bot ID',
              required: true,
            },
            userId: {
              type: 'string',
              short: 'u',
              description: 'User ID',
              required: true,
            },
          },
          handler,
        },
        ['node', 'test', '--botId', 'bot123', '--userId', 'user456']
      )

      expect(handler).toHaveBeenCalledWith({
        botId: 'bot123',
        userId: 'user456',
      })
    })

    it('should parse options passed after standalone --', async () => {
      const handler = jest.fn()

      await script(
        {
          name: 'test-script',
          description: 'A test script',
          options: {
            type: {
              type: 'string',
              description: 'Content type',
              default: 'manuals',
            },
          },
          handler,
        },
        ['node', 'test', '--', '--type', 'abilities']
      )

      expect(handler).toHaveBeenCalledWith({ type: 'abilities' })
    })
  })

  describe('interactive mode', () => {
    it('should prompt for missing required string options', async () => {
      const handler = jest.fn()

      inquirer.prompt.mockResolvedValueOnce({ value: 'prompted@example.com' })

      await script(
        {
          name: 'test-script',
          description: 'A test script',
          options: {
            email: {
              type: 'string',
              short: 'e',
              description: 'User email',
              message: 'What is the email address?',
              required: true,
            },
          },
          handler,
        },
        ['node', 'test']
      )

      expect(inquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'input',
          name: 'value',
          message: 'What is the email address?',
        }),
      ])
      expect(handler).toHaveBeenCalledWith({ email: 'prompted@example.com' })
    })

    it('should use description as message when message not provided', async () => {
      const handler = jest.fn()

      inquirer.prompt.mockResolvedValueOnce({ value: 'test@example.com' })

      await script(
        {
          name: 'test-script',
          description: 'A test script',
          options: {
            email: {
              type: 'string',
              description: 'User email address',
              required: true,
            },
          },
          handler,
        },
        ['node', 'test']
      )

      expect(inquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          message: 'User email address',
        }),
      ])
    })

    it('should prompt for confirm type options', async () => {
      const handler = jest.fn()

      inquirer.prompt.mockResolvedValueOnce({ value: true })

      await script(
        {
          name: 'test-script',
          description: 'A test script',
          options: {
            confirm: {
              type: 'confirm',
              description: 'Confirm action',
              message: 'Are you sure?',
              required: true,
            },
          },
          handler,
        },
        ['node', 'test']
      )

      expect(inquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'confirm',
          name: 'value',
          message: 'Are you sure?',
          default: false,
        }),
      ])
      expect(handler).toHaveBeenCalledWith({ confirm: true })
    })

    it('should only prompt for missing required options', async () => {
      const handler = jest.fn()

      inquirer.prompt.mockResolvedValueOnce({ value: 'user456' })

      await script(
        {
          name: 'test-script',
          description: 'A test script',
          options: {
            botId: {
              type: 'string',
              description: 'Bot ID',
              required: true,
            },
            userId: {
              type: 'string',
              description: 'User ID',
              required: true,
            },
          },
          handler,
        },
        ['node', 'test', '--botId', 'bot123']
      )

      // @note should only prompt once for userId since botId was provided
      expect(inquirer.prompt).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith({
        botId: 'bot123',
        userId: 'user456',
      })
    })

    it('should not prompt for optional options', async () => {
      const handler = jest.fn()

      await script(
        {
          name: 'test-script',
          description: 'A test script',
          options: {
            format: {
              type: 'string',
              description: 'Output format',
              required: false,
            },
          },
          handler,
        },
        ['node', 'test']
      )

      expect(inquirer.prompt).not.toHaveBeenCalled()
      expect(handler).toHaveBeenCalledWith({ format: undefined })
    })
  })

  describe('mixed mode', () => {
    it('should use CLI values and prompt for missing required', async () => {
      const handler = jest.fn()

      inquirer.prompt.mockResolvedValueOnce({ value: 'prompted@example.com' })

      await script(
        {
          name: 'test-script',
          description: 'A test script',
          options: {
            email: {
              type: 'string',
              description: 'Email',
              required: true,
            },
            dryRun: {
              type: 'boolean',
              description: 'Dry run',
            },
          },
          handler,
        },
        ['node', 'test', '--dryRun']
      )

      expect(handler).toHaveBeenCalledWith({
        email: 'prompted@example.com',
        dryRun: true,
      })
    })
  })
})

describe('confirm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should prompt for confirmation and return result', async () => {
    inquirer.prompt.mockResolvedValueOnce({ value: true })

    const result = await confirm('Are you sure?')

    expect(inquirer.prompt).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'confirm',
        name: 'value',
        message: 'Are you sure?',
        default: false,
      }),
    ])
    expect(result).toBe(true)
  })

  it('should use provided default value', async () => {
    inquirer.prompt.mockResolvedValueOnce({ value: true })

    await confirm('Are you sure?', true)

    expect(inquirer.prompt).toHaveBeenCalledWith([
      expect.objectContaining({
        default: true,
      }),
    ])
  })
})

describe('prompt', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should prompt for input and return result', async () => {
    inquirer.prompt.mockResolvedValueOnce({ value: 'user input' })

    const result = await prompt('Enter value:')

    expect(inquirer.prompt).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'input',
        name: 'value',
        message: 'Enter value:',
      }),
    ])
    expect(result).toBe('user input')
  })

  it('should use provided default value', async () => {
    inquirer.prompt.mockResolvedValueOnce({ value: 'default' })

    await prompt('Enter value:', 'default')

    expect(inquirer.prompt).toHaveBeenCalledWith([
      expect.objectContaining({
        default: 'default',
      }),
    ])
  })
})
