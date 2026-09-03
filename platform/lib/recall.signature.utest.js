import { verifyRecallSignature } from '@/lib/recall.signature'

import { createHmac } from 'crypto'

// @note the expectations are computed with node's crypto rather than with the
// implementation under test, so a mistake in the implementation cannot agree
// with itself. The scheme is Svix's: HMAC-SHA256 over `id.timestamp.body`
// keyed with the base64-DECODED secret, signature carried base64 as `v1,<sig>`.

const rawSecret = Buffer.from('super-secret-key-bytes')
const webhookSecret = 'whsec_' + rawSecret.toString('base64')

const svixId = 'msg_2Kq9'
const now = 1_700_000_000
const svixTimestamp = String(now)
const rawBody = '{"event":"bot.call_ended","bot":{"id":"b1","metadata":{}}}'

const sign = (id, ts, body) =>
  createHmac('sha256', rawSecret).update(`${id}.${ts}.${body}`).digest('base64')

const good = `v1,${sign(svixId, svixTimestamp, rawBody)}`

describe('verifyRecallSignature', () => {
  it('accepts a correct signature', async () => {
    await expect(
      verifyRecallSignature({
        rawBody,
        svixId,
        svixTimestamp,
        svixSignature: good,
        webhookSecret,
        now,
      })
    ).resolves.toBe(true)
  })

  it('accepts the secret without the whsec_ prefix', async () => {
    await expect(
      verifyRecallSignature({
        rawBody,
        svixId,
        svixTimestamp,
        svixSignature: good,
        webhookSecret: rawSecret.toString('base64'),
        now,
      })
    ).resolves.toBe(true)
  })

  it('accepts any one matching entry in a rotation list', async () => {
    await expect(
      verifyRecallSignature({
        rawBody,
        svixId,
        svixTimestamp,
        svixSignature: `v1,AAAA ${good}`,
        webhookSecret,
        now,
      })
    ).resolves.toBe(true)
  })

  it('rejects a tampered body', async () => {
    await expect(
      verifyRecallSignature({
        rawBody: rawBody.replace('b1', 'b2'),
        svixId,
        svixTimestamp,
        svixSignature: good,
        webhookSecret,
        now,
      })
    ).resolves.toBe(false)
  })

  it('rejects a signature bound to a different message id', async () => {
    await expect(
      verifyRecallSignature({
        rawBody,
        svixId: 'msg_other',
        svixTimestamp,
        svixSignature: good,
        webhookSecret,
        now,
      })
    ).resolves.toBe(false)
  })

  it('rejects a stale timestamp (replay)', async () => {
    const old = String(now - 10 * 60)

    await expect(
      verifyRecallSignature({
        rawBody,
        svixId,
        svixTimestamp: old,
        svixSignature: `v1,${sign(svixId, old, rawBody)}`,
        webhookSecret,
        now,
      })
    ).resolves.toBe(false)
  })

  it('rejects a different secret', async () => {
    await expect(
      verifyRecallSignature({
        rawBody,
        svixId,
        svixTimestamp,
        svixSignature: good,
        webhookSecret: 'whsec_' + Buffer.from('other').toString('base64'),
        now,
      })
    ).resolves.toBe(false)
  })

  it('rejects missing headers and unknown versions rather than throwing', async () => {
    for (const svixSignature of [undefined, null, '', `v2,${sign(svixId, svixTimestamp, rawBody)}`, 'garbage']) {
      await expect(
        verifyRecallSignature({
          rawBody,
          svixId,
          svixTimestamp,
          svixSignature,
          webhookSecret,
          now,
        })
      ).resolves.toBe(false)
    }

    await expect(
      verifyRecallSignature({
        rawBody,
        svixId: undefined,
        svixTimestamp,
        svixSignature: good,
        webhookSecret,
        now,
      })
    ).resolves.toBe(false)

    await expect(
      verifyRecallSignature({
        rawBody,
        svixId,
        svixTimestamp: 'not-a-number',
        svixSignature: good,
        webhookSecret,
        now,
      })
    ).resolves.toBe(false)
  })
})
