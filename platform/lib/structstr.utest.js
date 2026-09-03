import { build, escape, parse, unescape } from '@/lib/structstr'

describe('escape', () => {
  it('should escape forward slashes', () => {
    expect(escape('example/path')).toBe('example%2Fpath')
  })

  it('should not alter characters other than forward slashes', () => {
    expect(escape('example-path')).toBe('example-path')
  })
})

describe('unescape', () => {
  it('should unescape %2F to forward slashes', () => {
    expect(unescape('example%2Fpath')).toBe('example/path')
  })

  it('should not alter other characters', () => {
    expect(unescape('example-path')).toBe('example-path')
  })
})

describe('parse', () => {
  it('falls back to empty name when both input and default are missing', () => {
    expect(parse(undefined)).toEqual({ name: '', config: {} })
  })

  it('parses numeric and false boolean values from slash syntax', () => {
    const input = 'exampleName/count=12.5/enabled=false'

    expect(parse(input)).toEqual({
      name: 'exampleName',
      config: { count: 12.5, enabled: false },
    })
  })

  it('parses valid JSON input correctly', () => {
    const input = JSON.stringify({
      name: 'exampleName',
      config: { key: 'value' },
    })

    expect(parse(input)).toEqual({
      name: 'exampleName',
      config: { key: 'value' },
    })
  })

  it('parse string input but with just the name correctly', () => {
    const input = 'exampleName'

    expect(parse(input)).toEqual({ name: 'exampleName', config: {} })
  })

  it('parses string input with properties correctly', () => {
    const input = 'exampleName/key=value/key2=true/key3=long string'

    expect(parse(input)).toEqual({
      name: 'exampleName',
      config: { key: 'value', key2: true, key3: 'long string' },
    })
  })

  it('falls back to default input when input is empty', () => {
    const defaultInput = 'defaultName'

    expect(parse('', defaultInput)).toEqual({ name: 'defaultName', config: {} })
  })

  it('throws error on invalid JSON syntax', () => {
    const input = '{invalidJson}'

    expect(() => parse(input)).toThrow('Invalid syntax')
  })

  it('should parse an undefined fields as empty strings', () => {
    const input = 'exampleName/test1/test2'

    expect(parse(input)).toEqual({
      name: 'exampleName',
      config: { test1: '', test2: '' },
    })
  })

  it('should skip empty property names', () => {
    const input = 'exampleName/=empty/key=value'

    expect(parse(input)).toEqual({
      name: 'exampleName',
      config: { key: 'value' },
    })
  })

  it('should skip empty property names when parsing JSON', () => {
    const input = JSON.stringify({
      name: 'exampleName',
      config: { '': 'empty', key: 'value' },
    })

    expect(parse(input)).toEqual({
      name: 'exampleName',
      config: { key: 'value' },
    })
  })
})

describe('build function', () => {
  it('returns just escaped name when config is empty', () => {
    expect(build('example/Name', {})).toBe('example%2FName')
  })

  it('keeps numeric zero values and omits nullish defaults', () => {
    const name = 'exampleName'
    const config = { retries: 0, enabled: false, optional: '' }

    expect(build(name, config)).toBe(
      'exampleName/enabled=false/optional=/retries=0'
    )
  })

  it('constructs string from name and config correctly', () => {
    const name = 'exampleName'
    const config = { key: 'value', key2: true }

    expect(build(name, config)).toBe('exampleName/key=value/key2=true')
  })

  it('omits properties that match default configuration', () => {
    const name = 'exampleName'
    const config = { key: 'value', key2: true }
    const defaultConfig = { key: 'value' }

    expect(build(name, config, defaultConfig)).toBe('exampleName/key2=true')
  })

  it('correctly escapes property names and values', () => {
    const name = 'example/Name'
    const config = { 'key/one': 'value/two' }

    expect(build(name, config)).toBe('example%2FName/key%2Fone=value%2Ftwo')
  })
})

