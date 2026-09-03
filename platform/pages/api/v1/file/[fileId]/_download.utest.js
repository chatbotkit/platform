/* eslint-disable @typescript-eslint/no-require-imports */
import handler from './download'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    file: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/prisma/types', () => ({
  FileVisibility: {
    public: 'public',
    private: 'private',
  },
}))

const prisma = require('@/prisma/client').default
const { FileVisibility } = require('@/prisma/types')

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  queryParam: jest.fn((req, param) => req.query?.[param]),
  requiredUrlParam: jest.fn((req, param) => req.query?.[param]),
}))

jest.mock('@/lib/storage', () => ({
  getObjectDownloadUrl: jest.fn(),
}))

jest.mock('@/lib/fetch', () => jest.fn())

jest.mock('@/lib/session.get', () => ({
  getSession: jest.fn(),
}))

jest.mock('@/lib/header', () => ({
  getAcceptHeader: jest.fn(
    (req, defaultValue) => req.headers?.accept || defaultValue
  ),
  getContentTypeHeader: jest.fn(
    (response, defaultValue) =>
      response.headers?.get?.('content-type') || defaultValue
  ),
  getContentDispositionHeader: jest.fn(
    (response, defaultValue) => defaultValue
  ),
}))

jest.mock('@/lib/string', () => ({
  getRandomId: jest.fn(() => 'file-random123'),
}))

