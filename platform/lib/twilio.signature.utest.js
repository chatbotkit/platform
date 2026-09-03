import { verifyTwilioSignature } from '@/lib/twilio.signature'

import { createHmac } from 'crypto'

// @note the expectation is computed with node's crypto rather than with the
// implementation under test, so a mistake in the implementation cannot agree
// with itself.

describe('verifyTwilioSignature', () => {
  const authToken = 'auth-token'
  const url = 'https://example.com/api/v1/integration/twilio/abc/webhook'
  const params = { From: '+123', Body: 'hello', To: '+456' }

  // twilio: url, then every parameter appended as key + value, sorted by key
  const expected = createHmac('sha1', authToken)
    .update(
      Object.keys(params)
        .sort()
        .reduce((carry, key) => carry + key + params[key], url)
    )
    .digest('base64')

  it('accepts a correct signature', async () => {
    await expect(
      verifyTwilioSignature({ url, params, header: expected, authToken })
    ).resolves.toBe(true)
  })

  it('is insensitive to parameter order, since it sorts by key', async () => {
    await expect(
      verifyTwilioSignature({
        url,
        params: { To: '+456', Body: 'hello', From: '+123' },
        header: expected,
        authToken,
      })
    ).resolves.toBe(true)
  })

  it('rejects a tampered parameter', async () => {
    await expect(
      verifyTwilioSignature({
        url,
        params: { ...params, Body: 'goodbye' },
        header: expected,
        authToken,
      })
    ).resolves.toBe(false)
  })

  it('rejects a signature computed for a different url', async () => {
    // @note the url is part of the signed data, so a callback replayed at
    // another endpoint does not verify
    await expect(
      verifyTwilioSignature({
        url: url.replace('example.com', 'evil.example'),
        params,
        header: expected,
        authToken,
      })
    ).resolves.toBe(false)
  })

  it('rejects a signature from a different auth token', async () => {
    await expect(
      verifyTwilioSignature({ url, params, header: expected, authToken: 'x' })
    ).resolves.toBe(false)
  })

  it('rejects a missing or malformed header rather than throwing', async () => {
    for (const header of [undefined, null, '', 'not-base64!!']) {
      await expect(
        verifyTwilioSignature({ url, params, header, authToken })
      ).resolves.toBe(false)
    }
  })
})
