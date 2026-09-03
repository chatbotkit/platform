/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from './list'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/stream', () => ({
  withStreamCursor: (fn) => (cursor, req, stream, session) =>
    fn(cursor, req, stream, session),
}))

jest.mock('@/lib/filter', () => ({
  getMetaQueryFilter: jest.fn(() => []),
  getBlueprintIdQueryFilter: jest.fn(() => []),
  getCursorConstraints: jest.fn(() => ({})),
  getTakeConstraints: jest.fn(() => ({})),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

const {
  getMetaQueryFilter,
  getBlueprintIdQueryFilter,
  getCursorConstraints,
  getTakeConstraints,
} = require('@/lib/filter')

const { makeJsonSafe } = require('@/lib/struct')

describe('GET /api/v1/integration/extract/list', () => {
  const mockSession = {
    user: {
      id: 'user-123',
    },
  }

  beforeEach(() => {
    mockReset(prisma)
    getMetaQueryFilter.mockReturnValue([])
    getBlueprintIdQueryFilter.mockReturnValue([])
    getCursorConstraints.mockReturnValue({})
    getTakeConstraints.mockReturnValue({})
    makeJsonSafe.mockImplementation((data) => data)
  })

  it('returns extract integrations for the authenticated user', async () => {
    const mockRows = [
      {
        id: 'ext-1',
        name: 'Extract A',
        description: 'A',
        blueprintId: 'bp-1',
        botId: 'bot-1',
        schema: { fields: ['title'] },
        request: 'https://example.com/hook',
        meta: {},
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-02'),
      },
    ]

    prisma.extractIntegration.findMany.mockResolvedValue(mockRows)

    const result = await handler(null, {}, null, mockSession)

    expect(result).toEqual({ items: mockRows })
    expect(prisma.extractIntegration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [{ userId: 'user-123' }],
        },
      })
    )
  })

  it('applies meta, blueprint, cursor, and take filters', async () => {
    getMetaQueryFilter.mockReturnValue([{ 'meta.env': 'prod' }])
    getBlueprintIdQueryFilter.mockReturnValue([{ blueprintId: 'bp-2' }])
    getCursorConstraints.mockReturnValue({ cursor: { id: 'ext-10' }, skip: 1 })
    getTakeConstraints.mockReturnValue({ take: 25 })
    prisma.extractIntegration.findMany.mockResolvedValue([])

    await handler('ext-10', { query: { take: '25' } }, null, mockSession)

    expect(prisma.extractIntegration.findMany).toHaveBeenCalledWith({
      where: {
        AND: [
          { userId: 'user-123' },
          { 'meta.env': 'prod' },
          { blueprintId: 'bp-2' },
        ],
      },
      cursor: { id: 'ext-10' },
      skip: 1,
      take: 25,
      select: expect.any(Object),
    })
  })

  it('converts result with makeJsonSafe', async () => {
    const raw = [{ id: 'ext-raw', createdAt: new Date('2025-01-01') }]
    const safe = [{ id: 'ext-raw', createdAt: '2025-01-01T00:00:00.000Z' }]

    prisma.extractIntegration.findMany.mockResolvedValue(raw)
    makeJsonSafe.mockReturnValue(safe)

    const result = await handler(null, {}, null, mockSession)

    expect(makeJsonSafe).toHaveBeenCalledWith(raw)
    expect(result.items).toEqual(safe)
  })

  it('propagates prisma errors', async () => {
    prisma.extractIntegration.findMany.mockRejectedValue(new Error('db failed'))

    await expect(handler(null, {}, null, mockSession)).rejects.toThrow(
      'db failed'
    )
  })
})
