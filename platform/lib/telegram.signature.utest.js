import {
  deriveTelegramSecretToken,
  verifyTelegramSecretToken,
} from '@/lib/telegram.signature'

describe('verifyTelegramSecretToken', () => {
  it('accepts the registered token', () => {
    expect(
      verifyTelegramSecretToken({ header: 'abc', secretToken: 'abc' })
    ).toBe(true)
  })

  it('rejects a different token', () => {
    expect(
      verifyTelegramSecretToken({ header: 'abd', secretToken: 'abc' })
    ).toBe(false)
  })

  it('rejects an absent header', () => {
    // @note a webhook registered before the secret existed sends no header,
    // which the caller treats as unverifiable rather than hostile
    expect(
      verifyTelegramSecretToken({ header: undefined, secretToken: 'abc' })
    ).toBe(false)
  })
})

describe('deriveTelegramSecretToken', () => {
  it('derives a stable token from the bot token', async () => {
    expect(await deriveTelegramSecretToken('bot-token')).toBe(
      await deriveTelegramSecretToken('bot-token')
    )
  })

  it('changes when the bot token rotates', async () => {
    expect(await deriveTelegramSecretToken('a')).not.toBe(
      await deriveTelegramSecretToken('b')
    )
  })

  it('produces a token telegram accepts (1-256 of A-Za-z0-9_-)', async () => {
    expect(await deriveTelegramSecretToken('bot-token')).toMatch(
      /^[A-Za-z0-9_-]{1,256}$/
    )
  })
})
