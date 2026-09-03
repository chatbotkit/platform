import {
  catchAllParam,
  getQuery,
  queryParam,
  requiredUrlParam,
} from '@/lib/query.get'
import { throwBadRequest } from '@/lib/response'

jest.mock('@/lib/response', () => ({
  throwBadRequest: jest.fn(),
}))

jest.mock('@/lib/debug', () => {
  const originalModule = jest.requireActual('@/lib/debug')

  return {
    ...originalModule,

    error: jest.fn(),
  }
})

describe('requiredUrlParam', () => {
  const originalDebug = process.env.DEBUG

  beforeEach(() => {
    delete process.env.DEBUG
  })

  afterEach(() => {
    process.env.DEBUG = originalDebug
  })

  it('should return the parameter value when it is present and a string', () => {
    const req = new Request('http://localhost?testParam=testValue')
    const result = requiredUrlParam(req, 'testParam')

    expect(result).toBe('testValue')
  })

  it('should throw an error if the parameter is missing or empty', () => {
    const req = { query: {} }

    expect(() => requiredUrlParam(req, 'testParam')).toThrow()
    expect(throwBadRequest).toHaveBeenCalled()
  })

  it('should handle URLs with search params correctly', () => {
    const req = { url: 'http://example.com?testParam=testValue' }
    const result = requiredUrlParam(req, 'testParam')

    expect(result).toBe('testValue')
  })
})

describe('queryParam', () => {
  it('should return the parameter value when it is present and a string', () => {
    const req = new Request('http://localhost?testParam=testValue')
    const result = queryParam(req, 'testParam')

    expect(result).toBe('testValue')
  })

  it('should return undefined if the parameter is missing or empty', () => {
    const req = { query: {} }
    const result = queryParam(req, 'testParam')

    expect(result).toBeUndefined()
  })

  it('should handle URLs with search params correctly', () => {
    const req = { url: 'http://example.com?testParam=testValue' }
    const result = queryParam(req, 'testParam')

    expect(result).toBe('testValue')
  })
})

