/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { copyStorageFile, storageFileExists } from '@/lib/space.storage'

import handler from './[[...path]]'

jest.mock('@/prisma/client', () => {
  const { mockDeep } = require('jest-mock-extended')

  return {
    __esModule: true,
    default: mockDeep(),
  }
})

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (_schema, fn) => fn,
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
}))

jest.mock('@/lib/response', () => ({
  ok: jest.fn((data) => ({ status: 200, body: data })),
  notFound: jest.fn(() => ({ status: 404 })),
  notAuthorized: jest.fn(() => ({ status: 403 })),
}))

jest.mock('@/lib/space.storage', () => ({
  copyStorageFile: jest.fn(),
  storageFileExists: jest.fn(),
}))

jest.mock('@/lib/b64', () => ({
  encode: jest.fn((value) => `encoded:${value}`),
}))

describe('POST /api/v1/space/[spaceId]/storage/copy/[[...path]]', () => {
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
    it('should copy a file to a destination path', async () => {
      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageFileExists.mockResolvedValue(true)
      copyStorageFile.mockResolvedValue(undefined)

      const req = { query: { spaceId: 'space_abc', path: ['source.txt'] } }
      const body = { destinationPath: 'destination.txt' }
      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(200)
      expect(result.body.path).toBe('destination.txt')
      expect(copyStorageFile).toHaveBeenCalledWith(
        expect.objectContaining({
          spaceId: 'space_abc',
        })
      )
    })

    it('should copy a file to a nested destination path', async () => {
      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageFileExists.mockResolvedValue(true)
      copyStorageFile.mockResolvedValue(undefined)

      const req = { query: { spaceId: 'space_abc', path: ['original.pdf'] } }
      const body = { destinationPath: 'archive/2025/copy.pdf' }
      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(200)
      expect(result.body.path).toBe('archive/2025/copy.pdf')
    })
  })

  describe('authorization', () => {
    it('should return 404 when no source path is provided', async () => {
      const req = { query: { spaceId: 'space_abc', path: [] } }
      const body = { destinationPath: 'destination.txt' }
      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(404)
      expect(copyStorageFile).not.toHaveBeenCalled()
    })

    it('should return 404 when space is not found', async () => {
      prisma.space.findUniqueByIdentifier.mockResolvedValue(null)

      const req = { query: { spaceId: 'nonexistent', path: ['file.txt'] } }
      const body = { destinationPath: 'dest.txt' }
      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(404)
      expect(copyStorageFile).not.toHaveBeenCalled()
    })

    it('should return 403 when user does not own the space', async () => {
      prisma.space.findUniqueByIdentifier.mockResolvedValue({
        id: 'space_abc',
        userId: 'other_user',
      })

      const req = { query: { spaceId: 'space_abc', path: ['file.txt'] } }
      const body = { destinationPath: 'dest.txt' }
      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(403)
      expect(copyStorageFile).not.toHaveBeenCalled()
    })

    it('should return 404 when source file does not exist', async () => {
      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageFileExists.mockResolvedValue(false)

      const req = { query: { spaceId: 'space_abc', path: ['missing.txt'] } }
      const body = { destinationPath: 'dest.txt' }
      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(404)
      expect(copyStorageFile).not.toHaveBeenCalled()
    })
  })

  describe('multi-segment paths', () => {
    it('should handle nested source paths', async () => {
      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageFileExists.mockResolvedValue(true)
      copyStorageFile.mockResolvedValue(undefined)

      const req = {
        query: { spaceId: 'space_abc', path: ['docs', 'report.pdf'] },
      }
      const body = { destinationPath: 'archive/report-backup.pdf' }
      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(200)
      expect(result.body.path).toBe('archive/report-backup.pdf')
    })
  })
})
