import { getSecret, sign, trySign, verify, tryVerify, tokenExpiration, tokenIsFresh } from '@/lib/jwt'

describe('getSecret', () => {
  const original = process.env.JWT_TOKEN_SECRET_KEY

  afterEach(() => {
    process.env.JWT_TOKEN_SECRET_KEY = original
  })

  it('should reject a missing secret', () => {
    delete process.env.JWT_TOKEN_SECRET_KEY

    expect(() => getSecret()).toThrow(/JWT_TOKEN_SECRET_KEY/)
  })

  it('should reject a short secret', () => {
    process.env.JWT_TOKEN_SECRET_KEY = 'dummy'

    expect(() => getSecret()).toThrow(/at least 32/)
  })

  it('should refuse to verify anything while the secret is unset', async () => {
    const token = await sign({ userId: 'victim' }, 3600, 'user')

    delete process.env.JWT_TOKEN_SECRET_KEY

    await expect(verify(token)).rejects.toThrow(/JWT_TOKEN_SECRET_KEY/)
    expect(await tryVerify(token)).toBeNull()
  })
})

describe('encoder', () => {
  it('output must be valid instance', () => {
    expect(new TextEncoder().encode('test')).toBeInstanceOf(Uint8Array)
  })

  it('output must be valid instance name', () => {
    expect(new TextEncoder().encode('test').constructor.name).toEqual(
      'Uint8Array'
    )
  })
})

describe('sign / verify', () => {
  it('must correct sign and then verify', async () => {
    expect(await verify(await sign({ test: '123' }))).toEqual(
      expect.objectContaining({ test: '123', aud: 'none' })
    )
  })

  it('should include the custom audience in the token payload', async () => {
    const token = await sign({ data: 'x' }, 3600, 'user')
    const payload = await verify(token)

    expect(payload.aud).toBe('user')
  })

  it('should reject tokens signed with a different secret', async () => {
    const original = process.env.JWT_TOKEN_SECRET_KEY
    const token = await sign({ user: 'alice' })

    process.env.JWT_TOKEN_SECRET_KEY = 'totally-different-secret-totally-different'

    await expect(verify(token)).rejects.toThrow()

    process.env.JWT_TOKEN_SECRET_KEY = original
  })
})

describe('trySign', () => {
  it('should return a token string on success', async () => {
    const token = await trySign({ id: 'u1' })

    expect(typeof token).toBe('string')
    expect(token).not.toBeNull()
  })

  it('should produce a token that tryVerify can read back', async () => {
    const token = await trySign({ role: 'tester' })
    const payload = await tryVerify(token)

    expect(payload).toEqual(expect.objectContaining({ role: 'tester' }))
  })
})

describe('tryVerify', () => {
  it('should return the payload for a valid token', async () => {
    const token = await sign({ role: 'admin' })
    const payload = await tryVerify(token)

    expect(payload).toEqual(expect.objectContaining({ role: 'admin' }))
  })

  it('should return null for a completely invalid token string', async () => {
    const result = await tryVerify('not.a.valid.jwt')

    expect(result).toBeNull()
  })

  it('should return null for a token with a tampered signature', async () => {
    const token = await sign({ id: 'u1' })
    const tampered = token.slice(0, -5) + 'XXXXX'

    const result = await tryVerify(tampered)

    expect(result).toBeNull()
  })

  it('should return null for an expired token', async () => {
    jest.useFakeTimers()

    const token = await sign({ id: 'u2' }, 1)

    // advance time past expiry
    jest.advanceTimersByTime(2000)

    const result = await tryVerify(token)

    jest.useRealTimers()

    expect(result).toBeNull()
  })
})

describe('tokenExpiration', () => {
  it('should return a Date for a valid token with an exp claim', async () => {
    const token = await sign({ x: 1 }, 3600)
    const exp = tokenExpiration(token)

    expect(exp).toBeInstanceOf(Date)
    expect(exp.getTime()).toBeGreaterThan(Date.now())
  })

  it('should return null for a malformed token string', () => {
    expect(tokenExpiration('bad-token')).toBeNull()
  })

  it('should return null for an empty string', () => {
    expect(tokenExpiration('')).toBeNull()
  })

  it('should return null for a token payload missing the exp field', () => {
    // manually craft a JWT without exp by encoding a header.payload with no exp
    const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({ sub: 'user' })).toString('base64url')
    const fakeToken = `${header}.${payload}.fakesig`

    expect(tokenExpiration(fakeToken)).toBeNull()
  })
})

describe('tokenIsFresh', () => {
  it('should return true for a freshly signed token', async () => {
    const token = await sign({ id: 'u1' }, 3600)

    expect(tokenIsFresh(token)).toBe(true)
  })

  it('should return false for a malformed token', () => {
    expect(tokenIsFresh('garbage')).toBe(false)
  })

  it('should return false for an empty string', () => {
    expect(tokenIsFresh('')).toBe(false)
  })
})