describe('getQuery', () => {
  it('should parse URL search params from Request object', () => {
    const req = new Request('http://localhost?param1=value1&param2=value2')
    const result = getQuery(req)

    expect(result).toBeInstanceOf(Map)
    expect(result.get('param1')).toBe('value1')
    expect(result.get('param2')).toBe('value2')
    expect(result.get('nonexistent')).toBeUndefined()
  })

  it('should parse query from NextApiRequest with query object', () => {
    const req = {
      query: {
        param1: 'value1',
        param2: 'value2',
      },
    }

    const result = getQuery(req)

    expect(result).toBeInstanceOf(Map)
    expect(result.get('param1')).toBe('value1')
    expect(result.get('param2')).toBe('value2')
  })

  it('should handle array values in NextApiRequest query by taking first value', () => {
    const req = {
      query: {
        param1: ['first', 'second', 'third'],
        param2: 'singleValue',
      },
    }

    const result = getQuery(req)

    // @note the first one has priority over subsequent values
    expect(result.get('param1')).toBe('first')
    expect(result.get('param2')).toBe('singleValue')
  })

  it('should handle null and undefined values in NextApiRequest query', () => {
    const req = {
      query: {
        validParam: 'validValue',
        nullParam: null,
        undefinedParam: undefined,
        emptyStringParam: '',
      },
    }

    const result = getQuery(req)

    expect(result.get('validParam')).toBe('validValue')
    expect(result.get('nullParam')).toBeUndefined()
    expect(result.get('undefinedParam')).toBeUndefined()
    expect(result.get('emptyStringParam')).toBe('')
  })

  it('should convert non-string values to strings in NextApiRequest query', () => {
    const req = {
      query: {
        numberParam: 42,
        booleanParam: true,
        objectParam: { toString: () => 'customString' },
      },
    }

    const result = getQuery(req)

    expect(result.get('numberParam')).toBe('42')
    expect(result.get('booleanParam')).toBe('true')
    expect(result.get('objectParam')).toBe('customString')
  })

  it('should handle arrays with null/undefined values', () => {
    const req = {
      query: {
        mixedArray: ['valid', null, 'alsoValid', undefined, ''],
      },
    }

    const result = getQuery(req)

    // @note null and undefined values are filtered out, empty string is kept
    expect(result.get('mixedArray')).toBe('valid')
  })

  it('should handle empty query object', () => {
    const req = { query: {} }
    const result = getQuery(req)

    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(0)
  })

  it('should handle Request with no search params', () => {
    const req = new Request('http://localhost')
    const result = getQuery(req)

    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(0)
  })

  it('should handle complex URL with multiple params and encoding', () => {
    const req = new Request(
      'http://localhost?name=John%20Doe&age=30&tags=javascript&tags=nodejs'
    )

    const result = getQuery(req)

    expect(result.get('name')).toBe('John Doe')
    expect(result.get('age')).toBe('30')
    // @note URLSearchParams.get() returns first value for duplicate keys
    expect(result.get('tags')).toBe('javascript')
  })

  it('should give priority to first occurrence when duplicates exist', () => {
    // This tests the @note comment behavior
    const req = new Request('http://localhost?param=first&param=second')
    const result = getQuery(req)

    expect(result.get('param')).toBe('first')
  })

  it('should handle Request object without url property by creating empty Map', () => {
    // @note when request doesn't have 'query' property and 'url' is undefined
    // @note new URL(undefined, 'http://localhost') creates a valid URL 'http://localhost'
    // @note which has no search params, resulting in an empty Map
    const req = { notUrl: 'invalid' }
    const result = getQuery(req)

    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(0)
  })

  it('should handle NextApiRequest with undefined url safely', () => {
    // @note tests the safety check: req.url || '/' prevents URL parsing errors
    const req = {
      query: {
        param1: 'value1',
        param2: 'value2',
      },
      url: undefined, // This should be handled safely
    }

    const result = getQuery(req)

    expect(result).toBeInstanceOf(Map)
    expect(result.get('param1')).toBe('value1')
    expect(result.get('param2')).toBe('value2')
  })

  it('should handle NextApiRequest with null url safely', () => {
    // @note tests the safety check: req.url || '/' prevents URL parsing errors
    const req = {
      query: {
        param: 'value',
      },
      url: null, // This should be handled safely
    }

    const result = getQuery(req)

    expect(result).toBeInstanceOf(Map)
    expect(result.get('param')).toBe('value')
  })

  it('should merge URL search params with query object for NextApiRequest', () => {
    // @note tests that URL search params are preserved and merged with query object
    const req = {
      query: {
        fromQuery: 'queryValue',
        shared: 'fromQuery', // This should take precedence due to processing order
      },
      url: '/api/test?fromUrl=urlValue&shared=fromUrl',
    }

    const result = getQuery(req)

    expect(result).toBeInstanceOf(Map)
    expect(result.get('fromQuery')).toBe('queryValue')
    expect(result.get('fromUrl')).toBe('urlValue')
    // @note query object params are processed after URL params, so they should override
    expect(result.get('shared')).toBe('fromQuery')
  })

  it('should handle complex NextApiRequest with URL params and query arrays', () => {
    // @note comprehensive test of the new safety behavior
    const req = {
      query: {
        tags: ['javascript', 'nodejs'],
        filter: 'active',
      },
      url: '/api/search?category=programming&filter=inactive&sort=date',
    }

    const result = getQuery(req)

    expect(result).toBeInstanceOf(Map)
    expect(result.get('tags')).toBe('javascript') // First array value
    expect(result.get('filter')).toBe('active') // Query object overrides URL param
    expect(result.get('category')).toBe('programming') // From URL
    expect(result.get('sort')).toBe('date') // From URL only
  })
})

