/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */

let capturedHandlerFn = null

jest.mock('@/lib/auxiliary.handler', () => ({
  authenticatedHandler: jest.fn((schema, fn) => {
    capturedHandlerFn = fn

    return jest.fn()
  }),
}))

jest.mock('@/lib/debug', () => jest.fn(() => ({ log: jest.fn() })))

jest.mock('@/lib/env', () => ({
  ...jest.requireActual('@/lib/env'),
  isDevelopment: false,
}))

jest.mock('@/lib/egress.fetch', () => jest.fn())

jest.mock('@/lib/mime', () => ({
  typeToFileName: jest.fn((type) => `file.${type.split('/')[1]}`),
}))

const mockClient = {
  file: {
    create: jest.fn(),
    upload: jest.fn(),
  },
  dataset: {
    fetch: jest.fn(),
    file: {
      attach: jest.fn(),
      sync: jest.fn(),
    },
  },
}

jest.mock('@/lib/cbk.sdk', () => ({
  getSessionClient: jest.fn(),
}))

// Import after mocks so capturedHandlerFn is populated
require('@/pages/api/auxiliary/skillset/ability/chatbotkit/dataset/file/attach')

const fetchMock = require('@/lib/egress.fetch')
const { getSessionClient } = require('@/lib/cbk.sdk')
const { typeToFileName } = require('@/lib/mime')
const { FetchError: SdkFetchError } = require('@chatbotkit/fetch')

