/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */

import handler, { bodySchema } from './publish'

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/channel.session', () => ({
  publishChannelMessage: jest.fn(),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((_req, param) => _req.query?.[param]),
}))

jest.mock('@/lib/debug', () => {
  const debug = jest.fn()

  return { __esModule: true, default: debug }
})

describe('bodySchema', () => {
  it('should accept a valid message object', () => {
    const result = bodySchema.validate({ message: { text: 'hello' } })

    expect(result.error).toBeUndefined()
  })

  it('should accept an empty message object', () => {
    const result = bodySchema.validate({ message: {} })

    expect(result.error).toBeUndefined()
  })

  it('should reject a missing message field', () => {
    const result = bodySchema.validate({})

    expect(result.error).toBeDefined()
  })

  it('should accept a message with arbitrary fields', () => {
    const result = bodySchema.validate({
      message: { foo: 'bar', count: 42, nested: { a: 1 } },
    })

    expect(result.error).toBeUndefined()
  })
})

describe('POST /api/v1/channel/{channelId}/publish', () => {
  const { publishChannelMessage } = require('@/lib/channel.session')

  const mockSession = { id: 'session-123', user: { id: 'user-456' } }

  beforeEach(() => {
    jest.clearAllMocks()
    publishChannelMessage.mockResolvedValue(undefined)
  })

  it('should return badRequest when channelId is shorter than 16 characters', async () => {
    const req = { query: { channelId: 'short-id' } }

    const response = await handler(req, mockSession, { message: { data: 1 } })

    expect(response.status).toBe(400)
    expect(publishChannelMessage).not.toHaveBeenCalled()
  })

  it('should return badRequest when channelId is exactly 15 characters', async () => {
    const req = { query: { channelId: 'a'.repeat(15) } }

    const response = await handler(req, mockSession, { message: {} })

    expect(response.status).toBe(400)
    expect(publishChannelMessage).not.toHaveBeenCalled()
  })

  it('should publish and return ok when channelId is exactly 16 characters', async () => {
    const channelId = 'a'.repeat(16)
    const req = { query: { channelId } }
    const message = { result: 'success' }

    const response = await handler(req, mockSession, { message })

    expect(response.status).toBe(200)

    const body = await response.json()

    expect(body.id).toBe(channelId)
  })

  it('should publish and return ok when channelId is longer than 16 characters', async () => {
    const channelId = 'a'.repeat(32)
    const req = { query: { channelId } }
    const message = { data: 'payload' }

    const response = await handler(req, mockSession, { message })

    expect(response.status).toBe(200)

    const body = await response.json()

    expect(body.id).toBe(channelId)
  })

  it('should call publishChannelMessage with session, channelId, and message', async () => {
    const channelId = 'valid-channel-id-123'
    const req = { query: { channelId } }
    const message = { temperature: 72, conditions: 'sunny' }

    await handler(req, mockSession, { message })

    expect(publishChannelMessage).toHaveBeenCalledWith(
      mockSession,
      channelId,
      message
    )
  })

  it('should propagate errors thrown by publishChannelMessage', async () => {
    const channelId = 'valid-channel-id-123'
    const req = { query: { channelId } }

    publishChannelMessage.mockRejectedValue(new Error('channel error'))

    await expect(handler(req, mockSession, { message: {} })).rejects.toThrow(
      'channel error'
    )
  })

  it('should return the channelId as the id in the success response', async () => {
    const channelId = 'my-unique-channel-id-abc'
    const req = { query: { channelId } }

    const response = await handler(req, mockSession, { message: { x: 1 } })

    const body = await response.json()

    expect(body.id).toBe(channelId)
  })
})
