import { isDataURL, parseDataURL } from '@/lib/dataurl.parse'

describe('isDataURL', () => {
  test('returns true for a valid data URL', () => {
    expect(isDataURL('data:text/plain;base64,SGVsbG8=')).toBe(true)
  })

  test('returns false for a regular URL', () => {
    expect(isDataURL('https://example.com/icon.png')).toBe(false)
  })

  test('returns false for null or undefined', () => {
    expect(isDataURL(null)).toBe(false)
    expect(isDataURL(undefined)).toBe(false)
  })
})

describe('parseDataURL', () => {
  test('parses a valid data URL and extracts the content and MIME type', () => {
    const dataURL = 'data:text/plain;base64,SGVsbG8sIFdvcmxkIQ=='
    const testBuffer = new TextEncoder().encode('Hello, World!')
    const { data, type } = parseDataURL(dataURL)

    expect(type).toBe('text/plain')
    expect(data).toEqual(testBuffer)
  })

  test('throws an error for an invalid data URL', () => {
    expect(() => parseDataURL('data:text/plain;base64,')).toThrow()
  })

  test('parses a large base64 data URL without regex backtracking', () => {
    const content = 'a'.repeat(1024 * 1024)
    const dataURL = `data:video/mp4;base64,${Buffer.from(content).toString(
      'base64'
    )}`

    const { data, type } = parseDataURL(dataURL)

    expect(type).toBe('video/mp4')
    expect(data).toEqual(new TextEncoder().encode(content))
  })
})
