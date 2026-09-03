import {
  buildHeaders,
  buildHeadersArray,
  buildRequest,
  buildRequestRaw,
  buildResponse,
  buildResponseRaw,
  detectLineDelimiter,
  normalizeHeaders,
  normalizeMethod,
  normalizeRequest,
  normalizeUri,
  normalizeVersion,
  parseHeaders,
  parseHeadersArray,
  parseMessage,
  parseRequest,
  parseResponse,
  split,
} from '@/lib/http'

describe('split', () => {
  it('should split string by delimiter', () => {
    const input = 'hello\nworld\ntest'
    const result = Array.from(split(input, '\n'))

    expect(result).toEqual(['hello', 'world', 'test'])
  })

  it('should handle empty string', () => {
    const result = Array.from(split('', '\n'))

    expect(result).toEqual([''])
  })

  it('should handle string without delimiter', () => {
    const result = Array.from(split('hello', '\n'))

    expect(result).toEqual(['hello'])
  })

  it('should handle delimiter at end', () => {
    const result = Array.from(split('hello\n', '\n'))

    expect(result).toEqual(['hello', ''])
  })

  it('should handle consecutive delimiters', () => {
    const result = Array.from(split('hello\n\nworld', '\n'))

    expect(result).toEqual(['hello', '', 'world'])
  })
})

describe('parseMessage', () => {
  it('should parse HTTP message with headers and body', () => {
    const input =
      'GET /path HTTP/1.1\r\nHost: example.com\r\nContent-Type: text/plain\r\n\r\nhello world'

    const result = parseMessage(input)

    expect(result).toEqual({
      initialLine: 'GET /path HTTP/1.1',
      headers: ['Host: example.com', 'Content-Type: text/plain'],
      body: 'hello world',
    })
  })

  it('should parse message without body', () => {
    const input = 'GET /path HTTP/1.1\r\nHost: example.com\r\n\r\n'
    const result = parseMessage(input)

    expect(result).toEqual({
      initialLine: 'GET /path HTTP/1.1',
      headers: ['Host: example.com'],
      body: '',
    })
  })

  it('should parse message without headers', () => {
    const input = 'GET /path HTTP/1.1\r\n\r\nbody content'
    const result = parseMessage(input)

    expect(result).toEqual({
      initialLine: 'GET /path HTTP/1.1',
      headers: [],
      body: 'body content',
    })
  })

  it('should throw error for empty input', () => {
    expect(() => parseMessage('')).toThrow('cannot parse initial line')
  })

  it('should handle custom delimiter', () => {
    const input = 'GET /path HTTP/1.1\nHost: example.com\n\nbody'
    const result = parseMessage(input, '\n')

    expect(result.initialLine).toBe('GET /path HTTP/1.1')
    expect(result.headers).toEqual(['Host: example.com'])
    // @note accepting string body for now since that's what the function actually returns
    expect(result.body).toBe('body')
  })
})

describe('parseHeadersArray', () => {
  it('should parse array of header strings', () => {
    const headers = [
      'Host: example.com',
      'Content-Type: text/plain',
      'Authorization: Bearer token',
    ]

    const result = parseHeadersArray(headers)

    expect(result).toEqual({
      Host: 'example.com',
      'Content-Type': 'text/plain',
      Authorization: 'Bearer token',
    })
  })

  it('should handle headers without values', () => {
    const headers = ['Custom-Header:', 'Another-Header']
    const result = parseHeadersArray(headers)

    expect(result).toEqual({
      'Custom-Header': '',
      'Another-Header': '',
    })
  })

  it('should handle duplicate headers', () => {
    const headers = ['Accept: text/html', 'Accept: application/json']
    const result = parseHeadersArray(headers)

    expect(result).toEqual({
      Accept: ['text/html', 'application/json'],
    })
  })

  it('should handle set-cookie headers specially', () => {
    const headers = ['Set-Cookie: session=abc123']
    const result = parseHeadersArray(headers)

    expect(result).toEqual({
      'Set-Cookie': ['session=abc123'],
    })
  })

  it('should trim header names and values', () => {
    const headers = [
      '  Host  :   example.com   ',
      ' Content-Type : text/plain ',
    ]

    const result = parseHeadersArray(headers)

    expect(result).toEqual({
      Host: 'example.com',
      'Content-Type': 'text/plain',
    })
  })

  it('should handle custom separator', () => {
    const headers = ['Host= example.com', 'Type= text/plain']
    const result = parseHeadersArray(headers, '=')

    expect(result).toEqual({
      Host: 'example.com',
      Type: 'text/plain',
    })
  })

  it('should handle headers with multiple colons', () => {
    const headers = ['Time: 12:34:56', 'URL: http://example.com:8080']
    const result = parseHeadersArray(headers)

    expect(result).toEqual({
      Time: '12:34:56',
      URL: 'http://example.com:8080',
    })
  })

  it('should convert header values to strings', () => {
    const headers = [123, null, undefined, '']
    const result = parseHeadersArray(headers)

    expect(result).toEqual({
      123: '',
      null: '',
      undefined: '',
      '': '',
    })
  })
})

