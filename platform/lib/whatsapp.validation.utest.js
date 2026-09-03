import {
  parseWhatsAppAllowFrom,
  whatsAppSenderIsAllowed,
} from './whatsapp.validation'

describe('parseWhatsAppAllowFrom', () => {
  it('returns empty array for empty string', () => {
    expect(parseWhatsAppAllowFrom('')).toEqual([])
    expect(parseWhatsAppAllowFrom('   ')).toEqual([])
    expect(parseWhatsAppAllowFrom('\n\n')).toEqual([])
  })

  it('parses wildcard entry', () => {
    expect(parseWhatsAppAllowFrom('*')).toEqual([{ type: 'wildcard' }])
  })

  it('parses digits-only phone number', () => {
    expect(parseWhatsAppAllowFrom('12025551234')).toEqual([
      { type: 'phone', digits: '12025551234' },
    ])
  })

  it('parses E.164 phone number with + prefix', () => {
    expect(parseWhatsAppAllowFrom('+12025551234')).toEqual([
      { type: 'phone', digits: '12025551234' },
    ])
  })

  it('strips non-digit characters when normalising', () => {
    expect(parseWhatsAppAllowFrom('+44 7911 123456')).toEqual([
      { type: 'phone', digits: '447911123456' },
    ])
  })

  it('accepts minimum E.164 length (7 digits)', () => {
    expect(parseWhatsAppAllowFrom('1234567')).toEqual([
      { type: 'phone', digits: '1234567' },
    ])
  })

  it('accepts maximum E.164 length (15 digits)', () => {
    expect(parseWhatsAppAllowFrom('123456789012345')).toEqual([
      { type: 'phone', digits: '123456789012345' },
    ])
  })

  it('discards numbers shorter than 7 digits', () => {
    expect(parseWhatsAppAllowFrom('123456')).toEqual([])
    expect(parseWhatsAppAllowFrom('+1234')).toEqual([])
  })

  it('discards numbers longer than 15 digits', () => {
    expect(parseWhatsAppAllowFrom('1234567890123456')).toEqual([])
  })

  it('skips invalid entries silently', () => {
    expect(parseWhatsAppAllowFrom('not-a-phone')).toEqual([])
    expect(parseWhatsAppAllowFrom('@username')).toEqual([])
    expect(parseWhatsAppAllowFrom('#chatId')).toEqual([])
  })

  it('parses multiple entries separated by newlines', () => {
    const input = '+12025551234\n+447911123456'

    expect(parseWhatsAppAllowFrom(input)).toEqual([
      { type: 'phone', digits: '12025551234' },
      { type: 'phone', digits: '447911123456' },
    ])
  })

  it('parses multiple entries separated by commas', () => {
    const input = '+12025551234,+447911123456'

    expect(parseWhatsAppAllowFrom(input)).toEqual([
      { type: 'phone', digits: '12025551234' },
      { type: 'phone', digits: '447911123456' },
    ])
  })

  it('parses mixed wildcard and phone entries', () => {
    expect(parseWhatsAppAllowFrom('*\n12025551234')).toEqual([
      { type: 'wildcard' },
      { type: 'phone', digits: '12025551234' },
    ])
  })

  it('trims whitespace around entries', () => {
    expect(parseWhatsAppAllowFrom('  12025551234  \n  447911123456  ')).toEqual(
      [
        { type: 'phone', digits: '12025551234' },
        { type: 'phone', digits: '447911123456' },
      ]
    )
  })

  it('skips blank lines between entries', () => {
    expect(parseWhatsAppAllowFrom('\n12025551234\n\n447911123456\n')).toEqual([
      { type: 'phone', digits: '12025551234' },
      { type: 'phone', digits: '447911123456' },
    ])
  })
})

describe('whatsAppSenderIsAllowed', () => {
  it('blocks all when entries list is empty (secure by default)', () => {
    expect(whatsAppSenderIsAllowed('12025551234', [])).toBe(false)
    expect(whatsAppSenderIsAllowed('447911123456', [])).toBe(false)
  })

  it('allows when wildcard entry is present', () => {
    const entries = parseWhatsAppAllowFrom('*')

    expect(whatsAppSenderIsAllowed('12025551234', entries)).toBe(true)
    expect(whatsAppSenderIsAllowed('999999999', entries)).toBe(true)
  })

  it('allows matching phone number', () => {
    const entries = parseWhatsAppAllowFrom('12025551234')

    expect(whatsAppSenderIsAllowed('12025551234', entries)).toBe(true)
  })

  it('blocks non-matching phone number', () => {
    const entries = parseWhatsAppAllowFrom('12025551234')

    expect(whatsAppSenderIsAllowed('447911123456', entries)).toBe(false)
  })

  it('matches regardless of + prefix in allowFrom entry', () => {
    const entries = parseWhatsAppAllowFrom('+12025551234')

    // WhatsApp delivers sender phone without '+' prefix
    expect(whatsAppSenderIsAllowed('12025551234', entries)).toBe(true)
  })

  it('matches when sender from field has + prefix', () => {
    const entries = parseWhatsAppAllowFrom('12025551234')

    expect(whatsAppSenderIsAllowed('+12025551234', entries)).toBe(true)
  })

  it('allows when any one of multiple entries matches', () => {
    const entries = parseWhatsAppAllowFrom('12025551234\n447911123456')

    expect(whatsAppSenderIsAllowed('12025551234', entries)).toBe(true)
    expect(whatsAppSenderIsAllowed('447911123456', entries)).toBe(true)
  })

  it('blocks when none of multiple entries match', () => {
    const entries = parseWhatsAppAllowFrom('12025551234\n447911123456')

    expect(whatsAppSenderIsAllowed('19999999999', entries)).toBe(false)
  })

  it('blocks when list is non-empty and nothing matches', () => {
    const entries = parseWhatsAppAllowFrom('+447911123456')

    expect(whatsAppSenderIsAllowed('12025551234', entries)).toBe(false)
  })
})
