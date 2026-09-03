import { getFriendlyErrorMessage } from './zod.error'

import { z } from 'zod'

describe('getFriendlyErrorMessage', () => {
  it('should format a simple validation error', () => {
    const schema = z.object({
      email: z.string().email(),
    })

    try {
      schema.parse({ email: 'invalid-email' })
    } catch (error) {
      const message = getFriendlyErrorMessage(error as z.ZodError)

      expect(message).toContain('Invalid email')
      expect(message).toContain('email')
    }
  })

  it('should format multiple validation errors', () => {
    const schema = z.object({
      email: z.string().email(),
      age: z.number().min(18),
      name: z.string().min(1),
    })

    try {
      schema.parse({
        email: 'invalid-email',
        age: 16,
        name: '',
      })
    } catch (error) {
      const message = getFriendlyErrorMessage(error as z.ZodError)

      expect(message).toContain('Invalid email')
      expect(message).toContain('Number must be greater than or equal to 18')
      expect(message).toContain('String must contain at least 1 character(s)')
    }
  })

  it('should format required field errors', () => {
    const schema = z.object({
      name: z.string(),
      email: z.string().email(),
    })

    try {
      schema.parse({})
    } catch (error) {
      const message = getFriendlyErrorMessage(error as z.ZodError)

      expect(message).toContain('Required')
      expect(message).toContain('name')
      expect(message).toContain('email')
    }
  })

  it('should format nested object validation errors', () => {
    const schema = z.object({
      user: z.object({
        profile: z.object({
          name: z.string().min(1),
        }),
      }),
    })

    try {
      schema.parse({
        user: {
          profile: {
            name: '',
          },
        },
      })
    } catch (error) {
      const message = getFriendlyErrorMessage(error as z.ZodError)

      expect(message).toContain('String must contain at least 1 character(s)')
      expect(message).toContain('user.profile.name')
    }
  })

  it('should format array validation errors', () => {
    const schema = z.object({
      items: z.array(z.string().min(1)),
    })

    try {
      schema.parse({
        items: ['valid', '', 'also-valid'],
      })
    } catch (error) {
      const message = getFriendlyErrorMessage(error as z.ZodError)

      expect(message).toContain('String must contain at least 1 character(s)')
      expect(message).toContain('items[1]')
    }
  })

  it('should handle union type errors', () => {
    const schema = z.object({
      value: z.union([z.string(), z.number()]),
    })

    try {
      schema.parse({
        value: true, // boolean is not string or number
      })
    } catch (error) {
      const message = getFriendlyErrorMessage(error as z.ZodError)

      expect(message).toContain('Expected string')
      expect(message).toContain('received boolean')
      expect(message).toContain('value')
    }
  })

  it('should handle custom validation errors', () => {
    const schema = z.object({
      password: z
        .string()
        .refine(
          (val) => val.length >= 8,
          'Password must be at least 8 characters long'
        ),
    })

    try {
      schema.parse({
        password: '123',
      })
    } catch (error) {
      const message = getFriendlyErrorMessage(error as z.ZodError)

      expect(message).toContain('Password must be at least 8 characters long')
      expect(message).toContain('password')
    }
  })
})
