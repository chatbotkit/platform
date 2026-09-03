import { schema } from '@/lib/joi.handler'

import namespaceSchema from '@/schemas/namespace'

describe('namespaceSchema', () => {
  const mockUser = { id: 'user-123' }
  const mockSession = { user: mockUser }
  const mockContext = { session: mockSession }

  describe('basic validation', () => {
    it('should accept string values', async () => {
      const s = schema.object({
        namespace: namespaceSchema,
      })

      const result = await s.validateAsync(
        { namespace: 'my-namespace' },
        { context: mockContext }
      )

      expect(result).toEqual({ namespace: 'my-namespace' })
    })

    it('should accept null values', async () => {
      const s = schema.object({
        namespace: namespaceSchema,
      })

      const result = await s.validateAsync(
        { namespace: null },
        { context: mockContext }
      )

      expect(result).toEqual({ namespace: null })
    })

    it('should accept empty string values', async () => {
      const s = schema.object({
        namespace: namespaceSchema,
      })

      const result = await s.validateAsync(
        { namespace: '' },
        { context: mockContext }
      )

      expect(result).toEqual({ namespace: '' })
    })

    it('should accept undefined values', async () => {
      const s = schema.object({
        namespace: namespaceSchema,
      })

      const result = await s.validateAsync({}, { context: mockContext })

      expect(result).toEqual({})
    })
  })

  describe('authentication', () => {
    it('should throw error if not authenticated', async () => {
      const s = schema.object({
        namespace: namespaceSchema,
      })

      await expect(
        s.validateAsync(
          { namespace: 'my-namespace' },
          { context: { session: {} } }
        )
      ).rejects.toThrow()
    })
  })

  describe('payload.namespace propagation (token-based namespace)', () => {
    it('should use namespace from payload when present', async () => {
      const mockContextWithPayload = {
        session: {
          user: mockUser,
          payload: { namespace: 'namespace-from-payload' },
        },
      }

      const s = schema.object({
        namespace: namespaceSchema,
      })

      // @note even if namespace is not provided in the request body,
      // it should use the one from the payload
      const result = await s.validateAsync(
        {},
        { context: mockContextWithPayload }
      )

      expect(result).toEqual({ namespace: 'namespace-from-payload' })
    })

    it('should override request body namespace with payload namespace', async () => {
      const mockContextWithPayload = {
        session: {
          user: mockUser,
          payload: { namespace: 'namespace-from-payload' },
        },
      }

      const s = schema.object({
        namespace: namespaceSchema,
      })

      // @note request body provides 'namespace-in-body' but payload has 'namespace-from-payload'
      // payload should take precedence
      const result = await s.validateAsync(
        { namespace: 'namespace-in-body' },
        { context: mockContextWithPayload }
      )

      expect(result).toEqual({ namespace: 'namespace-from-payload' })
    })

    it('should fall back to request body when payload.namespace is not present', async () => {
      // @note payload exists but without namespace
      const mockContextWithEmptyPayload = {
        session: {
          user: mockUser,
          payload: {},
        },
      }

      const s = schema.object({
        namespace: namespaceSchema,
      })

      const result = await s.validateAsync(
        { namespace: 'namespace-from-body' },
        { context: mockContextWithEmptyPayload }
      )

      expect(result).toEqual({ namespace: 'namespace-from-body' })
    })

    it('should fall back to request body when no payload exists', async () => {
      const s = schema.object({
        namespace: namespaceSchema,
      })

      const result = await s.validateAsync(
        { namespace: 'namespace-from-body' },
        { context: mockContext }
      )

      expect(result).toEqual({ namespace: 'namespace-from-body' })
    })
  })
})