describe('auxiliary/skillset/ability/chatbotkit/dataset/file/attach', () => {
  const mockSession = { user: { id: 'user-123' }, id: 'session-abc' }
  const mockHeaders = new Headers()

  beforeEach(() => {
    jest.clearAllMocks()
    getSessionClient.mockResolvedValue(mockClient)
    mockClient.dataset.fetch.mockResolvedValue({ id: 'dataset-1' })
  })

  it('should export an authenticated handler', () => {
    expect(capturedHandlerFn).toBeDefined()
    expect(typeof capturedHandlerFn).toBe('function')
  })

  describe('successful file attach flow', () => {
    it('should fetch URL, create file, upload, attach and sync', async () => {
      const mockBlob = new Blob(['file content'], { type: 'text/plain' })

      const mockFetchResponse = {
        ok: true,
        blob: jest.fn().mockResolvedValue(mockBlob),
      }

      fetchMock.mockResolvedValue(mockFetchResponse)
      mockClient.file.create.mockResolvedValue({ id: 'file-xyz' })
      mockClient.file.upload.mockResolvedValue({})
      mockClient.dataset.file.attach.mockResolvedValue({})
      mockClient.dataset.file.sync.mockResolvedValue({})
      typeToFileName.mockReturnValue('file.plain')

      const result = await capturedHandlerFn(
        mockSession,
        { datasetId: 'dataset-1', url: 'https://example.com/doc.txt' },
        mockHeaders
      )

      expect(mockClient.dataset.fetch).toHaveBeenCalledWith('dataset-1')
      expect(fetchMock).toHaveBeenCalledWith('https://example.com/doc.txt')
      expect(mockClient.file.create).toHaveBeenCalledWith({})
      expect(mockClient.file.upload).toHaveBeenCalledWith(
        'file-xyz',
        expect.objectContaining({
          type: 'text/plain',
          name: 'file.plain',
        })
      )
      expect(mockClient.dataset.file.attach).toHaveBeenCalledWith(
        'dataset-1',
        'file-xyz',
        { type: 'source' }
      )
      expect(mockClient.dataset.file.sync).toHaveBeenCalledWith(
        'dataset-1',
        'file-xyz',
        {}
      )
      expect(result).toEqual({ fileId: 'file-xyz' })
    })

    it('should pass the blob arrayBuffer to the file upload', async () => {
      const mockBlob = {
        type: 'application/pdf',
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(100)),
      }

      fetchMock.mockResolvedValue({
        ok: true,
        blob: jest.fn().mockResolvedValue(mockBlob),
      })
      mockClient.file.create.mockResolvedValue({ id: 'file-pdf' })
      mockClient.file.upload.mockResolvedValue({})
      mockClient.dataset.file.attach.mockResolvedValue({})
      mockClient.dataset.file.sync.mockResolvedValue({})
      typeToFileName.mockReturnValue('file.pdf')

      await capturedHandlerFn(
        mockSession,
        { datasetId: 'ds-1', url: 'https://example.com/doc.pdf' },
        mockHeaders
      )

      expect(mockClient.file.upload).toHaveBeenCalledWith(
        'file-pdf',
        expect.objectContaining({
          type: 'application/pdf',
          name: 'file.pdf',
        })
      )
      expect(mockBlob.arrayBuffer).toHaveBeenCalled()
    })
  })

  describe('dataset validation', () => {
    it('should return an error object when the dataset does not exist', async () => {
      const notFoundError = new SdkFetchError('Not found', 'GENERIC_ERROR')

      notFoundError.status = 404

      mockClient.dataset.fetch.mockRejectedValue(notFoundError)

      const result = await capturedHandlerFn(
        mockSession,
        { datasetId: 'missing-ds', url: 'https://example.com/file.txt' },
        mockHeaders
      )

      expect(result).toEqual({
        error: {
          message: 'Dataset missing-ds not found',
        },
      })

      expect(fetchMock).not.toHaveBeenCalled()
      expect(mockClient.file.create).not.toHaveBeenCalled()
      expect(mockClient.file.upload).not.toHaveBeenCalled()
      expect(mockClient.dataset.file.attach).not.toHaveBeenCalled()
      expect(mockClient.dataset.file.sync).not.toHaveBeenCalled()
    })

    it('should propagate non-404 SDK errors from dataset.fetch', async () => {
      const serverError = new SdkFetchError('Server error', 'GENERIC_ERROR')

      serverError.status = 500

      mockClient.dataset.fetch.mockRejectedValue(serverError)

      await expect(
        capturedHandlerFn(
          mockSession,
          { datasetId: 'ds-1', url: 'https://example.com/file.txt' },
          mockHeaders
        )
      ).rejects.toThrow('Server error')

      expect(mockClient.file.create).not.toHaveBeenCalled()
    })

    it('should propagate non-SDK errors from dataset.fetch', async () => {
      mockClient.dataset.fetch.mockRejectedValue(new Error('Connection reset'))

      await expect(
        capturedHandlerFn(
          mockSession,
          { datasetId: 'ds-1', url: 'https://example.com/file.txt' },
          mockHeaders
        )
      ).rejects.toThrow('Connection reset')
    })
  })

  describe('URL fetch failure', () => {
    it('should return an error object when URL fetch fails', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })

      const result = await capturedHandlerFn(
        mockSession,
        { datasetId: 'dataset-1', url: 'https://example.com/missing.txt' },
        mockHeaders
      )

      expect(result).toEqual({
        error: {
          message: 'Failed to fetch file from https://example.com/missing.txt',
        },
      })

      expect(mockClient.file.create).not.toHaveBeenCalled()
      expect(mockClient.file.upload).not.toHaveBeenCalled()
      expect(mockClient.dataset.file.attach).not.toHaveBeenCalled()
      expect(mockClient.dataset.file.sync).not.toHaveBeenCalled()
    })

    it('should not call SDK methods when fetch fails with 500', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
      })

      const result = await capturedHandlerFn(
        mockSession,
        { datasetId: 'dataset-1', url: 'https://example.com/error' },
        mockHeaders
      )

      expect(result).toMatchObject({
        error: expect.objectContaining({ message: expect.any(String) }),
      })
      expect(mockClient.file.create).not.toHaveBeenCalled()
    })
  })

  describe('egress boundary', () => {
    it('refuses a private-IP literal URL before any connection is attempted', async () => {
      let captured

      fetchMock.mockImplementation((...args) =>
        jest
          .requireActual('@/lib/egress.fetch')
          .default(...args)
          .catch((e) => {
            captured = e

            throw e
          })
      )

      await expect(
        capturedHandlerFn(
          mockSession,
          { datasetId: 'dataset-1', url: 'http://10.0.0.1/x' },
          mockHeaders
        )
      ).rejects.toThrow()

      expect(fetchMock).toHaveBeenCalledWith('http://10.0.0.1/x')
      expect(String(captured?.cause?.message)).toMatch(
        /egress to 10\.0\.0\.1 is not allowed: not a public address/
      )
      expect(mockClient.file.create).not.toHaveBeenCalled()
    })
  })

  describe('SDK operation failures', () => {
    it('should propagate errors from file.create', async () => {
      const mockBlob = new Blob(['data'], { type: 'text/csv' })

      fetchMock.mockResolvedValue({
        ok: true,
        blob: jest.fn().mockResolvedValue(mockBlob),
      })
      mockClient.file.create.mockRejectedValue(new Error('File quota exceeded'))

      await expect(
        capturedHandlerFn(
          mockSession,
          { datasetId: 'ds-1', url: 'https://example.com/data.csv' },
          mockHeaders
        )
      ).rejects.toThrow('File quota exceeded')
    })

    it('should propagate errors from dataset.file.attach', async () => {
      const mockBlob = new Blob(['data'], { type: 'text/plain' })

      fetchMock.mockResolvedValue({
        ok: true,
        blob: jest.fn().mockResolvedValue(mockBlob),
      })
      mockClient.file.create.mockResolvedValue({ id: 'file-1' })
      mockClient.file.upload.mockResolvedValue({})
      mockClient.dataset.file.attach.mockRejectedValue(
        new Error('Dataset not found')
      )

      await expect(
        capturedHandlerFn(
          mockSession,
          { datasetId: 'missing-ds', url: 'https://example.com/file.txt' },
          mockHeaders
        )
      ).rejects.toThrow('Dataset not found')
    })

    it('should propagate errors from dataset.file.sync', async () => {
      const mockBlob = new Blob(['data'], { type: 'text/plain' })

      fetchMock.mockResolvedValue({
        ok: true,
        blob: jest.fn().mockResolvedValue(mockBlob),
      })
      mockClient.file.create.mockResolvedValue({ id: 'file-1' })
      mockClient.file.upload.mockResolvedValue({})
      mockClient.dataset.file.attach.mockResolvedValue({})
      mockClient.dataset.file.sync.mockRejectedValue(new Error('Sync failed'))

      await expect(
        capturedHandlerFn(
          mockSession,
          { datasetId: 'ds-1', url: 'https://example.com/file.txt' },
          mockHeaders
        )
      ).rejects.toThrow('Sync failed')
    })
  })

  describe('session client', () => {
    it('should obtain session client using the provided session', async () => {
      const mockBlob = new Blob(['data'], { type: 'text/plain' })

      fetchMock.mockResolvedValue({
        ok: true,
        blob: jest.fn().mockResolvedValue(mockBlob),
      })
      mockClient.file.create.mockResolvedValue({ id: 'f-1' })
      mockClient.file.upload.mockResolvedValue({})
      mockClient.dataset.file.attach.mockResolvedValue({})
      mockClient.dataset.file.sync.mockResolvedValue({})

      await capturedHandlerFn(
        mockSession,
        { datasetId: 'ds-1', url: 'https://example.com/file.txt' },
        mockHeaders
      )

      expect(getSessionClient).toHaveBeenCalledWith(mockSession)
    })

    it('should propagate getSessionClient errors', async () => {
      getSessionClient.mockRejectedValue(new Error('Auth failed'))

      const mockBlob = new Blob(['data'], { type: 'text/plain' })

      fetchMock.mockResolvedValue({
        ok: true,
        blob: jest.fn().mockResolvedValue(mockBlob),
      })

      await expect(
        capturedHandlerFn(
          mockSession,
          { datasetId: 'ds-1', url: 'https://example.com/file.txt' },
          mockHeaders
        )
      ).rejects.toThrow('Auth failed')
    })
  })
})
