import { parseKeyValue } from './keyvalue'

describe('parseKeyValue', () => {
  describe('YAML style (colon + space)', () => {
    it('parses simple key-value pairs', () => {
      const result = parseKeyValue('username: john\npassword: secret')

      expect(result.success).toBe(true)
      expect(result.format).toBe('yaml')
      expect(result.data).toEqual({
        username: 'john',
        password: 'secret',
      })
    })

    it('handles extra whitespace around values', () => {
      const result = parseKeyValue('username:   john   \npassword:  secret  ')

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        username: 'john',
        password: 'secret',
      })
    })

    it('handles empty lines and comments', () => {
      const input = `
        # This is a comment
        username: john

        # Another comment
        password: secret
      `

      const result = parseKeyValue(input)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        username: 'john',
        password: 'secret',
      })
    })
  })

  describe('compact YAML style (colon without space)', () => {
    it('parses with recognized keys', () => {
      const result = parseKeyValue('username:john\npassword:secret', {
        recognizedKeys: ['username', 'password'],
      })

      expect(result.success).toBe(true)
      expect(result.format).toBe('yaml')
      expect(result.data).toEqual({
        username: 'john',
        password: 'secret',
      })
    })

    it('does not parse without recognized keys (ambiguous with user:pass format)', () => {
      const result = parseKeyValue('username:john')

      expect(result.success).toBe(false)
    })
  })

  describe('properties style (equals sign)', () => {
    it('parses simple key-value pairs', () => {
      const result = parseKeyValue('username=john\npassword=secret')

      expect(result.success).toBe(true)
      expect(result.format).toBe('properties')
      expect(result.data).toEqual({
        username: 'john',
        password: 'secret',
      })
    })

    it('handles whitespace around equals sign', () => {
      const result = parseKeyValue('username = john\npassword = secret')

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        username: 'john',
        password: 'secret',
      })
    })

    it('handles values with equals signs', () => {
      const result = parseKeyValue('token=abc=def=ghi')

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        token: 'abc=def=ghi',
      })
    })
  })

  describe('mixed styles', () => {
    it('parses mixed YAML and properties style', () => {
      const result = parseKeyValue('username: john\npassword=secret')

      expect(result.success).toBe(true)
      expect(result.format).toBe('mixed')
      expect(result.data).toEqual({
        username: 'john',
        password: 'secret',
      })
    })
  })

  describe('JSON format', () => {
    it('parses JSON object', () => {
      const result = parseKeyValue('{"username": "john", "password": "secret"}')

      expect(result.success).toBe(true)
      expect(result.format).toBe('json')
      expect(result.data).toEqual({
        username: 'john',
        password: 'secret',
      })
    })

    it('ignores non-string values in JSON', () => {
      const result = parseKeyValue(
        '{"username": "john", "count": 42, "active": true}'
      )

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        username: 'john',
      })
    })

    it('falls back to line parsing for invalid JSON', () => {
      const result = parseKeyValue('{not valid json\nusername: john')

      expect(result.success).toBe(true)
      expect(result.format).toBe('yaml')
      expect(result.data).toEqual({
        username: 'john',
      })
    })
  })

  describe('recognized keys filtering', () => {
    it('only extracts recognized keys', () => {
      const result = parseKeyValue(
        'username: john\npassword: secret\nextra: ignored',
        { recognizedKeys: ['username', 'password'] }
      )

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        username: 'john',
        password: 'secret',
      })
    })

    it('handles case-insensitive key matching', () => {
      const result = parseKeyValue('USERNAME: john\nPassword: secret', {
        recognizedKeys: ['username', 'password'],
        caseInsensitive: true,
      })

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        USERNAME: 'john',
        Password: 'secret',
      })
    })

    it('handles case-sensitive key matching', () => {
      const result = parseKeyValue('USERNAME: john\npassword: secret', {
        recognizedKeys: ['username', 'password'],
        caseInsensitive: false,
      })

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        password: 'secret',
      })
    })
  })

  describe('quote stripping', () => {
    it('strips double quotes from values', () => {
      const result = parseKeyValue('username: "john"\npassword: "secret"')

      expect(result.data).toEqual({
        username: 'john',
        password: 'secret',
      })
    })

    it('strips single quotes from values', () => {
      const result = parseKeyValue("username: 'john'\npassword: 'secret'")

      expect(result.data).toEqual({
        username: 'john',
        password: 'secret',
      })
    })

    it('preserves quotes when disabled', () => {
      const result = parseKeyValue('username: "john"', { stripQuotes: false })

      expect(result.data).toEqual({
        username: '"john"',
      })
    })

    it('does not strip mismatched quotes', () => {
      const result = parseKeyValue('username: "john\'')

      expect(result.data).toEqual({
        username: '"john\'',
      })
    })
  })

  describe('edge cases', () => {
    it('returns empty result for empty input', () => {
      const result = parseKeyValue('')

      expect(result.success).toBe(false)
      expect(result.format).toBe('none')
      expect(result.data).toEqual({})
    })

    it('returns empty result for whitespace-only input', () => {
      const result = parseKeyValue('   \n\n   ')

      expect(result.success).toBe(false)
      expect(result.format).toBe('none')
    })

    it('returns empty result for unparseable input', () => {
      const result = parseKeyValue('just some random text')

      expect(result.success).toBe(false)
    })

    it('handles Windows line endings', () => {
      const result = parseKeyValue('username: john\r\npassword: secret')

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        username: 'john',
        password: 'secret',
      })
    })

    it('handles values containing colons', () => {
      const result = parseKeyValue('url: https://example.com:8080/path')

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        url: 'https://example.com:8080/path',
      })
    })
  })
})
