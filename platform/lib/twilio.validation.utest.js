import {
  parseTwilioAllowFrom,
  twilioSenderIsAllowed,
} from './twilio.validation'

describe('parseTwilioAllowFrom', () => {
  it('returns empty array for empty string', () => {
    expect(parseTwilioAllowFrom('')).toEqual([])
    expect(parseTwilioAllowFrom('   ')).toEqual([])
    expect(parseTwilioAllowFrom('\n\n')).toEqual([])
  })

  it('parses wildcard entry', () => {
    expect(parseTwilioAllowFrom('*')).toEqual([{ type: 'wildcard' }])
  })

  it('normalizes phone numbers to digits', () => {
    expect(parseTwilioAllowFrom('+1 (202) 555-1234')).toEqual([
      { type: 'phone', digits: '12025551234' },
    ])
  })

  it('parses multiple entries separated by newlines or commas', () => {
    expect(parseTwilioAllowFrom('+12025551234\n+447911123456')).toEqual([
      { type: 'phone', digits: '12025551234' },
      { type: 'phone', digits: '447911123456' },
    ])

    expect(parseTwilioAllowFrom('+12025551234,+447911123456')).toEqual([
      { type: 'phone', digits: '12025551234' },
      { type: 'phone', digits: '447911123456' },
    ])
  })

  it('skips invalid entries silently', () => {
    expect(parseTwilioAllowFrom('not-a-phone')).toEqual([])
    expect(parseTwilioAllowFrom('123456')).toEqual([])
    expect(parseTwilioAllowFrom('1234567890123456')).toEqual([])
  })
})

describe('twilioSenderIsAllowed', () => {
  it('denies all when entries are empty', () => {
    expect(twilioSenderIsAllowed('+12025551234', [])).toBe(false)
  })

  it('allows all when wildcard is present', () => {
    const entries = parseTwilioAllowFrom('*')

    expect(twilioSenderIsAllowed('+12025551234', entries)).toBe(true)
  })

  it('matches regardless of + prefix', () => {
    const entries = parseTwilioAllowFrom('12025551234')

    expect(twilioSenderIsAllowed('+12025551234', entries)).toBe(true)
  })

  it('rejects senders not in the allow list', () => {
    const entries = parseTwilioAllowFrom('+447911123456')

    expect(twilioSenderIsAllowed('+12025551234', entries)).toBe(false)
  })
})
