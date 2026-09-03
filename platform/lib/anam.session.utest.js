import { sign } from '@/lib/jwt'

import { signAnamSession, validateAnamSession } from '@/lib/anam.session'

describe('anam.session', () => {
  beforeAll(() => {
    process.env.JWT_TOKEN_SECRET_KEY =
      process.env.JWT_TOKEN_SECRET_KEY || 'test-secret-test-secret-test-secret-0000'
  })

  it('signs and validates an anam session', async () => {
    const token = await signAnamSession({
      anamIntegrationId: 'anam-1',
      conversationId: 'conversation-1',
      token: 'conversation-token',
      anamSessionToken: 'anam-session-token',
    })

    await expect(validateAnamSession(token)).resolves.toEqual(
      expect.objectContaining({
        anamIntegrationId: 'anam-1',
        conversationId: 'conversation-1',
        token: 'conversation-token',
        anamSessionToken: 'anam-session-token',
      })
    )
  })

  it('returns null for a token missing anamIntegrationId', async () => {
    const token = await sign({
      conversationId: 'conversation-1',
      token: 'conversation-token',
      anamSessionToken: 'anam-session-token',
    })

    await expect(validateAnamSession(token)).resolves.toBeNull()
  })

  it('returns null for a token missing conversationId', async () => {
    const token = await sign({
      anamIntegrationId: 'anam-1',
      token: 'conversation-token',
      anamSessionToken: 'anam-session-token',
    })

    await expect(validateAnamSession(token)).resolves.toBeNull()
  })

  it('returns null for a token missing token', async () => {
    const token = await sign({
      anamIntegrationId: 'anam-1',
      conversationId: 'conversation-1',
      anamSessionToken: 'anam-session-token',
    })

    await expect(validateAnamSession(token)).resolves.toBeNull()
  })

  it('returns null for a token missing anamSessionToken', async () => {
    const token = await sign({
      anamIntegrationId: 'anam-1',
      conversationId: 'conversation-1',
      token: 'conversation-token',
    })

    await expect(validateAnamSession(token)).resolves.toBeNull()
  })

  it('returns null for an invalid token', async () => {
    await expect(validateAnamSession('not.a.valid.jwt')).resolves.toBeNull()
  })
})
