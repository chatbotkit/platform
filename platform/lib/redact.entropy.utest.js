import {
  calculateEntropy,
  isHighEntropyString,
  redactEmbeddedTokens,
  redactEntropyFields,
  redactHighEntropyTokens,
  redactMessagesEntropy,
  redactSecret,
  redactString,
} from '@/lib/redact.entropy'

describe('calculateEntropy', () => {
  it('should return 0 for empty string', () => {
    expect(calculateEntropy('')).toBe(0)
  })

  it('should return 0 for null/undefined', () => {
    expect(calculateEntropy(null)).toBe(0)
    expect(calculateEntropy(undefined)).toBe(0)
  })

  it('should return 0 for single character repeated', () => {
    expect(calculateEntropy('aaaaaaa')).toBe(0)
  })

  it('should return 1 for two equally distributed characters', () => {
    expect(calculateEntropy('ab')).toBe(1)
    expect(calculateEntropy('abab')).toBe(1)
  })

  it('should return higher entropy for more varied strings', () => {
    const lowEntropy = calculateEntropy('aaaaabbb')
    const highEntropy = calculateEntropy('a1B2c3D4')

    expect(highEntropy).toBeGreaterThan(lowEntropy)
  })

  it('should calculate high entropy for random-looking strings', () => {
    const entropy = calculateEntropy('sk-abc123XYZ789!@#')

    expect(entropy).toBeGreaterThan(3.5)
  })
})

describe('isHighEntropyString', () => {
  const defaultOptions = {
    preserveLastChars: 3,
    entropyThreshold: 4.0,
    minLength: 8,
    maxLength: 256,
    maskChar: '*',
  }

  it('should return false for short strings', () => {
    expect(isHighEntropyString('abc123', defaultOptions)).toBe(false)
  })

  it('should return false for strings exceeding maxLength', () => {
    const longString = 'a'.repeat(300)

    expect(isHighEntropyString(longString, defaultOptions)).toBe(false)
  })

  it('should return false for natural language text with spaces', () => {
    expect(
      isHighEntropyString('This is a normal sentence.', defaultOptions)
    ).toBe(false)
  })

  it('should return false for URLs', () => {
    expect(
      isHighEntropyString(
        'https://example.com/path?query=value',
        defaultOptions
      )
    ).toBe(false)
  })

  it('should return false for email addresses', () => {
    expect(isHighEntropyString('user@example.com', defaultOptions)).toBe(false)
  })

  it('should return false for phone numbers', () => {
    expect(isHighEntropyString('+1 (555) 123-4567', defaultOptions)).toBe(false)
  })

  it('should return true for API key-like strings', () => {
    expect(isHighEntropyString('sk-abc123XYZ789def456', defaultOptions)).toBe(
      true
    )
  })

  it('should return true for password-like strings', () => {
    expect(isHighEntropyString('P@ssw0rd123!Complex', defaultOptions)).toBe(
      true
    )
  })

  it('should return true for base64-like strings', () => {
    expect(
      isHighEntropyString('YWJjZGVmZ2hpamtsbW5vcA==', defaultOptions)
    ).toBe(true)
  })

  it('should respect custom entropy threshold', () => {
    const lowThresholdOptions = { ...defaultOptions, entropyThreshold: 2.0 }
    const highThresholdOptions = { ...defaultOptions, entropyThreshold: 5.0 }

    const testString = 'abcd1234efgh5678'

    expect(isHighEntropyString(testString, lowThresholdOptions)).toBe(true)
    expect(isHighEntropyString(testString, highThresholdOptions)).toBe(false)
  })
})

describe('redactString', () => {
  const defaultOptions = {
    preserveLastChars: 3,
    entropyThreshold: 4.0,
    minLength: 8,
    maxLength: 256,
    maskChar: '*',
  }

  it('should mask all but last 3 characters by default', () => {
    expect(redactString('secretkey123', defaultOptions)).toBe('*********123')
  })

  it('should handle strings shorter than preserveLastChars', () => {
    expect(redactString('ab', defaultOptions)).toBe('**')
  })

  it('should handle strings equal to preserveLastChars', () => {
    expect(redactString('abc', defaultOptions)).toBe('***')
  })

  it('should respect custom preserveLastChars', () => {
    const customOptions = { ...defaultOptions, preserveLastChars: 5 }

    expect(redactString('mysecretpassword', customOptions)).toBe(
      '***********sword'
    )
  })

  it('should respect custom mask character', () => {
    const customOptions = { ...defaultOptions, maskChar: '#' }

    expect(redactString('secretkey123', customOptions)).toBe('#########123')
  })
})

