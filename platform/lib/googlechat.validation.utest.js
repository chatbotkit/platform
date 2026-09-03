import {
  googleChatSenderIsAllowed,
  parseGoogleChatAllowFrom,
} from './googlechat.validation'

describe('parseGoogleChatAllowFrom', () => {
  it('returns empty array for empty string', () => {
    expect(parseGoogleChatAllowFrom('')).toEqual([])
    expect(parseGoogleChatAllowFrom('   ')).toEqual([])
    expect(parseGoogleChatAllowFrom('\n\n')).toEqual([])
  })

  it('parses wildcard entry', () => {
    expect(parseGoogleChatAllowFrom('*')).toEqual([{ type: 'wildcard' }])
  })

  it('parses users/ resource name as userId', () => {
    expect(parseGoogleChatAllowFrom('users/USER_123')).toEqual([
      { type: 'userId', id: 'users/user_123' },
    ])
  })

  it('normalises userId to lowercase', () => {
    expect(parseGoogleChatAllowFrom('users/UPPER_CASE')).toEqual([
      { type: 'userId', id: 'users/upper_case' },
    ])
  })

  it('silently discards unrecognised entries (non-users/ strings)', () => {
    expect(parseGoogleChatAllowFrom('Alice')).toEqual([])
    expect(parseGoogleChatAllowFrom('john.doe@example.com')).toEqual([])
    expect(parseGoogleChatAllowFrom('randomstring')).toEqual([])
  })

  it('silently skips blank entries in a list', () => {
    expect(parseGoogleChatAllowFrom('users/USER_A,users/USER_B')).toEqual([
      { type: 'userId', id: 'users/user_a' },
      { type: 'userId', id: 'users/user_b' },
    ])
  })

  it('silently skips blank entries in a list', () => {
    expect(parseGoogleChatAllowFrom('users/USER_A\n  \nusers/USER_B')).toEqual([
      { type: 'userId', id: 'users/user_a' },
      { type: 'userId', id: 'users/user_b' },
    ])
  })

  it('parses mixed newline and comma separators', () => {
    expect(parseGoogleChatAllowFrom('*,users/USER_A\nusers/USER_B')).toEqual([
      { type: 'wildcard' },
      { type: 'userId', id: 'users/user_a' },
      { type: 'userId', id: 'users/user_b' },
    ])
  })

  it('trims surrounding whitespace from each entry', () => {
    expect(parseGoogleChatAllowFrom('  users/USER_A  \n  *  ')).toEqual([
      { type: 'userId', id: 'users/user_a' },
      { type: 'wildcard' },
    ])
  })
})

describe('googleChatSenderIsAllowed', () => {
  const sender = { name: 'users/USER_123' }

  it('blocks all when entries list is empty (secure by default)', () => {
    expect(googleChatSenderIsAllowed(sender, [])).toBe(false)
    expect(googleChatSenderIsAllowed({ name: 'users/OTHER' }, [])).toBe(false)
  })

  it('allows when wildcard entry is present', () => {
    const entries = parseGoogleChatAllowFrom('*')

    expect(googleChatSenderIsAllowed(sender, entries)).toBe(true)
    expect(googleChatSenderIsAllowed({ name: 'users/ANYONE' }, entries)).toBe(
      true
    )
  })

  it('allows matching userId (case-insensitive)', () => {
    const entries = parseGoogleChatAllowFrom('users/USER_123')

    expect(googleChatSenderIsAllowed({ name: 'users/USER_123' }, entries)).toBe(
      true
    )
    expect(googleChatSenderIsAllowed({ name: 'users/user_123' }, entries)).toBe(
      true
    )
  })

  it('blocks non-matching userId', () => {
    const entries = parseGoogleChatAllowFrom('users/OTHER')

    expect(googleChatSenderIsAllowed(sender, entries)).toBe(false)
  })

  it('allows when any entry in a multi-entry list matches', () => {
    const entries = parseGoogleChatAllowFrom('users/OTHER_USER\nusers/USER_123')

    expect(googleChatSenderIsAllowed(sender, entries)).toBe(true)
  })

  it('blocks when none of multiple entries match', () => {
    const entries = parseGoogleChatAllowFrom('users/A\nusers/B')

    expect(googleChatSenderIsAllowed(sender, entries)).toBe(false)
  })

  it('wildcard short-circuits remaining entries', () => {
    const entries = parseGoogleChatAllowFrom('*\nusers/NEVER_REACHED')

    expect(googleChatSenderIsAllowed({ name: 'users/RANDOM' }, entries)).toBe(
      true
    )
  })
})
