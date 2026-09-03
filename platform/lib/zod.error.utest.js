import { getFriendlyErrorMessage } from '@/lib/zod.error'

import { z } from 'zod'

describe('zod.error module', () => {
  describe('getFriendlyErrorMessage', () => {
    it('should format simple required field error', () => {
      const schema = z.object({
        name: z.string(),
      })

      try {
        schema.parse({})
      } catch (error) {
        const message = getFriendlyErrorMessage(error)

        expect(message).toContain('Required')
        expect(message).toContain('name')
      }
    })

    it('should format string type error', () => {
      const schema = z.object({
        email: z.string(),
      })

      try {
        schema.parse({ email: 123 })
      } catch (error) {
        const message = getFriendlyErrorMessage(error)

        expect(message).toContain('Expected string')
        expect(message).toContain('email')
      }
    })

    it('should format number type error', () => {
      const schema = z.object({
        age: z.number(),
      })

      try {
        schema.parse({ age: 'not a number' })
      } catch (error) {
        const message = getFriendlyErrorMessage(error)

        expect(message).toContain('Expected number')
        expect(message).toContain('age')
      }
    })

    it('should format email validation error', () => {
      const schema = z.object({
        email: z.string().email(),
      })

      try {
        schema.parse({ email: 'not-an-email' })
      } catch (error) {
        const message = getFriendlyErrorMessage(error)

        expect(message).toContain('email')
        expect(message).toContain('Invalid')
      }
    })

    it('should format minimum length error', () => {
      const schema = z.object({
        password: z.string().min(8),
      })

      try {
        schema.parse({ password: 'short' })
      } catch (error) {
        const message = getFriendlyErrorMessage(error)

        expect(message).toContain('String must contain at least 8')
        expect(message).toContain('password')
      }
    })

    it('should format maximum length error', () => {
      const schema = z.object({
        username: z.string().max(20),
      })

      try {
        schema.parse({ username: 'a'.repeat(25) })
      } catch (error) {
        const message = getFriendlyErrorMessage(error)

        expect(message).toContain('String must contain at most 20')
        expect(message).toContain('username')
      }
    })

    it('should format multiple validation errors', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
        email: z.string().email(),
      })

      try {
        schema.parse({
          name: 123,
          email: 'invalid',
        })
      } catch (error) {
        const message = getFriendlyErrorMessage(error)

        expect(message).toContain('name')
        expect(message).toContain('age')
        expect(message).toContain('email')
      }
    })

    it('should format nested object validation errors', () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          email: z.string().email(),
        }),
      })

      try {
        schema.parse({
          user: {
            name: 123,
            email: 'invalid',
          },
        })
      } catch (error) {
        const message = getFriendlyErrorMessage(error)

        expect(message).toContain('user')
        expect(message).toBeTruthy()
      }
    })

    it('should format array validation errors', () => {
      const schema = z.object({
        tags: z.array(z.string()),
      })

      try {
        schema.parse({ tags: [1, 2, 3] })
      } catch (error) {
        const message = getFriendlyErrorMessage(error)

        expect(message).toContain('tags')
        expect(message).toContain('Expected string')
      }
    })

    it('should format enum validation errors', () => {
      const schema = z.object({
        status: z.enum(['active', 'inactive', 'pending']),
      })

      try {
        schema.parse({ status: 'invalid' })
      } catch (error) {
        const message = getFriendlyErrorMessage(error)

        expect(message).toContain('status')
        expect(message).toContain('Invalid enum value')
      }
    })

    it('should format custom validation errors', () => {
      const schema = z.object({
        value: z.number().refine((val) => val > 0, {
          message: 'Value must be positive',
        }),
      })

      try {
        schema.parse({ value: -5 })
      } catch (error) {
        const message = getFriendlyErrorMessage(error)

        expect(message).toContain('Value must be positive')
      }
    })

    it('should format union type errors', () => {
      const schema = z.object({
        id: z.union([z.string(), z.number()]),
      })

      try {
        schema.parse({ id: true })
      } catch (error) {
        const message = getFriendlyErrorMessage(error)

        expect(message).toContain('id')
        expect(message).toBeTruthy()
      }
    })

    it('should format discriminated union errors', () => {
      const schema = z.discriminatedUnion('type', [
        z.object({ type: z.literal('a'), value: z.string() }),
        z.object({ type: z.literal('b'), value: z.number() }),
      ])

      try {
        schema.parse({ type: 'c' })
      } catch (error) {
        const message = getFriendlyErrorMessage(error)

        expect(message).toBeTruthy()
      }
    })

    it('should format optional field with wrong type', () => {
      const schema = z.object({
        optionalField: z.string().optional(),
      })

      try {
        schema.parse({ optionalField: 123 })
      } catch (error) {
        const message = getFriendlyErrorMessage(error)

        expect(message).toContain('Expected string')
        expect(message).toContain('optionalField')
      }
    })

    it('should format nullable field with wrong type', () => {
      const schema = z.object({
        nullableField: z.string().nullable(),
      })

      try {
        schema.parse({ nullableField: 123 })
      } catch (error) {
        const message = getFriendlyErrorMessage(error)

        expect(message).toContain('Expected string')
        expect(message).toContain('nullableField')
      }
    })

    it('should format date validation errors', () => {
      const schema = z.object({
        date: z.date(),
      })

      try {
        schema.parse({ date: 'not-a-date' })
      } catch (error) {
        const message = getFriendlyErrorMessage(error)

        expect(message).toContain('Expected date')
        expect(message).toContain('date')
      }
    })

    it('should return string message', () => {
      const schema = z.object({
        field: z.string(),
      })

      try {
        schema.parse({ field: 123 })
      } catch (error) {
        const message = getFriendlyErrorMessage(error)

        expect(typeof message).toBe('string')
        expect(message.length).toBeGreaterThan(0)
      }
    })
  })
})
