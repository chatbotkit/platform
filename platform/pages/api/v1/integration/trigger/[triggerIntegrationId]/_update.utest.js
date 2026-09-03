import { mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler, { bodySchema } from './update'

/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('@/prisma/client', () => {
  const { mockDeep } = require('jest-mock-extended')

  return {
    __esModule: true,
    default: mockDeep(),
  }
})

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (schema, fn) => fn,
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404, body: { error: 'Not found' } }),
  notAuthorized: () => ({ status: 403, body: { error: 'Not authorized' } }),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/meta', () => {
  const actual = jest.requireActual('@/lib/meta')

  return {
    ...actual,
    getMeta: jest.fn(actual.getMeta),
  }
})

jest.mock('@/lib/task.schedule', () => ({
  getNext: jest.fn((schedule) => {
    if (schedule === '2020-01-01T00:00:00Z') {
      return new Date('2020-01-01T00:00:00Z')
    }

    if (schedule === 'hourly') {
      return new Date('2030-02-01T12:00:00Z')
    }

    if (schedule === 'daily') {
      return new Date('2030-02-02T00:00:00Z')
    }

    if (schedule === 'weekly') {
      return new Date('2030-02-08T00:00:00Z')
    }

    // cron: return a fixed date for testing
    return new Date('2030-02-01T10:00:00Z')
  }),
}))

/* eslint-disable @typescript-eslint/no-require-imports */
const { getNext } = require('@/lib/task.schedule')
const { getMeta } = require('@/lib/meta')

