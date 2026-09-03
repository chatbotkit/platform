import { SystemError } from '@/lib/error'
import fetch from '@/lib/fetch'
import memcache from '@/lib/memcache'

import {
  findGoogleChatDirectMessageSpace,
  getGoogleChatAttachmentMediaDownloadUrl,
  isGoogleChatSpaceName,
  normalizeGoogleChatUserName,
  resolveGoogleChatSpace,
  sendGoogleChatImageMessage,
  sendGoogleChatMessage,
} from './googlechat.api'

jest.mock('@/lib/fetch')
jest.mock('@/lib/memcache', () => ({
  get: jest.fn(),
  set: jest.fn(),
}))
jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(() => ({ log: jest.fn() })),
}))

// @note PEM body must be valid base64 so atob() succeeds during JWT signing
const mockServiceAccountKey = JSON.stringify({
  client_email: 'test@test-project.iam.gserviceaccount.com',
  private_key:
    '-----BEGIN PRIVATE KEY-----\nZmFrZWtleWZvcnRlc3Rpbmc=\n-----END PRIVATE KEY-----\n',
  project_id: 'test-project',
})

const mockIntegration = { serviceAccountKey: mockServiceAccountKey }

const mockCryptoKey = {}

describe('getGoogleChatAttachmentMediaDownloadUrl', () => {
  it('builds a media download URL for an attachment resource name', () => {
    expect(
      getGoogleChatAttachmentMediaDownloadUrl(
        'spaces/SPACE_ID/messages/MESSAGE_ID/attachments/ATTACHMENT_ID'
      )
    ).toBe(
      'https://chat.googleapis.com/v1/media/spaces/SPACE_ID/messages/MESSAGE_ID/attachments/ATTACHMENT_ID?alt=media'
    )
  })
})

describe('normalizeGoogleChatUserName', () => {
  it('keeps user resource names unchanged', () => {
    expect(normalizeGoogleChatUserName('users/123456789')).toBe(
      'users/123456789'
    )
  })

  it('adds the users prefix to bare user IDs', () => {
    expect(normalizeGoogleChatUserName('123456789')).toBe('users/123456789')
  })
})

describe('isGoogleChatSpaceName', () => {
  it('detects Google Chat space resource names', () => {
    expect(isGoogleChatSpaceName('spaces/SPACE_ID')).toBe(true)
    expect(isGoogleChatSpaceName('person@example.com')).toBe(false)
  })
})