describe('redactSecret', () => {
  it('masks high-entropy secrets, preserving the last 3 characters', () => {
    expect(redactSecret('sk-proj-abcdefghijklmnop123')).toMatch(/^\*+123$/)
  })

  it('masks short / low-entropy values that auto-detection would skip', () => {
    // @note unlike redactEntropyFields, no entropy/length gate is applied
    expect(redactSecret('abc123')).toBe('***123')
    expect(redactSecret('secret')).toBe('***ret')
  })

  it('respects custom options', () => {
    expect(redactSecret('secretkey123', { maskChar: '#' })).toBe('#########123')
  })
})

describe('redactEntropyFields', () => {
  it('should return null/undefined as-is', () => {
    expect(redactEntropyFields(null)).toBe(null)
    expect(redactEntropyFields(undefined)).toBe(undefined)
  })

  it('should return primitives unchanged if not high entropy', () => {
    expect(redactEntropyFields('hello')).toBe('hello')
    expect(redactEntropyFields(123)).toBe(123)
    expect(redactEntropyFields(true)).toBe(true)
  })

  it('should redact high-entropy strings', () => {
    const result = redactEntropyFields('sk-abc123XYZ789def456')

    expect(result).toMatch(/^\*+456$/)
  })

  it('should recursively process arrays', () => {
    const input = ['hello', 'sk-abc123XYZ789def456', 'world']
    const result = redactEntropyFields(input)

    expect(result[0]).toBe('hello')
    expect(result[1]).toMatch(/^\*+456$/)
    expect(result[2]).toBe('world')
  })

  it('should recursively process objects', () => {
    const input = {
      name: 'Test User',
      apiKey: 'sk-abc123XYZ789def456',
      nested: {
        password: 'P@ssw0rd123!Complex',
        description: 'A normal description',
      },
    }
    const result = redactEntropyFields(input)

    expect(result.name).toBe('Test User')
    expect(result.apiKey).toMatch(/^\*+456$/)
    expect(result.nested.password).toMatch(/^\*+lex$/)
    expect(result.nested.description).toBe('A normal description')
  })

  it('should handle deeply nested structures', () => {
    const input = {
      level1: {
        level2: {
          level3: {
            secret: 'sk-abc123XYZ789def456',
          },
        },
      },
    }
    const result = redactEntropyFields(input)

    expect(result.level1.level2.level3.secret).toMatch(/^\*+456$/)
  })

  it('should handle arrays within objects', () => {
    const input = {
      items: [{ key: 'sk-secret1234567890abc' }, { key: 'normal-value' }],
    }
    const result = redactEntropyFields(input)

    expect(result.items[0].key).toMatch(/^\*+abc$/)
    expect(result.items[1].key).toBe('normal-value')
  })

  it('should preserve object structure', () => {
    const input = { a: 1, b: 'test', c: true, d: null }
    const result = redactEntropyFields(input)

    expect(result).toEqual(input)
  })

  it('should respect custom options', () => {
    const input = { secret: 'sk-abc123XYZ789def456' }
    const result = redactEntropyFields(input, {
      preserveLastChars: 5,
      maskChar: '#',
    })

    expect(result.secret).toMatch(/^#+ef456$/)
  })
})

describe('redactEmbeddedTokens', () => {
  const defaultOptions = {
    preserveLastChars: 3,
    entropyThreshold: 4.0,
    minLength: 8,
    maxLength: 256,
    maskChar: '*',
    redactEmbeddedTokens: true,
  }

  it('should redact tokens with _sk_ prefix', () => {
    const input = 'api_key: "moltbook_sk_Wk4gjx2IXVWoG0M4zdx_mlEzz4HuUz2w"'
    const result = redactEmbeddedTokens(input, defaultOptions)

    expect(result).not.toContain('Wk4gjx2IXVWoG0M4zdx_mlEzz4HuUz2w')
    expect(result).toMatch(/moltbook_sk_\*+/)
  })

  it('should redact tokens with _key_ prefix', () => {
    const input = 'The example_key_abc123def456ghi789 was used'
    const result = redactEmbeddedTokens(input, defaultOptions)

    expect(result).not.toContain('example_key_abc123def456ghi789')
    expect(result).toMatch(/example_key_\*+/)
  })

  it('should redact tokens with _claim_ prefix', () => {
    const input = 'claim_url: moltbook_claim_dlyXCg1xXsUlr9yRuEiQUxuncuXSFTFv'
    const result = redactEmbeddedTokens(input, defaultOptions)

    expect(result).not.toContain(
      'moltbook_claim_dlyXCg1xXsUlr9yRuEiQUxuncuXSFTFv'
    )
    expect(result).toMatch(/moltbook_claim_\*+/)
  })

  it('should redact sk-prefixed tokens (OpenAI style)', () => {
    const input = 'Using sk-proj_abcdefghij123456789xyz for authentication'
    const result = redactEmbeddedTokens(input, defaultOptions)

    expect(result).not.toContain('sk-proj_abcdefghij123456789xyz')
    // @note the prefix is preserved but the secret part is redacted
    expect(result).toMatch(/sk-proj_\*+xyz/)
  })

  it('should preserve non-token text around redacted tokens', () => {
    const input = 'The token moltbook_sk_abc123456789xyz was created yesterday'
    const result = redactEmbeddedTokens(input, defaultOptions)

    expect(result).toContain('The token ')
    expect(result).toContain(' was created yesterday')
  })

  it('should handle multiple tokens in the same string', () => {
    const input = 'Keys: app_sk_abc12345678 and service_token_xyz9876543'
    const result = redactEmbeddedTokens(input, defaultOptions)

    expect(result).toMatch(/app_sk_\*+/)
    expect(result).toMatch(/service_token_\*+/)
  })

  it('should fully redact Bearer JWT credentials except the last 3 characters', () => {
    const credential =
      'eyJhbGciOiJIUzI1NiJ9.eyJ0eXBlIjoicGlwZWRyZWFtX2FjY2Vzc190b2tlbiIsInNlY3JldElkIjoiY21leGFtcGxlMDAwMDAwMDAwMHNlY3JldGlkIiwidXNlcklkIjoiY2xleGFtcGxlMDAwMDAwMDAwMDAwMHVzZXJpZCIsInByb2plY3RJZCI6InByb2pfRXhhbXBsZTAiLCJlbnZpcm9ubWVudCI6InByb2R1Y3Rpb24iLCJleHRlcm5hbFVzZXJJZCI6ImRpcmVjdDpjbGV4YW1wbGUwMDAwMDAwMDAwMDAwdXNlcmlkIiwiYWNjb3VudElkIjoiYXBuX0V4YW1wbGUwIiwiY2xpZW50SWQiOiI0SUlzZXpuRVFQUU9sREdua0xRbjBzMGExeTJXbVRNU2Q5RGE2aGppRGNZIiwiaWF0IjoxNzc2MTE2NDUwLCJleHAiOjE3ODQwMDA0NTEsImF1ZCI6Im5vbmUifQ.q8696DDdTcEyKkIEeUmlNDODBdwDrvBGAVcgvu2u190'
    const input = `authorization: Bearer ${credential}`
    const result = redactEmbeddedTokens(input, defaultOptions)

    expect(result).toContain('authorization: Bearer ')
    expect(result).not.toContain(credential)
    expect(result).toContain(`${'*'.repeat(credential.length - 3)}190`)
    expect(result).not.toContain('AVcgvu2u190')
  })

  it('should redact GitHub server-to-server tokens embedded in a clone url', () => {
    const token = 'ghs_ip3RQWhTxR7YSUkSFrT8MuQcSOvriFALfOg9'
    const input = `git clone https://x-access-token:${token}@github.com/nebulaharborco/driftboard.git`
    const result = redactEmbeddedTokens(input, defaultOptions)

    expect(result).not.toContain(token)
    // @note the ghs_ scheme label is preserved, the secret body is masked
    expect(result).toMatch(/ghs_\*+Og9/)
    // @note surrounding url structure stays intact
    expect(result).toContain('https://x-access-token:')
    expect(result).toContain('@github.com/nebulaharborco/driftboard.git')
  })

  it('should redact every GitHub token prefix (ghp/gho/ghu/ghs/ghr)', () => {
    for (const prefix of ['ghp', 'gho', 'ghu', 'ghs', 'ghr']) {
      const token = `${prefix}_ip3RQWhTxR7YSUkSFrT8MuQcSOvriFALfOg9`
      const result = redactEmbeddedTokens(`token=${token} end`, defaultOptions)

      expect(result).not.toContain(token)
      expect(result).toMatch(new RegExp(`${prefix}_\\*+Og9`))
      expect(result).toContain(' end')
    }
  })

  it('should redact multiple GitHub tokens in the same long command', () => {
    const t1 = 'ghs_ip3RQWhTxR7YSUkSFrT8MuQcSOvriFALfOg9'
    const t2 = 'ghs_HP9Rf6oXoT7DFpjH4fNmm6wv2OU2X3C4Jj8X'
    // @note this whole command exceeds maxLength (256) so the entire-string
    // entropy check is skipped - redaction must come from the embedded pattern
    const input = `mkdir -p /tmp/repos && cd /tmp/repos && git clone https://x-access-token:${t1}@github.com/nebulaharborco/driftboard.git 2>&1 && git clone https://x-access-token:${t2}@github.com/nebulaharborco/notewheel.git 2>&1`
    const result = redactEmbeddedTokens(input, defaultOptions)

    expect(input.length).toBeGreaterThan(256)
    expect(result).not.toContain(t1)
    expect(result).not.toContain(t2)
    expect(result).toMatch(/ghs_\*+Og9/)
    expect(result).toMatch(/ghs_\*+j8X/)
  })

  it('should redact fine-grained GitHub PATs (github_pat_)', () => {
    const token =
      'github_pat_11ABCDEFG0abcdefghij12_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789ABC'
    const result = redactEmbeddedTokens(`AUTH=${token}`, defaultOptions)

    expect(result).not.toContain(token)
    expect(result).toMatch(/github_pat_\*+/)
  })

  it('should return unchanged string if no token patterns match', () => {
    const input = 'This is just a normal string without any tokens.'
    const result = redactEmbeddedTokens(input, defaultOptions)

    expect(result).toBe(input)
  })

  it('should respect custom mask character', () => {
    const customOptions = { ...defaultOptions, maskChar: '#' }
    const input = 'api_sk_secretvalue123456'
    const result = redactEmbeddedTokens(input, customOptions)

    expect(result).toMatch(/api_sk_#+/)
    expect(result).not.toContain('*')
  })
})

describe('redactHighEntropyTokens', () => {
  const defaultOptions = {
    preserveLastChars: 3,
    entropyThreshold: 4.0,
    minLength: 8,
    maxLength: 256,
    maskChar: '*',
    redactEmbeddedTokens: true,
    tokenMinLength: 20,
    tokenEntropyThreshold: 4.2,
  }

  it('should mask an unknown-format high-entropy token embedded in text', () => {
    const token = 'Xf9Qa2Lm8Zt4Vb7Nc1Wd5Yg3Hk6Jp0Rs'
    const input = `fetch the blob at ${token} now`
    const result = redactHighEntropyTokens(input, defaultOptions)

    expect(result).not.toContain(token)
    expect(result).toMatch(/\*+0Rs/)
    // @note the surrounding words survive
    expect(result).toContain('fetch the blob at ')
    expect(result).toContain(' now')
  })

  it('should preserve url/delimiter structure around a masked token', () => {
    const token = 'aB3dEf6Gh9Jk2Lm5Np8Qr1St4Uv7Wx0Yz'
    const input = `https://cdn.example.com/assets/${token}/file.bin`
    const result = redactHighEntropyTokens(input, defaultOptions)

    expect(result).not.toContain(token)
    expect(result).toContain('https://cdn.example.com/assets/')
    expect(result).toContain('/file.bin')
  })

  it('should NOT mask benign identifiers (cuids, names, slugs, paths)', () => {
    const inputs = [
      'conversation rcv91r65k20kr7w0o1m1kuel opened',
      'agent TheAlgorithmsFavoriteChild replied',
      'see a-normal-kebab-case-slug-here for details',
      'imported from packages/lib/redact.entropy.ts today',
    ]

    for (const input of inputs) {
      expect(redactHighEntropyTokens(input, defaultOptions)).toBe(input)
    }
  })

  it('should NOT mask short high-entropy fragments below tokenMinLength', () => {
    const input = 'code aB3dEf6Gh9 here'

    expect(redactHighEntropyTokens(input, defaultOptions)).toBe(input)
  })

  it('should mask regardless of the containing string length (no 256 cap)', () => {
    const token = '9pQ2mZ7xL4kR8vT3nW6yB1cF5hJ0dS'
    const input = 'x'.repeat(400) + ' ' + token + ' ' + 'y'.repeat(400)
    const result = redactHighEntropyTokens(input, defaultOptions)

    expect(input.length).toBeGreaterThan(256)
    expect(result).not.toContain(token)
    expect(result).toMatch(/\*+J0dS|\*+0dS/)
  })

  it('should respect a custom mask character', () => {
    const token = 'Xf9Qa2Lm8Zt4Vb7Nc1Wd5Yg3Hk6Jp0Rs'
    const result = redactHighEntropyTokens(`blob ${token} end`, {
      ...defaultOptions,
      maskChar: '#',
    })

    expect(result).toMatch(/#+0Rs/)
    expect(result).not.toContain('*')
  })

  it('should leave a string with no tokens unchanged', () => {
    const input = 'This is just a normal sentence without secrets.'

    expect(redactHighEntropyTokens(input, defaultOptions)).toBe(input)
  })
})

describe('redactMessagesEntropy', () => {
  it('should redact high-entropy strings in messages array', () => {
    const messages = [
      {
        type: 'user',
        text: 'Hello, how are you today?',
        meta: {},
      },
      {
        type: 'bot',
        text: 'I received your message',
        meta: {
          token: 'eyJhbGciOiJIUzI1NiJ9.test',
        },
      },
    ]

    const result = redactMessagesEntropy(messages)

    // @note natural language text is preserved
    expect(result[0].text).toBe('Hello, how are you today?')
    expect(result[1].meta.token).toMatch(/^\*+est$/)
  })

  it('should redact tokens embedded in multi-line strings with known prefixes', () => {
    const messages = [
      {
        type: 'activity',
        text: '',
        meta: {
          arguments: {
            input: {
              mode: 'read',
              path: '/space/.moltbook.json',
            },
          },
          result:
            'success: true\npath: /space/.moltbook.json\ncontents: |-\n  {\n    "api_key": "moltbook_sk_Wk4gjx2IXVWoG0M4zdx_mlEzz4HuUz2w",\n    "agent_name": "TheAlgorithmsFavoriteChild",\n    "claim_url": "https://moltbook.com/claim/moltbook_claim_dlyXCg1xXsUlr9yRuEiQUxuncuXSFTFv",\n    "verification_code": "lagoon-UUBX",\n    "profile_url": "https://moltbook.com/u/TheAlgorithmsFavoriteChild",\n    "registered_at": "2026-02-01T01:35:19.064869+00:00"\n  }\ntotalLines: 8\nstartLine: 1\nendLine: 8\n',
        },
      },
    ]

    const result = redactMessagesEntropy(messages)

    // @note the embedded token should be redacted but the rest preserved
    expect(result[0].meta.result).not.toContain(
      'moltbook_sk_Wk4gjx2IXVWoG0M4zdx_mlEzz4HuUz2w'
    )
    expect(result[0].meta.result).toMatch(/moltbook_sk_\*+/)
    // @note claim tokens should also be redacted
    expect(result[0].meta.result).not.toContain(
      'moltbook_claim_dlyXCg1xXsUlr9yRuEiQUxuncuXSFTFv'
    )
    // @note non-sensitive parts should be preserved
    expect(result[0].meta.result).toContain('TheAlgorithmsFavoriteChild')
    expect(result[0].meta.result).toContain('lagoon-UUBX')
  })

  it('should redact GitHub tokens inside a long tool-call command argument', () => {
    // @note mirrors the shape stored for a shell tool call on a public hub
    // conversation: meta.arguments.command holds a git-clone command with
    // x-access-token GitHub credentials that must never reach the rendered page.
    // The command is >256 chars, so the whole-string entropy check is skipped
    // and redaction depends entirely on the embedded GitHub-token pattern - this
    // is the exact path that previously leaked the credentials.
    const tokens = [
      'ghs_ip3RQWhTxR7YSUkSFrT8MuQcSOvriFALfOg9',
      'ghs_HP9Rf6oXoT7DFpjH4fNmm6wv2OU2X3C4Jj8X',
      'ghs_eXxpQcOCjkoCyKAMOwXFrA3MXRURsQIN7X9r',
      'ghs_slOwf21CyB3ifl6QkU2HGjHJuY36kI9BuTvL',
    ]
    const command = `mkdir -p /tmp/repos && cd /tmp/repos && git clone https://x-access-token:${tokens[0]}@github.com/nebulaharborco/driftboard.git 2>&1 && git clone https://x-access-token:${tokens[1]}@github.com/nebulaharborco/notewheel.git 2>&1 && git clone https://x-access-token:${tokens[2]}@github.com/nebulaharborco/hookline.git 2>&1 && git clone https://x-access-token:${tokens[3]}@github.com/nebulaharborco/linkloom.git 2>&1`

    const messages = [
      {
        type: 'activity',
        text: '',
        meta: {
          arguments: {
            command,
            timeout: 120000,
          },
        },
      },
    ]

    const result = redactMessagesEntropy(messages)
    const redacted = result[0].meta.arguments.command

    expect(command.length).toBeGreaterThan(256)

    for (const token of tokens) {
      expect(redacted).not.toContain(token)
    }

    // @note the ghs_ scheme labels survive so the entry is still readable
    expect(redacted).toMatch(/ghs_\*+Og9/)
    expect(redacted).toMatch(/ghs_\*+j8X/)
    // @note non-sensitive parts of the command survive
    expect(redacted).toContain('git clone')
    expect(redacted).toContain('driftboard.git')
    expect(result[0].meta.arguments.timeout).toBe(120000)
  })

  it('should redact an unknown-format secret embedded in a long command (generic entropy)', () => {
    // @note no vendor prefix (ghs_/sk-/etc.) - the ONLY thing that can catch this
    // is the generic per-token entropy pass. The command is also >256 chars, so
    // the whole-string entropy check is skipped. This is the exact gap that used
    // to leak novel credential formats.
    const secret = 'Xf9Qa2Lm8Zt4Vb7Nc1Wd5Yg3Hk6Jp0Rs'
    const padding = 'run --flag '.repeat(24)
    const command = `${padding}curl -H "authorization: ${secret}" https://internal.example.com/v1/deploy/nebulaharborco/driftboard`

    const messages = [
      { type: 'activity', text: '', meta: { arguments: { command } } },
    ]

    const result = redactMessagesEntropy(messages)
    const redacted = result[0].meta.arguments.command

    expect(command.length).toBeGreaterThan(256)
    expect(redacted).not.toContain(secret)
    expect(redacted).toMatch(/\*+0Rs/)
    // @note surrounding non-secret text survives
    expect(redacted).toContain('https://internal.example.com/v1/deploy')
    expect(redacted).toContain('driftboard')
  })

  it('should NOT redact benign identifiers in a long message (no false positives)', () => {
    const prose =
      'The quick brown fox jumps over the lazy dog while the farmer watches. '.repeat(
        6
      )
    const text = `${prose} conversation rcv91r65k20kr7w0o1m1kuel with agent TheAlgorithmsFavoriteChild`

    const messages = [{ type: 'user', text, meta: {} }]
    const result = redactMessagesEntropy(messages)

    expect(text.length).toBeGreaterThan(256)
    expect(result[0].text).toContain('rcv91r65k20kr7w0o1m1kuel')
    expect(result[0].text).toContain('TheAlgorithmsFavoriteChild')
    expect(result[0].text).not.toContain('*')
  })

  it('should handle empty messages array', () => {
    const result = redactMessagesEntropy([])

    expect(result).toEqual([])
  })

  it('should handle messages with nested meta objects', () => {
    const messages = [
      {
        type: 'activity',
        text: '',
        meta: {
          activity: {
            type: 'response',
            function: {
              name: 'authenticate',
              arguments: {
                // @note needs high entropy to trigger redaction
                password: 'xK9#mP2$vL5@nQ8wR3!',
              },
              result: {
                accessToken: 'abc123def456ghi789jkl',
              },
            },
          },
        },
      },
    ]

    const result = redactMessagesEntropy(messages)

    expect(result[0].meta.activity.function.arguments.password).toMatch(
      /^\*+R3!$/
    )
    expect(result[0].meta.activity.function.result.accessToken).toMatch(
      /^\*+jkl$/
    )
  })
})
