import { MAX_DB_TEXT_BYTES_LENGTH } from '@/prisma/constraints'

import requestSchema from '@/schemas/request'

const itIfTextLengthIsConstrained =
  MAX_DB_TEXT_BYTES_LENGTH <= 1000000 ? it : it.skip

describe('requestSchema', () => {
  it('should validate null values', () => {
    const result = requestSchema.validate(null)

    expect(result).toEqual({ value: null })
  })

  it('should allow empty strings', () => {
    const result = requestSchema.validate('')

    expect(result).toEqual({ value: '' })
  })

  it('should validate valid request strings', () => {
    const validRequests = [
      'GET /api/users',
      'POST /api/users',
      'PUT /api/users/123',
      'DELETE /api/users/123',
      'PATCH /api/users/123',
    ]

    validRequests.forEach((request) => {
      const result = requestSchema.validate(request)

      expect(result).toEqual({ value: request })
    })
  })

  it('should handle JSON-like request strings', () => {
    const jsonRequest =
      '{"method": "GET", "url": "/api/users", "params": {"id": "123"}}'

    const result = requestSchema.validate(jsonRequest)

    expect(result).toEqual({ value: jsonRequest })
  })

  it('should handle URL-encoded request strings', () => {
    const urlRequest = 'action=create&type=user&name=John%20Doe'
    const result = requestSchema.validate(urlRequest)

    expect(result).toEqual({ value: urlRequest })
  })

  it('should handle query parameters', () => {
    const queryRequest = '/api/users?sort=name&limit=10&offset=0'
    const result = requestSchema.validate(queryRequest)

    expect(result).toEqual({ value: queryRequest })
  })

  itIfTextLengthIsConstrained(
    'should reject strings exceeding maximum byte length',
    () => {
      // Create a string that exceeds the maximum byte length
      // MAX_DB_TEXT_BYTES_LENGTH is typically 65535 bytes

      const oversizedRequest = 'x'.repeat(70000) // definitely over any reasonable limit

      const result = requestSchema.validate(oversizedRequest)

      expect(result.error).toBeDefined()
      expect(result.error.message).toContain('must be less than or equal to')
    }
  )

  it('should validate strings at reasonable lengths', () => {
    const reasonableRequest = 'x'.repeat(1000) // well within limits

    const result = requestSchema.validate(reasonableRequest)

    expect(result).toEqual({ value: reasonableRequest })
  })

  it('should reject non-string values', () => {
    const result = requestSchema.validate(123)

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('string')
  })

  it('should reject arrays', () => {
    const result = requestSchema.validate(['GET', '/api/users'])

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('string')
  })

  it('should reject objects', () => {
    const result = requestSchema.validate({ method: 'GET', url: '/api/users' })

    expect(result.error).toBeDefined()
    expect(result.error.message).toContain('string')
  })

  it('should handle multiline request strings', () => {
    const multilineRequest = `GET /api/users HTTP/1.1
Host: example.com
Accept: application/json
Authorization: Bearer token123`

    const result = requestSchema.validate(multilineRequest)

    expect(result).toEqual({ value: multilineRequest })
  })

  it('should handle unicode characters in requests', () => {
    const unicodeRequest = 'GET /api/users?name=José&city=São Paulo'
    const result = requestSchema.validate(unicodeRequest)

    expect(result).toEqual({ value: unicodeRequest })
  })

  it('should handle special characters and symbols', () => {
    const specialRequest =
      'POST /api/data?filter=name:John&tags=[tag1,tag2]&sort=created_at:desc'
    const result = requestSchema.validate(specialRequest)

    expect(result).toEqual({ value: specialRequest })
  })
})