beforeEach(() => {
  jest.clearAllMocks()

  jest.spyOn(global.crypto.subtle, 'importKey').mockResolvedValue(mockCryptoKey)

  jest
    .spyOn(global.crypto.subtle, 'sign')
    .mockResolvedValue(new Uint8Array([1, 2, 3]).buffer)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('sendGoogleChatMessage', () => {
  describe('service account key validation', () => {
    it('throws SystemError when serviceAccountKey is null', async () => {
      await expect(
        sendGoogleChatMessage(
          { serviceAccountKey: null },
          'spaces/SPACE_ID',
          'hello'
        )
      ).rejects.toThrow(SystemError)
    })

    it('throws SystemError when serviceAccountKey is invalid JSON', async () => {
      await expect(
        sendGoogleChatMessage(
          { serviceAccountKey: 'not-valid-json' },
          'spaces/SPACE_ID',
          'hello'
        )
      ).rejects.toThrow(SystemError)
    })
  })

  describe('access token handling', () => {
    it('uses cached token when available (skips token exchange)', async () => {
      memcache.get.mockResolvedValue('cached-access-token')

      fetch.mockResolvedValue({ ok: true, text: jest.fn() })

      await sendGoogleChatMessage(mockIntegration, 'spaces/SPACE_ID', 'hello')

      // fetch should only be called once (the message send), not for token exchange
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(fetch).toHaveBeenCalledWith(
        'https://chat.googleapis.com/v1/spaces/SPACE_ID/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer cached-access-token',
          }),
        })
      )
    })

    it('exchanges token when cache misses and caches the result', async () => {
      memcache.get.mockResolvedValue(null)

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest
            .fn()
            .mockResolvedValue({ access_token: 'new-token', expires_in: 3600 }),
        })
        .mockResolvedValueOnce({ ok: true, text: jest.fn() })

      await sendGoogleChatMessage(mockIntegration, 'spaces/SPACE_ID', 'hello')

      expect(fetch).toHaveBeenCalledTimes(2)

      // first call: token exchange
      expect(fetch).toHaveBeenNthCalledWith(
        1,
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({ method: 'POST' })
      )

      // second call: message send with the new token
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        'https://chat.googleapis.com/v1/spaces/SPACE_ID/messages',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer new-token',
          }),
        })
      )

      // result should be cached
      expect(memcache.set).toHaveBeenCalledWith(
        `googlechat:token:test@test-project.iam.gserviceaccount.com`,
        'new-token',
        expect.objectContaining({ ex: expect.any(Number) })
      )
    })

    it('throws SystemError when token exchange fails', async () => {
      memcache.get.mockResolvedValue(null)

      fetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: jest.fn().mockResolvedValue('Unauthorized'),
      })

      await expect(
        sendGoogleChatMessage(mockIntegration, 'spaces/SPACE_ID', 'hello')
      ).rejects.toThrow(SystemError)
    })

    it('caches token with ttl reduced by 5 minutes for safety margin', async () => {
      memcache.get.mockResolvedValue(null)

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest
            .fn()
            .mockResolvedValue({ access_token: 'tok', expires_in: 3600 }),
        })
        .mockResolvedValueOnce({ ok: true, text: jest.fn() })

      await sendGoogleChatMessage(mockIntegration, 'spaces/SPACE_ID', 'hello')

      expect(memcache.set).toHaveBeenCalledWith(
        expect.any(String),
        'tok',
        { ex: 3300 } // 3600 - 300
      )
    })

    it('uses minimum ttl of 60 when expires_in is missing or very small', async () => {
      memcache.get.mockResolvedValue(null)

      fetch
        .mockResolvedValueOnce({
          ok: true,
          // @note no expires_in field - should default to 3600 then subtract 300
          json: jest.fn().mockResolvedValue({ access_token: 'tok' }),
        })
        .mockResolvedValueOnce({ ok: true, text: jest.fn() })

      await sendGoogleChatMessage(mockIntegration, 'spaces/SPACE_ID', 'hello')

      expect(memcache.set).toHaveBeenCalledWith(expect.any(String), 'tok', {
        ex: 3300,
      })
    })
  })

  describe('message sending', () => {
    beforeEach(() => {
      memcache.get.mockResolvedValue('access-token')
    })

    it('sends message without thread', async () => {
      fetch.mockResolvedValue({ ok: true, text: jest.fn() })

      await sendGoogleChatMessage(mockIntegration, 'spaces/SPACE_ID', 'hello')

      expect(fetch).toHaveBeenCalledWith(
        'https://chat.googleapis.com/v1/spaces/SPACE_ID/messages',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ text: 'hello' }),
        })
      )
    })

    it('sends message with thread and uses REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD option', async () => {
      fetch.mockResolvedValue({ ok: true, text: jest.fn() })

      await sendGoogleChatMessage(
        mockIntegration,
        'spaces/SPACE_ID',
        'reply',
        'spaces/SPACE_ID/threads/THREAD_ID'
      )

      expect(fetch).toHaveBeenCalledWith(
        'https://chat.googleapis.com/v1/spaces/SPACE_ID/messages?messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            text: 'reply',
            thread: { name: 'spaces/SPACE_ID/threads/THREAD_ID' },
          }),
        })
      )
    })

    it('sends private message when privateMessageViewerName is provided', async () => {
      fetch.mockResolvedValue({ ok: true, text: jest.fn() })

      await sendGoogleChatMessage(
        mockIntegration,
        'spaces/SPACE_ID',
        'private reply',
        'spaces/SPACE_ID/threads/THREAD_ID',
        { privateMessageViewerName: 'users/u1' }
      )

      expect(fetch).toHaveBeenCalledWith(
        'https://chat.googleapis.com/v1/spaces/SPACE_ID/messages?messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            text: 'private reply',
            thread: { name: 'spaces/SPACE_ID/threads/THREAD_ID' },
            privateMessageViewer: { name: 'users/u1' },
          }),
        })
      )
    })

    it('includes Authorization and Content-Type headers', async () => {
      fetch.mockResolvedValue({ ok: true, text: jest.fn() })

      await sendGoogleChatMessage(mockIntegration, 'spaces/SPACE_ID', 'hi')

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer access-token',
            'Content-Type': 'application/json',
          },
        })
      )
    })

    it('throws SystemError when message send fails', async () => {
      memcache.get.mockResolvedValue('access-token')

      fetch.mockImplementationOnce(async () => ({
        ok: false,
        status: 403,
        text: () =>
          Promise.resolve(
            '{"error":{"status":"PERMISSION_DENIED","message":"App cannot post to this space"}}'
          ),
      }))

      await expect(
        sendGoogleChatMessage(mockIntegration, 'spaces/SPACE_ID', 'hello')
      ).rejects.toThrow(
        'Failed to send Google Chat message: 403: {"error":{"status":"PERMISSION_DENIED","message":"App cannot post to this space"}}'
      )
    })
  })
})

