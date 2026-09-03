import { sign } from './sigv4'

// @note the worked example from the AWS Signature Version 4 documentation, so
// the signer is checked against a published vector rather than against itself

const credentials = {
  accessKeyId: 'AKIDEXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
}

describe('sign', () => {
  it('reproduces the documented IAM ListUsers signature', () => {
    const headers = sign({
      method: 'GET',
      url: 'https://iam.amazonaws.com/?Action=ListUsers&Version=2010-05-08',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
      },
      body: '',

      region: 'us-east-1',
      service: 'iam',

      ...credentials,

      date: new Date('2015-08-30T12:36:00Z'),
    })

    expect(headers['x-amz-date']).toBe('20150830T123600Z')

    expect(headers.authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/iam/aws4_request, SignedHeaders=content-type;host;x-amz-date, Signature=5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7'
    )
  })

  it('defaults the signing time to now', () => {
    const before = new Date()

    const headers = sign({
      method: 'POST',
      url: 'https://email.eu-west-1.amazonaws.com/v2/email/outbound-emails',
      headers: {},
      body: '{}',

      region: 'eu-west-1',
      service: 'ses',

      ...credentials,
    })

    const stamp = headers['x-amz-date']

    expect(stamp).toMatch(/^\d{8}T\d{6}Z$/)
    expect(stamp.slice(0, 8)).toBe(
      before.toISOString().slice(0, 10).replace(/-/g, '')
    )
    expect(headers.authorization).toContain(
      `Credential=AKIDEXAMPLE/${stamp.slice(0, 8)}/eu-west-1/ses/aws4_request`
    )
  })

  it('changes with the payload', () => {
    const base = {
      method: 'POST',
      url: 'https://email.eu-west-1.amazonaws.com/v2/email/outbound-emails',
      headers: { 'content-type': 'application/json' },

      region: 'eu-west-1',
      service: 'ses',

      ...credentials,

      date: new Date('2025-01-02T03:04:05Z'),
    }

    const one = sign({ ...base, body: '{"a":1}' }).authorization
    const two = sign({ ...base, body: '{"a":2}' }).authorization

    expect(one).not.toBe(two)
    expect(sign({ ...base, body: '{"a":1}' }).authorization).toBe(one)
  })

  it('lowercases header names and sorts them into SignedHeaders', () => {
    const headers = sign({
      method: 'POST',
      url: 'https://example.com/',
      headers: {
        'X-Custom': 'value',
        'Content-Type': 'application/json',
      },
      body: '',

      region: 'us-east-1',
      service: 'ses',

      ...credentials,
    })

    expect(headers['content-type']).toBe('application/json')
    expect(headers['x-custom']).toBe('value')
    expect(headers.authorization).toContain(
      'SignedHeaders=content-type;host;x-amz-date;x-custom,'
    )
  })

  it('canonicalizes header whitespace without altering what is sent', () => {
    const base = {
      method: 'POST',
      url: 'https://example.com/',
      body: '',

      region: 'us-east-1',
      service: 'ses',

      ...credentials,

      date: new Date('2025-01-02T03:04:05Z'),
    }

    const spaced = sign({ ...base, headers: { 'x-custom': '  a   b  ' } })
    const tight = sign({ ...base, headers: { 'x-custom': 'a b' } })

    expect(spaced.authorization).toBe(tight.authorization)
    expect(spaced['x-custom']).toBe('  a   b  ')
  })

  it('sorts query parameters by name, then value', () => {
    const base = {
      method: 'GET',
      headers: {},
      body: '',

      region: 'us-east-1',
      service: 'iam',

      ...credentials,

      date: new Date('2015-08-30T12:36:00Z'),
    }

    const ordered = sign({
      ...base,
      url: 'https://iam.amazonaws.com/?Action=ListUsers&Version=2010-05-08',
    })

    const shuffled = sign({
      ...base,
      url: 'https://iam.amazonaws.com/?Version=2010-05-08&Action=ListUsers',
    })

    expect(shuffled.authorization).toBe(ordered.authorization)
  })

  it('treats a path as case- and encoding-sensitive', () => {
    const base = {
      method: 'GET',
      headers: {},
      body: '',

      region: 'us-east-1',
      service: 'iam',

      ...credentials,

      date: new Date('2015-08-30T12:36:00Z'),
    }

    const a = sign({ ...base, url: 'https://example.com/a/b' })
    const b = sign({ ...base, url: 'https://example.com/a/B' })
    const c = sign({ ...base, url: 'https://example.com/a%2Fb' })

    expect(a.authorization).not.toBe(b.authorization)
    expect(a.authorization).not.toBe(c.authorization)
  })

  it('does not hand host back, since fetch sets it from the URL', () => {
    const headers = sign({
      method: 'POST',
      url: 'https://email.eu-west-1.amazonaws.com/v2/email/outbound-emails',
      headers: { 'content-type': 'application/json' },
      body: '{}',

      region: 'eu-west-1',
      service: 'ses',

      ...credentials,
    })

    expect(headers.host).toBeUndefined()
    expect(headers['content-type']).toBe('application/json')
    expect(headers.authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/eu-west-1\/ses\/aws4_request, SignedHeaders=content-type;host;x-amz-date, Signature=[0-9a-f]{64}$/
    )
  })

  it('signs the session token along with everything else', () => {
    const headers = sign({
      method: 'POST',
      url: 'https://email.eu-west-1.amazonaws.com/v2/email/outbound-emails',
      headers: { 'content-type': 'application/json' },
      body: '{}',

      region: 'eu-west-1',
      service: 'ses',

      ...credentials,
      sessionToken: 'token',
    })

    expect(headers['x-amz-security-token']).toBe('token')
    expect(headers.authorization).toContain(
      'SignedHeaders=content-type;host;x-amz-date;x-amz-security-token,'
    )
  })
})
