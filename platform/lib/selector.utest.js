import { shouldSkipHTML, shouldSkipJSONLD } from '@/lib/selector'

describe('shouldSkipHTML', () => {
  it('must correctly check if html should be skipped', () => {
    expect(shouldSkipHTML()).toEqual(false)
    expect(shouldSkipHTML('')).toEqual(false)
    expect(shouldSkipHTML('@skiphtml')).toEqual(true)
    expect(shouldSkipHTML('html')).toEqual(false)
  })
})

describe('shouldSkipJSONLD', () => {
  it('must correctly check if jsonld should be skipped', () => {
    expect(shouldSkipJSONLD()).toEqual(true)
    expect(shouldSkipJSONLD('')).toEqual(true)
    expect(shouldSkipJSONLD('@skipjsonld')).toEqual(true)
    expect(shouldSkipJSONLD('@jsonld')).toEqual(false)
  })
})
