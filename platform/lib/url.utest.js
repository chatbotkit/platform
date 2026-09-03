import {
  domain,
  extname,
  filename,
  isHTTPURL,
  isURL,
  joinPaths,
  pathquery,
  sameRoot,
  tryPathquery,
} from '@/lib/url'

describe('isURL', () => {
  it('returns true for valid URLs', () => {
    expect(isURL('https://example.com')).toEqual(true)
    expect(isURL('http://example.com')).toEqual(true)
    expect(isURL('ftp://example.com')).toEqual(true)
    expect(isURL('https://example.com/path/to/resource')).toEqual(true)
    expect(isURL('https://example.com/path/to/resource?query=param')).toEqual(
      true
    )
    expect(isURL('https://example.com/path/to/resource#fragment')).toEqual(true)
    expect(
      isURL('https://example.com/path/to/resource?query=param#fragment')
    ).toEqual(true)
    expect(
      isURL('https://example.com/path/to/resource#fragment?query=param')
    ).toEqual(true)
    expect(
      isURL('https://example.com/path/to/resource#fragment?query=param#another')
    ).toEqual(true)
    expect(
      isURL(
        'https://example.com/path/to/resource#fragment?query=param#another#more'
      )
    ).toEqual(true)
  })

  it('returns false for invalid URLs', () => {
    expect(isURL('example.com')).toEqual(false)
    expect(isURL('http://')).toEqual(false)
    expect(isURL('https://')).toEqual(false)
    expect(isURL('ftp://')).toEqual(false)
  })
})

describe('isHTTPURL', () => {
  it('returns true for valid HTTP URLs', () => {
    expect(isHTTPURL('https://example.com')).toEqual(true)
    expect(isHTTPURL('HTTPS://example.com')).toEqual(true)
    expect(isHTTPURL('http://example.com')).toEqual(true)
    expect(isHTTPURL('https://example.com/path/to/resource')).toEqual(true)
    expect(
      isHTTPURL('https://example.com/path/to/resource?query=param')
    ).toEqual(true)
    expect(isHTTPURL('https://example.com/path/to/resource#fragment')).toEqual(
      true
    )
  })

  it('returns false for invalid HTTP URLs', () => {
    expect(isHTTPURL('ftp://example.com')).toEqual(false)
    expect(isHTTPURL('example.com')).toEqual(false)
  })
})

describe('joinPaths', () => {
  it('joins paths', () => {
    expect(joinPaths('', 'bar')).toEqual('bar')
    expect(joinPaths(null, 'bar')).toEqual('bar')
    expect(joinPaths(undefined, 'bar')).toEqual('bar')
    expect(joinPaths('foo', '')).toEqual('foo')
    expect(joinPaths('foo', null)).toEqual('foo')
    expect(joinPaths('foo', undefined)).toEqual('foo')
    expect(joinPaths('foo', 'bar')).toEqual('foo/bar')
    expect(joinPaths('foo', '/', 'bar')).toEqual('foo/bar')
    expect(joinPaths('foo/', '/', 'bar')).toEqual('foo/bar')
    expect(joinPaths('foo', '/', '/bar')).toEqual('foo/bar')
    expect(joinPaths('foo/', '/', '/bar')).toEqual('foo/bar')
  })
})

describe('filename', () => {
  it('returns the filename', () => {
    expect(filename('https://foo/')).toEqual(null)
    expect(filename('https://foo/bar.baz')).toEqual('bar.baz')
    expect(filename('https://foo/bar')).toEqual('bar')
    expect(filename('https://foo/bar.baz/qux')).toEqual('qux')
  })
})

describe('extname', () => {
  it('returns the extension', () => {
    expect(extname('https://foo/bar.baz')).toEqual('.baz')
    expect(extname('https://foo/bar')).toEqual(null)
    expect(extname('https://foo/bar.baz/qux')).toEqual(null)
  })
})

describe('domain', () => {
  it('must correctly parse the domain', () => {
    expect(domain('https://127.0.0.1')).toEqual('127.0.0.1')
    expect(domain('https://localhost')).toEqual('localhost')
    expect(domain('https://localhost.')).toEqual('localhost')
    expect(domain('https://localhost:8080')).toEqual('localhost')
    expect(domain('https://www.chatbotkit.com')).toEqual('chatbotkit.com')
  })
})

describe('sameRoot', () => {
  it('returns true if the roots are the same', () => {
    expect(sameRoot('https://foo/bar', 'https://foo/baz')).toEqual(false)
    expect(sameRoot('https://foo/bar', 'https://foo:8080/baz')).toEqual(false)
    expect(sameRoot('https://foo/bar', 'https://bar/baz')).toEqual(false)
    expect(sameRoot('https://foo/bar', 'https://foo:8080/baz')).toEqual(false)
    expect(sameRoot('https://foo/bar', 'https://foo/bar')).toEqual(true)
    expect(sameRoot('https://foo/bar', 'https://foo/bar/')).toEqual(true)
    expect(sameRoot('https://foo/bar', 'https://foo/bar/baz')).toEqual(true)
  })
})

describe('pathquery', () => {
  it('returns the path and query of a relative url', () => {
    expect(pathquery('/dashboard?tab=usage')).toEqual('/dashboard?tab=usage')
  })

  it('drops the host of an absolute url', () => {
    expect(pathquery('https://evil.example/dashboard?tab=usage')).toEqual(
      '/dashboard?tab=usage'
    )
  })

  it('drops the fragment', () => {
    expect(pathquery('/dashboard?tab=usage#section')).toEqual(
      '/dashboard?tab=usage'
    )
  })
})

describe('tryPathquery', () => {
  it('returns the path and query when parseable', () => {
    expect(tryPathquery('/dashboard')).toEqual('/dashboard')
    expect(tryPathquery('https://evil.example/dashboard')).toEqual('/dashboard')
  })

  it('returns null for unparseable input', () => {
    expect(tryPathquery(null, null)).toEqual(null)
  })
})
