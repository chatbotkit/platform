import {
  normalizeTwilioMessageAddress,
  normalizeTwilioPhoneNumber,
} from './twilio.phone'

describe('twilio.phone', () => {
  describe('normalizeTwilioPhoneNumber', () => {
    it('normalizes a valid US number to E.164', () => {
      expect(normalizeTwilioPhoneNumber('(415) 555-2671')).toBe('+14155552671')
    })

    it('normalizes numbers with 00 international prefix', () => {
      expect(normalizeTwilioPhoneNumber('00447911123456')).toBe('+447911123456')
    })

    it('returns null for invalid values', () => {
      expect(normalizeTwilioPhoneNumber('')).toBeNull()
      expect(normalizeTwilioPhoneNumber('not-a-number')).toBeNull()
      expect(normalizeTwilioPhoneNumber('123')).toBeNull()
    })
  })

  describe('normalizeTwilioMessageAddress', () => {
    it('normalizes plain phone number addresses', () => {
      expect(normalizeTwilioMessageAddress('  +1 415 555 2671  ')).toBe(
        '+14155552671'
      )
    })

    it('normalizes channel-prefixed addresses', () => {
      expect(normalizeTwilioMessageAddress('whatsapp:00447911123456')).toBe(
        'whatsapp:+447911123456'
      )
    })

    it('returns null for invalid channel addresses', () => {
      expect(normalizeTwilioMessageAddress('whatsapp:invalid')).toBeNull()
    })

    it('allows alphanumeric sender only when enabled', () => {
      expect(normalizeTwilioMessageAddress('MyBrand123')).toBeNull()
      expect(
        normalizeTwilioMessageAddress('MyBrand123', {
          allowAlphanumericSender: true,
        })
      ).toBe('MyBrand123')
    })
  })
})
