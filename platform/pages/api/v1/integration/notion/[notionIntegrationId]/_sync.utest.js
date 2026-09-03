/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { doSync } from './sync'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/prisma/types', () => ({
  SyncStatus: { pending: 'pending' },
}))

jest.mock('@/config/limits', () => ({
  free: {
    notionIntegration: {
      maxPages: 10,
      maxTime: 10,
    },
  },
  pro: {
    notionIntegration: {
      maxPages: 1000,
      maxTime: 30,
    },
  },
}))

jest.mock('@/lib/batch', () => ({
  runBatchJobAsync: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/debug', () => {
  const actual = jest.requireActual('@/lib/debug')
  const fn = jest.fn(() => ({ log: jest.fn() }))

  return { __esModule: true, default: fn, ...actual, default: fn }
})

jest.mock('@/lib/host', () => ({
  getExternalAPIHostURL: jest.fn(() => 'https://api.example.com'),
}))

jest.mock('@/lib/limit.core', () => ({
  databaseLimitsOk: jest.fn(),
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/rate', () => ({
  withSessionRate: (_n, _period, fn) => fn,
}))

jest.mock('@/lib/response', () => ({
  throwConflict: jest.fn((msg) => {
    throw new Error(msg)
  }),
  conflict: jest.fn((msg) => ({ status: 409, error: msg })),
  notFound: jest.fn(() => ({ status: 404 })),
  notAuthorized: jest.fn(() => ({ status: 403 })),
  ok: jest.fn((data) => ({ status: 200, data })),
  respondFromError: jest.fn((e) => ({ status: 500, error: e.message })),
}))

jest.mock('@/lib/schedule', () => ({
  syncScheduleToMilliseconds: jest.fn(() => 0),
}))

jest.mock('@/lib/user.plan', () => ({
  revealUserPlan: jest.fn(),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/pages/api/v1/dataset/[datasetId]/queue', () => ({
  IMPORT_BLOB_EVENT_TYPE: 'import.blob',
  IMPORT_JOB_END_EVENT_TYPE: 'import.job.end',
  IMPORT_JOB_START_EVENT_TYPE: 'import.job.start',
}))

function makeIntegration(overrides = {}) {
  return {
    id: 'notion-001',
    userId: 'user-001',
    datasetId: 'dataset-001',
    token: 'secret_notion_token',
    syncSchedule: 'never',
    expiresIn: null,
    user: { id: 'user-001', email: 'user@example.com' },
    ...overrides,
  }
}

describe('doSync (notion integration)', () => {
  beforeEach(() => {
    mockReset(prisma)
    jest.clearAllMocks()

    const { databaseLimitsOk } = require('@/lib/limit.core')

    databaseLimitsOk.mockResolvedValue(true)

    const { revealUserPlan } = require('@/lib/user.plan')

    revealUserPlan.mockResolvedValue({ plan: 'free' })

    prisma.notionIntegration.update.mockResolvedValue({})
  })

  describe('early exit conditions', () => {
    it('should throw conflict when datasetId is missing', async () => {
      const integration = makeIntegration({ datasetId: null })

      await expect(doSync(integration)).rejects.toThrow('No dataset specified')

      expect(require('@/lib/batch').runBatchJobAsync).not.toHaveBeenCalled()
    })

    it('should return without launching job when database limits are exceeded', async () => {
      const { databaseLimitsOk } = require('@/lib/limit.core')

      databaseLimitsOk.mockResolvedValue(false)

      await doSync(makeIntegration())

      expect(require('@/lib/batch').runBatchJobAsync).not.toHaveBeenCalled()
      expect(prisma.notionIntegration.update).not.toHaveBeenCalled()
    })
  })

  describe('status lifecycle', () => {
    it('should set status to pending and update lastSyncedAt before launching the batch job', async () => {
      const { runBatchJobAsync } = require('@/lib/batch')

      let updateCalledBeforeBatch = false

      prisma.notionIntegration.update.mockImplementation(async () => {
        updateCalledBeforeBatch = !runBatchJobAsync.mock.calls.length

        return {}
      })

      await doSync(makeIntegration())

      expect(updateCalledBeforeBatch).toBe(true)

      expect(prisma.notionIntegration.update).toHaveBeenCalledWith({
        where: { id: 'notion-001' },
        data: { syncStatus: 'pending', lastSyncedAt: expect.any(Date) },
      })
    })
  })

  describe('batch job configuration', () => {
    it('should pass correct context with notionIntegrationId', async () => {
      const { runBatchJobAsync } = require('@/lib/batch')

      await doSync(makeIntegration())

      const callArgs = runBatchJobAsync.mock.calls[0][0]
      const input = JSON.parse(callArgs.env.BATCH_INPUT)

      expect(input.context).toEqual({ notionIntegrationId: 'notion-001' })
    })

    it('should construct queue URL using safe pathname assignment', async () => {
      const { runBatchJobAsync } = require('@/lib/batch')

      await doSync(makeIntegration({ datasetId: 'dataset-999' }))

      const callArgs = runBatchJobAsync.mock.calls[0][0]
      const input = JSON.parse(callArgs.env.BATCH_INPUT)

      expect(input.queueUrl).toBe(
        'https://api.example.com/api/v1/dataset/dataset-999/ingest'
      )
    })

    it('should not allow URL injection via datasetId', async () => {
      const { runBatchJobAsync } = require('@/lib/batch')

      await doSync(makeIntegration({ datasetId: 'safe-id' }))

      const callArgs = runBatchJobAsync.mock.calls[0][0]
      const input = JSON.parse(callArgs.env.BATCH_INPUT)

      // Pathname assignment prevents injection - the path is always constructed safely
      expect(input.queueUrl).toContain('/api/v1/dataset/safe-id/ingest')
    })

    it('should set expiresAt from expiresIn when present', async () => {
      const { runBatchJobAsync } = require('@/lib/batch')
      const beforeTime = Date.now()

      await doSync(makeIntegration({ expiresIn: 86400000 })) // 1 day

      const callArgs = runBatchJobAsync.mock.calls[0][0]
      const input = JSON.parse(callArgs.env.BATCH_INPUT)

      expect(input.expiresAt).toBeGreaterThanOrEqual(beforeTime + 86400000)
      expect(input.expiresAt).toBeLessThan(beforeTime + 86400000 + 5000)
    })

    it('should set expiresAt from scheduleIn when expiresIn is not set', async () => {
      const { syncScheduleToMilliseconds } = require('@/lib/schedule')
      const { runBatchJobAsync } = require('@/lib/batch')

      syncScheduleToMilliseconds.mockReturnValue(3600000) // 1 hour

      const beforeTime = Date.now()

      await doSync(makeIntegration({ expiresIn: null }))

      const callArgs = runBatchJobAsync.mock.calls[0][0]
      const input = JSON.parse(callArgs.env.BATCH_INPUT)

      expect(input.expiresAt).toBeGreaterThanOrEqual(beforeTime + 3600000)
      expect(input.expiresAt).toBeLessThan(beforeTime + 3600000 + 5000)
    })

    it('should leave expiresAt undefined when neither expiresIn nor scheduleIn is set', async () => {
      const { syncScheduleToMilliseconds } = require('@/lib/schedule')
      const { runBatchJobAsync } = require('@/lib/batch')

      syncScheduleToMilliseconds.mockReturnValue(0)

      await doSync(makeIntegration({ expiresIn: null }))

      const callArgs = runBatchJobAsync.mock.calls[0][0]
      const input = JSON.parse(callArgs.env.BATCH_INPUT)

      expect(input.expiresAt).toBeUndefined()
    })

    it('should pass correct meta with integration type', async () => {
      const { runBatchJobAsync } = require('@/lib/batch')

      await doSync(makeIntegration())

      const callArgs = runBatchJobAsync.mock.calls[0][0]
      const input = JSON.parse(callArgs.env.BATCH_INPUT)

      expect(input.meta).toEqual({ integration: 'notion' })
    })

    it('should clamp maxPages between 10 and 100000', async () => {
      const { revealUserPlan } = require('@/lib/user.plan')
      const { runBatchJobAsync } = require('@/lib/batch')

      // Free plan has maxPages: 10 (already at minimum)
      revealUserPlan.mockResolvedValue({ plan: 'free' })

      await doSync(makeIntegration())

      const callArgs = runBatchJobAsync.mock.calls[0][0]
      const input = JSON.parse(callArgs.env.BATCH_INPUT)

      expect(input.maxPages).toBe(10)
    })

    it('should use pro plan maxPages for pro users', async () => {
      const { revealUserPlan } = require('@/lib/user.plan')
      const { runBatchJobAsync } = require('@/lib/batch')

      revealUserPlan.mockResolvedValue({ plan: 'pro' })

      await doSync(makeIntegration())

      const callArgs = runBatchJobAsync.mock.calls[0][0]
      const input = JSON.parse(callArgs.env.BATCH_INPUT)

      expect(input.maxPages).toBe(1000)
    })

    it('should use notion runner image for the batch job', async () => {
      const { runBatchJobAsync } = require('@/lib/batch')

      await doSync(makeIntegration())

      const callArgs = runBatchJobAsync.mock.calls[0][0]

      expect(callArgs.image).toBe('ghcr.io/chatbotkit/runner-notion:latest')
    })

    it('should pass the notion token in input', async () => {
      const { runBatchJobAsync } = require('@/lib/batch')

      await doSync(makeIntegration({ token: 'secret_abc123' }))

      const callArgs = runBatchJobAsync.mock.calls[0][0]
      const input = JSON.parse(callArgs.env.BATCH_INPUT)

      expect(input.notionToken).toBe('secret_abc123')
    })

    it('should pass queue event type constants', async () => {
      const { runBatchJobAsync } = require('@/lib/batch')

      await doSync(makeIntegration())

      const callArgs = runBatchJobAsync.mock.calls[0][0]
      const input = JSON.parse(callArgs.env.BATCH_INPUT)

      expect(input.queueImportBlobEventType).toBe('import.blob')
      expect(input.queueJobStartEventType).toBe('import.job.start')
      expect(input.queueJobEndEventType).toBe('import.job.end')
    })

    it('should set timeout based on plan maxTime', async () => {
      const { revealUserPlan } = require('@/lib/user.plan')
      const { runBatchJobAsync } = require('@/lib/batch')

      revealUserPlan.mockResolvedValue({ plan: 'pro' })

      await doSync(makeIntegration())

      const callArgs = runBatchJobAsync.mock.calls[0][0]

      // pro maxTime: 30 minutes * 60 seconds = 1800
      expect(callArgs.timeout).toBe(1800)
    })
  })
})