describe('findGoogleChatDirectMessageSpace', () => {
  beforeEach(() => {
    memcache.get.mockResolvedValue('access-token')
  })

  it('finds a direct message space for a user', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ name: 'spaces/DM_SPACE' }),
    })

    await expect(
      findGoogleChatDirectMessageSpace(mockIntegration, 'users/123456789')
    ).resolves.toBe('spaces/DM_SPACE')

    expect(fetch).toHaveBeenCalledWith(
      'https://chat.googleapis.com/v1/spaces:findDirectMessage?name=users%2F123456789',
      expect.objectContaining({
        method: 'GET',
        headers: {
          Authorization: 'Bearer access-token',
        },
      })
    )
  })

  it('throws SystemError when the direct message lookup fails', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: jest.fn().mockResolvedValue('Not found'),
    })

    await expect(
      findGoogleChatDirectMessageSpace(mockIntegration, 'users/missing')
    ).rejects.toThrow(SystemError)
  })
})

describe('resolveGoogleChatSpace', () => {
  beforeEach(() => {
    memcache.get.mockResolvedValue('access-token')
  })

  it('keeps space resource names unchanged', async () => {
    await expect(
      resolveGoogleChatSpace(mockIntegration, 'spaces/SPACE_ID')
    ).resolves.toBe('spaces/SPACE_ID')

    expect(fetch).not.toHaveBeenCalled()
  })

  it('resolves non-space values as direct message users', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ name: 'spaces/DM_SPACE' }),
    })

    await expect(
      resolveGoogleChatSpace(mockIntegration, 'person@example.com')
    ).resolves.toBe('spaces/DM_SPACE')

    expect(fetch).toHaveBeenCalledWith(
      'https://chat.googleapis.com/v1/spaces:findDirectMessage?name=users%2Fperson%40example.com',
      expect.any(Object)
    )
  })
})

describe('sendGoogleChatImageMessage', () => {
  beforeEach(() => {
    memcache.get.mockResolvedValue('access-token')
  })

  it('sends image as cardsV2 message', async () => {
    fetch.mockResolvedValue({ ok: true, text: jest.fn() })

    await sendGoogleChatImageMessage(
      mockIntegration,
      'spaces/SPACE_ID',
      'https://example.com/image.png'
    )

    expect(fetch).toHaveBeenCalledWith(
      'https://chat.googleapis.com/v1/spaces/SPACE_ID/messages',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          cardsV2: [
            {
              cardId: 'imageCard',
              card: {
                sections: [
                  {
                    widgets: [
                      {
                        image: {
                          imageUrl: 'https://example.com/image.png',
                        },
                      },
                    ],
                  },
                ],
              },
            },
          ],
        }),
      })
    )
  })

  it('sends image with thread', async () => {
    fetch.mockResolvedValue({ ok: true, text: jest.fn() })

    await sendGoogleChatImageMessage(
      mockIntegration,
      'spaces/SPACE_ID',
      'https://example.com/image.png',
      'spaces/SPACE_ID/threads/THREAD_ID'
    )

    expect(fetch).toHaveBeenCalledWith(
      'https://chat.googleapis.com/v1/spaces/SPACE_ID/messages?messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          cardsV2: [
            {
              cardId: 'imageCard',
              card: {
                sections: [
                  {
                    widgets: [
                      {
                        image: {
                          imageUrl: 'https://example.com/image.png',
                        },
                      },
                    ],
                  },
                ],
              },
            },
          ],
          thread: { name: 'spaces/SPACE_ID/threads/THREAD_ID' },
        }),
      })
    )
  })

  it('sends private image when privateMessageViewerName is provided', async () => {
    fetch.mockResolvedValue({ ok: true, text: jest.fn() })

    await sendGoogleChatImageMessage(
      mockIntegration,
      'spaces/SPACE_ID',
      'https://example.com/image.png',
      undefined,
      { privateMessageViewerName: 'users/u1' }
    )

    expect(fetch).toHaveBeenCalledWith(
      'https://chat.googleapis.com/v1/spaces/SPACE_ID/messages',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining(
          '"privateMessageViewer":{"name":"users/u1"}'
        ),
      })
    )
  })

  it('throws SystemError when image send fails', async () => {
    fetch.mockImplementationOnce(async () => ({
      ok: false,
      status: 400,
      text: () => Promise.resolve('Bad Request'),
    }))

    await expect(
      sendGoogleChatImageMessage(
        mockIntegration,
        'spaces/SPACE_ID',
        'https://example.com/image.png'
      )
    ).rejects.toThrow(SystemError)
  })
})
