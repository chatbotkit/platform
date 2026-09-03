/**
 * @jest-environment node
 */
import fetch from '@/lib/fetch'
import memcache from '@/lib/memcache'

import { sendTeamsMessage, sendTeamsReply } from './microsoftteams.api'

jest.mock('@/lib/fetch', () => jest.fn())

jest.mock('@/lib/memcache', () => ({
  get: jest.fn(),
  set: jest.fn(),
}))

describe('microsoftteams.api', () => {
  const integration = {
    botFrameworkAppId: 'app-id',
    botFrameworkAppSecret: 'app-secret',
    tenantId: 'tenant-id',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('uses cached token when sending a reply', async () => {
    memcache.get.mockResolvedValue('cached-token')
    fetch.mockResolvedValue({ ok: true })

    await sendTeamsReply(integration, 'https://service.example.com/', {
      conversationId: 'conversation/1',
      activityId: 'activity/1',
      text: 'hello',
    })

    expect(fetch).toHaveBeenCalledWith(
      'https://service.example.com/v3/conversations/conversation%2F1/activities/activity%2F1',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer cached-token',
        }),
      })
    )
  })

  it('fetches and caches token when cache is empty', async () => {
    memcache.get.mockResolvedValue(null)
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'fresh-token', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({ ok: true })

    await sendTeamsMessage(
      integration,
      'https://service.example.com/',
      'conversation',
      'message'
    )

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://login.microsoftonline.com/tenant-id/oauth2/v2.0/token',
      expect.objectContaining({ method: 'POST' })
    )
    expect(memcache.set).toHaveBeenCalledWith(
      'teams:token:app-id',
      'fresh-token',
      { ex: 3300 }
    )
  })

  it('throws when credentials are missing', async () => {
    await expect(
      sendTeamsReply(
        { botFrameworkAppId: null, botFrameworkAppSecret: null },
        'https://service.example.com',
        {
          conversationId: 'conversation',
          activityId: 'activity',
          text: 'hello',
        }
      )
    ).rejects.toThrow('Teams integration is missing Bot Framework credentials')
  })

  it('throws when sending message fails', async () => {
    memcache.get.mockResolvedValue('cached-token')
    fetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'error',
    })

    await expect(
      sendTeamsMessage(
        integration,
        'https://service.example.com',
        'conversation',
        'message'
      )
    ).rejects.toThrow('Failed to send Teams message: 500')
  })
})
