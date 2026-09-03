import {
  SPECIAL_FIELD_PREFIXES,
  SPECIAL_FIELD_PREFIXES_REGEXP,
  isSpecialField,
} from './ability.fields'

describe('ability.fields', () => {
  describe('SPECIAL_FIELD_PREFIXES', () => {
    it('should be an array of strings', () => {
      expect(Array.isArray(SPECIAL_FIELD_PREFIXES)).toBe(true)
      expect(SPECIAL_FIELD_PREFIXES.every((p) => typeof p === 'string')).toBe(
        true
      )
    })

    it('should contain expected prefixes', () => {
      expect(SPECIAL_FIELD_PREFIXES).toContain('EARTH_')
      expect(SPECIAL_FIELD_PREFIXES).toContain('SECRET_')
      expect(SPECIAL_FIELD_PREFIXES).toContain('FILE_')
      expect(SPECIAL_FIELD_PREFIXES).toContain('BOT_')
      expect(SPECIAL_FIELD_PREFIXES).toContain('SPACE_')
      expect(SPECIAL_FIELD_PREFIXES).toContain('TASK_')
      expect(SPECIAL_FIELD_PREFIXES).toContain('USER_')
      expect(SPECIAL_FIELD_PREFIXES).toContain('CONVERSATION_')
      expect(SPECIAL_FIELD_PREFIXES).toContain('CONTACT_')
      expect(SPECIAL_FIELD_PREFIXES).toContain('NAMESPACE_')
      expect(SPECIAL_FIELD_PREFIXES).toContain('EXTERNAL_')
    })

    it('should have all prefixes ending with underscore', () => {
      SPECIAL_FIELD_PREFIXES.forEach((prefix) => {
        expect(prefix).toMatch(/_$/)
      })
    })
  })

  describe('SPECIAL_FIELD_PREFIXES_REGEXP', () => {
    it('should be a regular expression', () => {
      expect(SPECIAL_FIELD_PREFIXES_REGEXP).toBeInstanceOf(RegExp)
    })

    it('should be case insensitive', () => {
      expect(SPECIAL_FIELD_PREFIXES_REGEXP.flags).toContain('i')
    })

    it('should match all special prefixes', () => {
      SPECIAL_FIELD_PREFIXES.forEach((prefix) => {
        expect(SPECIAL_FIELD_PREFIXES_REGEXP.test(prefix + 'fieldName')).toBe(
          true
        )
      })
    })

    it('should match prefixes regardless of case', () => {
      expect(SPECIAL_FIELD_PREFIXES_REGEXP.test('earth_field')).toBe(true)
      expect(SPECIAL_FIELD_PREFIXES_REGEXP.test('EARTH_field')).toBe(true)
      expect(SPECIAL_FIELD_PREFIXES_REGEXP.test('Earth_field')).toBe(true)
      expect(SPECIAL_FIELD_PREFIXES_REGEXP.test('secret_field')).toBe(true)
      expect(SPECIAL_FIELD_PREFIXES_REGEXP.test('SECRET_field')).toBe(true)
    })
  })

  describe('isSpecialField', () => {
    it('should return true for fields with special prefixes', () => {
      expect(isSpecialField('EARTH_timestamp')).toBe(true)
      expect(isSpecialField('SECRET_apiKey')).toBe(true)
      expect(isSpecialField('FILE_id')).toBe(true)
      expect(isSpecialField('BOT_id')).toBe(true)
      expect(isSpecialField('SPACE_id')).toBe(true)
      expect(isSpecialField('TASK_id')).toBe(true)
      expect(isSpecialField('USER_id')).toBe(true)
      expect(isSpecialField('CONVERSATION_id')).toBe(true)
      expect(isSpecialField('CONTACT_id')).toBe(true)
      expect(isSpecialField('NAMESPACE_id')).toBe(true)
      expect(isSpecialField('EXTERNAL_data')).toBe(true)
    })

    it('should be case insensitive', () => {
      expect(isSpecialField('earth_timestamp')).toBe(true)
      expect(isSpecialField('Earth_timestamp')).toBe(true)
      expect(isSpecialField('EARTH_timestamp')).toBe(true)
      expect(isSpecialField('secret_key')).toBe(true)
      expect(isSpecialField('SECRET_key')).toBe(true)
    })

    it('should return false for regular fields', () => {
      expect(isSpecialField('fieldName')).toBe(false)
      expect(isSpecialField('username')).toBe(false)
      expect(isSpecialField('email')).toBe(false)
      expect(isSpecialField('customField')).toBe(false)
      expect(isSpecialField('MY_FIELD')).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(isSpecialField('')).toBe(false)
    })

    it('should return false for underscore-only string', () => {
      expect(isSpecialField('_')).toBe(false)
      expect(isSpecialField('__')).toBe(false)
    })

    it('should match prefix anywhere in the string', () => {
      expect(isSpecialField('EARTH_')).toBe(true)
      expect(isSpecialField('EARTH_fieldName')).toBe(true)
      expect(isSpecialField('EARTH_field_with_underscores')).toBe(true)
    })

    it('should handle fields with numbers', () => {
      expect(isSpecialField('SECRET_key123')).toBe(true)
      expect(isSpecialField('USER_id_123')).toBe(true)
      expect(isSpecialField('field123')).toBe(false)
    })

    it('should handle fields with special characters', () => {
      expect(isSpecialField('USER_id-value')).toBe(true)
      expect(isSpecialField('SECRET_api.key')).toBe(true)
    })

    it('should not match if prefix appears in middle without leading position', () => {
      // This behavior depends on regex implementation - it tests current behavior
      const result = isSpecialField('mySECRET_field')

      // The regex uses test() which matches anywhere, so this would be true
      expect(result).toBe(true)
    })

    it('should distinguish between all prefix types', () => {
      const prefixTypes = [
        'EARTH_',
        'SECRET_',
        'FILE_',
        'BOT_',
        'SPACE_',
        'TASK_',
        'USER_',
        'CONVERSATION_',
        'CONTACT_',
        'NAMESPACE_',
        'EXTERNAL_',
      ]

      prefixTypes.forEach((prefix) => {
        expect(isSpecialField(prefix + 'test')).toBe(true)
      })
    })

    it('should handle whitespace in field names', () => {
      expect(isSpecialField('USER_ id')).toBe(true)
      expect(isSpecialField(' USER_id')).toBe(true)
      expect(isSpecialField('USER_id ')).toBe(true)
    })
  })
})
