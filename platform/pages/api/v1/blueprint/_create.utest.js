/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler, { bodySchema } from './create'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/prisma/types', () => ({
  BlueprintVisibility: {
    private: 'private',
    public: 'public',
    unlisted: 'unlisted',
  },
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => {
  const createChainableMock = () => {
    const mock = {
      required: () => mock,
      optional: () => mock,
      allow: () => mock,
      valid: () => mock,
      min: () => mock,
      max: () => mock,
      describe: () => ({ keys: {} }),
    }

    return mock
  }

  const mockSchema = {
    object: (fields) => ({
      ...createChainableMock(),
      describe: () => ({ keys: fields || {} }),
    }),
    string: () => createChainableMock(),
    number: () => createChainableMock(),
    boolean: () => createChainableMock(),
    array: () => createChainableMock(),
  }

  return {
    __esModule: true,
    default: mockSchema,
    withSchema: (_schema, fn) => fn,
  }
})

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
}))

jest.mock('@/schemas/alias', () => ({}))
jest.mock('@/schemas/blueprintConfig', () => ({}))
jest.mock('@/schemas/description', () => ({}))
jest.mock('@/schemas/meta', () => ({}))
jest.mock('@/schemas/name', () => ({}))

// -------------------------------------------------------
// Test state
// -------------------------------------------------------

describe('/api/v1/blueprint/create', () => {
  const mockSession = {
    user: {
      id: 'user_abc123',
    },
  }

  beforeEach(() => {
    mockReset(prisma)
  })

  // -------------------------------------------------------
  // bodySchema
  // -------------------------------------------------------

  describe('bodySchema', () => {
    it('should be defined and exported', () => {
      expect(bodySchema).toBeDefined()
    })
  })

  // -------------------------------------------------------
  // Basic functionality
  // -------------------------------------------------------

  describe('basic functionality', () => {
    it('should create blueprint with minimal fields', async () => {
      const mockBlueprint = { id: 'bpt_abc123' }

      prisma.blueprint.create.mockResolvedValue(mockBlueprint)

      const result = await handler(null, mockSession, { name: 'My Blueprint' })

      expect(prisma.blueprint.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'user_abc123' }),
          select: { id: true },
        })
      )
      expect(result).toEqual({ status: 200, body: { id: 'bpt_abc123' } })
    })

    it('should set the userId from the session on the created record', async () => {
      prisma.blueprint.create.mockResolvedValue({ id: 'bpt_xyz' })

      await handler(null, { user: { id: 'user_xyz999' } }, {})

      expect(prisma.blueprint.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'user_xyz999' }),
        })
      )
    })

    it('should only select the id field in the create response', async () => {
      prisma.blueprint.create.mockResolvedValue({ id: 'bpt_selectid' })

      await handler(null, mockSession, {})

      expect(prisma.blueprint.create).toHaveBeenCalledWith(
        expect.objectContaining({ select: { id: true } })
      )
    })

    it('should return the created blueprint id wrapped in ok', async () => {
      prisma.blueprint.create.mockResolvedValue({ id: 'bpt_returned' })

      const result = await handler(null, mockSession, {})

      expect(result.body.id).toBe('bpt_returned')
    })
  })

  // -------------------------------------------------------
  // Data fields
  // -------------------------------------------------------

  describe('data fields', () => {
    it('should pass name from body to prisma', async () => {
      prisma.blueprint.create.mockResolvedValue({ id: 'bpt_1' })

      await handler(null, mockSession, { name: 'Test Blueprint' })

      expect(prisma.blueprint.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'Test Blueprint' }),
        })
      )
    })

    it('should pass visibility from body to prisma', async () => {
      prisma.blueprint.create.mockResolvedValue({ id: 'bpt_2' })

      await handler(null, mockSession, { visibility: 'public' })

      expect(prisma.blueprint.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ visibility: 'public' }),
        })
      )
    })

    it('should pass alias from body to prisma', async () => {
      prisma.blueprint.create.mockResolvedValue({ id: 'bpt_3' })

      await handler(null, mockSession, { alias: 'my-alias' })

      expect(prisma.blueprint.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ alias: 'my-alias' }),
        })
      )
    })

    it('should pass config from body to prisma', async () => {
      const config = { temperature: 0.7, model: 'gpt-4o' }

      prisma.blueprint.create.mockResolvedValue({ id: 'bpt_4' })

      await handler(null, mockSession, { config })

      expect(prisma.blueprint.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ config }),
        })
      )
    })

    it('should pass meta from body to prisma', async () => {
      const meta = { source: 'import', category: 'support' }

      prisma.blueprint.create.mockResolvedValue({ id: 'bpt_5' })

      await handler(null, mockSession, { meta })

      expect(prisma.blueprint.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ meta }),
        })
      )
    })

    it('should pass undefined for unspecified optional fields', async () => {
      prisma.blueprint.create.mockResolvedValue({ id: 'bpt_6' })

      await handler(null, mockSession, {})

      const callData = prisma.blueprint.create.mock.calls[0][0].data

      expect(callData.alias).toBeUndefined()
      expect(callData.name).toBeUndefined()
      expect(callData.visibility).toBeUndefined()
      expect(callData.config).toBeUndefined()
      expect(callData.meta).toBeUndefined()
    })
  })

  // -------------------------------------------------------
  // Error handling
  // -------------------------------------------------------

  describe('error handling', () => {
    it('should propagate database errors', async () => {
      prisma.blueprint.create.mockRejectedValue(
        new Error('Database connection lost')
      )

      await expect(handler(null, mockSession, {})).rejects.toThrow(
        'Database connection lost'
      )
    })

    it('should not swallow unique constraint violations', async () => {
      const error = new Error('Unique constraint failed on the fields: (alias)')

      error.code = 'P2002'
      prisma.blueprint.create.mockRejectedValue(error)

      await expect(handler(null, mockSession, { alias: 'duplicate' })).rejects.toThrow()
    })
  })
})
