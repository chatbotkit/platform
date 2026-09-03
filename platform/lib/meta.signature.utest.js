import { verifyMetaSignature } from '@/lib/meta.signature'

import { createHmac } from 'crypto'

// @note the expectations are computed with node's crypto rather than with the
// implementation under test, so a mistake in the implementation cannot agree
// with itself.

describe('verifyMetaSignature', () => {
  const appSecret = 'app-secret'
  const rawBody = '{"object":"page","entry":[]}'

  const signature =
    'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex')

  it('accepts a correct signature', async () => {
    await expect(
      verifyMetaSignature({ rawBody, header: signature, appSecret })
    ).resolves.toBe(true)
  })

  it('rejects a tampered body', async () => {
    await expect(
      verifyMetaSignature({
        rawBody: rawBody.replace('page', 'instagram'),
        header: signature,
        appSecret,
      })
    ).resolves.toBe(false)
  })

  it('rejects a signature from a different secret', async () => {
    await expect(
      verifyMetaSignature({ rawBody, header: signature, appSecret: 'other' })
    ).resolves.toBe(false)
  })

  it('rejects a missing or malformed header', async () => {
    for (const header of [undefined, null, '', 'deadbeef', 'sha1=deadbeef']) {
      await expect(
        verifyMetaSignature({ rawBody, header, appSecret })
      ).resolves.toBe(false)
    }
  })

  it('rejects a correct digest carrying the wrong prefix', async () => {
    const digest = createHmac('sha256', appSecret).update(rawBody).digest('hex')

    await expect(
      verifyMetaSignature({ rawBody, header: `sha256 ${digest}`, appSecret })
    ).resolves.toBe(false)
  })
})
