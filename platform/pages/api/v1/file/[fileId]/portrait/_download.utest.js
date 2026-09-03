/* eslint-disable @typescript-eslint/no-require-imports */
import handler from './download'

jest.mock('@/lib/file.icon', () => ({
  buildFileIconSvg: () => '<svg/>',
}))

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
  getQuery: jest.fn(() => ({})),
  queryParam: jest.fn((req, param) => req.query?.[param]),
  requiredUrlParam: jest.fn((req, param) => req.query?.[param]),
}))

jest.mock('@/lib/file.storage', () => ({
  getFileInstance: jest.fn(),
}))

jest.mock('@/lib/host', () => ({
  getExternalAPIHostURL: jest.fn((path) => `https://api.example.com${path}`),
  getExternalHostURL: jest.fn((path) => `https://app.example.com${path}`),
}))

jest.mock('@/lib/image.transform', () => ({
  isSupportedImageType: jest.fn(() => true),
  createPortrait: jest.fn(async () => ({
    buffer: Buffer.from('portrait-content'),
    mimeType: 'image/png',
  })),
}))

jest.mock('@/lib/session.get', () => ({
  getSession: jest.fn(),
}))

jest.mock('@/lib/response', () => ({
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
  redirect: (url) => ({ status: 302, url }),
  send: (body, headers) => ({ status: 200, body, headers }),
  captureUnknownException: jest.fn(),
  respondFromError: jest.fn((error) => ({ status: 500, error: error.message })),
}))

const { getFileInstance } = require('@/lib/file.storage')
const { getSession } = require('@/lib/session.get')

describe('GET /api/v1/file/[fileId]/portrait/download', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    getFileInstance.mockResolvedValue({
      arrayBuffer: jest.fn(async () => Buffer.from('source-image').buffer),
    })
  })

  it('uses public cache headers for public files when cache=true', async () => {
    prisma.file.findUnique.mockResolvedValue({
      id: 'file123',
      userId: 'user123',
      visibility: FileVisibility.public,
      meta: { contentType: 'image/png' },
    })

    const result = await handler({
      query: { fileId: 'file123', cache: 'true' },
    })

    expect(result.status).toBe(200)
    expect(result.headers).toMatchObject({
      'Cache-Control': 'public, max-age=10',
      'CDN-Cache-Control': 'public, max-age=60',
    })
    expect(result.headers).not.toHaveProperty('Vercel-CDN-Cache-Control')
  })

  it('uses private cache headers for private files when cache=true', async () => {
    prisma.file.findUnique.mockResolvedValue({
      id: 'file123',
      userId: 'user123',
      visibility: FileVisibility.private,
      meta: { contentType: 'image/png' },
    })
    getSession.mockResolvedValue({ user: { id: 'user123' } })

    const result = await handler({
      query: { fileId: 'file123', cache: 'true' },
    })

    expect(result.status).toBe(200)
    expect(result.headers).toMatchObject({
      'Cache-Control': 'private, max-age=10',
      'CDN-Cache-Control': 'private, max-age=60',
    })
    expect(result.headers).not.toHaveProperty('Vercel-CDN-Cache-Control')
  })
})