describe('buildHeadersArray', () => {
  it('should build headers array from object', () => {
    const headers = {
      Host: 'example.com',
      'Content-Type': 'text/plain',
    }

    const result = buildHeadersArray(headers)

    expect(result).toContain('Host: example.com')
    expect(result).toContain('Content-Type: text/plain')
  })

  it('should handle array values', () => {
    const headers = {
      Accept: ['text/html', 'application/json'],
    }

    const result = buildHeadersArray(headers)

    expect(result).toContain('Accept: text/html')
    expect(result).toContain('Accept: application/json')
  })

  it('should handle empty values', () => {
    const headers = {
      'Custom-Header': '',
      'Another-Header': null,
    }

    const result = buildHeadersArray(headers)

    expect(result).toContain('Custom-Header: ')
    expect(result).toContain('Another-Header: ')
  })

  it('should handle empty headers object', () => {
    const headers = {}
    const result = buildHeadersArray(headers)

    expect(result).toBe('')
  })

  it('should use custom delimiter and separator', () => {
    const headers = { Host: 'example.com' }
    const result = buildHeadersArray(headers, '\n', '=')

    expect(result).toContain('Host= example.com')
  })

  it('should handle undefined values', () => {
    const headers = {
      'Valid-Header': 'value',
      'Undefined-Header': undefined,
    }

    const result = buildHeadersArray(headers)

    expect(result).toContain('Valid-Header: value')
    expect(result).toContain('Undefined-Header: ')
  })

  it('should handle boolean and number values', () => {
    const headers = {
      'Bool-Header': true,
      'Number-Header': 123,
    }

    const result = buildHeadersArray(headers)

    expect(result).toContain('Bool-Header: true')
    expect(result).toContain('Number-Header: 123')
  })
})

describe('parseHeaders', () => {
  it('should parse headers from string', () => {
    const input = 'Host: example.com\r\nContent-Type: text/plain\r\n'
    const result = parseHeaders(input)

    expect(result).toEqual({
      Host: 'example.com',
      'Content-Type': 'text/plain',
    })
  })

  it('should handle empty headers string', () => {
    const result = parseHeaders('')

    expect(result).toEqual({})
  })
})

describe('buildHeaders', () => {
  it('should build headers string from object', () => {
    const headers = {
      Host: 'example.com',
      'Content-Type': 'text/plain',
    }

    const result = buildHeaders(headers)

    expect(result).toContain('Host: example.com')
    expect(result).toContain('Content-Type: text/plain')
  })
})

