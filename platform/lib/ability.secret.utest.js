import { findSecretTemplate, getSecretTemplateKey } from './ability.secret'

describe('getSecretTemplateKey', () => {
  describe('with @ prefix', () => {
    it('should extract key from @-prefixed hint', () => {
      expect(getSecretTemplateKey('@ably')).toBe('ably')
      expect(getSecretTemplateKey('@platform/google/mail')).toBe(
        'platform/google/mail'
      )
      expect(getSecretTemplateKey('@slack[bot]')).toBe('slack[bot]')
    })

    it('should handle complex nested keys', () => {
      expect(getSecretTemplateKey('@namespace/service/resource')).toBe(
        'namespace/service/resource'
      )
    })

    it('should handle keys with multiple segments', () => {
      expect(getSecretTemplateKey('@a/b/c/d/e')).toBe('a/b/c/d/e')
    })
  })

  describe('without @ prefix', () => {
    it('should return null for plain strings', () => {
      expect(getSecretTemplateKey('ably')).toBeNull()
      expect(getSecretTemplateKey('platform/google/mail')).toBeNull()
    })

    it('should return null for null/undefined', () => {
      expect(getSecretTemplateKey(null)).toBeNull()
      expect(getSecretTemplateKey(undefined)).toBeNull()
    })

    it('should return null for empty string', () => {
      expect(getSecretTemplateKey('')).toBeNull()
    })

    it('should return null when hint is only @', () => {
      expect(getSecretTemplateKey('@')).toBe('')
    })
  })

  describe('edge cases', () => {
    it('should handle whitespace in keys', () => {
      expect(getSecretTemplateKey('@some key')).toBe('some key')
    })

    it('should handle special characters', () => {
      expect(getSecretTemplateKey('@api-key_123')).toBe('api-key_123')
      expect(getSecretTemplateKey('@oauth2.0')).toBe('oauth2.0')
    })

    it('should handle multiple @ signs', () => {
      expect(getSecretTemplateKey('@@ably')).toBe('@ably')
      expect(getSecretTemplateKey('@platform@service')).toBe('platform@service')
    })
  })
})

describe('findSecretTemplate', () => {
  const secretTemplates = [
    { template: 'ably', name: 'Ably' },
    { template: 'slack', name: 'Slack' },
    { template: 'slack[bot]', name: 'Slack Bot' },
    { template: 'platform/google/mail', name: 'Google Mail' },
    { template: 'stripe', name: 'Stripe' },
  ]

  describe('matching templates', () => {
    it('should find exact template match', () => {
      const result = findSecretTemplate('@ably', secretTemplates)

      expect(result).toEqual({ template: 'ably', name: 'Ably' })
    })

    it('should find template with nested key', () => {
      const result = findSecretTemplate(
        '@platform/google/mail',
        secretTemplates
      )

      expect(result).toEqual({
        template: 'platform/google/mail',
        name: 'Google Mail',
      })
    })

    it('should find template with bracket notation', () => {
      const result = findSecretTemplate('@slack[bot]', secretTemplates)

      expect(result).toEqual({ template: 'slack[bot]', name: 'Slack Bot' })
    })
  })

  describe('non-matching templates', () => {
    it('should return null when template not found', () => {
      const result = findSecretTemplate('@nonexistent', secretTemplates)

      expect(result).toBeNull()
    })

    it('should return null for plain string (no @ prefix)', () => {
      const result = findSecretTemplate('ably', secretTemplates)

      expect(result).toBeNull()
    })

    it('should return null for null hint', () => {
      const result = findSecretTemplate(null, secretTemplates)

      expect(result).toBeNull()
    })

    it('should return null for undefined hint', () => {
      const result = findSecretTemplate(undefined, secretTemplates)

      expect(result).toBeNull()
    })

    it('should return null for empty string', () => {
      const result = findSecretTemplate('', secretTemplates)

      expect(result).toBeNull()
    })
  })

  describe('with empty template array', () => {
    it('should return null when templates array is empty', () => {
      const result = findSecretTemplate('@ably', [])

      expect(result).toBeNull()
    })

    it('should return null regardless of hint', () => {
      const result = findSecretTemplate('@any/template/key', [])

      expect(result).toBeNull()
    })
  })

  describe('with partial matches', () => {
    it('should not match partial template keys', () => {
      const result = findSecretTemplate('@platform/google', secretTemplates)

      expect(result).toBeNull()
    })

    it('should not match with extra characters', () => {
      const result = findSecretTemplate('@ably-key', secretTemplates)

      expect(result).toBeNull()
    })

    it('should be case-sensitive', () => {
      const result = findSecretTemplate('@ABLY', secretTemplates)

      expect(result).toBeNull()
    })
  })

  describe('generic MCP template (no secret)', () => {
    it('should return null when hint is #secret', () => {
      const result = findSecretTemplate('#secret', secretTemplates)

      expect(result).toBeNull()
    })

    it('should return null for custom suffix notation', () => {
      const result = findSecretTemplate('custom', secretTemplates)

      expect(result).toBeNull()
    })
  })

  describe('duplicate templates in array', () => {
    it('should return first matching template when duplicates exist', () => {
      const duplicates = [
        { template: 'ably', name: 'Ably First' },
        { template: 'ably', name: 'Ably Second' },
      ]
      const result = findSecretTemplate('@ably', duplicates)

      expect(result).toEqual({ template: 'ably', name: 'Ably First' })
    })
  })

  describe('templates with generic properties', () => {
    it('should pass through any template properties', () => {
      const templates = [
        {
          template: 'custom',
          id: '123',
          icon: 'icon',
          metadata: { foo: 'bar' },
        },
      ]
      const result = findSecretTemplate('@custom', templates)

      expect(result).toEqual({
        template: 'custom',
        id: '123',
        icon: 'icon',
        metadata: { foo: 'bar' },
      })
    })
  })
})
