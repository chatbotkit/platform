/**
 * @jest-environment node
 */
import {
  MASK_SENTINEL,
  isMaskSentinel,
  maskCredentials,
  maskSecretConfig,
  unmaskCredentials,
  unmaskSecretConfig,
} from './credential.mask'

describe('credential.mask', () => {
  it('isMaskSentinel matches only the sentinel', () => {
    expect(isMaskSentinel('********')).toBe(true)
    expect(isMaskSentinel(MASK_SENTINEL)).toBe(true)
    expect(isMaskSentinel('*******')).toBe(false)
    expect(isMaskSentinel(null)).toBe(false)
    expect(isMaskSentinel(undefined)).toBe(false)
  })

  it('maskCredentials replaces set fields with the sentinel and unset with null', () => {
    const row = { id: '1', a: 'secret', b: null, c: '', d: 'keep' }

    const masked = maskCredentials(row, ['a', 'b', 'c'])

    expect(masked).toEqual({
      id: '1',
      a: MASK_SENTINEL,
      b: null,
      c: null,
      d: 'keep',
    })

    // @note the input row is left untouched
    expect(row.a).toBe('secret')
  })

  it('maskCredentials does not add fields the row did not select', () => {
    expect(maskCredentials({ id: '1' }, ['a'])).toEqual({ id: '1' })
  })

  it('unmaskCredentials turns the sentinel into undefined and passes other values through', () => {
    expect(
      unmaskCredentials(
        { a: MASK_SENTINEL, b: 'new', c: null, d: '' },
        ['a', 'b', 'c', 'd']
      )
    ).toEqual({ a: undefined, b: 'new', c: null, d: '' })
  })

  it('maskSecretConfig masks clientSecret and leaves the rest', () => {
    expect(
      maskSecretConfig({ clientId: 'id', clientSecret: 's', scope: 'x' })
    ).toEqual({ clientId: 'id', clientSecret: MASK_SENTINEL, scope: 'x' })

    expect(maskSecretConfig({ clientId: 'id' })).toEqual({ clientId: 'id' })
    expect(maskSecretConfig({ clientSecret: null })).toEqual({
      clientSecret: null,
    })
    expect(maskSecretConfig(null)).toBeNull()
    expect(maskSecretConfig(undefined)).toBeUndefined()
  })

  it('unmaskSecretConfig restores the stored clientSecret behind the sentinel', () => {
    expect(
      unmaskSecretConfig(
        { clientId: 'new', clientSecret: MASK_SENTINEL },
        { clientId: 'old', clientSecret: 'stored' }
      )
    ).toEqual({ clientId: 'new', clientSecret: 'stored' })

    // a real value wins
    expect(
      unmaskSecretConfig({ clientSecret: 'fresh' }, { clientSecret: 'stored' })
    ).toEqual({ clientSecret: 'fresh' })

    // sentinel with nothing stored drops the key rather than storing asterisks
    expect(unmaskSecretConfig({ clientSecret: MASK_SENTINEL }, null)).toEqual(
      {}
    )

    expect(unmaskSecretConfig(null, { clientSecret: 'stored' })).toBeNull()
    expect(unmaskSecretConfig(undefined, {})).toBeUndefined()
  })
})