describe('URL handling', () => {
  it('should correctly handle HTTP URLs in config values', () => {
    const name = 'webService'
    const config = {
      endpoint: 'https://api.example.com/v1/data',
      callback: 'http://localhost:3000/webhook',
    }

    const structStr = build(name, config)
    const parsed = parse(structStr)

    expect(parsed.name).toBe('webService')
    expect(parsed.config.endpoint).toBe('https://api.example.com/v1/data')
    expect(parsed.config.callback).toBe('http://localhost:3000/webhook')
  })

  it('should correctly handle URLs with query parameters', () => {
    const name = 'apiCall'
    const config = {
      url: 'https://api.example.com/search?q=test&limit=10',
      redirectUrl: 'https://myapp.com/auth/callback?state=abc123',
    }

    const structStr = build(name, config)
    const parsed = parse(structStr)

    expect(parsed.name).toBe('apiCall')
    expect(parsed.config.url).toBe(
      'https://api.example.com/search?q=test&limit=10'
    )
    expect(parsed.config.redirectUrl).toBe(
      'https://myapp.com/auth/callback?state=abc123'
    )
  })

  it('should correctly handle URLs with fragments and complex paths', () => {
    const name = 'documentLink'
    const config = {
      docUrl: 'https://docs.example.com/api/v2/reference#authentication',
      resourcePath: '/users/123/documents/456/download',
      baseUrl: 'https://cdn.example.com/assets/images/',
    }

    const structStr = build(name, config)
    const parsed = parse(structStr)

    expect(parsed.name).toBe('documentLink')
    expect(parsed.config.docUrl).toBe(
      'https://docs.example.com/api/v2/reference#authentication'
    )
    expect(parsed.config.resourcePath).toBe('/users/123/documents/456/download')
    expect(parsed.config.baseUrl).toBe('https://cdn.example.com/assets/images/')
  })

  it('should handle URLs in both name and config properties', () => {
    const name = 'https://webhook.example.com/handler'
    const config = {
      sourceUrl: 'https://data.example.com/feed.json',
      targetUrl: 'https://storage.example.com/bucket/file.json',
    }

    const structStr = build(name, config)
    const parsed = parse(structStr)

    expect(parsed.name).toBe('https://webhook.example.com/handler')
    expect(parsed.config.sourceUrl).toBe('https://data.example.com/feed.json')
    expect(parsed.config.targetUrl).toBe(
      'https://storage.example.com/bucket/file.json'
    )
  })

  it('should handle complex URLs with special characters', () => {
    const name = 'oauthRedirect'
    const config = {
      authUrl:
        'https://oauth.example.com/authorize?client_id=123&redirect_uri=https://myapp.com/callback&scope=read:user',
      webhookUrl:
        'https://api.example.com/webhooks/user-events?secret=abc123&format=json',
    }

    const structStr = build(name, config)
    const parsed = parse(structStr)

    expect(parsed.name).toBe('oauthRedirect')
    expect(parsed.config.authUrl).toBe(
      'https://oauth.example.com/authorize?client_id=123&redirect_uri=https://myapp.com/callback&scope=read:user'
    )
    expect(parsed.config.webhookUrl).toBe(
      'https://api.example.com/webhooks/user-events?secret=abc123&format=json'
    )
  })

  it('should handle URLs with equals signs in query parameters', () => {
    const name = 'searchEngine'
    const config = {
      searchUrl: 'https://search.example.com?q=key=value&filter=type=document',
      apiKey: 'sk-1234567890abcdef',
    }

    const structStr = build(name, config)
    const parsed = parse(structStr)

    expect(parsed.name).toBe('searchEngine')
    expect(parsed.config.searchUrl).toBe(
      'https://search.example.com?q=key=value&filter=type=document'
    )
    expect(parsed.config.apiKey).toBe('sk-1234567890abcdef')
  })

  it('should handle file URLs and local paths', () => {
    const name = 'fileProcessor'
    const config = {
      inputPath: '/home/user/documents/data.csv',
      outputPath: '/var/www/html/reports/output.json',
      fileUrl: 'file:///home/user/uploads/image.png',
    }

    const structStr = build(name, config)
    const parsed = parse(structStr)

    expect(parsed.name).toBe('fileProcessor')
    expect(parsed.config.inputPath).toBe('/home/user/documents/data.csv')
    expect(parsed.config.outputPath).toBe('/var/www/html/reports/output.json')
    expect(parsed.config.fileUrl).toBe('file:///home/user/uploads/image.png')
  })

  it('should maintain URL integrity through multiple build/parse cycles', () => {
    const originalName = 'multiCycleTest'
    const originalConfig = {
      apiEndpoint: 'https://api.example.com/v1/users/search',
      callbackUrl: 'https://myapp.com/webhooks/user-created?validate=true',
      resourcePath: '/api/v2/documents/123/metadata',
    }

    // @note testing multiple cycles to ensure no data corruption through escaping/unescaping
    let structStr = build(originalName, originalConfig)
    let parsed = parse(structStr)

    // Second cycle
    structStr = build(parsed.name, parsed.config)
    parsed = parse(structStr)

    // Third cycle
    structStr = build(parsed.name, parsed.config)
    parsed = parse(structStr)

    expect(parsed.name).toBe(originalName)
    expect(parsed.config.apiEndpoint).toBe(originalConfig.apiEndpoint)
    expect(parsed.config.callbackUrl).toBe(originalConfig.callbackUrl)
    expect(parsed.config.resourcePath).toBe(originalConfig.resourcePath)
  })
})
