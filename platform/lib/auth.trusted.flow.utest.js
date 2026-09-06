/** @jest-environment node */

/* eslint-disable @typescript-eslint/no-require-imports */
import { TRUSTED_SIGNIN_PROVIDER_ID } from '@/lib/auth.trusted.consts'

import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

// @note exercise the installed NextAuth routes, including token hashing and
// identifier normalization, rather than mocking the email provider's behavior
const authRoot = path.dirname(require.resolve('next-auth'))
const parseProviders = require(path.join(
  authRoot,
  'core/lib/providers.js'
)).default
const signin = require(path.join(authRoot, 'core/routes/signin.js')).default
const callback = require(path.join(authRoot, 'core/routes/callback.js')).default

const gateKeys = [
  'NEXTAUTH_TRUSTED_SIGNIN',
  'TARGET_ENV',
  'NEXTAUTH_GOOGLE_APP_ID',
  'NEXTAUTH_AZURE_AD_CLIENT_ID',
  'NEXTAUTH_GITHUB_APP_ID',
  'LIMITS_CONFIG',
]

let db
let options
let context

beforeEach(() => {
  let provider
  const previous = Object.fromEntries(
    gateKeys.map((key) => [key, process.env[key]])
  )

  for (const key of gateKeys) {
    delete process.env[key]
  }

  process.env.NEXTAUTH_TRUSTED_SIGNIN = 'true'

  try {
    jest.isolateModules(() => {
      provider = parseProviders({
        providers: require('./auth.trusted').getTrustedProviders(),
        providerId: TRUSTED_SIGNIN_PROVIDER_ID,
        url: 'http://localhost:3000/api/auth',
      }).provider
      context = require('./context.store')
    })
  } finally {
    for (const key of gateKeys) {
      if (previous[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = previous[key]
      }
    }
  }

  db = new DatabaseSync(':memory:')
  // @note the schema makes token globally unique as well as unique per
  // identifier; this is the constraint a fixed public token collided with
  db.exec(`CREATE TABLE VerificationToken (
    identifier TEXT, token TEXT UNIQUE, expires INTEGER,
    UNIQUE(identifier, token)
  )`)

  options = {
    provider,
    secret: 'unit-test-secret',
    url: 'http://localhost:3000/api/auth',
    callbackUrl: '/overview',
    theme: {},
    pages: {},
    events: {},
    jwt: {},
    logger: { error: jest.fn(), debug: jest.fn() },
    callbacks: { signIn: jest.fn(async () => true) },
    session: {
      strategy: 'database',
      maxAge: 3600,
      generateSessionToken: randomUUID,
    },
    cookies: { sessionToken: { name: 'session', options: {} } },
    adapter: {
      getUserByEmail: async () => null,
      createUser: jest.fn(async (user) => ({ ...user, id: 'user' })),
      createSession: jest.fn(async (session) => session),
      createVerificationToken: async (data) => {
        // Same retirement behavior as auth.adapter.ts.
        db.prepare('DELETE FROM VerificationToken WHERE identifier = ?').run(
          data.identifier
        )
        db.prepare('INSERT INTO VerificationToken VALUES (?, ?, ?)').run(
          data.identifier,
          data.token,
          data.expires.valueOf()
        )

        return data
      },
      useVerificationToken: async ({ identifier, token }) => {
        const row = db
          .prepare(
            'DELETE FROM VerificationToken WHERE identifier = ? AND token = ? RETURNING *'
          )
          .get(identifier, token)

        return row ? { ...row, expires: new Date(row.expires) } : null
      },
    },
  }
})

afterEach(() => db.close())

async function issue(email, trustedToken = randomUUID()) {
  const result = await context.executeInContext(async () => {
    const body = { email, trustedToken }

    context.setContextNextApiRequest({ method: 'POST', body })

    return await signin({ options, body, query: {} })
  })

  expect(options.logger.error).not.toHaveBeenCalled()
  expect(result.redirect).toContain('/verify-request?')

  return trustedToken
}

async function verify(email, token) {
  return await callback({
    options,
    query: { email, token },
    method: 'GET',
    sessionStore: {},
  })
}

it('creates an account and database session with the browser token', async () => {
  const token = await issue('Alice@Example.com')
  const result = await verify('alice@example.com', token)

  expect(result.redirect).toBe('/overview')
  expect(result.cookies).toHaveLength(1)
  expect(options.adapter.createUser).toHaveBeenCalledWith(
    expect.objectContaining({ email: 'alice@example.com' })
  )
  expect(options.adapter.createSession).toHaveBeenCalledTimes(1)
})

it('allows a corrected address after an abandoned sign-in', async () => {
  await issue('typo@example.com')

  const token = await issue('alice@example.com')

  expect((await verify('alice@example.com', token)).redirect).toBe('/overview')
})

it('signs into an existing account without creating another user', async () => {
  const user = { id: 'existing-user', email: 'alice@example.com' }

  options.adapter.getUserByEmail = async () => user
  options.adapter.updateUser = async (data) => ({ ...user, ...data })

  const token = await issue(user.email)

  expect((await verify(user.email, token)).redirect).toBe('/overview')
  expect(options.adapter.createUser).not.toHaveBeenCalled()
  expect(options.adapter.createSession).toHaveBeenCalledWith(
    expect.objectContaining({ userId: user.id })
  )
})

it.each([undefined, 'not-a-uuid', ['not-a-token']])(
  'rejects a missing or malformed browser token: %j',
  async (trustedToken) => {
    const result = await context.executeInContext(async () => {
      const body = { email: 'alice@example.com', trustedToken }

      context.setContextNextApiRequest({ method: 'POST', body })

      return await signin({ options, body, query: {} })
    })

    expect(result.redirect).toContain('error=EmailSignin')
    expect(
      db.prepare('SELECT count(*) AS count FROM VerificationToken').get().count
    ).toBe(0)
    expect(options.adapter.createSession).not.toHaveBeenCalled()
  }
)

it('consumes the token once', async () => {
  const token = await issue('alice@example.com')

  await verify('alice@example.com', token)
  expect((await verify('alice@example.com', token)).redirect).toContain(
    'error=Verification'
  )
  expect(options.adapter.createSession).toHaveBeenCalledTimes(1)
})

it('rejects an expired token', async () => {
  const token = await issue('alice@example.com')

  db.exec('UPDATE VerificationToken SET expires = 0')
  expect((await verify('alice@example.com', token)).redirect).toContain(
    'error=Verification'
  )
  expect(options.adapter.createSession).not.toHaveBeenCalled()
})

it('honors the sign-in callback before issuing a token', async () => {
  options.callbacks.signIn.mockResolvedValue('/signin?error=InvalidEmail')

  const result = await signin({
    options,
    body: { email: 'alice@example.com' },
    query: {},
  })

  expect(result.redirect).toBe('/signin?error=InvalidEmail')
  expect(
    db.prepare('SELECT count(*) AS count FROM VerificationToken').get().count
  ).toBe(0)
})
