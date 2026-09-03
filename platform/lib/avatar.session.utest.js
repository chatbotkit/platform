import { signAvatarSession, validateAvatarSession } from '@/lib/avatar.session'
import { sign } from '@/lib/jwt'

describe('avatar.session', () => {
  beforeAll(() => {
    process.env.JWT_TOKEN_SECRET_KEY =
      process.env.JWT_TOKEN_SECRET_KEY || 'test-secret-test-secret-test-secret-0000'
  })

  it('signs and validates an avatar session', async () => {
    const token = await signAvatarSession({
      avatarIntegrationId: 'avatar-1',
      websocket: 'wss://example.test/socket',
    })

    await expect(validateAvatarSession(token)).resolves.toEqual(
      expect.objectContaining({
        avatarIntegrationId: 'avatar-1',
        websocket: 'wss://example.test/socket',
      })
    )
  })

  it('returns null for a token missing websocket', async () => {
    const token = await sign({
      avatarIntegrationId: 'avatar-1',
    })

    await expect(validateAvatarSession(token)).resolves.toBeNull()
  })

  it('returns null for a token missing avatarIntegrationId', async () => {
    const token = await sign({
      websocket: 'wss://example.test/socket',
    })

    await expect(validateAvatarSession(token)).resolves.toBeNull()
  })

  it('returns null for an invalid token', async () => {
    await expect(validateAvatarSession('not.a.valid.jwt')).resolves.toBeNull()
  })
})