describe('/api/v1/integration/trigger/[triggerIntegrationId]/update', () => {
  const mockSession = {
    user: { id: 'user_789' },
  }

  const mockTriggerIntegration = {
    id: 'trigger_123',
    userId: 'user_789',
    name: 'Existing Trigger',
    description: 'Existing description',
    schedule: null,
    meta: {},
  }

  beforeEach(() => {
    mockReset(prisma)
  })

  describe('bodySchema validation', () => {
    it('should accept an interval schedule value', async () => {
      await expect(
        bodySchema.validateAsync({ schedule: 'daily' })
      ).resolves.toBeDefined()
    })

    it('should accept a cron expression in schedule', async () => {
      await expect(
        bodySchema.validateAsync({ schedule: '0 0 * * *' })
      ).resolves.toBeDefined()
    })

    it('should accept a quarterly cron expression', async () => {
      await expect(
        bodySchema.validateAsync({ schedule: '*/15 * * * *' })
      ).resolves.toBeDefined()
    })

    it('should accept null schedule', async () => {
      await expect(
        bodySchema.validateAsync({ schedule: null })
      ).resolves.toBeDefined()
    })

    it('should reject an invalid schedule string', async () => {
      await expect(
        bodySchema.validateAsync({ schedule: 'invalid-schedule' })
      ).rejects.toBeDefined()
    })

    it('should reject a non-schedule string', async () => {
      await expect(
        bodySchema.validateAsync({ schedule: 'once-a-day' })
      ).rejects.toBeDefined()
    })

    it('should accept a timezone', async () => {
      await expect(
        bodySchema.validateAsync({ timezone: 'America/New_York' })
      ).resolves.toBeDefined()
    })
  })

  describe('handler', () => {
    describe('authorization', () => {
      it('should return 404 when trigger integration not found', async () => {
        prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue(null)

        const req = { query: { triggerIntegrationId: 'trigger_999' } }
        const body = { name: 'Updated name' }

        const result = await handler(req, mockSession, body)

        expect(result.status).toBe(404)
      })

      it('should return 403 when user does not own the trigger integration', async () => {
        prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue({
          ...mockTriggerIntegration,
          userId: 'other_user',
        })

        const req = { query: { triggerIntegrationId: 'trigger_123' } }
        const body = { name: 'Updated name' }

        const result = await handler(req, mockSession, body)

        expect(result.status).toBe(403)
      })
    })

    describe('schedule handling', () => {
      it('should compute nextTriggerAt when updating with an interval schedule', async () => {
        prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue(
          mockTriggerIntegration
        )

        prisma.triggerIntegration.update.mockResolvedValue({})

        const req = { query: { triggerIntegrationId: 'trigger_123' } }
        const body = { schedule: 'daily' }

        const result = await handler(req, mockSession, body)

        expect(result.status).toBe(200)

        expect(prisma.triggerIntegration.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              schedule: 'daily',
              nextTriggerAt: new Date('2030-02-02T00:00:00Z'),
            }),
          })
        )
      })

      it('should use the existing timezone when schedule changes without timezone input', async () => {
        prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue({
          ...mockTriggerIntegration,
          schedule: 'hourly',
          timezone: 'America/New_York',
        })

        prisma.triggerIntegration.update.mockResolvedValue({})

        const req = { query: { triggerIntegrationId: 'trigger_123' } }
        const body = { schedule: 'daily' }

        const result = await handler(req, mockSession, body)

        expect(result.status).toBe(200)
        expect(getNext).toHaveBeenCalledWith('daily', {
          timezone: 'America/New_York',
        })
        expect(prisma.triggerIntegration.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              schedule: 'daily',
              timezone: undefined,
              nextTriggerAt: new Date('2030-02-02T00:00:00Z'),
            }),
          })
        )
      })

      it('should compute nextTriggerAt when updating with a cron schedule', async () => {
        prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue(
          mockTriggerIntegration
        )

        prisma.triggerIntegration.update.mockResolvedValue({})

        const req = { query: { triggerIntegrationId: 'trigger_123' } }
        const body = { schedule: '0 0 * * *' }

        const result = await handler(req, mockSession, body)

        expect(result.status).toBe(200)

        expect(prisma.triggerIntegration.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              schedule: '0 0 * * *',
              nextTriggerAt: expect.any(Date),
            }),
          })
        )
      })

      it('should set nextTriggerAt to null when clearing schedule', async () => {
        prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue({
          ...mockTriggerIntegration,
          schedule: 'daily',
        })

        prisma.triggerIntegration.update.mockResolvedValue({})

        const req = { query: { triggerIntegrationId: 'trigger_123' } }
        const body = { schedule: null }

        const result = await handler(req, mockSession, body)

        expect(result.status).toBe(200)

        expect(prisma.triggerIntegration.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              schedule: null,
              nextTriggerAt: null,
            }),
          })
        )
      })

      it('should normalize empty string schedule to null', async () => {
        prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue({
          ...mockTriggerIntegration,
          schedule: 'daily',
        })

        prisma.triggerIntegration.update.mockResolvedValue({})

        const req = { query: { triggerIntegrationId: 'trigger_123' } }
        const body = { schedule: '' }

        const result = await handler(req, mockSession, body)

        expect(result.status).toBe(200)

        expect(prisma.triggerIntegration.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              schedule: null,
              nextTriggerAt: null,
            }),
          })
        )
      })

      it('should NOT set nextTriggerAt when schedule is not provided', async () => {
        prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue(
          mockTriggerIntegration
        )

        prisma.triggerIntegration.update.mockResolvedValue({})

        const req = { query: { triggerIntegrationId: 'trigger_123' } }
        const body = { name: 'New Name' }

        const result = await handler(req, mockSession, body)

        expect(result.status).toBe(200)
        expect(prisma.triggerIntegration.update).toHaveBeenCalledWith({
          where: { id: 'trigger_123' },
          data: expect.not.objectContaining({
            nextTriggerAt: expect.anything(),
          }),
        })
      })

      it('should recalculate nextTriggerAt when timezone is provided without schedule', async () => {
        prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue({
          ...mockTriggerIntegration,
          schedule: '0 9 * * *',
          timezone: 'UTC',
        })

        prisma.triggerIntegration.update.mockResolvedValue({})

        const req = { query: { triggerIntegrationId: 'trigger_123' } }
        const body = { timezone: 'America/New_York' }

        const result = await handler(req, mockSession, body)

        expect(result.status).toBe(200)
        expect(getNext).toHaveBeenCalledWith('0 9 * * *', {
          timezone: 'America/New_York',
        })
        expect(prisma.triggerIntegration.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              timezone: 'America/New_York',
              nextTriggerAt: new Date('2030-02-01T10:00:00Z'),
            }),
          })
        )
      })

      it('should normalize empty string timezone to null and recalculate nextTriggerAt', async () => {
        prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue({
          ...mockTriggerIntegration,
          schedule: '0 9 * * *',
          timezone: 'UTC',
        })

        prisma.triggerIntegration.update.mockResolvedValue({})

        const req = { query: { triggerIntegrationId: 'trigger_123' } }
        const body = { timezone: '' }

        const result = await handler(req, mockSession, body)

        expect(result.status).toBe(200)
        expect(getNext).toHaveBeenCalledWith('0 9 * * *', {
          timezone: null,
        })
        expect(prisma.triggerIntegration.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              timezone: null,
              nextTriggerAt: new Date('2030-02-01T10:00:00Z'),
            }),
          })
        )
      })

      it('should clear nextTriggerAt when timezone changes but there is no existing schedule', async () => {
        prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue({
          ...mockTriggerIntegration,
          schedule: null,
          timezone: 'UTC',
        })

        prisma.triggerIntegration.update.mockResolvedValue({})

        const req = { query: { triggerIntegrationId: 'trigger_123' } }
        const body = { timezone: 'America/New_York' }

        const result = await handler(req, mockSession, body)

        expect(result.status).toBe(200)
        expect(getNext).not.toHaveBeenCalled()
        expect(prisma.triggerIntegration.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              timezone: 'America/New_York',
              nextTriggerAt: null,
            }),
          })
        )
      })

      it('should clear nextTriggerAt when getNext returns a past date', async () => {
        prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue(
          mockTriggerIntegration
        )

        prisma.triggerIntegration.update.mockResolvedValue({})

        const req = { query: { triggerIntegrationId: 'trigger_123' } }
        const body = { schedule: '2020-01-01T00:00:00Z' }

        const result = await handler(req, mockSession, body)

        expect(result.status).toBe(200)
        expect(prisma.triggerIntegration.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              schedule: '2020-01-01T00:00:00Z',
              nextTriggerAt: null,
            }),
          })
        )
      })
    })

    describe('basic update', () => {
      it('should update trigger integration with all fields', async () => {
        prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue(
          mockTriggerIntegration
        )

        prisma.triggerIntegration.update.mockResolvedValue({})

        const req = { query: { triggerIntegrationId: 'trigger_123' } }
        const body = {
          name: 'Updated Name',
          description: 'Updated description',
          authenticate: false,
          schedule: 'weekly',
          sessionDuration: 7200000,
        }

        const result = await handler(req, mockSession, body)

        expect(result.status).toBe(200)
        expect(result.body.id).toBe('trigger_123')
      })

      it('should accept string blueprint and bot references', async () => {
        prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue(
          mockTriggerIntegration
        )

        prisma.triggerIntegration.update.mockResolvedValue({})

        const req = { query: { triggerIntegrationId: 'trigger_123' } }
        const body = {
          blueprintId: 'blueprint_456',
          botId: 'bot_789',
        }

        await handler(req, mockSession, body)

        expect(prisma.triggerIntegration.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              blueprintId: 'blueprint_456',
              botId: 'bot_789',
            }),
          })
        )
      })

      it('should merge meta updates with existing metadata', async () => {
        prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue({
          ...mockTriggerIntegration,
          meta: { existing: true },
        })

        prisma.triggerIntegration.update.mockResolvedValue({})

        const req = { query: { triggerIntegrationId: 'trigger_123' } }
        const body = {
          meta: {
            $update: {
              added: 'value',
            },
          },
        }

        await handler(req, mockSession, body)

        expect(getMeta).toHaveBeenCalledWith(body.meta, { existing: true })
        expect(prisma.triggerIntegration.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              meta: { existing: true, added: 'value' },
            }),
          })
        )
      })

      it('should return the id of the updated trigger integration', async () => {
        prisma.triggerIntegration.findUniqueByIdentifier.mockResolvedValue(
          mockTriggerIntegration
        )

        prisma.triggerIntegration.update.mockResolvedValue({})

        const req = { query: { triggerIntegrationId: 'trigger_123' } }
        const body = { name: 'New name' }

        const result = await handler(req, mockSession, body)

        expect(result.body.id).toBe('trigger_123')
      })
    })
  })
})
