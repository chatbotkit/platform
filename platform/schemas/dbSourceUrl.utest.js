import { MAX_DB_SOURCE_URL_BYTES_LENGTH } from '@/prisma/constraints'

import dbSourceUrlSchema from '@/schemas/dbSourceUrl'

const itIfLengthIsConstrained =
  MAX_DB_SOURCE_URL_BYTES_LENGTH <= 1000000 ? it : it.skip

describe('dbSourceUrlSchema', () => {
  it('should validate a url', () => {
    const value = 'https://example.com/sitemap.xml'

    expect(dbSourceUrlSchema.validate(value)).toEqual({ value })
  })

  it('should allow null and empty values', () => {
    expect(dbSourceUrlSchema.validate(null)).toEqual({ value: null })
    expect(dbSourceUrlSchema.validate('')).toEqual({ value: '' })
  })

  it('should accept a url longer than a plain db string', () => {
    const value = `https://example.com/${'a'.repeat(300)}`

    expect(dbSourceUrlSchema.validate(value)).toEqual({ value })
  })

  itIfLengthIsConstrained('should reject a url over the column width', () => {
    const value = `https://example.com/${'a'.repeat(
      MAX_DB_SOURCE_URL_BYTES_LENGTH
    )}`

    const { error } = dbSourceUrlSchema.validate(value)

    expect(error.message).toContain('bytes long')
  })
})
