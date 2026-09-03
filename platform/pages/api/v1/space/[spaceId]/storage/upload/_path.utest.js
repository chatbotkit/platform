/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import {
  getSpaceStorageFileName,
  getStorageFileUploadUrl,
  storageDirectoryExists,
  uploadStorageFile,
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
  withAny: (fn) => fn,
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
  limitsReached: jest.fn(() => ({ status: 429 })),
  respondFromError: jest.fn((err) => ({ status: 400, body: err })),
  methodNotAllowed: jest.fn(() => ({ status: 405 })),
}))

jest.mock('@/lib/space.storage', () => ({
  getSpaceStorageFileName: jest.fn(() => 'space-file-name.txt'),
  getStorageFileUploadUrl: jest.fn(),
  storageDirectoryExists: jest.fn(),
  uploadStorageFile: jest.fn(),
}))

jest.mock('@/lib/b64', () => ({
  encode: jest.fn((value) => `encoded:${value}`),
}))

jest.mock('@/lib/header', () => ({
  getContentTypeHeader: jest.fn(),
}))

jest.mock('@/lib/egress.fetch', () =>
  jest.fn().mockResolvedValue({
    ok: true,
    arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(100)),
    headers: { get: jest.fn(() => 'image/jpeg') },
  })
)

jest.mock('@/lib/env', () => ({
  ...jest.requireActual('@/lib/env'),
  isDevelopment: false,
}))

jest.mock('@/lib/dataurl.parse', () => ({
  parseDataURL: jest.fn(() => ({
    data: Buffer.from('file-content').toString('base64'),
    type: 'image/png',
  })),
}))

jest.mock('@/lib/user.limits', () => ({
  getMaxFileSize: jest.fn().mockResolvedValue(10 * 1024 * 1024),
}))

jest.mock('@/lib/upload', () => ({
  getUploadFile: jest.fn(),
}))

jest.mock('@/lib/string', () => ({
  normalizeText: jest.fn((text) => text),
}))

jest.mock('@/lib/request', () => ({
  parseRequestJson: jest.fn(),
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  default: jest.requireActual('@/lib/joi.handler').default,
  withSchema: (_schema, fn) => fn,
}))

