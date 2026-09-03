/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from './export'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: mockDeep(),
  }),
  { virtual: true }
)

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
  getBlueprintIdQueryFilter: jest.fn(() => []),
  getCursorConstraints: jest.fn(() => ({})),
  getMetaQueryFilter: jest.fn(() => []),
  getTakeConstraints: jest.fn(() => ({})),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

jest.mock('@/lib/yaml', () => ({
  stringify: jest.fn((value) => JSON.stringify(value)),
}))

const {
  getBlueprintIdQueryFilter,
  getCursorConstraints,
  getMetaQueryFilter,
  getTakeConstraints,
} = require('@/lib/filter')

const yaml = require('@/lib/yaml')

describe('/api/v1/ability/export', () => {
  const session = { user: { id: 'user_1' } }
  const req = { query: {} }

  beforeEach(() => {
    mockReset(prisma)
    jest.clearAllMocks()
    getBlueprintIdQueryFilter.mockReturnValue([])
    getCursorConstraints.mockReturnValue({})
    getMetaQueryFilter.mockReturnValue([])
    getTakeConstraints.mockReturnValue({})
  })

  it('returns exported abilities for the authenticated user', async () => {
    prisma.ability.findMany.mockResolvedValue([
      {
        id: 'ability_1',
        name: 'A1',
        description: '',
        blueprintId: null,
        skillsetId: null,
        linkedSecretId: null,
        linkedFileId: null,
        linkedBotId: null,
        linkedSpaceId: null,
        instruction: 'I1',
        meta: { key: 'value' },
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ])

    const result = await handler(null, req, null, session)

    expect(prisma.ability.findMany).toHaveBeenCalledWith({
      where: {
        AND: [{ userId: 'user_1' }],
      },
      select: {
        id: true,
        alias: true,
        name: true,
        description: true,
        blueprintId: true,
        skillsetId: true,
        linkedSecretId: true,
        linkedFileId: true,
        linkedBotId: true,
        linkedSpaceId: true,
        instruction: true,
        meta: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    expect(result.items).toHaveLength(1)
    expect(result.items[0].id).toBe('ability_1')
  })

  it('applies meta, blueprint, cursor and take constraints', async () => {
    getMetaQueryFilter.mockReturnValue([{ meta: { path: ['k'], equals: 'v' } }])
    getBlueprintIdQueryFilter.mockReturnValue([{ blueprintId: 'bp_1' }])
    getCursorConstraints.mockReturnValue({
      cursor: { id: 'ability_0' },
      skip: 1,
    })
    getTakeConstraints.mockReturnValue({ take: 25 })
    prisma.ability.findMany.mockResolvedValue([])

    await handler('ability_0', req, null, session)

    expect(prisma.ability.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { userId: 'user_1' },
            { meta: { path: ['k'], equals: 'v' } },
            { blueprintId: 'bp_1' },
          ],
        },
        cursor: { id: 'ability_0' },
        skip: 1,
        take: 25,
      })
    )
  })

  it('exposes meta proxy with toString conversion and property access', async () => {
    prisma.ability.findMany.mockResolvedValue([
      {
        id: 'ability_1',
        name: 'A1',
        description: '',
        blueprintId: null,
        skillsetId: null,
        linkedSecretId: null,
        linkedFileId: null,
        linkedBotId: null,
        linkedSpaceId: null,
        instruction: 'I1',
        meta: { nested: { enabled: true } },
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ])
    yaml.stringify.mockReturnValue('nested:\n  enabled: true\n')

    const result = await handler(null, req, null, session)

    expect(result.items[0].meta.nested).toEqual({ enabled: true })
    expect(result.items[0].meta.toString()).toBe('nested:\n  enabled: true\n')
    expect(yaml.stringify).toHaveBeenCalledWith({ nested: { enabled: true } })
  })
})
