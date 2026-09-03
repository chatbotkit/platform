import { extname, joinName } from '@/lib/file.helpers'

describe('extname', () => {
  it('returns the extension', () => {
    expect(extname('bar.baz')).toEqual('.baz')
    expect(extname('/bar.baz')).toEqual('.baz')
    expect(extname('/bar')).toEqual(null)
    expect(extname('/bar.baz/qux')).toEqual(null)
  })
})

describe('joinName', () => {
  test('appends extension correctly when a proper extension is provided', () => {
    expect(joinName('filename', 'txt')).toEqual('filename.txt')
  })

  test('returns the name alone when no extension is provided', () => {
    expect(joinName('filename', null)).toEqual('filename')
    expect(joinName('filename', undefined)).toEqual('filename')
  })

  test('correctly adds a dot if the extension does not start with one', () => {
    expect(joinName('filename', 'jpg')).toEqual('filename.jpg')
  })

  test('does not add an extra dot if the extension already starts with one', () => {
    expect(joinName('filename', '.png')).toEqual('filename.png')
  })

  test('returns the name alone when an empty string is provided as extension', () => {
    expect(joinName('filename', '')).toEqual('filename')
  })

  test('handles numeric values in the extension properly', () => {
    expect(joinName('file', '123')).toEqual('file.123')
  })

  test('handles special characters in the extension', () => {
    expect(joinName('file', '$pec!al')).toEqual('file.$pec!al')
  })

  test('handles very long strings', () => {
    const longName = 'a'.repeat(1000)
    const longExt = 'b'.repeat(1000)

    expect(joinName(longName, longExt)).toEqual(`${longName}.${longExt}`)
  })
})