describe('POST /api/v1/space/[spaceId]/storage/upload/[[...path]]', () => {
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

    // Reset fetch mock
    const fetch = require('@/lib/egress.fetch')

    fetch.mockResolvedValue({
      ok: true,
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(100)),
      headers: { get: jest.fn(() => 'image/jpeg') },
    })

    // Reset header mock
    const { getContentTypeHeader } = require('@/lib/header')

    getContentTypeHeader.mockReturnValue('application/json')

    // Reset parseRequestJson
    const { parseRequestJson } = require('@/lib/request')

    parseRequestJson.mockResolvedValue(null)

    // Reset getMaxFileSize to default
    const { getMaxFileSize } = require('@/lib/user.limits')

    getMaxFileSize.mockResolvedValue(10 * 1024 * 1024)
  })

  describe('method restriction', () => {
    it('should reject non-POST requests', async () => {
      const req = {
        method: 'GET',
        query: { spaceId: 'space_abc', path: ['file.txt'] },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(405)
    })

    it('should reject PUT requests', async () => {
      const req = {
        method: 'PUT',
        query: { spaceId: 'space_abc', path: ['file.txt'] },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(405)
    })

    it('should reject DELETE requests', async () => {
      const req = {
        method: 'DELETE',
        query: { spaceId: 'space_abc', path: ['file.txt'] },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(405)
    })
  })

  describe('path validation', () => {
    it('should return 400 when no path is provided', async () => {
      const req = {
        method: 'POST',
        query: { spaceId: 'space_abc', path: [] },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(400)
    })
  })

  describe('authorization', () => {
    it('should return 404 when space is not found', async () => {
      const { getContentTypeHeader } = require('@/lib/header')

      getContentTypeHeader.mockReturnValue('application/json')
      prisma.space.findUniqueByIdentifier.mockResolvedValue(null)

      const req = {
        method: 'POST',
        query: { spaceId: 'nonexistent', path: ['file.txt'] },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
      expect(uploadStorageFile).not.toHaveBeenCalled()
    })

    it('should return 403 when user does not own the space', async () => {
      const { getContentTypeHeader } = require('@/lib/header')

      getContentTypeHeader.mockReturnValue('application/json')
      prisma.space.findUniqueByIdentifier.mockResolvedValue({
        id: 'space_abc',
        userId: 'other_user',
      })

      const req = {
        method: 'POST',
        query: { spaceId: 'space_abc', path: ['file.txt'] },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
      expect(uploadStorageFile).not.toHaveBeenCalled()
    })

    it('should return 400 when uploading to a path that is a directory', async () => {
      const { getContentTypeHeader } = require('@/lib/header')

      getContentTypeHeader.mockReturnValue('application/json')
      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageDirectoryExists.mockResolvedValue(true)

      const req = {
        method: 'POST',
        query: { spaceId: 'space_abc', path: ['existing-directory'] },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(400)
      expect(uploadStorageFile).not.toHaveBeenCalled()
    })
  })

  describe('JSON body upload - HTTP URL', () => {
    it('should upload a file from an HTTP URL', async () => {
      const { getContentTypeHeader } = require('@/lib/header')
      const fetch = require('@/lib/egress.fetch')
      const { parseRequestJson } = require('@/lib/request')

      getContentTypeHeader.mockReturnValue('application/json')
      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageDirectoryExists.mockResolvedValue(false)
      parseRequestJson.mockResolvedValue({
        file: 'https://example.com/image.jpg',
      })
      uploadStorageFile.mockResolvedValue(undefined)

      const fileBuffer = new ArrayBuffer(1000)

      fetch.mockResolvedValue({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(fileBuffer),
        headers: { get: jest.fn(() => 'image/jpeg') },
      })

      const req = {
        method: 'POST',
        query: { spaceId: 'space_abc', path: ['image.jpg'] },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(result.body.path).toBe('image.jpg')
      expect(uploadStorageFile).toHaveBeenCalledWith(
        expect.objectContaining({ spaceId: 'space_abc' })
      )
    })

    it('refuses a private-IP literal URL before any connection is attempted', async () => {
      const { getContentTypeHeader } = require('@/lib/header')
      const fetch = require('@/lib/egress.fetch')
      const { parseRequestJson } = require('@/lib/request')

      let captured

      fetch.mockImplementation((...args) =>
        jest
          .requireActual('@/lib/egress.fetch')
          .default(...args)
          .catch((e) => {
            captured = e

            throw e
          })
      )

      getContentTypeHeader.mockReturnValue('application/json')
      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageDirectoryExists.mockResolvedValue(false)
      parseRequestJson.mockResolvedValue({
        file: 'http://127.0.0.1/image.jpg',
      })

      const req = {
        method: 'POST',
        query: { spaceId: 'space_abc', path: ['image.jpg'] },
      }

      await expect(handler(req, mockSession)).rejects.toThrow()

      expect(fetch).toHaveBeenCalledWith('http://127.0.0.1/image.jpg')
      expect(String(captured?.cause?.message)).toMatch(
        /egress to 127\.0\.0\.1 is not allowed: not a public address/
      )
      expect(uploadStorageFile).not.toHaveBeenCalled()
    })

    it('should return 400 when HTTP URL fetch fails', async () => {
      const { getContentTypeHeader } = require('@/lib/header')
      const fetch = require('@/lib/egress.fetch')
      const { parseRequestJson } = require('@/lib/request')

      getContentTypeHeader.mockReturnValue('application/json')
      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageDirectoryExists.mockResolvedValue(false)
      parseRequestJson.mockResolvedValue({
        file: 'https://example.com/image.jpg',
      })
      fetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })

      const req = {
        method: 'POST',
        query: { spaceId: 'space_abc', path: ['image.jpg'] },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(400)
      expect(uploadStorageFile).not.toHaveBeenCalled()
    })

    it('should return 429 when HTTP URL file exceeds size limit', async () => {
      const { getContentTypeHeader } = require('@/lib/header')
      const fetch = require('@/lib/egress.fetch')
      const { parseRequestJson } = require('@/lib/request')
      const { getMaxFileSize } = require('@/lib/user.limits')

      getContentTypeHeader.mockReturnValue('application/json')
      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageDirectoryExists.mockResolvedValue(false)
      parseRequestJson.mockResolvedValue({
        file: 'https://example.com/big-file.zip',
      })
      getMaxFileSize.mockResolvedValue(1000)

      const largeBuffer = new ArrayBuffer(2000)

      fetch.mockResolvedValue({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(largeBuffer),
        headers: { get: jest.fn(() => 'application/zip') },
      })

      const req = {
        method: 'POST',
        query: { spaceId: 'space_abc', path: ['big.zip'] },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(429)
      expect(uploadStorageFile).not.toHaveBeenCalled()
    })
  })

  describe('JSON body upload - data URL', () => {
    it('should upload a file from a data URL', async () => {
      const { getContentTypeHeader } = require('@/lib/header')
      const { parseRequestJson } = require('@/lib/request')
      const { parseDataURL } = require('@/lib/dataurl.parse')

      getContentTypeHeader.mockReturnValue('application/json')
      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageDirectoryExists.mockResolvedValue(false)
      parseRequestJson.mockResolvedValue({
        file: 'data:image/png;base64,iVBORw0KGgo=',
      })
      parseDataURL.mockReturnValue({
        data: Buffer.from('small-image').toString('base64'),
        type: 'image/png',
      })
      uploadStorageFile.mockResolvedValue(undefined)

      const req = {
        method: 'POST',
        query: { spaceId: 'space_abc', path: ['icon.png'] },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(result.body.path).toBe('icon.png')
      expect(uploadStorageFile).toHaveBeenCalled()
    })

    it('should return 429 when data URL file exceeds size limit', async () => {
      const { getContentTypeHeader } = require('@/lib/header')
      const { parseRequestJson } = require('@/lib/request')
      const { parseDataURL } = require('@/lib/dataurl.parse')
      const { getMaxFileSize } = require('@/lib/user.limits')

      getContentTypeHeader.mockReturnValue('application/json')
      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageDirectoryExists.mockResolvedValue(false)
      parseRequestJson.mockResolvedValue({
        file: 'data:video/mp4;base64,AAAAAA==',
      })
      getMaxFileSize.mockResolvedValue(5)
      parseDataURL.mockReturnValue({
        data: Buffer.from('this-is-a-large-data').toString('base64'),
        type: 'video/mp4',
      })

      const req = {
        method: 'POST',
        query: { spaceId: 'space_abc', path: ['video.mp4'] },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(429)
      expect(uploadStorageFile).not.toHaveBeenCalled()
    })
  })

  describe('JSON body upload - file metadata (two-stage)', () => {
    it('should return an uploadRequest for two-stage uploads', async () => {
      const { getContentTypeHeader } = require('@/lib/header')
      const { parseRequestJson } = require('@/lib/request')

      getContentTypeHeader.mockReturnValue('application/json')
      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageDirectoryExists.mockResolvedValue(false)
      parseRequestJson.mockResolvedValue({
        file: { type: 'image/png', size: 1024 },
      })
      getStorageFileUploadUrl.mockResolvedValue(
        'https://presigned-upload.example.com/put-url'
      )
      getSpaceStorageFileName.mockReturnValue('space-abc/encoded:icon.png')

      const req = {
        method: 'POST',
        query: { spaceId: 'space_abc', path: ['icon.png'] },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(result.body.uploadRequest).toBeDefined()
      expect(result.body.uploadRequest.method).toBe('PUT')
      expect(result.body.uploadRequest.url).toBe(
        'https://presigned-upload.example.com/put-url'
      )
      expect(result.body.uploadRequest.headers).toMatchObject({
        'Content-Type': 'image/png',
        'Content-Length': '1024',
      })
      expect(getStorageFileUploadUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          spaceId: 'space_abc',
          size: 1024,
          type: 'image/png',
        })
      )
      expect(uploadStorageFile).not.toHaveBeenCalled()
    })

    it('should return 429 when two-stage file size exceeds limit', async () => {
      const { getContentTypeHeader } = require('@/lib/header')
      const { parseRequestJson } = require('@/lib/request')
      const { getMaxFileSize } = require('@/lib/user.limits')

      getContentTypeHeader.mockReturnValue('application/json')
      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageDirectoryExists.mockResolvedValue(false)
      getMaxFileSize.mockResolvedValue(100)
      parseRequestJson.mockResolvedValue({
        file: { type: 'video/mp4', size: 999999 },
      })

      const req = {
        method: 'POST',
        query: { spaceId: 'space_abc', path: ['video.mp4'] },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(429)
      expect(uploadStorageFile).not.toHaveBeenCalled()
      expect(getStorageFileUploadUrl).not.toHaveBeenCalled()
    })

    it('should include optional metadata in upload request headers', async () => {
      const { getContentTypeHeader } = require('@/lib/header')
      const { parseRequestJson } = require('@/lib/request')

      getContentTypeHeader.mockReturnValue('application/json')
      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageDirectoryExists.mockResolvedValue(false)
      parseRequestJson.mockResolvedValue({
        file: { type: 'application/pdf', size: 2048, meta: { author: 'test' } },
      })
      getStorageFileUploadUrl.mockResolvedValue(
        'https://presigned.example.com/upload'
      )
      getSpaceStorageFileName.mockReturnValue('space-file.pdf')

      const req = {
        method: 'POST',
        query: { spaceId: 'space_abc', path: ['document.pdf'] },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(getStorageFileUploadUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { author: 'test' },
        })
      )
    })
  })

  describe('multipart form upload', () => {
    it('should upload a file from multipart form data', async () => {
      const { getContentTypeHeader } = require('@/lib/header')
      const { getUploadFile } = require('@/lib/upload')

      getContentTypeHeader.mockReturnValue('multipart/form-data')
      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageDirectoryExists.mockResolvedValue(false)
      uploadStorageFile.mockResolvedValue(undefined)
      getUploadFile.mockResolvedValue({
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(500)),
        size: 500,
        type: 'image/jpeg',
      })

      const req = {
        method: 'POST',
        query: { spaceId: 'space_abc', path: ['photo.jpg'] },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(result.body.path).toBe('photo.jpg')
      expect(uploadStorageFile).toHaveBeenCalled()
    })

    it('should return 429 when multipart file exceeds size limit', async () => {
      const { getContentTypeHeader } = require('@/lib/header')
      const { getUploadFile } = require('@/lib/upload')
      const { getMaxFileSize } = require('@/lib/user.limits')

      getContentTypeHeader.mockReturnValue('multipart/form-data')
      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageDirectoryExists.mockResolvedValue(false)
      getMaxFileSize.mockResolvedValue(100)
      getUploadFile.mockResolvedValue({
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(500)),
        size: 500,
        type: 'image/jpeg',
      })

      const req = {
        method: 'POST',
        query: { spaceId: 'space_abc', path: ['huge.jpg'] },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(429)
      expect(uploadStorageFile).not.toHaveBeenCalled()
    })
  })

  describe('direct binary upload', () => {
    it('should upload a direct binary stream', async () => {
      const { getContentTypeHeader } = require('@/lib/header')

      getContentTypeHeader.mockReturnValue('image/png')
      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageDirectoryExists.mockResolvedValue(false)
      uploadStorageFile.mockResolvedValue(undefined)

      const req = {
        method: 'POST',
        query: { spaceId: 'space_abc', path: ['image.png'] },
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(2048)),
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(result.body.path).toBe('image.png')
      expect(uploadStorageFile).toHaveBeenCalled()
    })

    it('should return 429 when binary stream exceeds size limit', async () => {
      const { getContentTypeHeader } = require('@/lib/header')
      const { getMaxFileSize } = require('@/lib/user.limits')

      getContentTypeHeader.mockReturnValue('application/octet-stream')
      prisma.space.findUniqueByIdentifier.mockResolvedValue(mockSpace)
      storageDirectoryExists.mockResolvedValue(false)
      getMaxFileSize.mockResolvedValue(10)

      const req = {
        method: 'POST',
        query: { spaceId: 'space_abc', path: ['big.bin'] },
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(999)),
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(429)
      expect(uploadStorageFile).not.toHaveBeenCalled()
    })
  })
})
