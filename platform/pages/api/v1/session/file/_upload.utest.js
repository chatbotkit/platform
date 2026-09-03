/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import handler from './upload'

jest.mock('@/lib/method', () => ({
  withAny: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/response', () => ({
  methodNotAllowed: () => ({ status: 405 }),
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

jest.mock('@/lib/storage', () => ({
  getObjectUploadUrl: jest.fn(),
}))

jest.mock('@/lib/session.file', () => ({
  getSessionFileTempDownloadURL: jest.fn(),
  getSessionFileUploadInformation: jest.fn(),
  uploadSessionFile: jest.fn(),
  uploadSessionFileFromURL: jest.fn(),
}))

jest.mock('@/lib/dataurl.parse', () => ({
  parseDataURL: jest.fn(),
}))

jest.mock('@/lib/file.helpers', () => ({
  extname: jest.fn((name) => (name.includes('.') ? name.split('.').pop() : '')),
}))

jest.mock('@/lib/mime', () => ({
  typeToFileName: jest.fn((type) => `file.${type.split('/')[1] || 'bin'}`),
}))

jest.mock('@/lib/upload', () => ({
  getUploadFile: jest.fn(),
}))

jest.mock('@/lib/string', () => ({
  normalizeText: jest.fn((value) => value),
}))

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(() => ({ log: jest.fn() })),
}))

const { getObjectUploadUrl } = require('@/lib/storage')
const { getContentTypeHeader } = require('@/lib/header')
const { parseRequestJson } = require('@/lib/request')
const {
  getSessionFileTempDownloadURL,
  getSessionFileUploadInformation,
} = require('@/lib/session.file')
const { getMaxFileSize } = require('@/lib/user.limits')

describe('POST /api/v1/session/file/upload', () => {
  const mockSession = {
    id: 'session-123',
    user: { id: 'user-123' },
  }

  beforeEach(() => {
    jest.clearAllMocks()

    getMaxFileSize.mockResolvedValue(4 * 1024 * 1024)
    getSessionFileUploadInformation.mockReturnValue({
      fileId: 'file-123',
      name: 'document.pdf',
      scope: 'session',
      key: 'uploads/document.pdf',
    })
    getSessionFileTempDownloadURL.mockResolvedValue(
      'https://storage.example.com/download/document.pdf'
    )
    getObjectUploadUrl.mockResolvedValue('https://s3.example.com/presigned')
  })

  it('falls back to a filename-derived content type when file.type is empty', async () => {
    getContentTypeHeader.mockReturnValue('application/json')
    parseRequestJson.mockResolvedValue({
      file: { type: '', size: 2048, name: 'document.pdf' },
    })

    const req = { method: 'POST' }

    const result = await handler(req, mockSession)

    expect(result.status).toBe(200)
    expect(getObjectUploadUrl).toHaveBeenCalledWith(
      'session',
      'uploads/document.pdf',
      expect.objectContaining({
        size: 2048,
        type: 'application/pdf',
        name: 'document.pdf',
      })
    )
    expect(result.uploadRequest.headers['Content-Type']).toBe('application/pdf')
  })
})
