/**
 * @jest-environment node
 */
import { createBlueprintBulletin } from '@/lib/blueprint.bulletin'

import prisma from '@/prisma/client'

import handler from './create'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    blueprint: {
      findUniqueByIdentifier: jest.fn(),
    },
  },
}))

jest.mock('@/lib/blueprint.bulletin', () => ({
  createBlueprintBulletin: jest.fn(),
  BULLETIN_MAX_TEXT_LENGTH: 4000,
  BULLETIN_MIN_TTL_SECONDS: 1,
  BULLETIN_MAX_TTL_SECONDS: 86400,
}))

jest.mock('@/lib/joi.handler', () => {
  const chain = () => {
    const c = {}

    for (const method of [
      'object',
      'string',
      'number',
      'integer',
      'min',
      'max',
      'required',
      'optional',
    ]) {
      c[method] = jest.fn(() => c)
    }

    return c
  }

  return {
    __esModule: true,
    default: chain(),
    // @note pass the validated body straight through to the handler
    withSchema: (_schema, fn) => fn,
  }
})

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, key) => req.query[key]),
}))

jest.mock('@/lib/response', () => ({
  ok: (body) => ({ status: 200, body }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

describe('POST /api/v1/blueprint/[blueprintId]/bulletin/create', () => {
  const session = { user: { id: 'user-1' } }
  const req = { query: { blueprintId: 'bpt-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when the blueprint does not exist', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session, { text: 'hello' })

    expect(result).toEqual({ status: 404 })
    expect(createBlueprintBulletin).not.toHaveBeenCalled()
  })

  it('returns 401 when the blueprint belongs to another user', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue({
      id: 'bpt-1',
      userId: 'user-2',
    })

    const result = await handler(req, session, { text: 'hello' })

    expect(result).toEqual({ status: 401 })
    expect(createBlueprintBulletin).not.toHaveBeenCalled()
  })

  it('creates a bulletin and returns the blueprint id and bulletin', async () => {
    const bulletin = {
      id: 'b-1',
      text: 'hello',
      createdAt: 1,
      expiresAt: 2,
    }

    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue({
      id: 'bpt-1',
      userId: 'user-1',
    })
    createBlueprintBulletin.mockResolvedValue(bulletin)

    const result = await handler(req, session, { text: 'hello', ttl: 120 })

    expect(result.status).toBe(200)
    expect(result.body).toEqual({ id: 'bpt-1', bulletin })
    expect(createBlueprintBulletin).toHaveBeenCalledWith('bpt-1', {
      text: 'hello',
      ttl: 120,
    })
  })
})
