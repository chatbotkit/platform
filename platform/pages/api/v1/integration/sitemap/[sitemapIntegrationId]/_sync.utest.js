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
  Schedule: { never: 'never', daily: 'daily' },
  SyncStatus: { pending: 'pending' },
}))

jest.mock('@/config/limits', () => ({
  free: {
    sitemapIntegration: {
      maxUrls: 10,
      maxTime: 10,
      engines: ['cheerio'],
      memory: { cheerio: 512, puppeteer: 1024 },
    },
  },
  pro: {
    sitemapIntegration: {
      maxUrls: 1000,
      maxTime: 30,
      engines: ['cheerio', 'puppeteer'],
      memory: { cheerio: 512, puppeteer: 1024 },
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
    id: 'sitemap-001',
    userId: 'user-001',
    datasetId: 'dataset-001',
    url: 'https://example.com',
    glob: '',
    javascript: false,
    syncSchedule: 'never',
    selectors: null,
    expiresIn: null,
    user: { id: 'user-001', email: 'user@example.com' },
    ...overrides,
  }
}

describe('doSync (sitemap integration)', () => {
  beforeEach(() => {
    mockReset(prisma)
    jest.clearAllMocks()

    const { databaseLimitsOk } = require('@/lib/limit.core')

    databaseLimitsOk.mockResolvedValue(true)

    const { revealUserPlan } = require('@/lib/user.plan')

    revealUserPlan.mockResolvedValue({ plan: 'free' })

    prisma.sitemapIntegration.update.mockResolvedValue({})
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
      expect(prisma.sitemapIntegration.update).not.toHaveBeenCalled()
    })

    it('should disable schedule and return when url is missing', async () => {
      const integration = makeIntegration({ url: '' })

      await doSync(integration)

      expect(prisma.sitemapIntegration.update).toHaveBeenCalledWith({
        where: { id: 'sitemap-001' },
        data: { syncSchedule: 'never' },
      })

      expect(require('@/lib/batch').runBatchJobAsync).not.toHaveBeenCalled()
    })

    it('should disable schedule and throw when url is invalid', async () => {
      const integration = makeIntegration({ url: 'not-a-valid-url' })

      await expect(doSync(integration)).rejects.toThrow(
        'SitemapIntegration invalid url: not-a-valid-url'
      )

      expect(prisma.sitemapIntegration.update).toHaveBeenCalledWith({
        where: { id: 'sitemap-001' },
        data: { syncSchedule: 'never' },
      })

      expect(require('@/lib/batch').runBatchJobAsync).not.toHaveBeenCalled()
    })
  })

  describe('status lifecycle', () => {
    it('should set status to pending before launching the batch job', async () => {
      const { runBatchJobAsync } = require('@/lib/batch')

      let statusUpdatedBeforeLaunch = false

      prisma.sitemapIntegration.update.mockImplementation(async ({ data }) => {
        if (data.syncStatus === 'pending') {
          statusUpdatedBeforeLaunch = true
        }

        return {}
      })

      runBatchJobAsync.mockImplementation(async () => {
        expect(statusUpdatedBeforeLaunch).toBe(true)
      })

      await doSync(makeIntegration())

      expect(statusUpdatedBeforeLaunch).toBe(true)
      expect(runBatchJobAsync).toHaveBeenCalled()
    })

    it('should update lastSyncedAt when setting status to pending', async () => {
      const before = new Date()

      await doSync(makeIntegration())

      const call = prisma.sitemapIntegration.update.mock.calls.find(
        ([args]) => args?.data?.syncStatus === 'pending'
      )

      expect(call).toBeDefined()
      expect(call[0].data.lastSyncedAt).toBeInstanceOf(Date)
      expect(call[0].data.lastSyncedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime()
      )
    })
  })

  describe('glob processing', () => {
    it('should use default /** glob when no glob patterns are specified', async () => {
      const { runBatchJobAsync } = require('@/lib/batch')

      await doSync(makeIntegration({ glob: '' }))

      const input = runBatchJobAsync.mock.calls[0][0].env.BATCH_INPUT
      const parsed = JSON.parse(input)

      expect(parsed.globs).toEqual([{ glob: 'https://example.com/**' }])
    })

    it('should use default /** glob when glob is null', async () => {
      const { runBatchJobAsync } = require('@/lib/batch')

      await doSync(makeIntegration({ glob: null }))

      const input = runBatchJobAsync.mock.calls[0][0].env.BATCH_INPUT
      const parsed = JSON.parse(input)

      expect(parsed.globs).toEqual([{ glob: 'https://example.com/**' }])
    })

    it('should prefix glob patterns with the origin URL', async () => {
      const { runBatchJobAsync } = require('@/lib/batch')

      await doSync(makeIntegration({ glob: '/docs/**' }))

      const input = runBatchJobAsync.mock.calls[0][0].env.BATCH_INPUT
      const parsed = JSON.parse(input)

      expect(parsed.globs).toEqual([{ glob: 'https://example.com/docs/**' }])
    })

    it('should handle multiple glob patterns, one per line', async () => {
      const { runBatchJobAsync } = require('@/lib/batch')

      await doSync(makeIntegration({ glob: '/docs/**\n/blog/**' }))

      const input = runBatchJobAsync.mock.calls[0][0].env.BATCH_INPUT
      const parsed = JSON.parse(input)

      expect(parsed.globs).toEqual([
        { glob: 'https://example.com/docs/**' },
        { glob: 'https://example.com/blog/**' },
      ])
    })

    it('should preserve negation prefix on exclusion glob patterns', async () => {
      const { runBatchJobAsync } = require('@/lib/batch')

      await doSync(makeIntegration({ glob: '/docs/**\n!/docs/internal/**' }))

      const input = runBatchJobAsync.mock.calls[0][0].env.BATCH_INPUT
      const parsed = JSON.parse(input)

      expect(parsed.globs).toContainEqual({
        glob: 'https://example.com/docs/**',
      })
      expect(parsed.globs).toContainEqual({
        glob: '!https://example.com/docs/internal/**',
      })
    })

    it('should append default /** glob when all patterns are negations', async () => {
      const { runBatchJobAsync } = require('@/lib/batch')

      await doSync(makeIntegration({ glob: '!/admin/**\n!/private/**' }))

      const input = runBatchJobAsync.mock.calls[0][0].env.BATCH_INPUT
      const parsed = JSON.parse(input)

      // should include both negation globs plus the default catch-all
      expect(parsed.globs).toContainEqual({
        glob: '!https://example.com/admin/**',
      })
      expect(parsed.globs).toContainEqual({
        glob: '!https://example.com/private/**',
      })
      expect(parsed.globs).toContainEqual({ glob: 'https://example.com/**' })
    })

    it('should not add default glob when there is at least one positive pattern', async () => {
      const { runBatchJobAsync } = require('@/lib/batch')

      await doSync(makeIntegration({ glob: '/docs/**\n!/docs/internal/**' }))

      const input = runBatchJobAsync.mock.calls[0][0].env.BATCH_INPUT
      const parsed = JSON.parse(input)

      // only 2 patterns, no extra default glob added
      expect(parsed.globs).toHaveLength(2)
    })

    it('should trim whitespace from glob pattern lines', async () => {
      const { runBatchJobAsync } = require('@/lib/batch')

      await doSync(makeIntegration({ glob: '  /docs/**  \n  /blog/**  ' }))

      const input = runBatchJobAsync.mock.calls[0][0].env.BATCH_INPUT
      const parsed = JSON.parse(input)

      expect(parsed.globs).toEqual([
        { glob: 'https://example.com/docs/**' },
        { glob: 'https://example.com/blog/**' },
      ])
    })

    it('should skip empty lines in glob patterns', async () => {
      const { runBatchJobAsync } = require('@/lib/batch')

      await doSync(makeIntegration({ glob: '/docs/**\n\n/blog/**\n' }))

      const input = runBatchJobAsync.mock.calls[0][0].env.BATCH_INPUT
      const parsed = JSON.parse(input)

      expect(parsed.globs).toHaveLength(2)
    })
  })

  describe('engine selection', () => {
    it('should use cheerio engine when javascript flag is false', async () => {
      const { revealUserPlan } = require('@/lib/user.plan')

      revealUserPlan.mockResolvedValue({ plan: 'pro' })

      const { runBatchJobAsync } = require('@/lib/batch')

      await doSync(makeIntegration({ javascript: false }))

      const input = runBatchJobAsync.mock.calls[0][0].env.BATCH_INPUT
      const parsed = JSON.parse(input)

      expect(parsed.engine).toBe('cheerio')
    })

    it('should use cheerio engine when plan does not support puppeteer', async () => {
      const { revealUserPlan } = require('@/lib/user.plan')

      revealUserPlan.mockResolvedValue({ plan: 'free' })

      const { runBatchJobAsync } = require('@/lib/batch')

      await doSync(makeIntegration({ javascript: true }))

      const input = runBatchJobAsync.mock.calls[0][0].env.BATCH_INPUT
      const parsed = JSON.parse(input)

      // free plan only has cheerio so puppeteer preferred engine falls back
      expect(parsed.engine).toBe('cheerio')
    })

    it('should use puppeteer engine when javascript flag is true and plan supports it', async () => {
      const { revealUserPlan } = require('@/lib/user.plan')

      revealUserPlan.mockResolvedValue({ plan: 'pro' })

      const { runBatchJobAsync } = require('@/lib/batch')

      await doSync(makeIntegration({ javascript: true }))

      const input = runBatchJobAsync.mock.calls[0][0].env.BATCH_INPUT
      const parsed = JSON.parse(input)

      expect(parsed.engine).toBe('puppeteer')
    })
  })

  describe('batch job configuration', () => {
    it('should pass correct context with sitemapIntegrationId', async () => {
      const { runBatchJobAsync } = require('@/lib/batch')

      await doSync(makeIntegration({ id: 'sitemap-xyz' }))

      const input = runBatchJobAsync.mock.calls[0][0].env.BATCH_INPUT
      const parsed = JSON.parse(input)

      expect(parsed.context).toEqual({ sitemapIntegrationId: 'sitemap-xyz' })
    })

    it('should construct queue URL using safe pathname assignment', async () => {
      const { runBatchJobAsync } = require('@/lib/batch')

      await doSync(makeIntegration({ datasetId: 'dataset-safe' }))

      const input = runBatchJobAsync.mock.calls[0][0].env.BATCH_INPUT
      const parsed = JSON.parse(input)

      // must use the expected safe path format
      expect(parsed.queueUrl).toBe(
        'https://api.example.com/api/v1/dataset/dataset-safe/ingest'
      )
    })

    it('should set expiresAt from expiresIn when present', async () => {
      const { runBatchJobAsync } = require('@/lib/batch')
      const before = Date.now()

      const expiresIn = 3600000 // 1 hour

      await doSync(makeIntegration({ expiresIn }))

      const after = Date.now()
      const input = runBatchJobAsync.mock.calls[0][0].env.BATCH_INPUT
      const parsed = JSON.parse(input)

      expect(parsed.expiresAt).toBeGreaterThanOrEqual(before + expiresIn)
      expect(parsed.expiresAt).toBeLessThanOrEqual(after + expiresIn)
    })

    it('should set expiresAt from scheduleIn when expiresIn is not set', async () => {
      const { syncScheduleToMilliseconds } = require('@/lib/schedule')

      syncScheduleToMilliseconds.mockReturnValue(86400000) // 1 day

      const { runBatchJobAsync } = require('@/lib/batch')
      const before = Date.now()

      await doSync(makeIntegration({ expiresIn: null }))

      const after = Date.now()
      const input = runBatchJobAsync.mock.calls[0][0].env.BATCH_INPUT
      const parsed = JSON.parse(input)

      expect(parsed.expiresAt).toBeGreaterThanOrEqual(before + 86400000)
      expect(parsed.expiresAt).toBeLessThanOrEqual(after + 86400000)
    })

    it('should leave expiresAt undefined when neither expiresIn nor scheduleIn is set', async () => {
      const { syncScheduleToMilliseconds } = require('@/lib/schedule')

      syncScheduleToMilliseconds.mockReturnValue(0)

      const { runBatchJobAsync } = require('@/lib/batch')

      await doSync(makeIntegration({ expiresIn: null }))

      const input = runBatchJobAsync.mock.calls[0][0].env.BATCH_INPUT
      const parsed = JSON.parse(input)

      expect(parsed.expiresAt).toBeUndefined()
    })

    it('should pass correct meta with integration type', async () => {
      const { runBatchJobAsync } = require('@/lib/batch')

      await doSync(makeIntegration())

      const input = runBatchJobAsync.mock.calls[0][0].env.BATCH_INPUT
      const parsed = JSON.parse(input)

      expect(parsed.meta).toEqual({ integration: 'sitemap' })
    })

    it('should clamp maxUrls between 10 and 100000', async () => {
      const { runBatchJobAsync } = require('@/lib/batch')

      // free plan has maxUrls 10, clamp(10, 10, 100000) = 10
      await doSync(makeIntegration())

      const input = runBatchJobAsync.mock.calls[0][0].env.BATCH_INPUT
      const parsed = JSON.parse(input)

      expect(parsed.maxUrls).toBe(10)
    })

    it('should use sitemap image for the batch runner', async () => {
      const { runBatchJobAsync } = require('@/lib/batch')

      await doSync(makeIntegration())

      expect(runBatchJobAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          image: 'ghcr.io/chatbotkit/runner-sitemap:latest',
        })
      )
    })
  })
})