describe('parseRequest', () => {
  it('should parse full HTTP request', () => {
    const input =
      'POST /api/data HTTP/1.1\r\nHost: example.com\r\nContent-Type: application/json\r\n\r\n{"data": "value"}'

    const result = parseRequest(input)

    expect(result).toEqual({
      method: 'POST',
      uri: '/api/data',
      version: 'HTTP/1.1',
      headers: {
        Host: 'example.com',
        'Content-Type': 'application/json',
      },
      body: '{"data": "value"}',
    })
  })

  it('should parse simple URL as GET request', () => {
    const input = 'https://example.com/path'
    const result = parseRequest(input)

    expect(result).toEqual({
      method: 'GET',
      uri: 'https://example.com/path',
      version: 'HTTP/1.0',
      headers: {},
    })
  })

  it('should parse HTTP URL as GET request', () => {
    const input = 'http://example.com/path'
    const result = parseRequest(input)

    expect(result).toEqual({
      method: 'GET',
      uri: 'http://example.com/path',
      version: 'HTTP/1.0',
      headers: {},
    })
  })

  it('should handle request without version', () => {
    const input = 'GET /path\r\nHost: example.com\r\n\r\n'
    const result = parseRequest(input)

    expect(result.method).toBe('GET')
    expect(result.uri).toBe('/path')
    expect(result.version).toBe('')
  })

  it('should handle request without headers', () => {
    const input = 'GET /path HTTP/1.1\r\n\r\n'
    const result = parseRequest(input)

    expect(result.method).toBe('GET')
    expect(result.uri).toBe('/path')
    expect(result.version).toBe('HTTP/1.1')
    expect(result.headers).toEqual({})
  })

  it('should handle malformed request line', () => {
    // @note for malformed input without whitespace, regex fails to match
    // and all parts default to empty strings - this is acceptable fallback behavior
    const input = 'INVALID_REQUEST_LINE\r\n\r\n'
    const result = parseRequest(input)

    expect(result.method).toBe('')
    expect(result.uri).toBe('')
    expect(result.version).toBe('')
  })

  it('should handle case-insensitive URL detection', () => {
    expect(parseRequest('HTTPS://EXAMPLE.COM')).toEqual({
      method: 'GET',
      uri: 'HTTPS://EXAMPLE.COM',
      version: 'HTTP/1.0',
      headers: {},
    })
  })
})

describe('buildRequest', () => {
  it('should build HTTP request string', () => {
    const req = {
      method: 'POST',
      uri: '/api/data',
      version: 'HTTP/1.1',
      headers: {
        Host: 'example.com',
        'Content-Type': 'application/json',
      },
      body: '{"data": "value"}',
    }

    const result = buildRequest(req)

    expect(result).toContain('POST /api/data HTTP/1.1')
    expect(result).toContain('Host: example.com')
    expect(result).toContain('Content-Type: application/json')
    expect(result).toContain('{"data": "value"}')
  })

  it('should use defaults for missing fields', () => {
    const req = { uri: '/path' }
    const result = buildRequest(req)

    expect(result).toContain('GET /path HTTP/1.1')
  })

  it('should handle empty body', () => {
    const req = { uri: '/path', body: '' }
    const result = buildRequest(req)

    expect(result).toContain('GET /path HTTP/1.1')
  })

  it('should handle null body', () => {
    const req = { uri: '/path', body: null }
    const result = buildRequest(req)

    expect(result).toContain('GET /path HTTP/1.1')
    expect(result).not.toContain('null')
  })

  it('should handle unicode content in body', () => {
    const req = {
      uri: '/path',
      body: '{"message": "Hello 世界"}',
    }

    const result = buildRequest(req)

    expect(result).toContain('Hello 世界')
  })
})

describe('buildRequestRaw', () => {
  it('should build raw HTTP request buffer', () => {
    const req = {
      method: 'POST',
      uri: '/api/data',
      headers: { Host: 'example.com' },
      body: 'test data',
    }

    const result = buildRequestRaw(req)

    expect(Buffer.isBuffer(result)).toBe(true)
    expect(result.toString()).toContain('POST /api/data HTTP/1.1')
    expect(result.toString()).toContain('Host: example.com')
    expect(result.toString()).toContain('test data')
  })
})

describe('parseResponse', () => {
  it('should parse HTTP response', () => {
    const input =
      'HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 5\r\n\r\nhello'

    const result = parseResponse(input)

    expect(result).toEqual({
      responseVersion: 'HTTP/1.1',
      responseCode: 200,
      responseMessage: 'OK',
      responseHeaders: {
        'Content-Type': 'text/plain',
        'Content-Length': '5',
      },
      responseBody: 'hello',
    })
  })

  it('should handle response without message', () => {
    const input = 'HTTP/1.1 404\r\n\r\n'
    const result = parseResponse(input)

    expect(result.responseVersion).toBe('HTTP/1.1')
    expect(result.responseCode).toBe(404)
    expect(result.responseMessage).toBeUndefined()
  })

  it('should parse response code as integer', () => {
    const input = 'HTTP/1.1 201 Created\r\n\r\n'
    const result = parseResponse(input)

    expect(typeof result.responseCode).toBe('number')
    expect(result.responseCode).toBe(201)
  })

  it('should handle response with long status message', () => {
    const input = 'HTTP/1.1 400 Bad Request - Invalid Parameters\r\n\r\n'
    const result = parseResponse(input)

    expect(result.responseCode).toBe(400)
    expect(result.responseMessage).toBe('Bad Request - Invalid Parameters')
  })

  it('should handle custom HTTP version', () => {
    const input = 'HTTP/2.0 200 OK\r\n\r\n'
    const result = parseResponse(input)

    expect(result.responseVersion).toBe('HTTP/2.0')
    expect(result.responseCode).toBe(200)
  })
})

