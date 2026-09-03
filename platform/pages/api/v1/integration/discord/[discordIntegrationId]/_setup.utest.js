/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { fetchAPI } from '@/lib/discord.api'

import handler, {
  doSetup,
} from '@/pages/api/v1/integration/discord/[discordIntegrationId]/setup'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/discord.api', () => ({
  fetchAPI: jest.fn(),
}))

jest.mock('@/lib/method', () => ({
  withAny: (fn) => fn,
  withGet: (fn) => fn,
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/debug', () => {
  const logger = { log: jest.fn() }
  const debug = jest.fn(() => logger)

  return {
    __esModule: true,
    default: debug,
  }
})

jest.mock('@/lib/error', () => ({
  captureError: jest.fn(),
  SystemError: class SystemError extends Error {
    constructor(message, code) {
      super(message)
      this.code = code
    }
  },
}))

jest.mock('@/lib/response', () => {
  const actual = jest.requireActual('@/lib/response')

  return {
    ...actual,
    respondFromError: jest.fn(() => ({ status: 500, json: async () => ({}) })),
  }
})

describe('doSetup', () => {
  const baseIntegration = {
    id: 'discord-123',
    userId: 'user-123',
    appId: 'app-123',
    botToken: 'Bot.token.here',
    publicKey: 'public-key-hex',
    handle: 'mybot',
    description: 'Talk to my bot',
  }

  beforeEach(() => {
    jest.clearAllMocks()

    // Default: GET commands returns empty array, DELETE and POST succeed
    fetchAPI.mockResolvedValue([])
  })

  describe('credential validation', () => {
    it('throws conflict when appId is null', async () => {
      const integration = { ...baseIntegration, appId: null }

      await expect(doSetup(integration)).rejects.toThrow(/No appId/)
    })

    it('throws conflict when appId is empty string', async () => {
      const integration = { ...baseIntegration, appId: '' }

      await expect(doSetup(integration)).rejects.toThrow(/No appId/)
    })

    it('throws conflict when botToken is null', async () => {
      const integration = { ...baseIntegration, botToken: null }

      await expect(doSetup(integration)).rejects.toThrow(/No botToken/)
    })

    it('throws conflict when botToken is empty string', async () => {
      const integration = { ...baseIntegration, botToken: '' }

      await expect(doSetup(integration)).rejects.toThrow(/No botToken/)
    })

    it('throws conflict when publicKey is null', async () => {
      const integration = { ...baseIntegration, publicKey: null }

      await expect(doSetup(integration)).rejects.toThrow(/No publicKey/)
    })

    it('throws conflict when publicKey is empty string', async () => {
      const integration = { ...baseIntegration, publicKey: '' }

      await expect(doSetup(integration)).rejects.toThrow(/No publicKey/)
    })

    it('throws conflict when handle becomes empty after sanitization', async () => {
      // Only non-word characters - all stripped out
      const integration = { ...baseIntegration, handle: '!!!###' }

      await expect(doSetup(integration)).rejects.toThrow(/No handle/)
    })

    it('falls back to chatbotkit handle when handle is empty string', async () => {
      const integration = { ...baseIntegration, handle: '' }

      // Empty string is falsy so the default 'chatbotkit' handle is used
      await expect(doSetup(integration)).resolves.toBeUndefined()
    })
  })

  describe('handle sanitization', () => {
    it('uses chatbotkit as fallback when handle is null', async () => {
      const integration = { ...baseIntegration, handle: null }

      await doSetup(integration)

      expect(fetchAPI).toHaveBeenCalledWith(
        expect.anything(),
        'POST',
        expect.stringContaining('/commands'),
        expect.objectContaining({ name: 'chatbotkit' })
      )
    })

    it('strips non-word characters from handle', async () => {
      const integration = { ...baseIntegration, handle: 'my-bot!' }

      await doSetup(integration)

      expect(fetchAPI).toHaveBeenCalledWith(
        expect.anything(),
        'POST',
        expect.stringContaining('/commands'),
        expect.objectContaining({ name: 'mybot' })
      )
    })

    it('trims whitespace from handle', async () => {
      const integration = { ...baseIntegration, handle: '  mybot  ' }

      await doSetup(integration)

      expect(fetchAPI).toHaveBeenCalledWith(
        expect.anything(),
        'POST',
        expect.stringContaining('/commands'),
        expect.objectContaining({ name: 'mybot' })
      )
    })
  })

  describe('command listing', () => {
    it('fetches existing commands from Discord API', async () => {
      await doSetup(baseIntegration)

      expect(fetchAPI).toHaveBeenCalledWith(
        expect.anything(),
        'GET',
        `applications/${baseIntegration.appId}/commands`
      )
    })

    it('throws conflict when commands response is not an array', async () => {
      fetchAPI.mockResolvedValue({ error: 'Unexpected response' })

      await expect(doSetup(baseIntegration)).rejects.toThrow(
        /Unexpected commands/
      )
    })

    it('throws conflict when commands response is null', async () => {
      fetchAPI.mockResolvedValue(null)

      await expect(doSetup(baseIntegration)).rejects.toThrow(
        /Unexpected commands/
      )
    })
  })

  describe('command deletion', () => {
    it('deletes all existing commands before registering new one', async () => {
      fetchAPI.mockResolvedValueOnce([{ id: 'cmd-1' }, { id: 'cmd-2' }])

      await doSetup(baseIntegration)

      expect(fetchAPI).toHaveBeenCalledWith(
        expect.anything(),
        'DELETE',
        `applications/${baseIntegration.appId}/commands/cmd-1`
      )
      expect(fetchAPI).toHaveBeenCalledWith(
        expect.anything(),
        'DELETE',
        `applications/${baseIntegration.appId}/commands/cmd-2`
      )
    })

    it('continues setup even when individual command deletion fails', async () => {
      fetchAPI.mockResolvedValueOnce([{ id: 'cmd-failing' }])

      // Deletion throws, registration succeeds
      fetchAPI
        .mockRejectedValueOnce(new Error('Delete failed'))
        .mockResolvedValueOnce({ id: 'new-cmd' })

      // Should not throw - deletion failures are non-fatal
      await expect(doSetup(baseIntegration)).resolves.toBeUndefined()
    })

    it('registers new command even when all deletions fail', async () => {
      fetchAPI
        .mockResolvedValueOnce([{ id: 'cmd-1' }, { id: 'cmd-2' }])
        .mockRejectedValueOnce(new Error('Delete 1 failed'))
        .mockRejectedValueOnce(new Error('Delete 2 failed'))
        .mockResolvedValueOnce({ id: 'new-cmd' })

      await doSetup(baseIntegration)

      // Last call should be command registration
      const lastCall = fetchAPI.mock.calls[fetchAPI.mock.calls.length - 1]

      expect(lastCall[1]).toBe('POST')
    })
  })

  describe('command registration', () => {
    it('registers a new slash command with the integration handle', async () => {
      await doSetup(baseIntegration)

      expect(fetchAPI).toHaveBeenCalledWith(
        expect.anything(),
        'POST',
        `applications/${baseIntegration.appId}/commands`,
        expect.objectContaining({
          name: baseIntegration.handle,
          description: expect.any(String),
        })
      )
    })

    it('command payload includes a message option', async () => {
      await doSetup(baseIntegration)

      const postCall = fetchAPI.mock.calls.find((c) => c[1] === 'POST')
      const payload = postCall[3]

      expect(payload.options).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'message', required: true }),
        ])
      )
    })

    it('resolves without a return value on success', async () => {
      const result = await doSetup(baseIntegration)

      expect(result).toBeUndefined()
    })
  })
})

