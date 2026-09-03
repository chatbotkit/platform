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

jest.mock('@/lib/response', () => ({
  throwNotFound: jest.fn((msg) => {
    const err = new Error(msg)

    err.code = 404

    throw err
  }),
  throwNotAuthorized: jest.fn(() => {
    const err = new Error('Not authorized')

    err.code = 403

    throw err
  }),
}))

jest.mock('@/lib/yaml', () => ({
  stringify: jest.fn((data) => `yaml:${JSON.stringify(data)}`),
}))

const { throwNotFound, throwNotAuthorized } = require('@/lib/response')

describe('/api/v1/skillset/{skillsetId}/ability/export', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  const makeReq = (skillsetId = 'skillset_abc') =>
    Object.freeze({ query: { skillsetId } })

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
      linkedSecretId: null,
      linkedFileId: null,
      linkedBotId: null,
      linkedSpaceId: null,
      meta: { source: 'openapi' },
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
  ]

  beforeEach(() => {
    mockReset(prisma)
    jest.clearAllMocks()
  })

  describe('authorization', () => {
    it('should throw 404 when skillset is not found', async () => {
      prisma.skillset.findUniqueByIdentifier.mockResolvedValue(null)

      await expect(
        handler(null, makeReq(), null, mockSession)
      ).rejects.toMatchObject({ code: 404 })

      expect(throwNotFound).toHaveBeenCalledWith('Skillset not found')
    })

    it('should throw 403 when user does not own the skillset', async () => {
      prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
        ...mockSkillset,
        userId: 'other_user',
      })

      await expect(
        handler(null, makeReq(), null, mockSession)
      ).rejects.toMatchObject({ code: 403 })

      expect(throwNotAuthorized).toHaveBeenCalled()
    })

    it('should proceed when user owns the skillset', async () => {
      prisma.skillset.findUniqueByIdentifier.mockResolvedValue(mockSkillset)

      prisma.ability.findMany.mockResolvedValue(mockAbilities)

      const result = await handler(null, makeReq(), null, mockSession)

      expect(result.items).toHaveLength(1)
    })
  })

  describe('basic listing', () => {
    beforeEach(() => {
      prisma.skillset.findUniqueByIdentifier.mockResolvedValue(mockSkillset)
    })

    it('should return abilities for the given skillset', async () => {
      prisma.ability.findMany.mockResolvedValue(mockAbilities)

      const result = await handler(null, makeReq(), null, mockSession)

      expect(result.items).toHaveLength(1)
      expect(result.items[0].id).toBe('ability_1')
      expect(result.items[0].name).toBe('Fetch Weather')
    })

    it('should return empty items array when skillset has no abilities', async () => {
      prisma.ability.findMany.mockResolvedValue([])

      const result = await handler(null, makeReq(), null, mockSession)

      expect(result.items).toEqual([])
    })

    it('should query abilities filtered by the skillset id', async () => {
      prisma.ability.findMany.mockResolvedValue([])

      await handler(null, makeReq('skillset_xyz'), null, mockSession)

      const call = prisma.ability.findMany.mock.calls[0][0]

      expect(call.where.AND).toEqual(
        expect.arrayContaining([{ skillsetId: 'skillset_abc' }])
      )
    })
  })

  describe('meta proxy YAML conversion', () => {
    beforeEach(() => {
      prisma.skillset.findUniqueByIdentifier.mockResolvedValue(mockSkillset)
    })

    it('should include meta data in the result', async () => {
      prisma.ability.findMany.mockResolvedValue([
        { ...mockAbilities[0], meta: { source: 'openapi', version: '3.0' } },
      ])

      const result = await handler(null, makeReq(), null, mockSession)

      expect(result.items[0].meta).toBeDefined()
    })

    it('should provide a meta.toString() that serializes to YAML', async () => {
      const yaml = require('@/lib/yaml')

      prisma.ability.findMany.mockResolvedValue([
        { ...mockAbilities[0], meta: { key: 'value' } },
      ])

      const result = await handler(null, makeReq(), null, mockSession)

      const metaString = result.items[0].meta.toString()

      expect(yaml.stringify).toHaveBeenCalledWith({ key: 'value' })
      expect(metaString).toBe('yaml:{"key":"value"}')
    })

    it('should return yaml of empty object from meta.toString() when meta is null', async () => {
      const yaml = require('@/lib/yaml')

      prisma.ability.findMany.mockResolvedValue([
        { ...mockAbilities[0], meta: null },
      ])

      const result = await handler(null, makeReq(), null, mockSession)

      const metaString = result.items[0].meta.toString()

      // @note meta || {} converts null to {} so yaml.stringify gets called with {}
      expect(yaml.stringify).toHaveBeenCalledWith({})
      expect(metaString).toBe('yaml:{}')
    })

    it('should still allow accessing meta fields directly', async () => {
      prisma.ability.findMany.mockResolvedValue([
        { ...mockAbilities[0], meta: { source: 'openapi' } },
      ])

      const result = await handler(null, makeReq(), null, mockSession)

      expect(result.items[0].meta.source).toBe('openapi')
    })

    it('should use YAML stringify for meta with complex nested data', async () => {
      const yaml = require('@/lib/yaml')

      const complexMeta = {
        parameters: { apiKey: 'key123' },
        tags: ['weather', 'api'],
      }

      prisma.ability.findMany.mockResolvedValue([
        { ...mockAbilities[0], meta: complexMeta },
      ])

      await handler(null, makeReq(), null, mockSession)

      const result2 = await handler(null, makeReq(), null, mockSession)

      result2.items[0].meta.toString()

      expect(yaml.stringify).toHaveBeenLastCalledWith(complexMeta)
    })
  })

  describe('multiple abilities', () => {
    beforeEach(() => {
      prisma.skillset.findUniqueByIdentifier.mockResolvedValue(mockSkillset)
    })

    it('should return all abilities with their fields', async () => {
      const multipleAbilities = [
        ...mockAbilities,
        {
          id: 'ability_2',
          name: 'Post Data',
          description: 'Posts data to API',
          instruction: '```fetch\nmethod: POST\n```',
          skillsetId: 'skillset_abc',
          blueprintId: 'bp_123',
          linkedSecretId: 'secret_456',
          linkedFileId: null,
          linkedBotId: null,
          linkedSpaceId: null,
          meta: null,
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
      ]

      prisma.ability.findMany.mockResolvedValue(multipleAbilities)

      const result = await handler(null, makeReq(), null, mockSession)

      expect(result.items).toHaveLength(2)
      expect(result.items[1].blueprintId).toBe('bp_123')
      expect(result.items[1].linkedSecretId).toBe('secret_456')
    })
  })
})