describe('requiredUrlParam - additional edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should trim whitespace from parameter values', () => {
    const req = new Request('http://localhost?param=%20%20%20trimmed%20%20%20')
    const result = requiredUrlParam(req, 'param')

    expect(result).toBe('trimmed')
  })

  it('should handle URL encoding properly', () => {
    const req = new Request('http://localhost?param=hello%20world%26test')
    const result = requiredUrlParam(req, 'param')

    expect(result).toBe('hello world&test')
  })

  it('should throw for parameter that exists but is only whitespace', () => {
    const req = new Request('http://localhost?param=%20%20%20')

    expect(() => requiredUrlParam(req, 'param')).toThrow()
    expect(throwBadRequest).toHaveBeenCalled()
  })

  it('should throw for empty string parameter', () => {
    const req = new Request('http://localhost?param=')

    expect(() => requiredUrlParam(req, 'param')).toThrow()
    expect(throwBadRequest).toHaveBeenCalled()
  })

  it('should handle NextApiRequest with complex arrays properly', () => {
    // @note arrays in query are processed by getQuery, so this should work normally
    const req = {
      query: {
        param: ['first', 'second'],
      },
    }

    const result = requiredUrlParam(req, 'param')

    expect(result).toBe('first')
  })

  it('should handle special characters in parameter names', () => {
    const req = new Request(
      'http://localhost?param-with-dashes=value&param_with_underscores=value2'
    )

    expect(requiredUrlParam(req, 'param-with-dashes')).toBe('value')
    expect(requiredUrlParam(req, 'param_with_underscores')).toBe('value2')
  })

  it('should handle unicode characters in parameter values', () => {
    const req = new Request(
      'http://localhost?param=%E2%9C%93%E2%9C%93%E2%9C%93'
    )

    const result = requiredUrlParam(req, 'param')

    expect(result).toBe('✓✓✓')
  })
})

describe('queryParam - additional edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return trimmed value for valid parameter', () => {
    const req = new Request('http://localhost?param=%20%20value%20%20')
    const result = queryParam(req, 'param')

    expect(result).toBe('value')
  })

  it('should return empty string for parameter that is only whitespace', () => {
    // @note queryParam returns trimmed value, so whitespace becomes empty string
    const req = new Request('http://localhost?param=%20%20%20')
    const result = queryParam(req, 'param')

    expect(result).toBe('')
  })

  it('should return empty string for empty string parameter', () => {
    // @note queryParam returns trimmed value, empty string stays empty string
    const req = new Request('http://localhost?param=')
    const result = queryParam(req, 'param')

    expect(result).toBe('')
  })

  it('should handle NextApiRequest with arrays by returning first value', () => {
    const req = {
      query: {
        param: ['first', 'second', 'third'],
      },
    }

    const result = queryParam(req, 'param')

    expect(result).toBe('first')
  })

  it('should handle special characters and encoding', () => {
    const req = new Request('http://localhost?param=hello%20world%26more')
    const result = queryParam(req, 'param')

    expect(result).toBe('hello world&more')
  })

  it('should return undefined for non-existent parameter', () => {
    const req = new Request('http://localhost?other=value')
    const result = queryParam(req, 'param')

    expect(result).toBeUndefined()
  })

  it('should handle case-sensitive parameter names', () => {
    const req = new Request('http://localhost?Param=value1&param=value2')

    expect(queryParam(req, 'Param')).toBe('value1')
    expect(queryParam(req, 'param')).toBe('value2')
  })
})

describe('Integration tests - real-world scenarios', () => {
  it('should handle typical Next.js API route request', () => {
    const req = {
      query: {
        id: '12345',
        filter: 'active',
        sort: ['name', 'date'], // Next.js often converts repeated params to arrays
      },
    }

    expect(requiredUrlParam(req, 'id')).toBe('12345')
    expect(queryParam(req, 'filter')).toBe('active')
    expect(queryParam(req, 'sort')).toBe('name') // First value from array
    expect(queryParam(req, 'nonexistent')).toBeUndefined()
  })

  it('should handle Web API Request object from middleware', () => {
    const req = new Request(
      'https://example.com/api/users?page=1&limit=10&include=profile'
    )

    expect(requiredUrlParam(req, 'page')).toBe('1')
    expect(queryParam(req, 'limit')).toBe('10')
    expect(queryParam(req, 'include')).toBe('profile')
    expect(queryParam(req, 'missing')).toBeUndefined()
  })

  it('should handle mixed number and string parameters', () => {
    const req = {
      query: {
        userId: 42,
        isActive: true,
        timestamp: new Date('2023-01-01'),
        tags: ['javascript', 'nodejs'],
      },
    }

    expect(requiredUrlParam(req, 'userId')).toBe('42')
    expect(queryParam(req, 'isActive')).toBe('true')
    expect(queryParam(req, 'timestamp')).toContain('2023') // Date toString contains year
    expect(queryParam(req, 'tags')).toBe('javascript')
  })

  it('should handle URL with fragment and complex query string', () => {
    const req = new Request(
      'http://localhost/api?search=hello%20world&type=all&debug=1#section'
    )

    expect(requiredUrlParam(req, 'search')).toBe('hello world')
    expect(queryParam(req, 'type')).toBe('all')
    expect(queryParam(req, 'debug')).toBe('1')
  })
})

