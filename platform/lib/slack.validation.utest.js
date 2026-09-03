import { parseSlackAllowFrom, slackSenderIsAllowed } from './slack.validation'

describe('parseSlackAllowFrom', () => {
  it('returns empty array for empty string', () => {
    expect(parseSlackAllowFrom('')).toEqual([])
    expect(parseSlackAllowFrom('   ')).toEqual([])
    expect(parseSlackAllowFrom('\n\n')).toEqual([])
  })

  it('parses wildcard entry', () => {
    expect(parseSlackAllowFrom('*')).toEqual([{ type: 'wildcard' }])
  })

  it('parses Slack user ID with @ prefix', () => {
    expect(parseSlackAllowFrom('@U12345678')).toEqual([
      { type: 'userId', id: 'U12345678' },
    ])
  })

  it('parses Slack workspace user ID (W…) with @ prefix', () => {
    expect(parseSlackAllowFrom('@W12345678')).toEqual([
      { type: 'userId', id: 'W12345678' },
    ])
  })

  it('parses raw Slack user ID without prefix', () => {
    expect(parseSlackAllowFrom('U12345678')).toEqual([
      { type: 'userId', id: 'U12345678' },
    ])
    expect(parseSlackAllowFrom('W12345678')).toEqual([
      { type: 'userId', id: 'W12345678' },
    ])
  })

  it('normalises user IDs to uppercase', () => {
    expect(parseSlackAllowFrom('@u12345678')).toEqual([
      { type: 'userId', id: 'U12345678' },
    ])
    expect(parseSlackAllowFrom('u12345678')).toEqual([
      { type: 'userId', id: 'U12345678' },
    ])
  })

  it('parses Slack channel ID with # prefix', () => {
    expect(parseSlackAllowFrom('#C12345678')).toEqual([
      { type: 'channelId', id: 'C12345678' },
    ])
  })

  it('parses Slack private group ID with # prefix', () => {
    expect(parseSlackAllowFrom('#G12345678')).toEqual([
      { type: 'channelId', id: 'G12345678' },
    ])
  })

  it('parses Slack DM channel ID with # prefix', () => {
    expect(parseSlackAllowFrom('#D12345678')).toEqual([
      { type: 'channelId', id: 'D12345678' },
    ])
  })

  it('parses raw Slack channel ID without prefix', () => {
    expect(parseSlackAllowFrom('C12345678')).toEqual([
      { type: 'channelId', id: 'C12345678' },
    ])
    expect(parseSlackAllowFrom('G12345678')).toEqual([
      { type: 'channelId', id: 'G12345678' },
    ])
  })

  it('normalises channel IDs to uppercase', () => {
    expect(parseSlackAllowFrom('#c12345678')).toEqual([
      { type: 'channelId', id: 'C12345678' },
    ])
    expect(parseSlackAllowFrom('c12345678')).toEqual([
      { type: 'channelId', id: 'C12345678' },
    ])
  })

  it('parses @username (non-ID form) as username entry', () => {
    expect(parseSlackAllowFrom('@johndoe')).toEqual([
      { type: 'username', username: 'johndoe' },
    ])
  })

  it('parses @username case-insensitively', () => {
    expect(parseSlackAllowFrom('@JohnDoe')).toEqual([
      { type: 'username', username: 'johndoe' },
    ])
  })

  it('parses #channel-name (non-ID form) as channelName entry', () => {
    expect(parseSlackAllowFrom('#general')).toEqual([
      { type: 'channelName', name: 'general' },
    ])
    expect(parseSlackAllowFrom('#my-team-channel')).toEqual([
      { type: 'channelName', name: 'my-team-channel' },
    ])
  })

  it('parses #channel-name case-insensitively', () => {
    expect(parseSlackAllowFrom('#General')).toEqual([
      { type: 'channelName', name: 'general' },
    ])
  })

  it('parses newline-separated list', () => {
    expect(parseSlackAllowFrom('U12345678\n#general\n*')).toEqual([
      { type: 'userId', id: 'U12345678' },
      { type: 'channelName', name: 'general' },
      { type: 'wildcard' },
    ])
  })

  it('parses comma-separated list', () => {
    expect(parseSlackAllowFrom('U12345678,C12345678')).toEqual([
      { type: 'userId', id: 'U12345678' },
      { type: 'channelId', id: 'C12345678' },
    ])
  })

  it('silently skips invalid or empty entries', () => {
    expect(parseSlackAllowFrom('@\n#\n  \n@valid')).toEqual([
      { type: 'username', username: 'valid' },
    ])
  })
})

