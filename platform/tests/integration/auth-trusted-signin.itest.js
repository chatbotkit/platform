/** @jest-environment node */
import { TRUSTED_SIGNIN_PROVIDER_ID } from '@/lib/auth.trusted.consts'
import fetch from '@/lib/fetch'

import { randomUUID } from 'node:crypto'

const baseUrl = process.env._ITEST_CHATBOTKIT_BASE_URL

function authUrl(path) {
  return new URL(`/api/auth/${path}`, baseUrl)
}

function responseCookies(response) {
  return response.headers.getSetCookie()
}

function assertNoSessionCookie(response) {
  const names = responseCookies(response).map((cookie) => cookie.split('=')[0])

  expect(names.some((name) => /session-token(?:\.\d+)?$/.test(name))).toBe(
    false
  )
}

describe('Hosted deployment rejects trusted sign-in', () => {
  it('does not advertise a trusted provider', async () => {
    const response = await fetch(authUrl('providers'), { redirect: 'manual' })

    expect(response.status).toBe(200)

    const providers = await response.json()

    // @note a healthy auth endpoint must still expose ordinary email sign-in;
    // an empty response or an error page is not evidence that the gate works
    expect(providers.email).toMatchObject({ id: 'email', type: 'email' })
    expect(providers).not.toHaveProperty(TRUSTED_SIGNIN_PROVIDER_ID)
    expect(
      Object.values(providers).some(
        ({ id }) => id === TRUSTED_SIGNIN_PROVIDER_ID
      )
    ).toBe(false)
  })

  it('rejects a direct trusted sign-in even with a valid CSRF token', async () => {
    const csrfResponse = await fetch(authUrl('csrf'), { redirect: 'manual' })

    expect(csrfResponse.status).toBe(200)

    const { csrfToken } = await csrfResponse.json()
    const cookies = responseCookies(csrfResponse)

    expect(csrfToken).toEqual(expect.any(String))
    expect(csrfToken.length).toBeGreaterThan(0)
    expect(cookies.some((cookie) => cookie.includes('csrf-token='))).toBe(true)

    const response = await fetch(
      authUrl(`signin/${TRUSTED_SIGNIN_PROVIDER_ID}`),
      {
        method: 'POST',
        redirect: 'manual',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: cookies.map((cookie) => cookie.split(';')[0]).join('; '),
        },
        // @note a reserved address avoids creating a real account if this
        // regression check ever runs against a misconfigured deployment
        body: new URLSearchParams({
          csrfToken,
          email: `trusted-signin-check-${randomUUID()}@example.invalid`,
          trustedToken: randomUUID(),
          callbackUrl: new URL('/overview', baseUrl).href,
        }),
      }
    )

    expect(response.status).toBe(302)
    assertNoSessionCookie(response)

    const location = response.headers.get('location')

    expect(location).not.toBeNull()
    expect(['/api/auth/signin', '/signin']).toContain(
      new URL(location, baseUrl).pathname
    )
  })

  it.each(['not-a-uuid', randomUUID()])(
    'rejects a direct trusted callback with token %s',
    async (token) => {
      const url = authUrl(`callback/${TRUSTED_SIGNIN_PROVIDER_ID}`)

      url.searchParams.set('email', 'trusted-signin-check@example.invalid')
      url.searchParams.set('token', token)
      url.searchParams.set('callbackUrl', new URL('/overview', baseUrl).href)

      const response = await fetch(url, { redirect: 'manual' })

      // NextAuth rejects callbacks for a provider that is not registered.
      expect(response.status).toBe(400)
      assertNoSessionCookie(response)
    }
  )
})
