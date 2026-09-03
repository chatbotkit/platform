import {
  CHATBOTKIT_ASSERTION_HEADER_PREFIX,
  CHATBOTKIT_INTERNAL_FRONTEND_HOST_HEADER_NAME,
  CHATBOTKIT_INTERNAL_REAL_IP_HEADER_NAME,
} from '@/config/headers'

import {
  executeInContext,
  getContextFrontendHost,
  getContextRequestIpAddress,
} from '@/lib/context.store'
import { warn } from '@/lib/debug'
import {
  getInternalAssertionHeaders,
  injectInternalAssertionContext,
} from '@/lib/header.assertion'

import { createHmac } from 'node:crypto'

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(() => ({ log: jest.fn() })),
  warn: jest.fn(() => ({ log: jest.fn() })),
}))

const SECRET = '0123456789abcdef'

function encode(value) {
  return Buffer.from(value).toString('base64url')
}

function assertion(name, value, secret = SECRET) {
  const payload = `v1.${encode(name)}.${encode(value)}`
  const tag = createHmac('sha256', secret).update(payload).digest('hex')

  return [`x-chatbotkit-assertion-${tag}`, payload]
}

describe('internal header assertions', () => {
  it('should keep canonical internal names outside the assertion namespace', () => {
    expect(
      [
        CHATBOTKIT_INTERNAL_FRONTEND_HOST_HEADER_NAME,
        CHATBOTKIT_INTERNAL_REAL_IP_HEADER_NAME,
      ].every((name) => !name.startsWith(CHATBOTKIT_ASSERTION_HEADER_PREFIX))
    ).toBe(true)
  })

  it('should inject valid frontend host and real IP assertions into context', async () => {
    const headers = new Headers([
      assertion(
        CHATBOTKIT_INTERNAL_FRONTEND_HOST_HEADER_NAME,
        'Portal.Example.com:443'
      ),
      assertion(CHATBOTKIT_INTERNAL_REAL_IP_HEADER_NAME, '203.0.113.7'),
    ])

    await executeInContext(async () => {
      injectInternalAssertionContext(headers, SECRET)

      expect(getContextFrontendHost()).toBe('portal.example.com')
      expect(getContextRequestIpAddress()).toBe('203.0.113.7')
    })
  })

  it('should verify the portal Web Crypto contract vector', async () => {
    // @note the portal sender pins the same literal vector. This catches
    // protocol drift without making the public platform import the internal
    // portal application.

    const name =
      'x-chatbotkit-assertion-' +
      '312464a034df6b33afe1133c4c5c13aab0b6e3b7934c5bfe099f1f200247a9cf'
    const payload =
      'v1.eC1jaGF0Ym90a2l0LWludGVybmFsLWZyb250ZW5kLWhvc3Q.' +
      'cG9ydGFsLmV4YW1wbGUuY29t'

    await executeInContext(async () => {
      injectInternalAssertionContext(new Headers([[name, payload]]), SECRET)

      expect(getContextFrontendHost()).toBe('portal.example.com')
    })
  })

  it('should ignore spoofed canonical headers', async () => {
    const headers = new Headers({
      [CHATBOTKIT_INTERNAL_FRONTEND_HOST_HEADER_NAME]: 'attacker.example.com',
      [CHATBOTKIT_INTERNAL_REAL_IP_HEADER_NAME]: '198.51.100.9',
    })

    await executeInContext(async () => {
      injectInternalAssertionContext(headers, SECRET)

      expect(getContextFrontendHost()).toBeUndefined()
      expect(getContextRequestIpAddress()).toBeUndefined()
    })
  })

  it('should reject an assertion with an invalid signature', async () => {
    const [name, payload] = assertion(
      CHATBOTKIT_INTERNAL_FRONTEND_HOST_HEADER_NAME,
      'portal.example.com',
      'fedcba9876543210'
    )

    await executeInContext(async () => {
      injectInternalAssertionContext(new Headers([[name, payload]]), SECRET)

      expect(getContextFrontendHost()).toBeUndefined()
    })
  })

  it('should ignore validly signed claims outside the allowlist', async () => {
    const headers = new Headers([
      assertion('x-chatbotkit-internal-admin', 'true'),
    ])

    await executeInContext(async () => {
      injectInternalAssertionContext(headers, SECRET)

      expect(getContextFrontendHost()).toBeUndefined()
      expect(getContextRequestIpAddress()).toBeUndefined()
    })
  })

  it('should reject malformed host and IP claim values', async () => {
    const headers = new Headers([
      assertion(
        CHATBOTKIT_INTERNAL_FRONTEND_HOST_HEADER_NAME,
        'portal.example.com/path'
      ),
      assertion(CHATBOTKIT_INTERNAL_REAL_IP_HEADER_NAME, 'not-an-ip'),
    ])

    await executeInContext(async () => {
      injectInternalAssertionContext(headers, SECRET)

      expect(getContextFrontendHost()).toBeUndefined()
      expect(getContextRequestIpAddress()).toBeUndefined()
    })
  })

  it('should reject duplicate claims instead of choosing an order', async () => {
    const headers = new Headers([
      assertion(
        CHATBOTKIT_INTERNAL_FRONTEND_HOST_HEADER_NAME,
        'first.example.com'
      ),
      assertion(
        CHATBOTKIT_INTERNAL_FRONTEND_HOST_HEADER_NAME,
        'second.example.com'
      ),
    ])

    await executeInContext(async () => {
      injectInternalAssertionContext(headers, SECRET)

      expect(getContextFrontendHost()).toBeUndefined()
    })
  })

  it('should fail closed when the receiver has no secret', async () => {
    const headers = new Headers([
      assertion(
        CHATBOTKIT_INTERNAL_FRONTEND_HOST_HEADER_NAME,
        'portal.example.com'
      ),
    ])

    await executeInContext(async () => {
      injectInternalAssertionContext(headers, '')

      expect(getContextFrontendHost()).toBeUndefined()
      expect(warn).toHaveBeenCalledWith(
        'INTERNAL_HEADERS_SECRET is missing or shorter than 16 characters; incoming internal assertions will not be trusted'
      )
    })
  })

  it('should fail closed when the receiver secret is too short', async () => {
    const headers = new Headers([
      assertion(
        CHATBOTKIT_INTERNAL_FRONTEND_HOST_HEADER_NAME,
        'portal.example.com'
      ),
    ])

    await executeInContext(async () => {
      injectInternalAssertionContext(headers, 'too-short')

      expect(getContextFrontendHost()).toBeUndefined()
      expect(warn).toHaveBeenCalledWith(
        'INTERNAL_HEADERS_SECRET is missing or shorter than 16 characters; incoming internal assertions will not be trusted'
      )
    })
  })

  it('should serialize context values without exposing canonical names', () => {
    const headers = getInternalAssertionHeaders(
      {
        frontendHost: 'Portal.Example.com:443',
        realIp: '203.0.113.7',
      },
      SECRET
    )

    expect(Object.keys(headers)).toHaveLength(2)
    expect(
      Object.keys(headers).every((name) =>
        name.startsWith('x-chatbotkit-assertion-')
      )
    ).toBe(true)
    expect(headers).not.toHaveProperty(
      CHATBOTKIT_INTERNAL_FRONTEND_HOST_HEADER_NAME
    )
    expect(headers).not.toHaveProperty(CHATBOTKIT_INTERNAL_REAL_IP_HEADER_NAME)
  })

  it('should not serialize assertions with a short secret', () => {
    expect(
      getInternalAssertionHeaders(
        { frontendHost: 'portal.example.com' },
        'too-short'
      )
    ).toEqual({})
    expect(warn).toHaveBeenCalledWith(
      'INTERNAL_HEADERS_SECRET is missing or shorter than 16 characters; internal assertions will not be sent'
    )
  })
})
