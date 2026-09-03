/**
 * @jest-environment node
 */
import {
  parseTeamsAllowFrom,
  teamsFromIsAllowed,
} from '@/lib/microsoftteams.validation'

describe('parseTeamsAllowFrom', () => {
  it('returns empty array for empty string', () => {
    expect(parseTeamsAllowFrom('')).toEqual([])
  })

  it('returns empty array for whitespace-only string', () => {
    expect(parseTeamsAllowFrom('   \n  ')).toEqual([])
  })

  it('parses wildcard entry', () => {
    expect(parseTeamsAllowFrom('*')).toEqual([{ type: 'wildcard' }])
  })

  it('parses standard Teams user ID', () => {
    expect(parseTeamsAllowFrom('29:1AbcDefGhi')).toEqual([
      { type: 'userId', id: '29:1abcdefghi' },
    ])
  })

  it('normalises entry to lowercase', () => {
    expect(parseTeamsAllowFrom('29:1ABCDEF')).toEqual([
      { type: 'userId', id: '29:1abcdef' },
    ])
  })

  it('parses opaque ID without Teams prefix', () => {
    expect(parseTeamsAllowFrom('some-opaque-id')).toEqual([
      { type: 'userId', id: 'some-opaque-id' },
    ])
  })

  it('silently discards blank lines', () => {
    const result = parseTeamsAllowFrom('29:1Abc\n\n29:1Def')

    expect(result).toEqual([
      { type: 'userId', id: '29:1abc' },
      { type: 'userId', id: '29:1def' },
    ])
  })

  it('splits on commas', () => {
    const result = parseTeamsAllowFrom('29:1Abc,29:1Def')

    expect(result).toEqual([
      { type: 'userId', id: '29:1abc' },
      { type: 'userId', id: '29:1def' },
    ])
  })

  it('trims whitespace around entries', () => {
    const result = parseTeamsAllowFrom('  29:1Abc  \n  29:1Def  ')

    expect(result).toEqual([
      { type: 'userId', id: '29:1abc' },
      { type: 'userId', id: '29:1def' },
    ])
  })

  it('handles mixed newline and comma separators', () => {
    const result = parseTeamsAllowFrom('29:1Abc,29:1Def\n*')

    expect(result).toHaveLength(3)
    expect(result[2]).toEqual({ type: 'wildcard' })
  })

  it('parses wildcard mixed with user IDs', () => {
    const result = parseTeamsAllowFrom('29:1Abc\n*\n29:1Xyz')

    expect(result).toEqual([
      { type: 'userId', id: '29:1abc' },
      { type: 'wildcard' },
      { type: 'userId', id: '29:1xyz' },
    ])
  })
})

describe('teamsFromIsAllowed', () => {
  it('denies all when entry list is empty', () => {
    expect(teamsFromIsAllowed('29:1AbcDef', [])).toBe(false)
  })

  it('allows any sender when wildcard is present', () => {
    const entries = parseTeamsAllowFrom('*')

    expect(teamsFromIsAllowed('29:1AbcDef', entries)).toBe(true)
    expect(teamsFromIsAllowed('29:1XyzUnknown', entries)).toBe(true)
  })

  it('allows matching Teams user ID', () => {
    const entries = parseTeamsAllowFrom('29:1AbcDef')

    expect(teamsFromIsAllowed('29:1AbcDef', entries)).toBe(true)
  })

  it('allows match case-insensitively', () => {
    const entries = parseTeamsAllowFrom('29:1ABCDEF')

    expect(teamsFromIsAllowed('29:1abcdef', entries)).toBe(true)
    expect(teamsFromIsAllowed('29:1AbCdEf', entries)).toBe(true)
  })

  it('denies sender not in list', () => {
    const entries = parseTeamsAllowFrom('29:1AbcDef')

    expect(teamsFromIsAllowed('29:1OtherUser', entries)).toBe(false)
  })

  it('allows one of multiple listed IDs', () => {
    const entries = parseTeamsAllowFrom('29:1Alice\n29:1Bob')

    expect(teamsFromIsAllowed('29:1Alice', entries)).toBe(true)
    expect(teamsFromIsAllowed('29:1Bob', entries)).toBe(true)
    expect(teamsFromIsAllowed('29:1Charlie', entries)).toBe(false)
  })

  it('allows when wildcard is among multiple entries', () => {
    const entries = parseTeamsAllowFrom('29:1Alice\n*')

    expect(teamsFromIsAllowed('29:1Anyone', entries)).toBe(true)
  })

  it('denies all when entry list is empty string', () => {
    const entries = parseTeamsAllowFrom('')

    expect(teamsFromIsAllowed('29:1AbcDef', entries)).toBe(false)
  })
})