describe('buildResponse', () => {
  it('should build HTTP response string', () => {
    const res = {
      responseVersion: 'HTTP/1.1',
      responseCode: 200,
      responseMessage: 'OK',
      responseHeaders: {
        'Content-Type': 'text/plain',
      },
      responseBody: 'hello',
    }

    const result = buildResponse(res)

    expect(result).toContain('HTTP/1.1 200 OK')
    expect(result).toContain('Content-Type: text/plain')
    expect(result).toContain('hello')
  })

  it('should use defaults for missing fields', () => {
    const res = { responseCode: 404 }
    const result = buildResponse(res)

    expect(result).toContain('HTTP/1.1 404')
  })
})

describe('buildResponseRaw', () => {
  it('should build raw HTTP response buffer', () => {
    const res = {
      responseCode: 200,
      responseMessage: 'OK',
      responseHeaders: { 'Content-Type': 'text/plain' },
      responseBody: 'hello',
    }

    const result = buildResponseRaw(res)

    expect(Buffer.isBuffer(result)).toBe(true)
    expect(result.toString()).toContain('HTTP/1.1 200 OK')
    expect(result.toString()).toContain('Content-Type: text/plain')
    expect(result.toString()).toContain('hello')
  })
})

describe('detectLineDelimiter', () => {
  it('should detect CRLF delimiter', () => {
    const input = 'line1\r\nline2\r\nline3'
    const result = detectLineDelimiter(input)

    expect(result).toBe('\r\n')
  })

  it('should detect LF delimiter', () => {
    const input = 'line1\nline2\nline3'
    const result = detectLineDelimiter(input)

    expect(result).toBe('\n')
  })

  it('should handle input with only CRLF', () => {
    const input = 'line1\r\nline2\r\n'
    const result = detectLineDelimiter(input)

    expect(result).toBe('\r\n')
  })

  it('should handle mixed delimiters at different positions', () => {
    const input = 'first\nother content\r\nlast'
    const result = detectLineDelimiter(input)

    // @note current implementation finds first \n at position before \r\n
    expect(result).toBe('\n')
  })

  it('should prefer CRLF when both are present', () => {
    const input = 'line1\r\nline2\nline3'
    const result = detectLineDelimiter(input)

    expect(result).toBe('\r\n')
  })

  it('should handle input with no delimiters', () => {
    const input = 'single line with no delimiters'
    const result = detectLineDelimiter(input)

    expect(result).toBe('\n')
  })
})

describe('normalizeMethod', () => {
  it('should normalize HTTP methods to uppercase', () => {
    expect(normalizeMethod('get')).toBe('GET')
    expect(normalizeMethod('post')).toBe('POST')
    expect(normalizeMethod('PUT')).toBe('PUT')
  })

  it('should default to GET for empty/null/undefined', () => {
    expect(normalizeMethod('')).toBe('GET')
    expect(normalizeMethod(null)).toBe('GET')
    expect(normalizeMethod(undefined)).toBe('GET')
  })

  it('should trim whitespace', () => {
    expect(normalizeMethod('  post  ')).toBe('POST')
  })

  it('should handle mixed case', () => {
    expect(normalizeMethod('DeLeTe')).toBe('DELETE')
  })
})

describe('normalizeVersion', () => {
  it('should normalize HTTP versions to uppercase', () => {
    expect(normalizeVersion('http/1.1')).toBe('HTTP/1.1')
    expect(normalizeVersion('HTTP/2.0')).toBe('HTTP/2.0')
  })

  it('should default to HTTP/1.1 for empty/null/undefined', () => {
    expect(normalizeVersion('')).toBe('HTTP/1.1')
    expect(normalizeVersion(null)).toBe('HTTP/1.1')
    expect(normalizeVersion(undefined)).toBe('HTTP/1.1')
  })

  it('should trim whitespace', () => {
    expect(normalizeVersion('  http/1.0  ')).toBe('HTTP/1.0')
  })
})

