/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import {
  getStorageFileDownloadUrl,
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
}))

jest.mock('@/lib/response', () => ({
  ok: jest.fn((data) => ({ status: 200, body: data })),
  notFound: jest.fn(() => ({ status: 404 })),
  notAuthorized: jest.fn(() => ({ status: 403 })),
  badRequest: jest.fn(() => ({ status: 400 })),
  send: jest.fn((body, headers) => ({ status: 200, body, headers })),
}))

jest.mock('@/lib/header', () => ({
  getAcceptHeader: jest.fn(
    (req, defaultValue) => req.headers?.accept || defaultValue
  ),
  getContentTypeHeader: jest.fn(() => 'application/octet-stream'),
  getContentDispositionHeader: jest.fn((res, fallback) => fallback),
}))

jest.mock('@/lib/space.storage', () => ({
  getStorageFileDownloadUrl: jest.fn(),
  storageFileExists: jest.fn(),
}))

jest.mock('@/lib/fetch', () =>
  jest.fn().mockResolvedValue({
    ok: true,
    body: 'file-body',
    headers: { get: jest.fn(() => null) },
  })
)

jest.mock('@/lib/b64', () => ({
  encode: jest.fn((value) => `encoded:${value}`),
}))

jest.mock('@/lib/string', () => ({
  getRandomId: jest.fn((prefix) => `${prefix}random`),
}))

describe('GET /api/v1/space/[spaceId]/storage/download/[[...path]]', () => {
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

  describe('authorization', () => {
    it('should return 400 when no path is provided', async () => {
      const req = { query: { spaceId: 'space_abc', path: [] }, headers: {} }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(400)
    })

    it('should return 404 when space is not found', async () => {
      prisma.space.findUniqueByIdentifier.mockResolvedValue(null)

      const req = {
        query: { spaceId: 'nonexistent', path: ['file.txt'] },
        headers: {},
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
      expect(getStorageFileDownloadUrl).not.toHaveBeenCalled()
    })

    it('should return 403 when user does not own the space', async () => {
      prisma.space.findUniqueByIdentifier.mockResolvedValue({
        id: 'space_abc',
        userId: 'other_user',
      })

      const req = {
        query: { spaceId: 'space_abc', path: ['file.txt'] },
        headers: {},
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
      expect(getStorageFileDownloadUrl).not.toHaveBeenCalled()
    })

    it('should return 404 when file does not exist', async () => {
      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageFileExists.mockResolvedValue(false)

      const req = {
        query: { spaceId: 'space_abc', path: ['missing.txt'] },
        headers: {},
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
      expect(getStorageFileDownloadUrl).not.toHaveBeenCalled()
    })
  })

  describe('JSON URL response (Accept: application/json)', () => {
    it('should return presigned download URL', async () => {
      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageFileExists.mockResolvedValue(true)
      getStorageFileDownloadUrl.mockResolvedValue(
        'https://presigned.example.com/file.txt'
      )

      const req = {
        query: { spaceId: 'space_abc', path: ['file.txt'] },
        headers: { accept: 'application/json' },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(result.body.url).toBe('https://presigned.example.com/file.txt')
    })

    it('should include file id in the JSON response', async () => {
      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageFileExists.mockResolvedValue(true)
      getStorageFileDownloadUrl.mockResolvedValue(
        'https://presigned.example.com/file.txt'
      )

      const req = {
        query: { spaceId: 'space_abc', path: ['documents', 'report.pdf'] },
        headers: { accept: 'application/json' },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(result.body.id).toBeDefined()
    })
  })

  describe('direct file stream response', () => {
    it('should stream the file content directly', async () => {
      const fetch = require('@/lib/fetch')

      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageFileExists.mockResolvedValue(true)
      getStorageFileDownloadUrl.mockResolvedValue(
        'https://storage.example.com/file.txt'
      )
      fetch.mockResolvedValue({
        ok: true,
        body: 'file-content',
        headers: { get: jest.fn(() => null) },
      })

      const req = {
        query: { spaceId: 'space_abc', path: ['file.txt'] },
        headers: {},
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
    })

    it('should return 404 if the download URL fetch fails', async () => {
      const fetch = require('@/lib/fetch')

      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageFileExists.mockResolvedValue(true)
      getStorageFileDownloadUrl.mockResolvedValue(
        'https://storage.example.com/file.txt'
      )
      fetch.mockResolvedValue({ ok: false, status: 403 })

      const req = {
        query: { spaceId: 'space_abc', path: ['file.txt'] },
        headers: {},
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
    })
  })

  describe('multi-segment paths', () => {
    it('should handle nested file paths correctly', async () => {
      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageFileExists.mockResolvedValue(true)
      getStorageFileDownloadUrl.mockResolvedValue(
        'https://presigned.example.com/nested.pdf'
      )

      const req = {
        query: { spaceId: 'space_abc', path: ['docs', 'reports', 'q1.pdf'] },
        headers: { accept: 'application/json' },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(getStorageFileDownloadUrl).toHaveBeenCalledWith(
        expect.objectContaining({ spaceId: 'space_abc' })
      )
    })
  })
})
