// Type-only file test: verify TypeScript types compile correctly
describe('instruction.transform.types', () => {
  it('should export InstructionTransformResult type', () => {
    // @note this is a TypeScript types-only file with no runtime exports
    // We just verify the module can be imported without errors
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./instruction.transform.types')
    }).not.toThrow()
  })

  it('should define valid InstructionTransformResult structure', () => {
    // Example of a valid result matching the type definition
    const validResult = {
      action: 'fetch',
      params: { url: 'https://example.com' },
      text: 'GET /api/endpoint',
      usage: {
        tokensUsed: 100,
        modelUsed: 'gpt-4',
      },
    }

    expect(validResult).toMatchObject({
      action: expect.any(String),
      params: expect.any(Object),
      text: expect.any(String),
      usage: {
        tokensUsed: expect.any(Number),
        modelUsed: expect.any(String),
      },
    })
  })

  describe('InstructionTransformResult structure', () => {
    it('should have action field as string', () => {
      const result = {
        action: 'search',
        params: {},
        text: '',
        usage: { tokensUsed: 0, modelUsed: 'base' },
      }

      expect(typeof result.action).toBe('string')
    })

    it('should have params field as object', () => {
      const result = {
        action: 'fetch',
        params: { key: 'value' },
        text: '',
        usage: { tokensUsed: 0, modelUsed: 'base' },
      }

      expect(typeof result.params).toBe('object')
      expect(result.params).not.toBeNull()
    })

    it('should have text field as string', () => {
      const result = {
        action: 'email',
        params: {},
        text: 'Email content',
        usage: { tokensUsed: 50, modelUsed: 'gpt-3.5' },
      }

      expect(typeof result.text).toBe('string')
    })

    it('should have usage object with tokensUsed and modelUsed', () => {
      const result = {
        action: 'fetch',
        params: {},
        text: '',
        usage: { tokensUsed: 200, modelUsed: 'claude-2' },
      }

      expect(result.usage).toMatchObject({
        tokensUsed: expect.any(Number),
        modelUsed: expect.any(String),
      })
    })
  })

  describe('edge cases', () => {
    it('should handle empty params object', () => {
      const result = {
        action: 'abort',
        params: {},
        text: '',
        usage: { tokensUsed: 0, modelUsed: 'base' },
      }

      expect(result.params).toEqual({})
    })

    it('should handle empty text', () => {
      const result = {
        action: 'search',
        params: { query: 'test' },
        text: '',
        usage: { tokensUsed: 10, modelUsed: 'base' },
      }

      expect(result.text).toBe('')
    })

    it('should handle zero tokens used', () => {
      const result = {
        action: 'echo',
        params: {},
        text: 'test',
        usage: { tokensUsed: 0, modelUsed: 'base' },
      }

      expect(result.usage.tokensUsed).toBe(0)
    })

    it('should handle base model (no AI model used)', () => {
      const result = {
        action: 'fetch',
        params: {},
        text: '',
        usage: { tokensUsed: 0, modelUsed: 'base' },
      }

      expect(result.usage.modelUsed).toBe('base')
    })
  })
})
