/**
 * @jest-environment node
 */

/**
 * Tests for the allowFrom restriction logic in the email parse handler.
 *
 * The desired behavior mirrors the Telegram integration:
 * - null / empty allowFrom → deny all (secure by default)
 * - '*' wildcard          → allow all explicitly
 * - specific patterns     → allow only matching senders
 */
import prisma from '@/prisma/client'

import { logEvent } from '@/lib/log'

import handler from './parse'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// @note the inbound vendor format belongs to the email module - these tests
// mock the module and exercise the application flow (allowFrom, reply
// parsing, threading, events). The module's own parsing is covered in the
// email package's tests.
jest.mock('@chatbotkit-dev/email', () => ({
  __esModule: true,
  formatIntegrationInbox: (integrationId) =>
    `${integrationId}@integration.test`,
  parseInboundEmail: async (form) => {
    const get = (key) => {
      const value = form.get(key)

      return typeof value === 'string' ? value : undefined
    }

    const to = get('to') || ''
    const integrationId = to.split('@')[0]

    if (!integrationId) {
      return null
    }

    return {
      integrationId,
      to,
      fromEmail: get('from') || '',
      fromName: undefined,
      subject: get('subject') || '',
      text: get('text'),
      html: get('html'),
      headers: get('headers'),
      senderIp: get('sender_ip'),
      attachments: [],
    }
  },
}))

