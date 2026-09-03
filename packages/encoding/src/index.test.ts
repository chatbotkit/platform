import { getEncoding } from './index'

describe('getEncoding', () => {
  it('should detect empty buffer', () => {
    const buffer = new Uint8Array([])

    expect(getEncoding(buffer)).toBe('utf8')
  })

  it('should detect buffer with space', () => {
    const buffer = new Uint8Array([0x20]) // Space character

    expect(getEncoding(buffer)).toBe('utf8')
  })

  it('should detect utf8', () => {
    const buffer = new Uint8Array([0xe2, 0x82, 0xac]) // € (euro sign)

    expect(getEncoding(buffer)).toBe('utf8')
  })

  it('should detect binary', () => {
    const buffer = new Uint8Array([0xff, 0x00, 0x01]) // Non-UTF8 bytes

    expect(getEncoding(buffer)).toBe('binary')
  })
})
