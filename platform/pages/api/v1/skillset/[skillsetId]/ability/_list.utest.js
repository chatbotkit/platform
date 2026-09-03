/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from './list'

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
  getMetaQueryFilter: jest.fn(() => []),
  getBlueprintIdQueryFilter: jest.fn(() => []),
  getCursorConstraints: jest.fn(() => ({})),
  getTakeConstraints: jest.fn(() => ({})),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, name) => req.query[name]),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: (data) => data,
}))

const {
  getMetaQueryFilter,
  getBlueprintIdQueryFilter,
  getCursorConstraints,
  getTakeConstraints,
} = require('@/lib/filter')

describe('/api/v1/skillset/{skillsetId}/ability/list', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  const mockSkillset = {
    id: 'skillset_abc',
    userId: 'user_123',
    name: 'My Skillset',
  }

  const mockAbilities = [
    {
      id: 'ability_1',
      name: 'Fetch Weather',
      description: 'Gets weather data',
      instruction: '```fetch\nurl: https://api.weather.com\n```',
      skillsetId: 'skillset_abc',
      blueprintId: null,
      linkedSecretId: 'secret_xyz',
      linkedFileId: null,
      linkedBotId: null,
      linkedSpaceId: null,
      meta: {},
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    },
    {
      id: 'ability_2',
      name: 'Send Slack Message',
      description: 'Posts to Slack',
      instruction: '```fetch\nurl: https://slack.com/api/chat.postMessage\n```',
      skillsetId: 'skillset_abc',
      blueprintId: 'bp_1',
      linkedSecretId: 'secret_slack',
      linkedFileId: null,
      linkedBotId: null,
      linkedSpaceId: null,
      meta: {},
      createdAt: new Date('2026-01-02'),
      updatedAt: new Date('2026-01-02'),
    },
  ]

  beforeEach(() => {
    mockReset(prisma)
    getMetaQueryFilter.mockReturnValue([])
    getBlueprintIdQueryFilter.mockReturnValue([])
    getCursorConstraints.mockReturnValue({})
    getTakeConstraints.mockReturnValue({})
  })

  describe('successful listing', () => {
    it('should list abilities for a valid skillset owned by the user', async () => {
      prisma.skillset.findUniqueByIdentifier.mockResolvedValue(mockSkillset)
      prisma.ability.findMany.mockResolvedValue(mockAbilities)

      const result = await handler(
        null,
        { query: { skillsetId: 'skillset_abc' } },
        null,
        mockSession
      )

      expect(result.items).toHaveLength(2)
      expect(result.items[0].id).toBe('ability_1')
      expect(result.items[1].id).toBe('ability_2')
    })

    it('should query abilities filtered by skillset id', async () => {
      prisma.skillset.findUniqueByIdentifier.mockResolvedValue(mockSkillset)
      prisma.ability.findMany.mockResolvedValue(mockAbilities)

      await handler(
        null,
        { query: { skillsetId: 'skillset_abc' } },
        null,
        mockSession
      )

      expect(prisma.ability.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [{ skillsetId: 'skillset_abc' }],
          },
        })
      )
    })

    it('should return empty items array when skillset has no abilities', async () => {
      prisma.skillset.findUniqueByIdentifier.mockResolvedValue(mockSkillset)
      prisma.ability.findMany.mockResolvedValue([])

      const result = await handler(
        null,
        { query: { skillsetId: 'skillset_abc' } },
        null,
        mockSession
      )

      expect(result.items).toHaveLength(0)
    })

    it('should look up skillset using user and skillset id from request', async () => {
      prisma.skillset.findUniqueByIdentifier.mockResolvedValue(mockSkillset)
      prisma.ability.findMany.mockResolvedValue([])

      await handler(
        null,
        { query: { skillsetId: 'skillset_abc' } },
        null,
        mockSession
      )

      expect(prisma.skillset.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'skillset_abc'
      )
    })
  })

  describe('authorization', () => {
    it('should throw not found when skillset does not exist', async () => {
      prisma.skillset.findUniqueByIdentifier.mockResolvedValue(null)

      await expect(
        handler(
          null,
          { query: { skillsetId: 'missing_id' } },
          null,
          mockSession
        )
      ).rejects.toThrow()

      expect(prisma.ability.findMany).not.toHaveBeenCalled()
    })

    it('should throw not authorized when skillset belongs to another user', async () => {
      prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
        ...mockSkillset,
        userId: 'other_user',
      })

      await expect(
        handler(
          null,
          { query: { skillsetId: 'skillset_abc' } },
          null,
          mockSession
        )
      ).rejects.toThrow()

      expect(prisma.ability.findMany).not.toHaveBeenCalled()
    })
  })

  describe('filters and pagination', () => {
    it('should apply meta query filters', async () => {
      getMetaQueryFilter.mockReturnValue([
        { meta: { path: ['type'], equals: 'fetch' } },
      ])
      prisma.skillset.findUniqueByIdentifier.mockResolvedValue(mockSkillset)
      prisma.ability.findMany.mockResolvedValue([mockAbilities[0]])

      await handler(
        null,
        { query: { skillsetId: 'skillset_abc' } },
        null,
        mockSession
      )

      expect(prisma.ability.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { skillsetId: 'skillset_abc' },
              { meta: { path: ['type'], equals: 'fetch' } },
            ],
          },
        })
      )
    })

    it('should apply blueprint id filter', async () => {
      getBlueprintIdQueryFilter.mockReturnValue([{ blueprintId: 'bp_1' }])
      prisma.skillset.findUniqueByIdentifier.mockResolvedValue(mockSkillset)
      prisma.ability.findMany.mockResolvedValue([mockAbilities[1]])

      await handler(
        null,
        { query: { skillsetId: 'skillset_abc', blueprintId: 'bp_1' } },
        null,
        mockSession
      )

      expect(prisma.ability.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [{ skillsetId: 'skillset_abc' }, { blueprintId: 'bp_1' }],
          },
        })
      )
    })

    it('should apply cursor-based pagination constraints', async () => {
      getCursorConstraints.mockReturnValue({
        cursor: { id: 'ability_1' },
        skip: 1,
      })
      getTakeConstraints.mockReturnValue({ take: 20 })
      prisma.skillset.findUniqueByIdentifier.mockResolvedValue(mockSkillset)
      prisma.ability.findMany.mockResolvedValue([mockAbilities[1]])

      await handler(
        'ability_1',
        { query: { skillsetId: 'skillset_abc', take: '20' } },
        null,
        mockSession
      )

      expect(prisma.ability.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'ability_1' },
          skip: 1,
          take: 20,
        })
      )
    })
  })

  describe('error handling', () => {
    it('should propagate database errors from skillset lookup', async () => {
      prisma.skillset.findUniqueByIdentifier.mockRejectedValue(
        new Error('DB connection failed')
      )

      await expect(
        handler(
          null,
          { query: { skillsetId: 'skillset_abc' } },
          null,
          mockSession
        )
      ).rejects.toThrow('DB connection failed')
    })

    it('should propagate database errors from ability query', async () => {
      prisma.skillset.findUniqueByIdentifier.mockResolvedValue(mockSkillset)
      prisma.ability.findMany.mockRejectedValue(new Error('Query timeout'))

      await expect(
        handler(
          null,
          { query: { skillsetId: 'skillset_abc' } },
          null,
          mockSession
        )
      ).rejects.toThrow('Query timeout')
    })
  })
})