describe('Error handling edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should handle very long parameter values', () => {
    const longValue = 'a'.repeat(1000)

    const req = new Request(
      `http://localhost?param=${encodeURIComponent(longValue)}`
    )

    expect(requiredUrlParam(req, 'param')).toBe(longValue)
    expect(queryParam(req, 'param')).toBe(longValue)
  })

  it('should handle parameters with only equals sign', () => {
    const req = new Request('http://localhost?param1=&param2=value')

    expect(() => requiredUrlParam(req, 'param1')).toThrow()
    expect(queryParam(req, 'param1')).toBe('')
    expect(requiredUrlParam(req, 'param2')).toBe('value')
  })

  it('should handle parameters without equals sign', () => {
    const req = new Request('http://localhost?standalone&param=value')

    expect(queryParam(req, 'standalone')).toBe('')
    expect(requiredUrlParam(req, 'param')).toBe('value')
  })

  it('should maintain order when processing multiple array values', () => {
    const req = {
      query: {
        items: ['first', 'second', 'third', 'fourth'],
      },
    }

    // Should always get the first value due to URLSearchParams behavior
    expect(queryParam(req, 'items')).toBe('first')
    expect(requiredUrlParam(req, 'items')).toBe('first')
  })
})

describe('catchAllParam', () => {
  it('should return array segments from NextApiRequest query', () => {
    const req = {
      query: {
        path: ['documents', 'reports', 'annual'],
      },
    }

    expect(catchAllParam(req, 'path')).toEqual([
      'documents',
      'reports',
      'annual',
    ])
  })

  it('should wrap single string value in an array for NextApiRequest', () => {
    const req = {
      query: {
        path: 'documents',
      },
    }

    expect(catchAllParam(req, 'path')).toEqual(['documents'])
  })

  it('should return empty array when key is missing from NextApiRequest', () => {
    const req = {
      query: {},
    }

    expect(catchAllParam(req, 'path')).toEqual([])
  })

  it('should return empty array for undefined value in NextApiRequest', () => {
    const req = {
      query: {
        path: undefined,
      },
    }

    expect(catchAllParam(req, 'path')).toEqual([])
  })

  it('should return empty array for empty string in NextApiRequest', () => {
    const req = {
      query: {
        path: '',
      },
    }

    expect(catchAllParam(req, 'path')).toEqual([])
  })

  it('should filter out null and undefined from arrays in NextApiRequest', () => {
    const req = {
      query: {
        path: ['valid', null, 'also-valid', undefined],
      },
    }

    expect(catchAllParam(req, 'path')).toEqual(['valid', 'also-valid'])
  })

  it('should return segments from Request searchParams', () => {
    const req = new Request(
      'http://localhost?path=documents&path=reports&path=annual'
    )

    expect(catchAllParam(req, 'path')).toEqual([
      'documents',
      'reports',
      'annual',
    ])
  })

  it('should return single segment from Request searchParams', () => {
    const req = new Request('http://localhost?path=documents')

    expect(catchAllParam(req, 'path')).toEqual(['documents'])
  })

  it('should return empty array when key is missing from Request', () => {
    const req = new Request('http://localhost?other=value')

    expect(catchAllParam(req, 'path')).toEqual([])
  })

  it('should return empty array for Request with no params', () => {
    const req = new Request('http://localhost')

    expect(catchAllParam(req, 'path')).toEqual([])
  })

  it('should handle URL-encoded segments in Request', () => {
    const req = new Request(
      'http://localhost?path=my%20documents&path=annual%20report'
    )

    expect(catchAllParam(req, 'path')).toEqual([
      'my documents',
      'annual report',
    ])
  })

  it('should produce correct joined path for catch-all routes', () => {
    const req = {
      query: {
        path: ['documents', 'reports', 'annual'],
      },
    }

    const result = catchAllParam(req, 'path').join('/')

    expect(result).toBe('documents/reports/annual')
  })

  it('should produce empty string when joined with no segments', () => {
    const req = { query: {} }

    const result = catchAllParam(req, 'path').join('/')

    expect(result).toBe('')
  })
})
