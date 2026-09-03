import { doSetup } from '@/pages/api/v1/integration/whatsapp/[whatsappIntegrationId]/setup'

describe('WhatsApp setup - doSetup', () => {
  const baseIntegration = {
    id: 'wa-int-123',
    userId: 'user-123',
    phoneNumberId: 'phone-123',
    accessToken: 'token-123',
    appSecret: 'meta-app-secret',
  }

  it('throws conflict when phoneNumberId is null', async () => {
    const integration = { ...baseIntegration, phoneNumberId: null }

    await expect(doSetup(integration)).rejects.toThrow(/No phone number ID/)
  })

  it('throws conflict when phoneNumberId is empty', async () => {
    const integration = { ...baseIntegration, phoneNumberId: '' }

    await expect(doSetup(integration)).rejects.toThrow(/No phone number ID/)
  })

  it('throws conflict when accessToken is null', async () => {
    const integration = { ...baseIntegration, accessToken: null }

    await expect(doSetup(integration)).rejects.toThrow(/No access token/)
  })

  it('throws conflict when accessToken is empty', async () => {
    const integration = { ...baseIntegration, accessToken: '' }

    await expect(doSetup(integration)).rejects.toThrow(/No access token/)
  })

  it('succeeds without an app secret (signature validation is opt-in)', async () => {
    const integration = { ...baseIntegration, appSecret: null }

    await expect(doSetup(integration)).resolves.toBeUndefined()
  })

  it('succeeds when required config is present', async () => {
    await expect(doSetup(baseIntegration)).resolves.toBeUndefined()
  })
})
