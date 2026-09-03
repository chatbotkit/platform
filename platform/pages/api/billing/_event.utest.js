/**
 * @jest-environment node
 */

import { handleWebhookEvent } from '@chatbotkit-dev/billing/provider'

import prisma from '@/prisma/client'

import { captureException } from '@/lib/error'
import { resetAccountLimits } from '@/lib/limit.core'
import {
  notifyInvoicePaymentFailed,
  notifyInvoicePaymentSucceeded,
  notifySubscriptionDeleted,
  notifyTrialStart,
  notifyTrialStartDuplicateCardDetected,
} from '@/lib/notify'
import { slidingWindow } from '@/lib/ratelimit'
import { recordLanguageTokenUsage } from '@/lib/usage.record'
import { deleteUser } from '@/lib/user.delete'

import handler from '@/pages/api/billing/event'

// @note the billing provider is mocked at the module boundary - the route
// only maps outcomes to responses and runs follow-ups, so that is all this
// suite asserts

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

jest.mock('@chatbotkit-dev/billing/provider', () => ({
  __esModule: true,
  handleWebhookEvent: jest.fn(),
}))

jest.mock('@/lib/method', () => ({
  withAny: (fn) => fn,
}))

jest.mock('@/lib/billing.handler', () => ({
  withBilling: (fn) => fn,
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: { user: {} },
}))

jest.mock('@/lib/limit.core', () => ({
  KNOWN_ACCOUNT_LIMITS: ['limit1'],
  resetAccountLimits: jest.fn(),
}))

jest.mock('@/lib/notify', () => ({
  notifyInvoicePaymentFailed: jest.fn(),
  notifyInvoicePaymentSucceeded: jest.fn(),
  notifySubscriptionDeleted: jest.fn(),
  notifyTrialStart: jest.fn(),
  notifyTrialStartDuplicateCardDetected: jest.fn(),
}))

jest.mock('@/lib/ratelimit', () => ({
  slidingWindow: jest.fn(),
}))

jest.mock('@/lib/usage.record', () => ({
  recordLanguageTokenUsage: jest.fn(),
}))

jest.mock('@/lib/user.delete', () => ({
  deleteUser: jest.fn(),
}))

jest.mock('@/lib/debug', () => ({
  log: jest.fn(),
  __esModule: true,
  default: jest.fn(() => ({ log: jest.fn() })),
}))

jest.mock('@/lib/error', () => ({
  captureException: jest.fn(),
  errorToErrorResponse: jest.fn((e) => ({
    message: e.message || 'Unknown error',
    code: 'INTERNAL_SERVER_ERROR',
  })),
}))

jest.mock('@/config/models', () => ({
  baseLanguageModel: 'test-base-model',
}))

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const MOCK_USER = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  billingCustomerId: 'cus_test',
  billingSubscriptionStatus: 'active',
}

function handled(followUps = [], overrides = {}) {
  return {
    outcome: 'handled',
    type: 'some.event',
    account: MOCK_USER,
    followUps,
    messages: [],
    ...overrides,
  }
}

