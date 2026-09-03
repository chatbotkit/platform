import { parseBasicCredentials } from './creds.basic.parse'

describe('parseBasicCredentials', () => {
  describe('YAML style', () => {
    it('parses credentials with space after colon', () => {
      const result = parseBasicCredentials('username: john\npassword: secret')

      expect(result.success).toBe(true)
      expect(result.credentials).toEqual({
        username: 'john',
        password: 'secret',
      })
      expect(result.isStructured).toBe(true)
    })

    it('parses credentials without space after colon', () => {
      const result = parseBasicCredentials('username:john\npassword:secret')

      expect(result.success).toBe(true)
      expect(result.credentials).toEqual({
        username: 'john',
        password: 'secret',
      })
    })
  })

  describe('properties style', () => {
    it('parses credentials with equals sign', () => {
      const result = parseBasicCredentials('username=john\npassword=secret')

      expect(result.success).toBe(true)
      expect(result.credentials).toEqual({
        username: 'john',
        password: 'secret',
      })
    })

    it('handles whitespace around equals sign', () => {
      const result = parseBasicCredentials('username = john\npassword = secret')

      expect(result.success).toBe(true)
      expect(result.credentials).toEqual({
        username: 'john',
        password: 'secret',
      })
    })
  })

  describe('JSON format', () => {
    it('parses JSON object', () => {
      const result = parseBasicCredentials(
        '{"username": "john", "password": "secret"}'
      )

      expect(result.success).toBe(true)
      expect(result.credentials).toEqual({
        username: 'john',
        password: 'secret',
      })
      expect(result.isStructured).toBe(true)
    })

    it('returns structured=true for valid JSON with no credentials', () => {
      const result = parseBasicCredentials('{"other": "field"}')

      expect(result.success).toBe(false)
      expect(result.isStructured).toBe(true)
    })

    it('returns structured=true for empty JSON object', () => {
      const result = parseBasicCredentials('{}')

      expect(result.success).toBe(false)
      expect(result.isStructured).toBe(true)
    })
  })

  describe('key aliases', () => {
    it('normalizes user/pass to username/password', () => {
      const result = parseBasicCredentials('user: john\npass: secret')

      expect(result.success).toBe(true)
      expect(result.credentials).toEqual({
        username: 'john',
        password: 'secret',
      })
    })

    it('handles mixed aliases', () => {
      const result = parseBasicCredentials('user: john\npassword: secret')

      expect(result.success).toBe(true)
      expect(result.credentials).toEqual({
        username: 'john',
        password: 'secret',
      })
    })

    it('handles mixed aliases reversed', () => {
      const result = parseBasicCredentials('username: john\npass: secret')

      expect(result.success).toBe(true)
      expect(result.credentials).toEqual({
        username: 'john',
        password: 'secret',
      })
    })
  })

  describe('partial credentials', () => {
    it('handles username only', () => {
      const result = parseBasicCredentials('username: john')

      expect(result.success).toBe(true)
      expect(result.credentials).toEqual({
        username: 'john',
        password: '',
      })
    })

    it('handles password only', () => {
      const result = parseBasicCredentials('password: secret')

      expect(result.success).toBe(true)
      expect(result.credentials).toEqual({
        username: '',
        password: 'secret',
      })
    })
  })

  describe('raw user:pass format', () => {
    it('returns structured=false for user:pass format', () => {
      const result = parseBasicCredentials('myuser:mypass')

      expect(result.success).toBe(false)
      expect(result.isStructured).toBe(false)
    })

    it('returns structured=false for empty input', () => {
      const result = parseBasicCredentials('')

      expect(result.success).toBe(false)
      expect(result.isStructured).toBe(false)
    })

    it('returns structured=false for whitespace-only input', () => {
      const result = parseBasicCredentials('   \n\n   ')

      expect(result.success).toBe(false)
      expect(result.isStructured).toBe(false)
    })

    it('returns structured=false for plain text', () => {
      const result = parseBasicCredentials('just some random text')

      expect(result.success).toBe(false)
      expect(result.isStructured).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('returns structured=true for non-credential keys', () => {
      const result = parseBasicCredentials('foo: bar')

      expect(result.success).toBe(false)
      expect(result.isStructured).toBe(true)
    })

    it('handles values with special characters', () => {
      const result = parseBasicCredentials(
        'username: user@example.com\npassword: p@ss:word=123'
      )

      expect(result.success).toBe(true)
      expect(result.credentials).toEqual({
        username: 'user@example.com',
        password: 'p@ss:word=123',
      })
    })

    it('handles quoted values', () => {
      const result = parseBasicCredentials(
        'username: "john"\npassword: \'secret\''
      )

      expect(result.success).toBe(true)
      expect(result.credentials).toEqual({
        username: 'john',
        password: 'secret',
      })
    })

    it('ignores comments', () => {
      const result = parseBasicCredentials(
        '# credentials\nusername: john\n# password below\npassword: secret'
      )

      expect(result.success).toBe(true)
      expect(result.credentials).toEqual({
        username: 'john',
        password: 'secret',
      })
    })
  })
})
