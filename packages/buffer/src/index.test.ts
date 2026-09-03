import {
  b64d2buf,
  buf2b64d,
  buf2hex,
  buf2str,
  buf2stream,
  concatBufs,
  hex2buf,
  str2buf,
  stream2buf,
} from './index'

describe('buf2str', () => {
  test('converts an ArrayBuffer to a string', () => {
    const testArrayBuffer = str2buf('Hello, World!')

    expect(buf2str(testArrayBuffer)).toBe('Hello, World!')
  })
})

describe('str2buf', () => {
  test('converts a string to an ArrayBuffer', () => {
    const testString = 'Hello, World!'

    expect(new TextDecoder().decode(str2buf(testString))).toBe(testString)
  })
})

describe('hex2buf', () => {
  test('converts a hex string to a Uint8Array', () => {
    const testHex = '48656c6c6f2c20576f726c6421'
    const expectedArray = Uint8Array.from(
      new TextEncoder().encode('Hello, World!')
    )

    expect(hex2buf(testHex)).toEqual(expectedArray)
  })

  test('should match Buffer from Node.js', () => {
    const testHexBuf = hex2buf('48656c6c6f2c20576f726c6421')
    const expectedHexBuf = new Uint8Array(
      Buffer.from('48656c6c6f2c20576f726c6421', 'hex')
    )

    expect(testHexBuf).toEqual(expectedHexBuf)
  })

  test('should throw on odd-length hex string', () => {
    expect(() => hex2buf('abc')).toThrow('odd length')
    expect(() => hex2buf('a')).toThrow('odd length')
  })
})

describe('buf2hex', () => {
  test('converts a Uint8Array to a hex string', () => {
    const testBuffer = new TextEncoder().encode('Hello, World!')
    const testHex = '48656c6c6f2c20576f726c6421'

    expect(buf2hex(testBuffer)).toBe(testHex)
  })
})

describe('b64d2buf', () => {
  test('converts a base64 encoded string to a Uint8Array', () => {
    const testBase64 = 'SGVsbG8sIFdvcmxkIQ=='
    const testBuffer = new TextEncoder().encode('Hello, World!')

    expect(b64d2buf(testBase64)).toEqual(testBuffer)
  })
})

describe('buf2b64d', () => {
  test('converts a Uint8Array to a base64 string', () => {
    const testBuffer = new TextEncoder().encode('Hello, World!')
    const testBase64 = 'SGVsbG8sIFdvcmxkIQ=='

    expect(buf2b64d(testBuffer)).toBe(testBase64)
  })
})

describe('concatBufs', () => {
  test('concatenates multiple ArrayBuffers into a single ArrayBuffer', () => {
    const buffer1 = str2buf('Hello')
    const buffer2 = str2buf(' ')
    const buffer3 = str2buf('World')
    const concatenatedBuffer = concatBufs(buffer1, buffer2, buffer3)

    expect(new TextDecoder().decode(concatenatedBuffer)).toBe('Hello World')
  })

  test('matches Buffer.concat from Node.js', () => {
    const testBuf = new Uint8Array(
      concatBufs(str2buf('Hello'), str2buf(' '), str2buf('World'))
    )
    const expectedBuf = new Uint8Array(
      Buffer.concat([
        Buffer.from('Hello'),
        Buffer.from(' '),
        Buffer.from('World'),
      ])
    )

    expect(testBuf).toEqual(expectedBuf)
  })
})

describe('stream2buf', () => {
  test('converts a ReadableStream to an ArrayBuffer', async () => {
    const testArrayBuffer = str2buf('Hello, World!')
    const stream = await buf2stream(testArrayBuffer)
    const outputBuffer = await stream2buf(stream)

    expect(new Uint8Array(outputBuffer)).toEqual(
      new Uint8Array(testArrayBuffer)
    )
  })
})

describe('buf2stream', () => {
  test('converts an ArrayBuffer to a ReadableStream', async () => {
    const testArrayBuffer = str2buf('Hello, World!')
    const stream = await buf2stream(testArrayBuffer)
    const reader = stream.getReader()
    const result = await reader.read()

    expect(result.done).toBeFalsy()
    expect(new Uint8Array(result.value!)).toEqual(
      new Uint8Array(testArrayBuffer)
    )

    const end = await reader.read()

    expect(end.done).toBeTruthy()
  })
})