describe('slackSenderIsAllowed', () => {
  const userId = 'U12345678'
  const channelId = 'C87654321'
  const username = 'johndoe'
  const channelName = 'general'

  const sender = { userId, channelId, username, channelName }

  it('blocks all when entries list is empty (secure by default)', () => {
    expect(slackSenderIsAllowed(sender, [])).toBe(false)
    expect(
      slackSenderIsAllowed({ userId: 'UOTHER', channelId: 'COTHER' }, [])
    ).toBe(false)
  })

  it('allows when wildcard entry is present', () => {
    const entries = parseSlackAllowFrom('*')

    expect(slackSenderIsAllowed(sender, entries)).toBe(true)
    expect(
      slackSenderIsAllowed({ userId: 'UOTHER', channelId: 'COTHER' }, entries)
    ).toBe(true)
  })

  it('allows matching userId via @ prefix', () => {
    const entries = parseSlackAllowFrom('@U12345678')

    expect(slackSenderIsAllowed(sender, entries)).toBe(true)
  })

  it('allows matching userId via raw ID', () => {
    const entries = parseSlackAllowFrom('U12345678')

    expect(slackSenderIsAllowed(sender, entries)).toBe(true)
  })

  it('blocks non-matching userId', () => {
    const entries = parseSlackAllowFrom('@U99999999')

    expect(slackSenderIsAllowed(sender, entries)).toBe(false)
  })

  it('is case-insensitive for userId matching', () => {
    const entries = parseSlackAllowFrom('@u12345678')

    expect(slackSenderIsAllowed(sender, entries)).toBe(true)
  })

  it('allows matching channelId via # prefix', () => {
    const entries = parseSlackAllowFrom('#C87654321')

    expect(slackSenderIsAllowed(sender, entries)).toBe(true)
  })

  it('allows matching channelId via raw ID', () => {
    const entries = parseSlackAllowFrom('C87654321')

    expect(slackSenderIsAllowed(sender, entries)).toBe(true)
  })

  it('blocks non-matching channelId', () => {
    const entries = parseSlackAllowFrom('#C00000000')

    expect(slackSenderIsAllowed(sender, entries)).toBe(false)
  })

  it('allows matching username', () => {
    const entries = parseSlackAllowFrom('@johndoe')

    expect(
      slackSenderIsAllowed({ ...sender, username: 'johndoe' }, entries)
    ).toBe(true)
  })

  it('blocks when username does not match', () => {
    const entries = parseSlackAllowFrom('@alice')

    expect(slackSenderIsAllowed({ ...sender, username: 'bob' }, entries)).toBe(
      false
    )
  })

  it('blocks when username is undefined and entry is username type', () => {
    const entries = parseSlackAllowFrom('@johndoe')

    expect(
      slackSenderIsAllowed({ userId, channelId, channelName }, entries)
    ).toBe(false)
  })

  it('allows matching channelName', () => {
    const entries = parseSlackAllowFrom('#general')

    expect(
      slackSenderIsAllowed({ ...sender, channelName: 'general' }, entries)
    ).toBe(true)
  })

  it('blocks when channelName does not match', () => {
    const entries = parseSlackAllowFrom('#random')

    expect(
      slackSenderIsAllowed({ ...sender, channelName: 'general' }, entries)
    ).toBe(false)
  })

  it('blocks when channelName is undefined and entry is channelName type', () => {
    const entries = parseSlackAllowFrom('#general')

    expect(slackSenderIsAllowed({ userId, channelId, username }, entries)).toBe(
      false
    )
  })

  it('allows when any of multiple entries match', () => {
    const entries = parseSlackAllowFrom('U99999999\nU12345678')

    expect(slackSenderIsAllowed(sender, entries)).toBe(true)
  })

  it('blocks when none of multiple entries match', () => {
    const entries = parseSlackAllowFrom('U99999999\nC00000000')

    expect(slackSenderIsAllowed(sender, entries)).toBe(false)
  })
})
