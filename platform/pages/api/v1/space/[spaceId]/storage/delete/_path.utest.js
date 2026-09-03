/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import {
  deleteStorageDirectory,
  deleteStorageFile,
  storageDirectoryExists,
  storageFileExists,
} from '@/lib/space.storage'

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
  deleteStorageDirectory: jest.fn(),
  deleteStorageFile: jest.fn(),
  storageDirectoryExists: jest.fn(),
  storageFileExists: jest.fn(),
}))

jest.mock('@/lib/b64', () => ({
  encode: jest.fn((value) => `encoded:${value}`),
}))

describe('POST /api/v1/space/[spaceId]/storage/delete/[[...path]]', () => {
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

  describe('deleting a file (non-recursive)', () => {
    it('should delete a single file', async () => {
      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageFileExists.mockResolvedValue(true)
      deleteStorageFile.mockResolvedValue(undefined)

      const req = { query: { spaceId: 'space_abc', path: ['file.txt'] } }
      const body = {}
      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(200)
      expect(result.body.path).toBe('file.txt')
      expect(deleteStorageFile).toHaveBeenCalledWith(
        expect.objectContaining({ spaceId: 'space_abc' })
      )
      expect(deleteStorageDirectory).not.toHaveBeenCalled()
    })

    it('should return 404 when file does not exist', async () => {
      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageFileExists.mockResolvedValue(false)

      const req = { query: { spaceId: 'space_abc', path: ['missing.txt'] } }
      const body = {}
      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(404)
      expect(deleteStorageFile).not.toHaveBeenCalled()
    })
  })

  describe('deleting a directory (recursive)', () => {
    it('should delete a directory recursively', async () => {
      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageDirectoryExists.mockResolvedValue(true)
      deleteStorageDirectory.mockResolvedValue(undefined)

      const req = { query: { spaceId: 'space_abc', path: ['documents'] } }
      const body = { recursive: true }
      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(200)
      expect(result.body.path).toBe('documents')
      expect(deleteStorageDirectory).toHaveBeenCalledWith(
        expect.objectContaining({ spaceId: 'space_abc' })
      )
      expect(deleteStorageFile).not.toHaveBeenCalled()
    })

    it('should return 404 when directory does not exist', async () => {
      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageDirectoryExists.mockResolvedValue(false)

      const req = { query: { spaceId: 'space_abc', path: ['nonexistent-dir'] } }
      const body = { recursive: true }
      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(404)
      expect(deleteStorageDirectory).not.toHaveBeenCalled()
    })
  })

  describe('authorization', () => {
    it('should return 404 when no path is provided', async () => {
      const req = { query: { spaceId: 'space_abc', path: [] } }
      const body = {}
      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(404)
      expect(deleteStorageFile).not.toHaveBeenCalled()
      expect(deleteStorageDirectory).not.toHaveBeenCalled()
    })

    it('should return 404 when space is not found', async () => {
      prisma.space.findUniqueByIdentifier.mockResolvedValue(null)

      const req = { query: { spaceId: 'nonexistent', path: ['file.txt'] } }
      const body = {}
      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(404)
      expect(deleteStorageFile).not.toHaveBeenCalled()
    })

    it('should return 403 when user does not own the space', async () => {
      prisma.space.findUniqueByIdentifier.mockResolvedValue({
        id: 'space_abc',
        userId: 'other_user',
      })

      const req = { query: { spaceId: 'space_abc', path: ['file.txt'] } }
      const body = {}
      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(403)
      expect(deleteStorageFile).not.toHaveBeenCalled()
    })
  })

  describe('routing logic', () => {
    it('should use file check when recursive is false', async () => {
      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageFileExists.mockResolvedValue(true)
      deleteStorageFile.mockResolvedValue(undefined)

      const req = { query: { spaceId: 'space_abc', path: ['file.txt'] } }
      const body = { recursive: false }

      await handler(req, mockSession, body)

      expect(storageFileExists).toHaveBeenCalled()
      expect(storageDirectoryExists).not.toHaveBeenCalled()
    })

    it('should use directory check when recursive is true', async () => {
      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageDirectoryExists.mockResolvedValue(true)
      deleteStorageDirectory.mockResolvedValue(undefined)

      const req = { query: { spaceId: 'space_abc', path: ['dir'] } }
      const body = { recursive: true }

      await handler(req, mockSession, body)

      expect(storageDirectoryExists).toHaveBeenCalled()
      expect(storageFileExists).not.toHaveBeenCalled()
    })
  })
})
