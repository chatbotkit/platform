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
  getBlueprintIdQueryFilter: jest.fn(() => []),
  getCursorConstraints: jest.fn(() => ({})),
  getMetaQueryFilter: jest.fn(() => []),
  getTakeConstraints: jest.fn(() => ({})),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

const {
  getBlueprintIdQueryFilter,
  getCursorConstraints,
  getMetaQueryFilter,
  getTakeConstraints,
} = require('@/lib/filter')

describe('/api/v1/ability/list', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  const mockReq = {
    query: {},
  }

  beforeEach(() => {
    mockReset(prisma)
    getBlueprintIdQueryFilter.mockReturnValue([])
    getCursorConstraints.mockReturnValue({})
    getMetaQueryFilter.mockReturnValue([])
    getTakeConstraints.mockReturnValue({})
  })

  describe('basic functionality', () => {
    it('should list abilities for authenticated user', async () => {
      const now1 = Date.now()
      const now2 = Date.now() + 1000
      const now3 = Date.now() + 2000
      const now4 = Date.now() + 3000

      const mockAbilities = [
        {
          id: 'ability_1',
          name: 'Test Ability 1',
          description: 'First test ability',
          blueprintId: 'blueprint_1',
          skillsetId: 'skillset_1',
          linkedSecretId: null,
          linkedFileId: null,
          linkedBotId: null,
          linkedSpaceId: null,
          instruction: 'Do something',
          meta: {},
          createdAt: new Date(now1),
          updatedAt: new Date(now2),
        },
        {
          id: 'ability_2',
          name: 'Test Ability 2',
          description: 'Second test ability',
          blueprintId: null,
          skillsetId: 'skillset_2',
          linkedSecretId: 'secret_1',
          linkedFileId: 'file_1',
          linkedBotId: 'bot_1',
          linkedSpaceId: null,
          instruction: 'Do something else',
          meta: { custom: 'data' },
          createdAt: new Date(now3),
          updatedAt: new Date(now4),
        },
      ]

      prisma.ability.findMany.mockResolvedValue(mockAbilities)

      const result = await handler(null, mockReq, null, mockSession)

      expect(prisma.ability.findMany).toHaveBeenCalledWith({
        where: {
          AND: [{ userId: 'user_123' }],
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
          state: true,
          meta: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      expect(result).toEqual({
        items: mockAbilities,
      })
    })

    it('should return empty array when user has no abilities', async () => {
      prisma.ability.findMany.mockResolvedValue([])

      const result = await handler(null, mockReq, null, mockSession)

      expect(result).toEqual({
        items: [],
      })
    })
  })

  describe('filtering', () => {
    it('should apply meta query filters', async () => {
      const { getMetaQueryFilter } = require('@/lib/filter')

      getMetaQueryFilter.mockReturnValue([{ meta: { path: 'value' } }])

      prisma.ability.findMany.mockResolvedValue([])

      await handler(null, mockReq, null, mockSession)

      expect(getMetaQueryFilter).toHaveBeenCalledWith(mockReq)
      expect(prisma.ability.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([{ meta: { path: 'value' } }]),
          }),
        })
      )
    })

    it('should apply blueprint ID filters', async () => {
      const { getBlueprintIdQueryFilter } = require('@/lib/filter')

      getBlueprintIdQueryFilter.mockReturnValue([
        { blueprintId: 'blueprint_123' },
      ])

      prisma.ability.findMany.mockResolvedValue([])

      await handler(null, mockReq, null, mockSession)

      expect(getBlueprintIdQueryFilter).toHaveBeenCalledWith(mockReq)
      expect(prisma.ability.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([{ blueprintId: 'blueprint_123' }]),
          }),
        })
      )
    })
  })

  describe('pagination', () => {
    it('should apply cursor constraints', async () => {
      const { getCursorConstraints } = require('@/lib/filter')
      const mockCursor = 'cursor_abc'

      getCursorConstraints.mockReturnValue({
        cursor: { id: mockCursor },
        skip: 1,
      })

      prisma.ability.findMany.mockResolvedValue([])

      await handler(mockCursor, mockReq, null, mockSession)

      expect(getCursorConstraints).toHaveBeenCalledWith(mockReq, mockCursor)
      expect(prisma.ability.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: mockCursor },
          skip: 1,
        })
      )
    })

    it('should apply take constraints', async () => {
      const { getTakeConstraints } = require('@/lib/filter')

      getTakeConstraints.mockReturnValue({ take: 10 })

      prisma.ability.findMany.mockResolvedValue([])

      await handler(null, mockReq, null, mockSession)

      expect(getTakeConstraints).toHaveBeenCalledWith(mockReq)
      expect(prisma.ability.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      )
    })
  })

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      prisma.ability.findMany.mockRejectedValue(
        new Error('Database connection failed')
      )

      await expect(handler(null, mockReq, null, mockSession)).rejects.toThrow(
        'Database connection failed'
      )
    })
  })

  describe('data transformation', () => {
    it('should handle abilities with null optional fields', async () => {
      const now = Date.now()
      const mockAbility = {
        id: 'ability_1',
        name: 'Minimal Ability',
        description: '',
        blueprintId: null,
        skillsetId: null,
        linkedSecretId: null,
        linkedFileId: null,
        linkedBotId: null,
        linkedSpaceId: null,
        instruction: '',
        meta: null,
        createdAt: new Date(now),
        updatedAt: new Date(now),
      }

      prisma.ability.findMany.mockResolvedValue([mockAbility])

      const result = await handler(null, mockReq, null, mockSession)

      expect(result.items).toHaveLength(1)
      expect(result.items[0]).toEqual(mockAbility)
    })

    it('should handle abilities with all optional fields populated', async () => {
      const now = Date.now()
      const mockAbility = {
        id: 'ability_1',
        name: 'Full Ability',
        description: 'Fully populated',
        blueprintId: 'blueprint_1',
        skillsetId: 'skillset_1',
        linkedSecretId: 'secret_1',
        linkedFileId: 'file_1',
        linkedBotId: 'bot_1',
        linkedSpaceId: 'space_1',
        instruction: 'Complex instruction',
        meta: { key1: 'value1', key2: 'value2' },
        createdAt: new Date(now),
        updatedAt: new Date(now),
      }

      prisma.ability.findMany.mockResolvedValue([mockAbility])

      const result = await handler(null, mockReq, null, mockSession)

      expect(result.items).toHaveLength(1)
      expect(result.items[0]).toEqual(mockAbility)
    })
  })
})
