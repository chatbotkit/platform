import {
  SPECIAL_FIELD_PREFIXES,
  SPECIAL_FIELD_PREFIXES_REGEXP,
  isSpecialField,
} from '@/lib/ability.fields'

describe('SPECIAL_FIELD_PREFIXES', () => {
  it('should contain expected special field prefixes', () => {
    expect(SPECIAL_FIELD_PREFIXES).toEqual([
      // time
      'EARTH_',
      // resource linking
      'SECRET_',
      'FILE_',
      'BOT_',
      'SPACE_',
      'TASK_',
      // user context
      'USER_',
      'CONVERSATION_',
      'CONTACT_',
      'NAMESPACE_',
      // external
      'EXTERNAL_',
    ])
  })

  it('should be an array of strings', () => {
    expect(Array.isArray(SPECIAL_FIELD_PREFIXES)).toBe(true)
    SPECIAL_FIELD_PREFIXES.forEach((prefix) => {
      expect(typeof prefix).toBe('string')
    })
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

  it('should have case-insensitive flag', () => {
    expect(SPECIAL_FIELD_PREFIXES_REGEXP.flags).toContain('i')
  })

  it('should match all special field prefixes', () => {
    SPECIAL_FIELD_PREFIXES.forEach((prefix) => {
      expect(SPECIAL_FIELD_PREFIXES_REGEXP.test(prefix)).toBe(true)
    })
  })

  it('should match special field prefixes in different cases', () => {
    expect(SPECIAL_FIELD_PREFIXES_REGEXP.test('earth_')).toBe(true)
    expect(SPECIAL_FIELD_PREFIXES_REGEXP.test('EARTH_')).toBe(true)
    expect(SPECIAL_FIELD_PREFIXES_REGEXP.test('Earth_')).toBe(true)
    expect(SPECIAL_FIELD_PREFIXES_REGEXP.test('secret_')).toBe(true)
    expect(SPECIAL_FIELD_PREFIXES_REGEXP.test('SECRET_')).toBe(true)
  })
})

describe('isSpecialField', () => {
  describe('should return true for special field names', () => {
    it.each([
      ['EARTH_field', 'EARTH_ prefix'],
      ['SECRET_key', 'SECRET_ prefix'],
      ['FILE_upload', 'FILE_ prefix'],
      ['BOT_config', 'BOT_ prefix'],
      ['USER_email', 'USER_ prefix'],
      ['CONVERSATION_id', 'CONVERSATION_ prefix'],
      ['CONTACT_info', 'CONTACT_ prefix'],
    ])('should identify %s as special field (%s)', (fieldName) => {
      expect(isSpecialField(fieldName)).toBe(true)
    })
  })

  describe('should handle case-insensitive matching', () => {
    it.each([
      ['earth_field', 'lowercase'],
      ['EARTH_FIELD', 'uppercase'],
      ['Earth_Field', 'mixed case'],
      ['secret_data', 'lowercase'],
      ['SECRET_DATA', 'uppercase'],
      ['Secret_Data', 'mixed case'],
      ['file_path', 'lowercase'],
      ['FILE_PATH', 'uppercase'],
      ['bot_name', 'lowercase'],
      ['BOT_NAME', 'uppercase'],
      ['conversation_thread', 'lowercase'],
      ['CONVERSATION_THREAD', 'uppercase'],
      ['contact_email', 'lowercase'],
      ['CONTACT_EMAIL', 'uppercase'],
    ])('should match %s (%s)', (fieldName) => {
      expect(isSpecialField(fieldName)).toBe(true)
    })
  })

  describe('should return false for non-special field names', () => {
    it.each([
      ['regular_field', 'regular field'],
      ['data_value', 'data field'],
      ['config_setting', 'config field'],
      ['normal_property', 'normal property'],
      ['custom_attribute', 'custom attribute'],
      ['application_data', 'application data'],
      ['system_info', 'system info'],
    ])('should not identify %s as special field (%s)', (fieldName) => {
      expect(isSpecialField(fieldName)).toBe(false)
    })
  })

  describe('should handle edge cases', () => {
    it('should return false for empty string', () => {
      expect(isSpecialField('')).toBe(false)
    })

    it('should return false for null', () => {
      expect(isSpecialField(null)).toBe(false)
    })

    it('should return false for undefined', () => {
      expect(isSpecialField(undefined)).toBe(false)
    })

    it('should handle non-string inputs', () => {
      expect(isSpecialField(123)).toBe(false)
      expect(isSpecialField({})).toBe(false)
      expect(isSpecialField([])).toBe(false)
      expect(isSpecialField(true)).toBe(false)
    })

    it('should return false for partial prefix matches', () => {
      expect(isSpecialField('EART_field')).toBe(false)
      expect(isSpecialField('SECRE_key')).toBe(false)
      expect(isSpecialField('FIL_upload')).toBe(false)
    })

    it('should return false for prefixes without underscore', () => {
      expect(isSpecialField('EARTH')).toBe(false)
      expect(isSpecialField('SECRET')).toBe(false)
      expect(isSpecialField('FILE')).toBe(false)
    })

    it('should return true for prefixes anywhere in field name', () => {
      expect(isSpecialField('field_EARTH_value')).toBe(true)
      expect(isSpecialField('my_SECRET_data')).toBe(true)
      expect(isSpecialField('prefix_FILE_suffix')).toBe(true)
    })

    it('should return true for prefixes at the start even with partial match', () => {
      expect(isSpecialField('EARTH_')).toBe(true)
      expect(isSpecialField('SECRET_')).toBe(true)
      expect(isSpecialField('FILE_')).toBe(true)
      expect(isSpecialField('BOT_')).toBe(true)
      expect(isSpecialField('CONVERSATION_')).toBe(true)
      expect(isSpecialField('CONTACT_')).toBe(true)
    })
  })

  describe('should handle whitespace and special characters', () => {
    it('should return true for field names with leading/trailing whitespace containing special prefixes', () => {
      expect(isSpecialField(' EARTH_field')).toBe(true)
      expect(isSpecialField('EARTH_field ')).toBe(true)
      expect(isSpecialField(' EARTH_field ')).toBe(true)
    })

    it('should handle field names with special characters after prefix', () => {
      expect(isSpecialField('EARTH_field@123')).toBe(true)
      expect(isSpecialField('SECRET_key-value')).toBe(true)
      expect(isSpecialField('FILE_name.ext')).toBe(true)
    })
  })
})
