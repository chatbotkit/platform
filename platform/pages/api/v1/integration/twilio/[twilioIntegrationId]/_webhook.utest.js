/**
 * @jest-environment node
 */
import { mockDeep } from 'jest-mock-extended'

import { createHmac } from 'crypto'

import { getExternalAPIHostURL } from '@/lib/host'

import prisma from '@/prisma/client'

import { logEvent } from '@/lib/log'
import memcache from '@/lib/memcache'

import { sendEvent } from '@/pages/api/v1/integration/twilio/[twilioIntegrationId]/queue'
import handler from '@/pages/api/v1/integration/twilio/[twilioIntegrationId]/webhook'

jest.mock('@/lib/method', () => ({
  withAny: (fn) => fn,
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/channel.core', () => ({
  waitForChannelMessage: jest.fn(async (_channelId, options) => {
    await options?.onSubscribe?.()

    return { xml: '<Response><Message>Hello</Message></Response>' }
  }),
}))

jest.mock('@/lib/memcache', () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
}))

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

jest.mock(
  '@/pages/api/v1/integration/twilio/[twilioIntegrationId]/queue',
  () => ({
    SMS_DELIVERY_CONFIRMATION_TIMEOUT_MS: 30000,
    SMS_DELIVERY_CONFIRMATION_TTL_SECONDS: 3600,
    sendEvent: jest.fn(),
  })
)

