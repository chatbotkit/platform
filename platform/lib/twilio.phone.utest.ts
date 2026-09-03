import {
  normalizeTwilioMessageAddress,
  normalizeTwilioPhoneNumber,
} from './twilio.phone'

describe('normalizeTwilioPhoneNumber', () => {
  it('keeps valid E.164 phone numbers', () => {
    expect(normalizeTwilioPhoneNumber('+447911123456')).toBe('+447911123456')
    expect(normalizeTwilioPhoneNumber('+16513956925')).toBe('+16513956925')
  })

  it('normalizes formatted phone numbers', () => {
    expect(normalizeTwilioPhoneNumber('+44 7911 123456')).toBe('+447911123456')
    expect(normalizeTwilioPhoneNumber('+1 (651) 395-6925')).toBe('+16513956925')
  })

  it('normalizes international 00 prefixes', () => {
    expect(normalizeTwilioPhoneNumber('00447911123456')).toBe('+447911123456')
  })

  it('uses US as the default country for national numbers', () => {
    expect(normalizeTwilioPhoneNumber('(651) 395-6925')).toBe('+16513956925')
  })

  it('returns null for blank or invalid phone numbers', () => {
    expect(normalizeTwilioPhoneNumber('')).toBeNull()
    expect(normalizeTwilioPhoneNumber('   ')).toBeNull()
    expect(normalizeTwilioPhoneNumber('not-a-phone')).toBeNull()
    expect(normalizeTwilioPhoneNumber('+1234')).toBeNull()
  })
})

describe('normalizeTwilioMessageAddress', () => {
  it('normalizes phone number addresses', () => {
    expect(normalizeTwilioMessageAddress('+44 7911 123456')).toBe(
      '+447911123456'
    )
  })

  it('normalizes channel-prefixed phone number addresses', () => {
    expect(normalizeTwilioMessageAddress('whatsapp:+44 7911 123456')).toBe(
      'whatsapp:+447911123456'
    )
    expect(normalizeTwilioMessageAddress('messenger:00447911123456')).toBe(
      'messenger:+447911123456'
    )
  })

  it('allows alphanumeric sender addresses only when enabled', () => {
    expect(normalizeTwilioMessageAddress('ChatBotKit')).toBeNull()
    expect(
      normalizeTwilioMessageAddress('ChatBotKit', {
        allowAlphanumericSender: true,
      })
    ).toBe('ChatBotKit')
  })

  it('rejects invalid channel-prefixed addresses', () => {
    expect(normalizeTwilioMessageAddress('whatsapp:not-a-phone')).toBeNull()
  })

  it('rejects blank addresses', () => {
    expect(normalizeTwilioMessageAddress('')).toBeNull()
    expect(normalizeTwilioMessageAddress('   ')).toBeNull()
  })
})
