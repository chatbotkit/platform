/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */

let capturedHandlerFn = null

jest.mock('@/lib/auxiliary.handler', () => ({
  authenticatedHandler: jest.fn((schema, fn) => {
    // @note every auxiliary route is authenticated; bind a mock session so
    // the tests keep calling the inner function as (parameters, headers)
    capturedHandlerFn = (parameters, headers) =>
      fn({ user: { id: 'test-user-id' } }, parameters, headers)

    return jest.fn()
  }),
}))

jest.mock('@/lib/debug', () => jest.fn(() => ({ log: jest.fn() })))

jest.mock('mathjs', () => ({
  evaluate: jest.fn(),
}))

// Import after mocks so capturedHandlerFn is populated
require('@/pages/api/auxiliary/skillset/ability/chatbotkit/math/evaluate')

const { evaluate } = require('mathjs')

describe('auxiliary/skillset/ability/chatbotkit/math/evaluate', () => {
  const mockHeaders = new Headers()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should export an authenticated handler', () => {
    expect(capturedHandlerFn).toBeDefined()
    expect(typeof capturedHandlerFn).toBe('function')
  })

  describe('basic expression evaluation', () => {
    it('should evaluate a simple arithmetic expression', async () => {
      evaluate.mockReturnValue(4)

      const result = await capturedHandlerFn(
        { expression: '2 + 2' },
        mockHeaders
      )

      expect(evaluate).toHaveBeenCalledWith('2 + 2')
      expect(result).toBe(4)
    })

    it('should evaluate a multiplication expression', async () => {
      evaluate.mockReturnValue(6)

      const result = await capturedHandlerFn(
        { expression: '2 * 3' },
        mockHeaders
      )

      expect(evaluate).toHaveBeenCalledWith('2 * 3')
      expect(result).toBe(6)
    })

    it('should evaluate a division expression', async () => {
      evaluate.mockReturnValue(2.5)

      const result = await capturedHandlerFn(
        { expression: '5 / 2' },
        mockHeaders
      )

      expect(evaluate).toHaveBeenCalledWith('5 / 2')
      expect(result).toBe(2.5)
    })

    it('should evaluate a complex expression', async () => {
      evaluate.mockReturnValue(14)

      const result = await capturedHandlerFn(
        { expression: '2 + 3 * 4' },
        mockHeaders
      )

      expect(evaluate).toHaveBeenCalledWith('2 + 3 * 4')
      expect(result).toBe(14)
    })
  })

  describe('return value types', () => {
    it('should return numeric result directly', async () => {
      evaluate.mockReturnValue(42)

      const result = await capturedHandlerFn({ expression: '42' }, mockHeaders)

      expect(result).toBe(42)
    })

    it('should return float result', async () => {
      evaluate.mockReturnValue(3.14159)

      const result = await capturedHandlerFn({ expression: 'pi' }, mockHeaders)

      expect(result).toBe(3.14159)
    })

    it('should return matrix or array results', async () => {
      const matrixResult = [1, 2, 3]

      evaluate.mockReturnValue(matrixResult)

      const result = await capturedHandlerFn(
        { expression: '[1, 2, 3]' },
        mockHeaders
      )

      expect(result).toEqual(matrixResult)
    })

    it('should return string results for unit expressions', async () => {
      evaluate.mockReturnValue('100 cm')

      const result = await capturedHandlerFn(
        { expression: '1 m to cm' },
        mockHeaders
      )

      expect(result).toBe('100 cm')
    })
  })

  describe('error propagation', () => {
    it('should propagate errors thrown by mathjs evaluate', async () => {
      evaluate.mockImplementation(() => {
        throw new Error('Undefined symbol: x')
      })

      await expect(
        capturedHandlerFn({ expression: 'x + 1' }, mockHeaders)
      ).rejects.toThrow('Undefined symbol: x')
    })

    it('should propagate syntax errors from mathjs', async () => {
      evaluate.mockImplementation(() => {
        throw new SyntaxError('Unexpected token')
      })

      await expect(
        capturedHandlerFn({ expression: '1 + + + 2' }, mockHeaders)
      ).rejects.toThrow('Unexpected token')
    })
  })

  describe('expression forwarding', () => {
    it('should pass the expression directly to mathjs evaluate', async () => {
      evaluate.mockReturnValue(0)

      const expression = 'sqrt(16) + log(10)'

      await capturedHandlerFn({ expression }, mockHeaders)

      expect(evaluate).toHaveBeenCalledWith(expression)
      expect(evaluate).toHaveBeenCalledTimes(1)
    })
  })
})