describe('Twilio webhook API handler', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    memcache.get.mockResolvedValue(null)
    memcache.set.mockResolvedValue(undefined)
    memcache.del.mockResolvedValue(undefined)
  })

  function makeRequest(
    body,
    {
      twilioIntegrationId = 'int-123',
      method = 'POST',
      contentType = 'application/x-www-form-urlencoded',
    } = {}
  ) {
    const url = `https://example.com/api/v1/integration/twilio/${twilioIntegrationId}/webhook?twilioIntegrationId=${twilioIntegrationId}`

    return new Request(url, {
      method,
      headers: {
        'Content-Type': contentType,
      },
      body: body,
    })
  }

  it('returns 404 when integration not found', async () => {
    prisma.twilioIntegration.findUnique.mockResolvedValue(null)

    const req = makeRequest('From=%2B1234567890&Body=Hello&MessageSid=SM123')
    const res = await handler(req)

    expect(res.status).toBe(404)
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('returns 200 OK when From is missing', async () => {
    prisma.twilioIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      userId: 'user-1',
    })

    const req = makeRequest('Body=Hello')
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('returns 200 OK when Body is missing', async () => {
    prisma.twilioIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      userId: 'user-1',
    })

    const req = makeRequest('From=%2B1234567890')
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('queues voice webhook and streams XML response', async () => {
    prisma.twilioIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      userId: 'user-1',
    })

    const req = makeRequest('CallSid=CA123&From=%2B1234567890&To=%2B10987654321')
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/xml')
    expect(sendEvent).toHaveBeenCalledWith('int-123', {
      type: 'interact',
      payload: {
        channelId: expect.stringMatching(/^twilio-voice-/),
        from: '+1234567890',
        to: '+10987654321',
        body: '',
        callSid: 'CA123',
      },
    })

    const body = await res.text()

    expect(body).toBe('<Response><Message>Hello</Message></Response>')
    expect(memcache.set).not.toHaveBeenCalled()
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        user: { id: 'user-1' },
        name: 'Twilio Call Received',
        type: 'integration.twilio.call.received',
        relations: {
          twilioIntegrationId: 'int-123',
        },
        meta: expect.objectContaining({
          from: '+1234567890',
          to: '+10987654321',
          callSid: 'CA123',
        }),
      })
    )
  })

  it('blocks voice webhook when sender is not allowed', async () => {
    prisma.twilioIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      userId: 'user-1',
      allowFrom: '+447911123456',
    })

    const req = makeRequest('CallSid=CA123&From=%2B1234567890&To=%2B10987654321')
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/xml')
    expect(await res.text()).toBe('<Response></Response>')
    expect(sendEvent).not.toHaveBeenCalled()
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        user: { id: 'user-1' },
        name: 'Sender Blocked',
        type: 'integration.twilio.blocked',
        relations: {
          twilioIntegrationId: 'int-123',
        },
        meta: expect.objectContaining({
          from: '+1234567890',
          to: '+10987654321',
          callSid: 'CA123',
        }),
      })
    )
    expect(logEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'integration.twilio.call.received',
      })
    )
  })

  it('returns 200 OK when From is empty', async () => {
    prisma.twilioIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      userId: 'user-1',
    })

    const req = makeRequest('From=&Body=Hello')
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('returns 200 OK when Body is empty', async () => {
    prisma.twilioIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      userId: 'user-1',
    })

    const req = makeRequest('From=%2B1234567890&Body=')
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('returns 200 OK when From is whitespace only', async () => {
    prisma.twilioIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      userId: 'user-1',
    })

    const req = makeRequest('From=%20%20&Body=Hello')
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('returns 200 OK when Body is whitespace only', async () => {
    prisma.twilioIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      userId: 'user-1',
    })

    const req = makeRequest('From=%2B1234567890&Body=%20%20')
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('returns 200 OK when SMS MessageSid is missing', async () => {
    prisma.twilioIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      userId: 'user-1',
    })

    const req = makeRequest('From=%2B1234567890&Body=Hello')
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('sends interact event with correct payload for valid message', async () => {
    prisma.twilioIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      userId: 'user-1',
    })

    const req = makeRequest(
      'From=%2B1234567890&Body=Hello%20there&MessageSid=SM123'
    )
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).toHaveBeenCalledWith('int-123', {
      type: 'interact',
      payload: {
        channelId: expect.stringMatching(/^twilio-/),
        from: '+1234567890',
        to: undefined,
        body: 'Hello there',
        messageSid: 'SM123',
        deliveredKey: expect.stringMatching(/^twilio-webhook-delivered-/),
        deliveryCheckAt: expect.any(Number),
      },
    })
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        user: { id: 'user-1' },
        name: 'Twilio SMS Received',
        type: 'integration.twilio.sms.received',
        relations: {
          twilioIntegrationId: 'int-123',
        },
        meta: expect.objectContaining({
          from: '+1234567890',
          messageSid: 'SM123',
        }),
      })
    )
  })

  it('blocks SMS webhook when sender is not allowed', async () => {
    prisma.twilioIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      userId: 'user-1',
      allowFrom: '+447911123456',
    })

    const req = makeRequest(
      'From=%2B1234567890&Body=Hello%20there&MessageSid=SM123'
    )
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/xml')
    expect(await res.text()).toBe('<Response></Response>')
    expect(sendEvent).not.toHaveBeenCalled()
    expect(memcache.set).not.toHaveBeenCalled()
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        user: { id: 'user-1' },
        name: 'Sender Blocked',
        type: 'integration.twilio.blocked',
        relations: {
          twilioIntegrationId: 'int-123',
        },
        meta: expect.objectContaining({
          from: '+1234567890',
          messageSid: 'SM123',
        }),
      })
    )
    expect(logEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'integration.twilio.sms.received',
      })
    )
  })

  it('returns streaming XML response', async () => {
    prisma.twilioIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      userId: 'user-1',
    })

    const req = makeRequest('From=%2B1234567890&Body=Hello&MessageSid=SM123')
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/xml')

    const body = await res.text()

    expect(body).toBe('<Response><Message>Hello</Message></Response>')
  })

  it('trims whitespace from From and Body values', async () => {
    prisma.twilioIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      userId: 'user-1',
    })

    const req = makeRequest(
      'From=%20%2B1234567890%20&Body=%20Hello%20world%20&MessageSid=SM123'
    )
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).toHaveBeenCalledWith('int-123', {
      type: 'interact',
      payload: {
        channelId: expect.stringMatching(/^twilio-/),
        from: '+1234567890',
        to: undefined,
        body: 'Hello world',
        messageSid: 'SM123',
        deliveredKey: expect.stringMatching(/^twilio-webhook-delivered-/),
        deliveryCheckAt: expect.any(Number),
      },
    })
  })

  it('handles special characters in Body', async () => {
    prisma.twilioIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      userId: 'user-1',
    })

    const req = makeRequest(
      'From=%2B1234567890&Body=Hello%21%20How%20are%20you%3F&MessageSid=SM123'
    )
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).toHaveBeenCalledWith('int-123', {
      type: 'interact',
      payload: {
        channelId: expect.stringMatching(/^twilio-/),
        from: '+1234567890',
        to: undefined,
        body: 'Hello! How are you?',
        messageSid: 'SM123',
        deliveredKey: expect.stringMatching(/^twilio-webhook-delivered-/),
        deliveryCheckAt: expect.any(Number),
      },
    })
  })

  it('handles unicode characters in Body', async () => {
    prisma.twilioIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      userId: 'user-1',
    })

    const req = makeRequest(
      'From=%2B1234567890&Body=%E4%BD%A0%E5%A5%BD&MessageSid=SM123'
    )
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(sendEvent).toHaveBeenCalledWith('int-123', {
      type: 'interact',
      payload: {
        channelId: expect.stringMatching(/^twilio-/),
        from: '+1234567890',
        to: undefined,
        body: '你好',
        messageSid: 'SM123',
        deliveredKey: expect.stringMatching(/^twilio-webhook-delivered-/),
        deliveryCheckAt: expect.any(Number),
      },
    })
  })

  it('passes Twilio routing metadata to the queue', async () => {
    prisma.twilioIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      userId: 'user-1',
    })

    const req = makeRequest(
      'From=%2B1234567890&To=%2B10987654321&Body=Hello&MessageSid=SM123'
    )

    await handler(req)

    expect(sendEvent).toHaveBeenCalledWith('int-123', {
      type: 'interact',
      payload: expect.objectContaining({
        from: '+1234567890',
        to: '+10987654321',
        body: 'Hello',
        messageSid: 'SM123',
        deliveredKey: expect.stringMatching(/^twilio-webhook-delivered-/),
        deliveryCheckAt: expect.any(Number),
      }),
    })
  })

  it('parses JSON webhook bodies from Twilio tunnel delivery', async () => {
    prisma.twilioIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      userId: 'user-1',
    })

    const req = makeRequest(
      JSON.stringify({
        ToCountry: 'US',
        SmsMessageSid: 'SM00000000000000000000000000000000',
        SmsStatus: 'received',
        Body: 'Ok',
        FromCountry: 'GB',
        To: '+15005550006',
        MessageSid: 'SM00000000000000000000000000000000',
        AccountSid: 'AC00000000000000000000000000000000',
        From: '+447911123456',
        ApiVersion: '2010-04-01',
      }),
      {
        contentType: 'application/json',
      }
    )

    await handler(req)

    expect(sendEvent).toHaveBeenCalledWith('int-123', {
      type: 'interact',
      payload: expect.objectContaining({
        from: '+447911123456',
        to: '+15005550006',
        body: 'Ok',
        messageSid: 'SM00000000000000000000000000000000',
        deliveredKey: expect.stringMatching(/^twilio-webhook-delivered-/),
        deliveryCheckAt: expect.any(Number),
      }),
    })
  })

  it('sends voice interact event with an empty body for relay calls', async () => {
    prisma.twilioIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      userId: 'user-1',
    })

    const req = makeRequest('CallSid=CA123&From=%2B1234567890&To=%2B10987654321')

    await handler(req)

    expect(sendEvent).toHaveBeenCalledWith('int-123', {
      type: 'interact',
      payload: expect.objectContaining({
        channelId: expect.stringMatching(/^twilio-/),
        from: '+1234567890',
        to: '+10987654321',
        body: '',
        callSid: 'CA123',
      }),
    })
  })

  it('generates unique channelId for each request', async () => {
    prisma.twilioIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      userId: 'user-1',
    })

    const req1 = makeRequest('From=%2B1234567890&Body=Hello1&MessageSid=SM123')

    await handler(req1)

    const call1 = sendEvent.mock.calls[0][1].payload.channelId

    const req2 = makeRequest('From=%2B1234567890&Body=Hello2&MessageSid=SM456')

    await handler(req2)

    const call2 = sendEvent.mock.calls[1][1].payload.channelId

    expect(call1).not.toBe(call2)
    expect(call1).toMatch(/^twilio-/)
    expect(call2).toMatch(/^twilio-/)
  })

  it('returns empty TwiML when channel wait fails (e.g. timeout or no bot)', async () => {
    const { waitForChannelMessage } = await import('@/lib/channel.core')

    waitForChannelMessage.mockRejectedValueOnce(
      new Error('channel wait timed out')
    )

    prisma.twilioIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      userId: 'user-1',
    })

    const req = makeRequest('From=%2B1234567890&Body=Hello&MessageSid=SM123')
    const res = await handler(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/xml')

    const body = await res.text()

    expect(body).toBe('<Response></Response>')
    expect(memcache.set).not.toHaveBeenCalled()
  })

  it('returns empty TwiML when voice channel wait fails', async () => {
    const { waitForChannelMessage } = await import('@/lib/channel.core')

    waitForChannelMessage.mockRejectedValueOnce(
      new Error('channel wait timed out')
    )

    prisma.twilioIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      userId: 'user-1',
    })

    const req = makeRequest('CallSid=CA123&From=%2B1234567890&To=%2B10987654321')
    const res = await handler(req)
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/xml')
    expect(body).toBe('<Response></Response>')
    expect(memcache.set).not.toHaveBeenCalled()
  })

  it('marks webhook delivery when XML is returned through the channel', async () => {
    prisma.twilioIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      userId: 'user-1',
    })

    const req = makeRequest('From=%2B1234567890&Body=Hello&MessageSid=SM123')
    const res = await handler(req)

    await res.text()

    expect(memcache.set).toHaveBeenCalledWith(
      expect.stringMatching(/^twilio-webhook-delivered-/),
      '1',
      expect.objectContaining({ ex: expect.any(Number) })
    )
  })

  it('uses the SMS webhook response timeout for SMS channel waits', async () => {
    const { waitForChannelMessage } = await import('@/lib/channel.core')
    const abortSignalTimeout = jest.spyOn(AbortSignal, 'timeout')

    prisma.twilioIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      userId: 'user-1',
    })

    const req = makeRequest('From=%2B1234567890&Body=Hello&MessageSid=SM123')

    await handler(req)

    expect(abortSignalTimeout).toHaveBeenCalledWith(12000)
    expect(waitForChannelMessage).toHaveBeenCalledWith(
      expect.stringMatching(/^twilio-/),
      expect.objectContaining({ abortSignal: expect.any(Object) })
    )

    abortSignalTimeout.mockRestore()
  })

  it('uses the webhook response timeout for voice channel waits', async () => {
    const { waitForChannelMessage } = await import('@/lib/channel.core')
    const abortSignalTimeout = jest.spyOn(AbortSignal, 'timeout')

    prisma.twilioIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      userId: 'user-1',
    })

    const req = makeRequest('CallSid=CA123&From=%2B1234567890&To=%2B10987654321')
    const res = await handler(req)

    await res.text()

    expect(abortSignalTimeout).toHaveBeenCalledWith(12000)
    expect(waitForChannelMessage).toHaveBeenCalledWith(
      expect.stringMatching(/^twilio-/),
      expect.objectContaining({ abortSignal: expect.any(Object) })
    )

    abortSignalTimeout.mockRestore()
  })

  it('subscribes to the response channel before queueing the webhook event', async () => {
    const { waitForChannelMessage } = await import('@/lib/channel.core')
    const events = []

    waitForChannelMessage.mockImplementationOnce(async (_channelId, options) => {
      events.push('subscribed')

      await options?.onSubscribe?.()

      return { xml: '<Response><Connect></Connect></Response>' }
    })
    sendEvent.mockImplementationOnce(async () => {
      events.push('queued')
    })

    prisma.twilioIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      userId: 'user-1',
    })

    const req = makeRequest('CallSid=CA123&From=%2B1234567890&To=%2B10987654321')
    const res = await handler(req)

    await res.text()

    expect(events).toEqual(['subscribed', 'queued'])
  })

  describe('signature verification', () => {
    // @note real HMACs over the same public callback url the handler derives
    // (getExternalAPIHostURL), computed with node's crypto rather than the
    // verifier under test
    const authToken = 'twilio-auth-token'
    const url = getExternalAPIHostURL('/api/v1/integration/twilio/int-123/webhook')

    // a body with no From: the handler answers 200 early once the gate opens,
    // which isolates the gate from the messaging path
    const params = { Body: 'Hello', MessageSid: 'SM123' }
    const formBody = new URLSearchParams(params).toString()

    const sign = (p, token = authToken) =>
      createHmac('sha1', token)
        .update(
          Object.keys(p)
            .sort()
            .reduce((carry, key) => carry + key + p[key], url)
        )
        .digest('base64')

    function signedRequest(body, signature) {
      return new Request(
        'https://example.com/api/v1/integration/twilio/int-123/webhook?twilioIntegrationId=int-123',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            ...(signature ? { 'X-Twilio-Signature': signature } : {}),
          },
          body,
        }
      )
    }

    it('accepts a correctly signed webhook when the auth token is set', async () => {
      prisma.twilioIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        authToken,
        allowFrom: '*',
      })

      const res = await handler(signedRequest(formBody, sign(params)))

      expect(res.status).toBe(200)
      expect(logEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'integration.twilio.configuration.error' })
      )
    })

    it('rejects a tampered parameter with 403 and records a configuration error', async () => {
      prisma.twilioIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        authToken,
        allowFrom: '*',
      })

      const res = await handler(
        signedRequest(
          new URLSearchParams({ ...params, Body: 'Goodbye' }).toString(),
          sign(params)
        )
      )

      expect(res.status).toBe(403)
      expect(sendEvent).not.toHaveBeenCalled()
      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'integration.twilio.configuration.error' })
      )
    })

    it('rejects a signature from a different auth token', async () => {
      prisma.twilioIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        authToken,
        allowFrom: '*',
      })

      const res = await handler(signedRequest(formBody, sign(params, 'other')))

      expect(res.status).toBe(403)
    })

    it('rejects a webhook with no signature header when the auth token is set', async () => {
      prisma.twilioIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        authToken,
        allowFrom: '*',
      })

      const res = await handler(signedRequest(formBody, undefined))

      expect(res.status).toBe(403)
    })

    it('accepts, logged, when no auth token is configured (the documented bypass)', async () => {
      prisma.twilioIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        allowFrom: '*',
      })

      const res = await handler(signedRequest(formBody, undefined))

      expect(res.status).toBe(200)
    })
  })
})
