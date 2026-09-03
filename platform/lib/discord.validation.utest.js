import {
  discordSenderIsAllowed,
  parseDiscordAllowFrom,
} from './discord.validation'

describe('parseDiscordAllowFrom', () => {
  it('returns empty array for empty string', () => {
    expect(parseDiscordAllowFrom('')).toEqual([])
    expect(parseDiscordAllowFrom('   ')).toEqual([])
    expect(parseDiscordAllowFrom('\n\n')).toEqual([])
  })

  it('parses wildcard entry', () => {
    expect(parseDiscordAllowFrom('*')).toEqual([{ type: 'wildcard' }])
  })

  it('parses Discord snowflake user ID with @ prefix', () => {
    expect(parseDiscordAllowFrom('@123456789012345678')).toEqual([
      { type: 'userId', id: '123456789012345678' },
    ])
  })

  it('parses raw Discord snowflake user ID without prefix', () => {
    expect(parseDiscordAllowFrom('123456789012345678')).toEqual([
      { type: 'userId', id: '123456789012345678' },
    ])
  })

  it('parses 15-digit snowflake IDs (minimum length)', () => {
    expect(parseDiscordAllowFrom('123456789012345')).toEqual([
      { type: 'userId', id: '123456789012345' },
    ])
    expect(parseDiscordAllowFrom('@123456789012345')).toEqual([
      { type: 'userId', id: '123456789012345' },
    ])
  })

  it('does not treat short digit strings as user IDs (raw, no @)', () => {
    // @note raw digits without @ are silently dropped - not a known format
    expect(parseDiscordAllowFrom('12345678')).toEqual([])
  })

  it('treats @-prefixed short digit strings as usernames', () => {
    // @note @12345678 is not long enough for a snowflake, so it falls through to username
    expect(parseDiscordAllowFrom('@12345678')).toEqual([
      { type: 'username', username: '12345678' },
    ])
  })

  it('parses @username (non-ID form) as username entry', () => {
    expect(parseDiscordAllowFrom('@johndoe')).toEqual([
      { type: 'username', username: 'johndoe' },
    ])
  })

  it('parses @username case-insensitively', () => {
    expect(parseDiscordAllowFrom('@JohnDoe')).toEqual([
      { type: 'username', username: 'johndoe' },
    ])
  })

  it('parses newline-separated list', () => {
    expect(parseDiscordAllowFrom('123456789012345678\n@alice\n*')).toEqual([
      { type: 'userId', id: '123456789012345678' },
      { type: 'username', username: 'alice' },
      { type: 'wildcard' },
    ])
  })

  it('parses comma-separated list', () => {
    expect(
      parseDiscordAllowFrom('123456789012345678,987654321098765432')
    ).toEqual([
      { type: 'userId', id: '123456789012345678' },
      { type: 'userId', id: '987654321098765432' },
    ])
  })

  it('silently skips invalid or empty entries', () => {
    expect(parseDiscordAllowFrom('@\n  \n@valid')).toEqual([
      { type: 'username', username: 'valid' },
    ])
  })

  it('does not treat non-digit strings without @ as entries', () => {
    expect(parseDiscordAllowFrom('notasnowflake')).toEqual([])
  })
})

describe('discordSenderIsAllowed', () => {
  const userId = '123456789012345678'
  const username = 'johndoe'

  const sender = { userId, username }

  it('blocks all when entries list is empty (secure by default)', () => {
    expect(discordSenderIsAllowed(sender, [])).toBe(false)
    expect(discordSenderIsAllowed({ userId: '987654321098765432' }, [])).toBe(
      false
    )
  })

  it('allows when wildcard entry is present', () => {
    const entries = parseDiscordAllowFrom('*')

    expect(discordSenderIsAllowed(sender, entries)).toBe(true)
    expect(
      discordSenderIsAllowed({ userId: '987654321098765432' }, entries)
    ).toBe(true)
  })

  it('allows matching userId via @ prefix', () => {
    const entries = parseDiscordAllowFrom('@123456789012345678')

    expect(discordSenderIsAllowed(sender, entries)).toBe(true)
  })

  it('allows matching userId via raw snowflake', () => {
    const entries = parseDiscordAllowFrom('123456789012345678')

    expect(discordSenderIsAllowed(sender, entries)).toBe(true)
  })

  it('blocks non-matching userId', () => {
    const entries = parseDiscordAllowFrom('@999999999999999999')

    expect(discordSenderIsAllowed(sender, entries)).toBe(false)
  })

  it('allows matching username', () => {
    const entries = parseDiscordAllowFrom('@johndoe')

    expect(
      discordSenderIsAllowed({ ...sender, username: 'johndoe' }, entries)
    ).toBe(true)
  })

  it('blocks when username does not match', () => {
    const entries = parseDiscordAllowFrom('@alice')

    expect(
      discordSenderIsAllowed({ ...sender, username: 'bob' }, entries)
    ).toBe(false)
  })

  it('blocks when username is undefined and entry is username type', () => {
    const entries = parseDiscordAllowFrom('@johndoe')

    expect(discordSenderIsAllowed({ userId }, entries)).toBe(false)
  })

  it('username matching is case-insensitive', () => {
    const entries = parseDiscordAllowFrom('@JohnDoe')

    expect(
      discordSenderIsAllowed({ ...sender, username: 'JOHNDOE' }, entries)
    ).toBe(true)
  })

  it('allows when any of multiple entries match', () => {
    const entries = parseDiscordAllowFrom(
      '999999999999999999\n123456789012345678'
    )

    expect(discordSenderIsAllowed(sender, entries)).toBe(true)
  })

  it('blocks when none of multiple entries match', () => {
    const entries = parseDiscordAllowFrom(
      '999999999999999999\n888888888888888888'
    )

    expect(discordSenderIsAllowed(sender, entries)).toBe(false)
  })

  it('stops at first match (wildcard short-circuits)', () => {
    const entries = parseDiscordAllowFrom('*\n999999999999999999')

    expect(
      discordSenderIsAllowed({ userId: 'any-user-id-0000' }, entries)
    ).toBe(true)
  })
})
