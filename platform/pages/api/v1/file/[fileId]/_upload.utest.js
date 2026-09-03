/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler from './upload'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      file: {
        findUniqueByIdentifier: jest.fn(),
        update: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/method', () => ({
  withAny: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  methodNotAllowed: () => ({ status: 405 }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
  limitsReached: () => ({ status: 429 }),
  badRequest: () => ({ status: 400 }),
  ok: (data) => ({ status: 200, ...data }),
  respondFromError: (error) => ({ status: 500, error }),
}))

jest.mock('@/lib/header', () => ({
  getContentTypeHeader: jest.fn(),
}))

jest.mock('@/lib/user.limits', () => ({
  getMaxFileSize: jest.fn(),
}))

jest.mock('@/lib/request', () => ({
  parseRequestJson: jest.fn(),
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  schemaErrorToError: jest.fn((error) => error),
}))

jest.mock('@/lib/file.storage', () => ({
  getFileObjectDownloadUrl: jest.fn(),
  getFileObjectUploadUrl: jest.fn(),
  uploadFileObject: jest.fn(),
}))

jest.mock('@/lib/dataurl.parse', () => ({
  parseDataURL: jest.fn(),
}))

jest.mock('@/lib/egress.fetch', () => jest.fn())

jest.mock('@/lib/env', () => ({
  ...jest.requireActual('@/lib/env'),
  isDevelopment: false,
}))

jest.mock('@/lib/mime', () => ({
  typeToFileName: jest.fn((type) => `file.${type.split('/')[1] || 'bin'}`),
}))

jest.mock('@/lib/string', () => ({
  normalizeText: jest.fn((value) => value),
}))

jest.mock('@/lib/upload', () => ({
  getUploadFile: jest.fn(),
}))

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(() => ({ log: jest.fn() })),
}))

const fetch = require('@/lib/egress.fetch')
const { getContentTypeHeader } = require('@/lib/header')
const {
  getFileObjectDownloadUrl,
  getFileObjectUploadUrl,
} = require('@/lib/file.storage')
const { parseRequestJson } = require('@/lib/request')
const { getMaxFileSize } = require('@/lib/user.limits')

describe('POST /api/v1/file/{fileId}/upload', () => {
  const mockSession = { user: { id: 'user-123' } }

  beforeEach(() => {
    jest.clearAllMocks()

    prisma.file.findUniqueByIdentifier.mockResolvedValue({
      id: 'file-123',
      userId: 'user-123',
      meta: {},
    })
    prisma.file.update.mockResolvedValue({})
    getMaxFileSize.mockResolvedValue(4 * 1024 * 1024)
    getFileObjectUploadUrl.mockResolvedValue('https://s3.example.com/presigned')
    getFileObjectDownloadUrl.mockResolvedValue(
      'https://storage.example.com/download/document.pdf'
    )
  })

  it('refuses a private-IP literal source URL before any connection is attempted', async () => {
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
    parseRequestJson.mockResolvedValue({ file: 'http://127.0.0.1/file.pdf' })

    const req = { method: 'POST', query: { fileId: 'file-123' } }

    await expect(handler(req, mockSession)).rejects.toThrow()

    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1/file.pdf')
    expect(String(captured?.cause?.message)).toMatch(
      /egress to 127\.0\.0\.1 is not allowed: not a public address/
    )
    expect(prisma.file.update).not.toHaveBeenCalled()
  })

  it('falls back to a filename-derived content type when file.type is empty', async () => {
    getContentTypeHeader.mockReturnValue('application/json')
    parseRequestJson.mockResolvedValue({
      file: { type: '', size: 2048, name: 'document.pdf' },
    })

    const req = { method: 'POST', query: { fileId: 'file-123' } }

    const result = await handler(req, mockSession)

    expect(result.status).toBe(200)
    expect(getFileObjectUploadUrl).toHaveBeenCalledWith(
      'file-123',
      expect.objectContaining({
        size: 2048,
        type: 'application/pdf',
        name: 'document.pdf',
      })
    )
    expect(result.uploadRequest.headers['Content-Type']).toBe('application/pdf')
    expect(prisma.file.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          meta: {
            contentType: 'application/pdf',
          },
        },
      })
    )
  })
})