describe('POST /api/v1/integration/discord/[discordIntegrationId]/setup', () => {
  const mockSession = {
    user: {
      id: 'user-123',
    },
  }

  beforeEach(() => {
    mockReset(prisma)
    jest.clearAllMocks()

    fetchAPI.mockResolvedValue([])
  })

  it('returns 404 when integration is not found', async () => {
    prisma.discordIntegration.findUniqueByIdentifier.mockResolvedValue(null)

    const req = { query: { discordIntegrationId: 'nonexistent' } }
    const result = await handler(req, mockSession)

    expect(result.status).toBe(404)
  })

  it('returns 403 when user does not own the integration', async () => {
    prisma.discordIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'discord-123',
      userId: 'other-user',
      appId: 'app-1',
      botToken: 'token',
      publicKey: 'key',
      handle: 'mybot',
    })

    const req = { query: { discordIntegrationId: 'discord-123' } }
    const result = await handler(req, mockSession)

    expect(result.status).toBe(403)
  })

  it('returns 200 with integration id on success', async () => {
    prisma.discordIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'discord-123',
      userId: 'user-123',
      appId: 'app-1',
      botToken: 'token',
      publicKey: 'key',
      handle: 'mybot',
    })

    const req = { query: { discordIntegrationId: 'discord-123' } }
    const result = await handler(req, mockSession)

    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({ id: 'discord-123' })
  })

  it('captures error and calls respondFromError when doSetup throws', async () => {
    prisma.discordIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'discord-123',
      userId: 'user-123',
      appId: null, // will trigger conflict in doSetup
      botToken: 'token',
      publicKey: 'key',
      handle: 'mybot',
    })

    const req = { query: { discordIntegrationId: 'discord-123' } }

    await handler(req, mockSession)

    const { captureError } = jest.requireMock('@/lib/error')
    const { respondFromError } = jest.requireMock('@/lib/response')

    expect(captureError).toHaveBeenCalled()
    expect(respondFromError).toHaveBeenCalled()
  })
})
