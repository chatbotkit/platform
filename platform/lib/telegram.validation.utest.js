import {
  parseTelegramAllowFrom,
  telegramSenderIsAllowed,
} from './telegram.validation'

describe('parseTelegramAllowFrom', () => {
  it('returns empty array for empty string', () => {
    expect(parseTelegramAllowFrom('')).toEqual([])
    expect(parseTelegramAllowFrom('   ')).toEqual([])
    expect(parseTelegramAllowFrom('\n\n')).toEqual([])
  })

  it('parses wildcard entry', () => {
    expect(parseTelegramAllowFrom('*')).toEqual([{ type: 'wildcard' }])
  })

  it('parses @username entry', () => {
    expect(parseTelegramAllowFrom('@bob')).toEqual([
      { type: 'username', username: 'bob' },
    ])
  })

  it('parses @username case-insensitively', () => {
    expect(parseTelegramAllowFrom('@Bob')).toEqual([
      { type: 'username', username: 'bob' },
    ])
  })

  it('parses @numericId as userId', () => {
    expect(parseTelegramAllowFrom('@111222333')).toEqual([
      { type: 'userId', id: 111222333 },
    ])
  })

  it('parses #chatId entry', () => {
    expect(parseTelegramAllowFrom('#-1001234567')).toEqual([
      { type: 'chatId', id: -1001234567 },
    ])
  })

  it('parses positive raw integer as userId', () => {
    expect(parseTelegramAllowFrom('111222333')).toEqual([
      { type: 'userId', id: 111222333 },
    ])
  })

  it('parses negative raw integer as chatId', () => {
    expect(parseTelegramAllowFrom('-1001234567')).toEqual([
      { type: 'chatId', id: -1001234567 },
    ])
  })

  it('skips invalid entries silently', () => {
    expect(parseTelegramAllowFrom('not-a-valid-entry')).toEqual([])
    expect(parseTelegramAllowFrom('@')).toEqual([])
    expect(parseTelegramAllowFrom('#')).toEqual([])
    expect(parseTelegramAllowFrom('#notanumber')).toEqual([])
  })

  it('parses multiple entries separated by newlines', () => {
    const input = '@bob\n@111222333\n#-1001234567'

    expect(parseTelegramAllowFrom(input)).toEqual([
      { type: 'username', username: 'bob' },
      { type: 'userId', id: 111222333 },
      { type: 'chatId', id: -1001234567 },
    ])
  })

  it('parses multiple entries separated by commas', () => {
    const input = '@bob,111222333,-1001234567'

    expect(parseTelegramAllowFrom(input)).toEqual([
      { type: 'username', username: 'bob' },
      { type: 'userId', id: 111222333 },
      { type: 'chatId', id: -1001234567 },
    ])
  })

  it('trims whitespace around entries', () => {
    expect(parseTelegramAllowFrom('  @bob  \n  111222333  ')).toEqual([
      { type: 'username', username: 'bob' },
      { type: 'userId', id: 111222333 },
    ])
  })
})

describe('telegramSenderIsAllowed', () => {
  const userId = 111222333
  const chatId = -1001234567
  const username = 'bob'

  it('blocks all when entries list is empty (secure by default)', () => {
    expect(telegramSenderIsAllowed(userId, chatId, username, [])).toBe(false)
    expect(telegramSenderIsAllowed(999, 888, undefined, [])).toBe(false)
  })

  it('allows when wildcard entry is present', () => {
    const entries = parseTelegramAllowFrom('*')

    expect(telegramSenderIsAllowed(userId, chatId, username, entries)).toBe(
      true
    )
    expect(telegramSenderIsAllowed(999, 888, undefined, entries)).toBe(true)
  })

  it('allows matching userId', () => {
    const entries = parseTelegramAllowFrom('@111222333')

    expect(telegramSenderIsAllowed(userId, chatId, username, entries)).toBe(
      true
    )
    expect(telegramSenderIsAllowed(999, chatId, username, entries)).toBe(false)
  })

  it('allows matching chatId', () => {
    const entries = parseTelegramAllowFrom('#-1001234567')

    expect(telegramSenderIsAllowed(userId, chatId, username, entries)).toBe(
      true
    )
    expect(telegramSenderIsAllowed(userId, -999, username, entries)).toBe(false)
  })

  it('allows matching username (case-insensitive)', () => {
    const entries = parseTelegramAllowFrom('@Bob')

    expect(telegramSenderIsAllowed(userId, chatId, 'bob', entries)).toBe(true)
    expect(telegramSenderIsAllowed(userId, chatId, 'BOB', entries)).toBe(true)
    expect(telegramSenderIsAllowed(userId, chatId, 'alice', entries)).toBe(
      false
    )
  })

  it('does not allow when username is undefined and only username entry exists', () => {
    const entries = parseTelegramAllowFrom('@bob')

    expect(telegramSenderIsAllowed(userId, chatId, undefined, entries)).toBe(
      false
    )
  })

  it('allows when any one of multiple entries matches', () => {
    const entries = parseTelegramAllowFrom('@bob\n#-1001234567')

    // matches via chatId
    expect(telegramSenderIsAllowed(999, chatId, 'alice', entries)).toBe(true)
    // matches via username
    expect(telegramSenderIsAllowed(999, 888, 'bob', entries)).toBe(true)
    // matches neither
    expect(telegramSenderIsAllowed(999, 888, 'alice', entries)).toBe(false)
  })

  it('blocks when list is non-empty and nothing matches', () => {
    const entries = parseTelegramAllowFrom('@111222333')

    expect(telegramSenderIsAllowed(999, chatId, username, entries)).toBe(false)
  })
})