function makeRequest(sig, body = '{}') {
  const buf = Buffer.from(
    typeof body === 'string' ? body : JSON.stringify(body)
  )

  return {
    headers: sig ? { 'x-signature': sig } : {},
    arrayBuffer: jest
      .fn()
      .mockResolvedValue(
        buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
      ),
  }
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('billing event handler', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    resetAccountLimits.mockResolvedValue(undefined)
    notifyTrialStart.mockResolvedValue(undefined)
    notifyTrialStartDuplicateCardDetected.mockResolvedValue(undefined)
    notifySubscriptionDeleted.mockResolvedValue(undefined)
    notifyInvoicePaymentSucceeded.mockResolvedValue(undefined)
    notifyInvoicePaymentFailed.mockResolvedValue(undefined)
    recordLanguageTokenUsage.mockResolvedValue(undefined)
    deleteUser.mockResolvedValue(undefined)
    captureException.mockResolvedValue(undefined)
  })

  describe('provider invocation', () => {
    it('hands the raw payload and headers to the provider', async () => {
      handleWebhookEvent.mockResolvedValue(handled())

      const req = makeRequest('v1=sig', '{"id":"evt_1"}')
      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(handleWebhookEvent).toHaveBeenCalledWith(prisma, slidingWindow, {
        payload: '{"id":"evt_1"}',
        headers: { 'x-signature': 'v1=sig' },
      })
    })

    it('flattens Headers instances into a plain object', async () => {
      handleWebhookEvent.mockResolvedValue(handled())

      const req = makeRequest('v1=sig')

      req.headers = new Headers({ 'x-signature': 'v1=sig' })

      await handler(req)

      expect(handleWebhookEvent).toHaveBeenCalledWith(
        prisma,
        slidingWindow,
        expect.objectContaining({
          headers: { 'x-signature': 'v1=sig' },
        })
      )
    })
  })

  describe('outcome mapping', () => {
    it('returns 400 for missing_signature', async () => {
      handleWebhookEvent.mockResolvedValue({ outcome: 'missing_signature' })

      const res = await handler(makeRequest(null))

      expect(res.status).toBe(400)
    })

    it('returns 403 for unconfigured', async () => {
      handleWebhookEvent.mockResolvedValue({ outcome: 'unconfigured' })

      const res = await handler(makeRequest('v1=sig'))

      expect(res.status).toBe(403)
    })

    it('returns 403 for invalid', async () => {
      handleWebhookEvent.mockResolvedValue({
        outcome: 'invalid',
        message: 'No signatures found matching the expected signature',
      })

      const res = await handler(makeRequest('v1=sig'))

      expect(res.status).toBe(403)
    })

    it('returns an error response for unknown_account', async () => {
      handleWebhookEvent.mockResolvedValue({
        outcome: 'unknown_account',
        customerId: 'cus_missing',
      })

      const res = await handler(makeRequest('v1=sig'))

      expect(res.status).toBeGreaterThanOrEqual(400)
    })

    it('returns 200 with the provider messages for handled', async () => {
      handleWebhookEvent.mockResolvedValue(
        handled([], { messages: ['subscription updated'] })
      )

      const res = await handler(makeRequest('v1=sig'))

      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toEqual({
        messages: ['subscription updated'],
      })
    })

    it('returns 200 without side effects when there are no follow-ups', async () => {
      handleWebhookEvent.mockResolvedValue(handled())

      const res = await handler(makeRequest('v1=sig'))

      expect(res.status).toBe(200)
      expect(resetAccountLimits).not.toHaveBeenCalled()
      expect(notifyTrialStart).not.toHaveBeenCalled()
      expect(recordLanguageTokenUsage).not.toHaveBeenCalled()
      expect(deleteUser).not.toHaveBeenCalled()
    })

    it('returns an error response when the provider throws', async () => {
      handleWebhookEvent.mockRejectedValue(new Error('provider exploded'))

      const res = await handler(makeRequest('v1=sig'))

      expect(res.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('follow-ups', () => {
    it('runs notify_trial_start against the account', async () => {
      handleWebhookEvent.mockResolvedValue(
        handled([{ action: 'notify_trial_start' }])
      )

      const res = await handler(makeRequest('v1=sig'))

      expect(res.status).toBe(200)
      expect(notifyTrialStart).toHaveBeenCalledWith(MOCK_USER)
    })

    it('runs notify_trial_duplicate_card against the account', async () => {
      handleWebhookEvent.mockResolvedValue(
        handled([{ action: 'notify_trial_duplicate_card' }])
      )

      const res = await handler(makeRequest('v1=sig'))

      expect(res.status).toBe(200)
      expect(notifyTrialStartDuplicateCardDetected).toHaveBeenCalledWith(
        MOCK_USER
      )
    })

    it('runs reset_account_limits with the known limits', async () => {
      handleWebhookEvent.mockResolvedValue(
        handled([{ action: 'reset_account_limits' }])
      )

      const res = await handler(makeRequest('v1=sig'))

      expect(res.status).toBe(200)
      expect(resetAccountLimits).toHaveBeenCalledWith(MOCK_USER, ['limit1'])
    })

    it('runs notify_subscription_deleted against the account', async () => {
      handleWebhookEvent.mockResolvedValue(
        handled([{ action: 'notify_subscription_deleted' }])
      )

      const res = await handler(makeRequest('v1=sig'))

      expect(res.status).toBe(200)
      expect(notifySubscriptionDeleted).toHaveBeenCalledWith(MOCK_USER)
    })

    it('runs notify_invoice_payment_succeeded against the account', async () => {
      handleWebhookEvent.mockResolvedValue(
        handled([{ action: 'notify_invoice_payment_succeeded' }])
      )

      const res = await handler(makeRequest('v1=sig'))

      expect(res.status).toBe(200)
      expect(notifyInvoicePaymentSucceeded).toHaveBeenCalledWith(MOCK_USER)
    })

    it('runs notify_invoice_payment_failed against the account', async () => {
      handleWebhookEvent.mockResolvedValue(
        handled([{ action: 'notify_invoice_payment_failed' }])
      )

      const res = await handler(makeRequest('v1=sig'))

      expect(res.status).toBe(200)
      expect(notifyInvoicePaymentFailed).toHaveBeenCalledWith(MOCK_USER)
    })

    it('credits booster tokens to the given user', async () => {
      handleWebhookEvent.mockResolvedValue(
        handled([{ action: 'credit_booster_tokens', userId: 'user-9' }])
      )

      const res = await handler(makeRequest('v1=sig'))

      expect(res.status).toBe(200)
      expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
        user: { id: 'user-9' },
        count: -1000000,
        model: 'test-base-model',
      })
    })

    it('deletes the account for delete_account', async () => {
      handleWebhookEvent.mockResolvedValue(
        handled([{ action: 'delete_account' }])
      )

      const res = await handler(makeRequest('v1=sig'))

      expect(res.status).toBe(200)
      expect(deleteUser).toHaveBeenCalledWith(MOCK_USER.id)
    })

    it('runs every follow-up in order', async () => {
      handleWebhookEvent.mockResolvedValue(
        handled([
          { action: 'notify_trial_start' },
          { action: 'reset_account_limits' },
        ])
      )

      const res = await handler(makeRequest('v1=sig'))

      expect(res.status).toBe(200)
      expect(notifyTrialStart).toHaveBeenCalledTimes(1)
      expect(resetAccountLimits).toHaveBeenCalledTimes(1)
      expect(notifyTrialStart.mock.invocationCallOrder[0]).toBeLessThan(
        resetAccountLimits.mock.invocationCallOrder[0]
      )
    })

    it('returns an error response for an unknown follow-up', async () => {
      handleWebhookEvent.mockResolvedValue(
        handled([{ action: 'not_a_real_action' }])
      )

      const res = await handler(makeRequest('v1=sig'))

      expect(res.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('error resilience', () => {
    it('captures a failing notification and keeps going', async () => {
      notifySubscriptionDeleted.mockRejectedValue(new Error('SendGrid down'))

      handleWebhookEvent.mockResolvedValue(
        handled([
          { action: 'notify_subscription_deleted' },
          { action: 'reset_account_limits' },
        ])
      )

      const res = await handler(makeRequest('v1=sig'))

      expect(res.status).toBe(200)
      expect(captureException).toHaveBeenCalledWith(expect.any(Error))
      expect(resetAccountLimits).toHaveBeenCalled()
    })

    it('captures a failing limits reset and keeps going', async () => {
      resetAccountLimits.mockRejectedValue(new Error('db down'))

      handleWebhookEvent.mockResolvedValue(
        handled([
          { action: 'reset_account_limits' },
          { action: 'notify_invoice_payment_succeeded' },
        ])
      )

      const res = await handler(makeRequest('v1=sig'))

      expect(res.status).toBe(200)
      expect(captureException).toHaveBeenCalledWith(expect.any(Error))
      expect(notifyInvoicePaymentSucceeded).toHaveBeenCalled()
    })

    it('returns an error response when account deletion throws', async () => {
      deleteUser.mockRejectedValue(new Error('cannot delete'))

      handleWebhookEvent.mockResolvedValue(
        handled([{ action: 'delete_account' }])
      )

      const res = await handler(makeRequest('v1=sig'))

      expect(res.status).toBeGreaterThanOrEqual(400)
    })
  })
})
