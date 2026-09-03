import {
  cloakKeyRegex,
  exportKey,
  formatKey,
  generateKey,
  parseKey,
} from './key'

describe('key', () => {
  test('formatKey', () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
    const received = formatKey(bytes)
    const expected = 'k1.aesgcm256.AQIDBAUGBwg='

    expect(received).toEqual(expected)
  })

  test('parseKey + formatKey', async () => {
    const key = 'k1.aesgcm256.Q46Y_L1Vx3KBVQ1POmtuGo2IdWalnbWQzxigxC-vEqo='
    const parsed = await parseKey(key)
    const received = formatKey(await exportKey(parsed.key))

    expect(parsed.fingerprint).toEqual('1fb314a0')
    expect(received).toEqual(key)
  })

  test('generateKey', () => {
    const key = generateKey()

    expect(key).toMatch(cloakKeyRegex)
  })
})