jest.mock('@/lib/url', () => ({
  joinPaths: jest.fn((...args) => args.join('/')),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  noContent: () => ({ status: 204 }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
  send: (body, headers) => ({ status: 200, body, headers }),
  captureUnknownException: jest.fn(),
  respondFromError: jest.fn((error) => ({ status: 500, error: error.message })),
}))

const { getObjectDownloadUrl } = require('@/lib/storage')
const fetch = require('@/lib/fetch')
const { getSession } = require('@/lib/session.get')
const { captureUnknownException } = require('@/lib/response')

describe('GET /api/v1/file/[fileId]/download', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should download a public file without authentication', async () => {
      const mockFile = {
        id: 'file123',
        userId: 'user123',
        name: 'test.pdf',
        visibility: FileVisibility.public,
      }

      prisma.file.findUnique.mockResolvedValue(mockFile)
      getObjectDownloadUrl.mockResolvedValue('https://s3.example.com/file123')

      fetch.mockResolvedValue({
        ok: true,
        body: Buffer.from('file content'),
        headers: {
          get: jest.fn((header) => {
            if (header === 'content-type') {
              return 'application/pdf'
            }

            return null
          }),
        },
      })

      const req = {
        query: { fileId: 'file123' },
        headers: {},
      }

      const result = await handler(req)

      expect(result.status).toBe(200)
      expect(prisma.file.findUnique).toHaveBeenCalledWith({
        where: { id: 'file123' },
      })
      expect(getSession).not.toHaveBeenCalled()
    })

    it('should download a private file with valid authentication', async () => {
      const mockFile = {
        id: 'file123',
        userId: 'user123',
        name: 'secret.pdf',
        visibility: FileVisibility.private,
      }

      prisma.file.findUnique.mockResolvedValue(mockFile)
      getSession.mockResolvedValue({ user: { id: 'user123' } })
      getObjectDownloadUrl.mockResolvedValue('https://s3.example.com/file123')

      fetch.mockResolvedValue({
        ok: true,
        body: Buffer.from('secret content'),
        headers: {
          get: jest.fn(() => 'application/pdf'),
        },
      })

      const req = {
        query: { fileId: 'file123' },
      }

      const result = await handler(req)

      expect(result.status).toBe(200)
      expect(getSession).toHaveBeenCalledWith(req)
    })

    it('should return URL when Accept header is application/json', async () => {
      const mockFile = {
        id: 'file123',
        userId: 'user123',
        name: 'test.pdf',
        visibility: FileVisibility.public,
      }

      prisma.file.findUnique.mockResolvedValue(mockFile)
      getObjectDownloadUrl.mockResolvedValue('https://s3.example.com/file123')

      fetch.mockResolvedValue({
        ok: true,
        body: Buffer.from('content'),
        headers: { get: jest.fn() },
      })

      const req = {
        query: { fileId: 'file123' },
        headers: { accept: 'application/json' },
      }

      const result = await handler(req)

      expect(result.status).toBe(200)
      expect(result.body).toEqual({ url: 'https://s3.example.com/file123' })
    })
  })

  describe('caching', () => {
    it('should use cache strategy when cache=true', async () => {
      const mockFile = {
        id: 'file123',
        userId: 'user123',
        name: 'cached.pdf',
        visibility: FileVisibility.public,
      }

      prisma.file.findUnique.mockResolvedValue(mockFile)
      getObjectDownloadUrl.mockResolvedValue('https://s3.example.com/file123')

      fetch.mockResolvedValue({
        ok: true,
        body: Buffer.from('content'),
        headers: { get: jest.fn(() => 'application/pdf') },
      })

      const req = {
        query: { fileId: 'file123', cache: 'true' },
      }

      const result = await handler(req)

      expect(prisma.file.findUnique).toHaveBeenCalledWith({
        where: { id: 'file123' },
        cacheStrategy: {
          swr: 60,
          ttl: 60,
        },
      })

      expect(result.status).toBe(200)
      expect(result.headers).toMatchObject({
        'Cache-Control': 'public, max-age=10',
        'CDN-Cache-Control': 'public, max-age=60',
      })
      expect(result.headers).not.toHaveProperty('Vercel-CDN-Cache-Control')
    })

    it('should use private cache headers for private files when cache=true', async () => {
      const mockFile = {
        id: 'file123',
        userId: 'user123',
        name: 'cached-private.pdf',
        visibility: FileVisibility.private,
      }

      prisma.file.findUnique.mockResolvedValue(mockFile)
      getSession.mockResolvedValue({ user: { id: 'user123' } })
      getObjectDownloadUrl.mockResolvedValue('https://s3.example.com/file123')

      fetch.mockResolvedValue({
        ok: true,
        body: Buffer.from('content'),
        headers: { get: jest.fn(() => 'application/pdf') },
      })

      const req = {
        query: { fileId: 'file123', cache: 'true' },
      }

      const result = await handler(req)

      expect(result.status).toBe(200)
      expect(result.headers).toMatchObject({
        'Cache-Control': 'private, max-age=10',
        'CDN-Cache-Control': 'private, max-age=60',
      })
      expect(result.headers).not.toHaveProperty('Vercel-CDN-Cache-Control')
    })

    it('should not use cache strategy when cache is not specified', async () => {
      const mockFile = {
        id: 'file123',
        userId: 'user123',
        name: 'uncached.pdf',
        visibility: FileVisibility.public,
      }

      prisma.file.findUnique.mockResolvedValue(mockFile)
      getObjectDownloadUrl.mockResolvedValue('https://s3.example.com/file123')

      fetch.mockResolvedValue({
        ok: true,
        body: Buffer.from('content'),
        headers: { get: jest.fn(() => 'application/pdf') },
      })

      const req = {
        query: { fileId: 'file123' },
      }

      const result = await handler(req)

      expect(prisma.file.findUnique).toHaveBeenCalledWith({
        where: { id: 'file123' },
      })

      expect(result.headers?.['Cache-Control']).toBeUndefined()
    })
  })

  describe('edge cases', () => {
    it('should return 404 when file does not exist', async () => {
      prisma.file.findUnique.mockResolvedValue(null)

      const req = {
        query: { fileId: 'nonexistent' },
      }

      const result = await handler(req)

      expect(result).toEqual({ status: 404 })
    })

    it('should return 204 when S3 object does not exist (empty file, default accept)', async () => {
      const mockFile = {
        id: 'file123',
        userId: 'user123',
        name: 'test.txt',
        visibility: FileVisibility.public,
      }

      prisma.file.findUnique.mockResolvedValue(mockFile)
      getObjectDownloadUrl.mockResolvedValue('https://s3.example.com/file123')

      fetch.mockResolvedValue({
        ok: false,
        status: 404,
      })

      const req = {
        query: { fileId: 'file123' },
        headers: {},
      }

      const result = await handler(req)

      expect(result).toEqual({ status: 204 })
    })

    it('should return 404 when S3 object does not exist and Accept is application/json', async () => {
      const mockFile = {
        id: 'file123',
        userId: 'user123',
        name: 'test.txt',
        visibility: FileVisibility.public,
      }

      prisma.file.findUnique.mockResolvedValue(mockFile)
      getObjectDownloadUrl.mockResolvedValue('https://s3.example.com/file123')

      fetch.mockResolvedValue({
        ok: false,
        status: 404,
      })

      const req = {
        query: { fileId: 'file123' },
        headers: { accept: 'application/json' },
      }

      const result = await handler(req)

      expect(result).toEqual({ status: 404 })
    })

    it('should use generated filename when file name is empty', async () => {
      const mockFile = {
        id: 'file123',
        userId: 'user123',
        name: '',
        visibility: FileVisibility.public,
      }

      prisma.file.findUnique.mockResolvedValue(mockFile)
      getObjectDownloadUrl.mockResolvedValue('https://s3.example.com/file123')

      fetch.mockResolvedValue({
        ok: true,
        body: Buffer.from('content'),
        headers: { get: jest.fn(() => 'application/octet-stream') },
      })

      const req = {
        query: { fileId: 'file123' },
      }

      const result = await handler(req)

      expect(result.status).toBe(200)
      expect(result.headers['Content-Disposition']).toMatch(
        /attachment; filename="file-.*\.bin"/
      )
    })

    it('should trim whitespace from filename', async () => {
      const mockFile = {
        id: 'file123',
        userId: 'user123',
        name: '  spaced.pdf  ',
        visibility: FileVisibility.public,
      }

      prisma.file.findUnique.mockResolvedValue(mockFile)
      getObjectDownloadUrl.mockResolvedValue('https://s3.example.com/file123')

      fetch.mockResolvedValue({
        ok: true,
        body: Buffer.from('content'),
        headers: { get: jest.fn(() => 'application/pdf') },
      })

      const req = {
        query: { fileId: 'file123' },
      }

      const result = await handler(req)

      expect(result.status).toBe(200)
      expect(result.headers['Content-Disposition']).toBe(
        'attachment; filename="spaced.pdf.bin"'
      )
    })
  })

  describe('authorization', () => {
    it('should call captureUnknownException when accessing private file without authentication', async () => {
      const mockFile = {
        id: 'file123',
        userId: 'user123',
        name: 'secret.pdf',
        visibility: FileVisibility.private,
      }

      prisma.file.findUnique.mockResolvedValue(mockFile)
      getSession.mockRejectedValue(new Error('Not authenticated'))

      const req = {
        query: { fileId: 'file123' },
      }

      const result = await handler(req)

      expect(captureUnknownException).toHaveBeenCalled()
      expect(result.status).toBe(500)
    })

    it('should return 401 when accessing private file owned by different user', async () => {
      const mockFile = {
        id: 'file123',
        userId: 'user123',
        name: 'secret.pdf',
        visibility: FileVisibility.private,
      }

      prisma.file.findUnique.mockResolvedValue(mockFile)
      getSession.mockResolvedValue({ user: { id: 'user456' } })

      const req = {
        query: { fileId: 'file123' },
      }

      const result = await handler(req)

      expect(result).toEqual({ status: 401 })
    })
  })
})