jest.mock('@/lib/method', () => ({
  withAny: (fn) => fn,
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    emailIntegration: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock(
  '@/pages/api/v1/integration/email/[emailIntegrationId]/queue',
  () => ({
    INTERACT_EVENT_TYPE: 'interact',
    sendEvent: jest.fn(async () => undefined),
  })
)

jest.mock('@/lib/debug', () =>
  jest.fn(() => ({
    log: jest.fn(),
  }))
)

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

jest.mock('@/lib/email.message', () => ({
  parseMessage: jest.fn(async () => ({
    messageId: undefined,
    inReplyTo: undefined,
  })),
}))

jest.mock('email-reply-parser', () => {
  return class EmailReplyParser {
    read(text) {
      return {
        getVisibleText: () => text,
      }
    }
  }
})

jest.mock('@/lib/session.file', () => ({
  uploadSessionFile: jest.fn(),
  getSessionFileTempDownloadURL: jest.fn(),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INTEGRATION_ID = 'test-integration-123'
const USER_ID = 'test-user-123'

/**
 * Builds a minimal mock Request that parse.js can process.
 *
 * @param {object} overrides
 * @param {string} [overrides.fromEmail] - The sender email address
 */
function createMockRequest({ fromEmail = 'sender@example.com' } = {}) {
  const formDataMap = new Map([
    ['from', fromEmail],
    // local part of the to address becomes the emailIntegrationId
    ['to', `${INTEGRATION_ID}@integration.test`],
    ['subject', 'Test Subject'],
    ['text', 'Hello world'],
    ['sender_ip', '1.2.3.4'],
    ['headers', ''],
  ])

  return {
    formData: async () => formDataMap,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/v1/integration/email/parse – allowFrom restrictions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('deny by default (no allowFrom configured)', () => {
    it('blocks sender when allowFrom is null', async () => {
      prisma.emailIntegration.findUnique.mockResolvedValueOnce({
        allowFrom: null,
        userId: USER_ID,
      })

      const result = await handler(createMockRequest())

      // Should be rejected – not 200
      expect(result.status).toBe(403)
    })

    it('logs blocked sender event against the email integration', async () => {
      prisma.emailIntegration.findUnique.mockResolvedValueOnce({
        allowFrom: 'allowed@example.com',
        userId: USER_ID,
      })

      const result = await handler(
        createMockRequest({ fromEmail: 'blocked@example.com' })
      )

      expect(result.status).toBe(403)
      expect(logEvent).toHaveBeenCalledWith({
        user: { id: USER_ID },
        name: 'Sender Blocked',
        description: 'A message was blocked due to allowFrom restrictions.',
        type: 'integration.email.blocked',
        relations: {
          emailIntegrationId: INTEGRATION_ID,
        },
        meta: {
          from: 'blocked@example.com',
        },
      })
    })

    it('blocks sender when allowFrom is empty string', async () => {
      prisma.emailIntegration.findUnique.mockResolvedValueOnce({
        allowFrom: '',
        userId: USER_ID,
      })

      const result = await handler(createMockRequest())

      expect(result.status).toBe(403)
    })

    it('blocks sender when allowFrom contains only whitespace and newlines', async () => {
      prisma.emailIntegration.findUnique.mockResolvedValueOnce({
        allowFrom: '  \n\n  ',
        userId: USER_ID,
      })

      const result = await handler(createMockRequest())

      expect(result.status).toBe(403)
    })
  })

  describe('wildcard (*) allows all senders', () => {
    it('allows any sender when allowFrom is "*"', async () => {
      prisma.emailIntegration.findUnique.mockResolvedValueOnce({
        allowFrom: '*',
      })

      const result = await handler(createMockRequest())

      expect(result.status).toBe(200)
    })

    it('allows any sender when allowFrom contains wildcard with other entries', async () => {
      prisma.emailIntegration.findUnique.mockResolvedValueOnce({
        allowFrom: 'specific@example.com\n*',
      })

      const result = await handler(
        createMockRequest({ fromEmail: 'random@unrelated.org' })
      )

      expect(result.status).toBe(200)
    })
  })

  describe('exact email pattern matching', () => {
    it('allows sender when exact email matches allowFrom', async () => {
      prisma.emailIntegration.findUnique.mockResolvedValueOnce({
        allowFrom: 'sender@example.com',
      })

      const result = await handler(
        createMockRequest({ fromEmail: 'sender@example.com' })
      )

      expect(result.status).toBe(200)
    })

    it('blocks sender when exact email does not match allowFrom', async () => {
      prisma.emailIntegration.findUnique.mockResolvedValueOnce({
        allowFrom: 'allowed@example.com',
      })

      const result = await handler(
        createMockRequest({ fromEmail: 'other@example.com' })
      )

      expect(result.status).toBe(403)
    })

    it('is case-insensitive when matching exact email', async () => {
      prisma.emailIntegration.findUnique.mockResolvedValueOnce({
        allowFrom: 'Sender@Example.COM',
      })

      const result = await handler(
        createMockRequest({ fromEmail: 'sender@example.com' })
      )

      expect(result.status).toBe(200)
    })
  })

  describe('domain pattern matching (@domain.com)', () => {
    it('allows sender whose domain matches @domain pattern', async () => {
      prisma.emailIntegration.findUnique.mockResolvedValueOnce({
        allowFrom: '@example.com',
      })

      const result = await handler(
        createMockRequest({ fromEmail: 'anyone@example.com' })
      )

      expect(result.status).toBe(200)
    })

    it('blocks sender whose domain does not match @domain pattern', async () => {
      prisma.emailIntegration.findUnique.mockResolvedValueOnce({
        allowFrom: '@example.com',
      })

      const result = await handler(
        createMockRequest({ fromEmail: 'anyone@other.com' })
      )

      expect(result.status).toBe(403)
    })
  })

  describe('multiple patterns (newline and comma delimited)', () => {
    it('allows sender matching any of multiple newline-separated patterns', async () => {
      prisma.emailIntegration.findUnique
        .mockResolvedValueOnce({
          allowFrom: 'alice@example.com\nbob@example.com',
        })
        .mockResolvedValueOnce({
          allowFrom: 'alice@example.com\nbob@example.com',
        })

      const resultAlice = await handler(
        createMockRequest({ fromEmail: 'alice@example.com' })
      )

      const resultBob = await handler(
        createMockRequest({ fromEmail: 'bob@example.com' })
      )

      expect(resultAlice.status).toBe(200)
      expect(resultBob.status).toBe(200)
    })

    it('blocks sender not matching any of the patterns', async () => {
      prisma.emailIntegration.findUnique.mockResolvedValueOnce({
        allowFrom: 'alice@example.com\nbob@example.com',
      })

      const result = await handler(
        createMockRequest({ fromEmail: 'charlie@example.com' })
      )

      expect(result.status).toBe(403)
    })

    it('allows sender matching any of multiple comma-separated patterns', async () => {
      prisma.emailIntegration.findUnique.mockResolvedValueOnce({
        allowFrom: 'alice@example.com,@trusted.org',
      })

      const result = await handler(
        createMockRequest({ fromEmail: 'anyone@trusted.org' })
      )

      expect(result.status).toBe(200)
    })
  })
})