describe('normalizeUri', () => {
  it('should trim URI whitespace', () => {
    expect(normalizeUri('  /path/to/resource  ')).toBe('/path/to/resource')
  })

  it('should handle empty/null/undefined', () => {
    expect(normalizeUri('')).toBe('')
    expect(normalizeUri(null)).toBe('')
    expect(normalizeUri(undefined)).toBe('')
  })

  it('should preserve URI as-is after trimming', () => {
    expect(normalizeUri('/api/v1/users?id=123')).toBe('/api/v1/users?id=123')
  })
})

describe('normalizeHeaders', () => {
  it('should normalize header names to lowercase', () => {
    const headers = {
      'Content-Type': 'application/json',
      AUTHORIZATION: 'Bearer token',
      Host: 'example.com',
    }

    const result = normalizeHeaders(headers)

    expect(result).toEqual({
      'content-type': 'application/json',
      authorization: 'Bearer token',
      host: 'example.com',
    })
  })

  it('should trim header names and values', () => {
    const headers = {
      '  Content-Type  ': '  application/json  ',
      ' Host ': ' example.com ',
    }

    const result = normalizeHeaders(headers)

    expect(result).toEqual({
      'content-type': 'application/json',
      host: 'example.com',
    })
  })

  it('should handle array values', () => {
    const headers = {
      Accept: ['text/html', 'application/json'],
    }

    const result = normalizeHeaders(headers)

    expect(result).toEqual({
      accept: ['text/html', 'application/json'],
    })
  })

  it('should handle empty/null/undefined headers', () => {
    expect(normalizeHeaders(null)).toEqual({})
    expect(normalizeHeaders(undefined)).toEqual({})
    expect(normalizeHeaders({})).toEqual({})
  })

  it('should skip empty/falsy header values', () => {
    const headers = {
      'Valid-Header': 'value',
      'Empty-Header': '',
      'Null-Header': null,
      'Undefined-Header': undefined,
      'False-Header': false,
    }

    const result = normalizeHeaders(headers)

    expect(result).toEqual({
      'valid-header': 'value',
    })
  })

  it('should convert non-string values to strings', () => {
    const headers = {
      'Number-Header': 123,
      'Boolean-Header': true,
    }

    const result = normalizeHeaders(headers)

    expect(result).toEqual({
      'number-header': '123',
      'boolean-header': 'true',
    })
  })
})

describe('normalizeRequest', () => {
  it('should normalize complete request', () => {
    const req = {
      method: 'post',
      uri: '  /api/data  ',
      version: 'http/1.0',
      headers: {
        'Content-Type': 'application/json',
        AUTHORIZATION: 'Bearer token',
      },
      body: '{"data": "value"}',
    }

    const result = normalizeRequest(req)

    expect(result).toEqual({
      method: 'POST',
      uri: '/api/data',
      version: 'HTTP/1.0',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer token',
      },
      body: '{"data": "value"}',
    })
  })

  it('should use defaults for missing fields', () => {
    const req = { uri: '/path' }
    const result = normalizeRequest(req)

    expect(result).toEqual({
      method: 'GET',
      uri: '/path',
      version: 'HTTP/1.1',
      headers: {},
      body: undefined,
    })
  })

  it('should remove body for HEAD and GET methods', () => {
    const getReq = {
      method: 'GET',
      uri: '/path',
      body: 'should be removed',
    }

    const headReq = {
      method: 'HEAD',
      uri: '/path',
      body: 'should be removed',
    }

    expect(normalizeRequest(getReq).body).toBeUndefined()
    expect(normalizeRequest(headReq).body).toBeUndefined()
  })

  it('should preserve body for POST/PUT/PATCH methods', () => {
    const postReq = {
      method: 'POST',
      uri: '/path',
      body: 'important data',
    }

    expect(normalizeRequest(postReq).body).toBe('important data')
  })

  it('should remove content headers when no body', () => {
    const req = {
      method: 'GET',
      uri: '/path',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': '100',
        'Transport-Encoding': 'chunked',
        'Other-Header': 'keep-me',
      },
    }

    const result = normalizeRequest(req)

    expect(result.headers).toEqual({
      'other-header': 'keep-me',
    })
  })

  it('should normalize request with existing normalized fields', () => {
    expect(
      normalizeRequest({
        uri: 'https://api/123',
        headers: {
          Authorization: 'Bearer 123',
        },
      })
    ).toEqual({
      method: 'GET',
      uri: 'https://api/123',
      version: 'HTTP/1.1',
      headers: {
        authorization: 'Bearer 123',
      },
      body: undefined,
    })
  })
})
