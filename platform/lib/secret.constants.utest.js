import {
  ALLOWED_TEMPLATE_CONFIG_FIELDS,
  ALLOWED_USER_CONFIG_FIELDS,
  SECRET_METADATA_FIELDS,
} from './secret.constants'

describe('secret.constants', () => {
  describe('ALLOWED_USER_CONFIG_FIELDS', () => {
    it('should be an array', () => {
      expect(Array.isArray(ALLOWED_USER_CONFIG_FIELDS)).toBe(true)
    })

    it('should contain expected credential fields', () => {
      expect(ALLOWED_USER_CONFIG_FIELDS).toContain('clientId')
      expect(ALLOWED_USER_CONFIG_FIELDS).toContain('clientSecret')
      expect(ALLOWED_USER_CONFIG_FIELDS).toContain('scope')
    })

    it('should contain user authentication fields', () => {
      expect(ALLOWED_USER_CONFIG_FIELDS).toContain('user')
      expect(ALLOWED_USER_CONFIG_FIELDS).toContain('username')
      expect(ALLOWED_USER_CONFIG_FIELDS).toContain('pass')
      expect(ALLOWED_USER_CONFIG_FIELDS).toContain('password')
    })

    it('should have exactly 7 fields', () => {
      expect(ALLOWED_USER_CONFIG_FIELDS).toHaveLength(7)
    })

    it('should not contain duplicate values', () => {
      const uniqueFields = [...new Set(ALLOWED_USER_CONFIG_FIELDS)]

      expect(uniqueFields).toHaveLength(ALLOWED_USER_CONFIG_FIELDS.length)
    })
  })

  describe('ALLOWED_TEMPLATE_CONFIG_FIELDS', () => {
    it('should be an array', () => {
      expect(Array.isArray(ALLOWED_TEMPLATE_CONFIG_FIELDS)).toBe(true)
    })

    it('should contain template field', () => {
      expect(ALLOWED_TEMPLATE_CONFIG_FIELDS).toContain('template')
    })

    it('should include all ALLOWED_USER_CONFIG_FIELDS', () => {
      ALLOWED_USER_CONFIG_FIELDS.forEach((field) => {
        expect(ALLOWED_TEMPLATE_CONFIG_FIELDS).toContain(field)
      })
    })

    it('should have template as first element', () => {
      expect(ALLOWED_TEMPLATE_CONFIG_FIELDS[0]).toBe('template')
    })
  })

  describe('SECRET_METADATA_FIELDS', () => {
    it('should be an array', () => {
      expect(Array.isArray(SECRET_METADATA_FIELDS)).toBe(true)
    })

    it('should contain expected metadata fields', () => {
      expect(SECRET_METADATA_FIELDS).toContain('reference')
      expect(SECRET_METADATA_FIELDS).toContain('secretId')
      expect(SECRET_METADATA_FIELDS).toContain('id')
    })

    it('should have exactly 3 fields', () => {
      expect(SECRET_METADATA_FIELDS).toHaveLength(3)
    })
  })

  describe('integration tests', () => {
    it('should have distinct purposes for each constant', () => {
      // User config fields are for credentials
      expect(ALLOWED_USER_CONFIG_FIELDS).toContain('clientId')

      // Template config includes template identifier
      expect(ALLOWED_TEMPLATE_CONFIG_FIELDS).toContain('template')

      // Metadata fields are for resolution
      expect(SECRET_METADATA_FIELDS).toContain('reference')
    })

    it('should support filtering operations', () => {
      const mockConfig = {
        clientId: 'test-id',
        clientSecret: 'test-secret',
        reference: 'test-ref',
        id: 'test-id',
        customField: 'custom',
      }

      // Pick user config fields
      const userFields = Object.keys(mockConfig).filter((key) =>
        ALLOWED_USER_CONFIG_FIELDS.includes(key)
      )

      expect(userFields).toContain('clientId')
      expect(userFields).toContain('clientSecret')
      expect(userFields).not.toContain('reference')
      expect(userFields).not.toContain('customField')

      // Filter metadata fields
      const nonMetadataFields = Object.keys(mockConfig).filter(
        (key) => !SECRET_METADATA_FIELDS.includes(key)
      )

      expect(nonMetadataFields).toContain('clientId')
      expect(nonMetadataFields).toContain('customField')
      expect(nonMetadataFields).not.toContain('reference')
      expect(nonMetadataFields).not.toContain('id')
    })
  })
})
