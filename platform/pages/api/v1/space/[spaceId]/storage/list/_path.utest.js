/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { encode } from '@/lib/b64'
import { listStorage, storageDirectoryExists } from '@/lib/space.storage'

import handler from './[[...path]]'

jest.mock('@/prisma/client', () => {
  const { mockDeep } = require('jest-mock-extended')

  return {
    __esModule: true,
    default: mockDeep(),
  }
})

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, key) => req.query[key]),
  catchAllParam: jest.fn((req, key) =>
    Array.isArray(req.query[key])
      ? req.query[key]
      : req.query[key]
        ? [req.query[key]]
        : []
  ),
  queryParam: jest.fn((req, key) => req.query?.[key]),
}))

jest.mock('@/lib/response', () => ({
  ok: jest.fn((data) => ({ status: 200, body: data })),
  notFound: jest.fn(() => ({ status: 404 })),
  notAuthorized: jest.fn(() => ({ status: 403 })),
}))

jest.mock('@/lib/b64', () => ({
  encode: jest.fn((value) => `encoded:${value}`),
}))

jest.mock('@/lib/space.storage', () => ({
  listStorage: jest.fn(),
  storageDirectoryExists: jest.fn(),
}))

describe('GET /api/v1/space/[spaceId]/storage/list/[[...path]]', () => {
  const mockSession = {
    user: { id: 'user_123' },
  }

  const mockSpace = {
    id: 'space_abc',
    userId: 'user_123',
  }

  beforeEach(() => {
    mockReset(prisma)
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should list files in a directory', async () => {
      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageDirectoryExists.mockResolvedValue(true)
      listStorage.mockResolvedValue({
        items: [
          {
            id: 'file1',
            path: 'documents/file1.txt',
            size: 100,
            updatedAt: 1000,
            isDirectory: false,
          },
          {
            id: 'dir1',
            path: 'documents/subdir',
            size: 0,
            updatedAt: 2000,
            isDirectory: true,
          },
        ],
      })

      const req = { query: { spaceId: 'space_abc', path: ['documents'] } }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(result.body.items).toHaveLength(2)
      expect(listStorage).toHaveBeenCalledWith(
        expect.objectContaining({
          spaceId: 'space_abc',
          recursive: false,
        })
      )
    })

    it('should list root directory when no path provided', async () => {
      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageDirectoryExists.mockResolvedValue(true)
      listStorage.mockResolvedValue({ items: [] })

      const req = { query: { spaceId: 'space_abc', path: [] } }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(result.body.items).toHaveLength(0)
    })

    it('should list files recursively when recursive=true', async () => {
      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageDirectoryExists.mockResolvedValue(true)
      listStorage.mockResolvedValue({ items: [] })

      const req = {
        query: { spaceId: 'space_abc', path: [], recursive: 'true' },
      }

      await handler(req, mockSession)

      expect(listStorage).toHaveBeenCalledWith(
        expect.objectContaining({ recursive: true })
      )
    })

    it('should not list recursively when recursive=false', async () => {
      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageDirectoryExists.mockResolvedValue(true)
      listStorage.mockResolvedValue({ items: [] })

      const req = {
        query: { spaceId: 'space_abc', path: [], recursive: 'false' },
      }

      await handler(req, mockSession)

      expect(listStorage).toHaveBeenCalledWith(
        expect.objectContaining({ recursive: false })
      )
    })
  })

  describe('authorization', () => {
    it('should return 404 when space is not found', async () => {
      prisma.space.findUniqueByIdentifier.mockResolvedValue(null)

      const req = { query: { spaceId: 'nonexistent', path: [] } }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
      expect(listStorage).not.toHaveBeenCalled()
    })

    it('should return 403 when user does not own the space', async () => {
      prisma.space.findUniqueByIdentifier.mockResolvedValue({
        id: 'space_abc',
        userId: 'other_user',
      })

      const req = { query: { spaceId: 'space_abc', path: [] } }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
      expect(listStorage).not.toHaveBeenCalled()
    })
  })

  describe('directory existence', () => {
    it('should return 404 when directory does not exist', async () => {
      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageDirectoryExists.mockResolvedValue(false)

      const req = { query: { spaceId: 'space_abc', path: ['nonexistent'] } }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
      expect(listStorage).not.toHaveBeenCalled()
    })
  })

  describe('multi-segment paths', () => {
    it('should handle nested paths correctly', async () => {
      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageDirectoryExists.mockResolvedValue(true)
      listStorage.mockResolvedValue({ items: [] })

      const req = {
        query: { spaceId: 'space_abc', path: ['docs', 'reports', '2025'] },
      }

      await handler(req, mockSession)

      expect(listStorage).toHaveBeenCalledWith(
        expect.objectContaining({ spaceId: 'space_abc' })
      )
    })
  })

  describe('path encoding', () => {
    beforeEach(() => {
      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageDirectoryExists.mockResolvedValue(true)
      listStorage.mockResolvedValue({ items: [] })
    })

    it('should encode "." as the path id when no segments are provided', async () => {
      const req = { query: { spaceId: 'space_abc', path: [] } }

      await handler(req, mockSession)

      expect(encode).toHaveBeenCalledWith('.', true)
    })

    it('should join multiple path segments with "/" before encoding', async () => {
      const req = {
        query: { spaceId: 'space_abc', path: ['docs', 'reports'] },
      }

      await handler(req, mockSession)

      expect(encode).toHaveBeenCalledWith('docs/reports', true)
    })

    it('should check directory existence using the encoded path id', async () => {
      const req = { query: { spaceId: 'space_abc', path: ['docs'] } }

      await handler(req, mockSession)

      expect(storageDirectoryExists).toHaveBeenCalledWith(
        expect.objectContaining({
          spaceId: 'space_abc',
          pathId: expect.any(String),
        })
      )
    })
  })
})
