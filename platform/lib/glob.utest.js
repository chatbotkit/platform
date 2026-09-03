import { makeGlobUrl, match } from '@/lib/glob'

describe('match', () => {
  it('must match', () => {
    expect(match('/', '**')).toBe(true)
    expect(match('/test/abc.123', '/test/*.123')).toBe(true)
    expect(match('/test/abc.456', '/test/*.123')).toBe(false)
    expect(match('/test/a/b/c.123', '/test/**/*.123')).toBe(true)
  })

  it('must match multiline patterns', () => {
    expect(match('/test/abc.123', '/test/*.123\n/test/*.456')).toBe(true)
    expect(match('/test/abc.456', '/test/*.123\n/test/*.456')).toBe(true)
    expect(match('/test/abc.789', '/test/*.123\n/test/*.456')).toBe(false)
  })

  it('must match multiline patterns with negation', () => {
    expect(match('/test/abc.123', '/test/*.123\n!/test/*.456')).toBe(true)
    expect(match('/test/abc.456', '/test/*.123\n!/test/*.456')).toBe(false)
    expect(match('/test/abc.789', '/test/*.123\n!/test/*.456')).toBe(false)
  })
})

describe('makeGlobUrl', () => {
  it('must correctly make glob url', () => {
    expect(makeGlobUrl('https://test.com', '**')).toBe('https://test.com/**')
    expect(makeGlobUrl('https://test.com', '/**')).toBe('https://test.com/**')
    expect(makeGlobUrl('https://test.com', '/test/{abc,xyz}/**')).toBe(
      'https://test.com/test/{abc,xyz}/**'
    )
    expect(
      makeGlobUrl('https://test.com', 'https://best.com/test/{abc,xyz}/**')
    ).toBe('https://best.com/test/{abc,xyz}/**')
  })
})
