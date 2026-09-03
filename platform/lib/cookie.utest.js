import { parse, stringify } from './cookie'

describe('cookie utilities', () => {
  describe('parse', () => {
    it('should parse empty cookie string', () => {
      const result = parse('')

      expect(result).toBeDefined()
      expect(typeof result.get).toBe('function')
    })

    it('should parse single cookie', () => {
      const result = parse('name=value')

      expect(result.get('name')).toBe('value')
    })

    it('should parse multiple cookies', () => {
      const result = parse('name1=value1; name2=value2; name3=value3')

      expect(result.get('name1')).toBe('value1')
      expect(result.get('name2')).toBe('value2')
      expect(result.get('name3')).toBe('value3')
    })

    it('should handle cookies with special characters', () => {
      const result = parse('email=test%40example.com')

      expect(result.get('email')).toBe('test@example.com')
    })

    it('should handle cookies with equals signs in value', () => {
      const result = parse('data=key=value')

      expect(result.get('data')).toBe('key=value')
    })

    it('should return undefined for non-existent cookie', () => {
      const result = parse('name=value')

      expect(result.get('nonexistent')).toBeUndefined()
    })

    it('should handle whitespace around cookie values', () => {
      const result = parse('name1=value1;   name2=value2')

      expect(result.get('name1')).toBe('value1')
      expect(result.get('name2')).toBe('value2')
    })

    it('should set HAS_DOCUMENT_COOKIE to false in test environment', () => {
      const result = parse('name=value')

      expect(result.HAS_DOCUMENT_COOKIE).toBe(false)
    })
  })

  describe('stringify', () => {
    it('should stringify empty cookies', () => {
      const cookies = parse('')
      const result = stringify(cookies)

      expect(result).toBe('')
    })

    it('should stringify single cookie', () => {
      const cookies = parse('name=value')
      const result = stringify(cookies)

      expect(result).toBe('name=value')
    })

    it('should stringify multiple cookies', () => {
      const cookies = parse('name1=value1; name2=value2')
      const result = stringify(cookies)

      expect(result).toContain('name1=value1')
      expect(result).toContain('name2=value2')
      expect(result).toContain('; ')
    })

    it('should handle cookies with special characters', () => {
      const cookies = parse('email=test%40example.com')
      const result = stringify(cookies)

      expect(result).toBe('email=test%40example.com')
    })

    it('should encode values containing semicolons', () => {
      const cookies = parse('name=' + encodeURIComponent('val;ue'))
      const result = stringify(cookies)

      expect(result).toBe('name=val%3Bue')
    })

    it('should encode values containing spaces', () => {
      const cookies = parse('name=' + encodeURIComponent('hello world'))
      const result = stringify(cookies)

      expect(result).toBe('name=hello%20world')
    })

    it('should maintain cookie values through parse and stringify', () => {
      const original = 'session=abc123; user=john'
      const cookies = parse(original)
      const result = stringify(cookies)

      expect(result).toContain('session=abc123')
      expect(result).toContain('user=john')
    })

    it('should handle empty string values', () => {
      const cookies = parse('empty=')
      const result = stringify(cookies)

      expect(result).toBe('empty=')
    })
  })

  describe('integration', () => {
    it('should round-trip cookies correctly', () => {
      const original = 'name=value; session=token123; user=admin'
      const parsed = parse(original)
      const stringified = stringify(parsed)

      const reparsed = parse(stringified)

      expect(reparsed.get('name')).toBe('value')
      expect(reparsed.get('session')).toBe('token123')
      expect(reparsed.get('user')).toBe('admin')
    })

    it('should round-trip cookies with encoded values', () => {
      const original =
        'team=' +
        encodeURIComponent('My Team; Special') +
        '; user=' +
        encodeURIComponent('name=value')

      const parsed = parse(original)

      expect(parsed.get('team')).toBe('My Team; Special')
      expect(parsed.get('user')).toBe('name=value')

      const stringified = stringify(parsed)
      const reparsed = parse(stringified)

      expect(reparsed.get('team')).toBe('My Team; Special')
      expect(reparsed.get('user')).toBe('name=value')
    })

    it('should round-trip after removing a cookie', () => {
      const original = 'keep=yes; remove=me; also_keep=ok'
      const parsed = parse(original)

      parsed.remove('remove')

      const stringified = stringify(parsed)
      const reparsed = parse(stringified)

      expect(reparsed.get('keep')).toBe('yes')
      expect(reparsed.get('also_keep')).toBe('ok')
      expect(reparsed.get('remove')).toBeUndefined()
    })

    it('should round-trip encoded values after removing a cookie', () => {
      const original =
        'runas_teamname=' +
        encodeURIComponent('Team; Special & Name') +
        '; runas_userid=user456; session=abc'

      const parsed = parse(original)

      parsed.remove('runas_userid')

      const stringified = stringify(parsed)
      const reparsed = parse(stringified)

      expect(reparsed.get('runas_teamname')).toBe('Team; Special & Name')
      expect(reparsed.get('session')).toBe('abc')
      expect(reparsed.get('runas_userid')).toBeUndefined()
    })

    it('should handle complex cookie scenarios', () => {
      const cookieString = 'token=abc123; path=/; domain=.example.com'
      const parsed = parse(cookieString)

      expect(parsed.get('token')).toBe('abc123')
      expect(parsed.get('path')).toBe('/')
      expect(parsed.get('domain')).toBe('.example.com')
    })
  })
})
