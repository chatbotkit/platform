/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { getContextContact, getContextNamespace } from '@/lib/context.store'
import { fetchPlusPlus } from '@/lib/egress.fetch'
import { download } from '@/lib/fetch'
import { getContentTypeHeader } from '@/lib/header'
import { logEvent } from '@/lib/log'
import {
  copyStorageFile,
  deleteStorageFile,
  downloadStorageFile,
  listStorage,
  moveStorageFile,
  searchStorageFiles,
  storageFileExists,
  uploadStorageFile,
} from '@/lib/space.storage'

import {
  doSpaceStorageCopy,
  doSpaceStorageDelete,
  doSpaceStorageImport,
  doSpaceStorageRead,
  doSpaceStorageRw,
  doSpaceStorageSearch,
  doSpaceStorageWrite,
  executeSpaceAction,
  spaceStorageCopySchema,
  spaceStorageDeleteSchema,
  spaceStorageImportSchema,
  spaceStorageListSchema,
  spaceStorageMoveSchema,
  spaceStorageReadSchema,
  spaceStorageSearchSchema,
  spaceStorageWriteSchema,
} from './action.exec.space'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    space: {
      findFirst: jest.fn(),
    },
  },
}))

jest.mock('@/lib/context.store', () => ({
  getContextBot: jest.fn(),
  getContextContact: jest.fn(),
  getContextNamespace: jest.fn(),
}))

jest.mock('@/lib/fetch', () => ({
  __esModule: true,
  default: jest.fn(),
  withTimeout: jest.fn((fn) => fn),
  withBodyTimeout: jest.fn((fn) => fn),
  withRetry: jest.fn((fn) => fn),
  download: jest.fn(),
}))

jest.mock('@/lib/egress.fetch', () => ({
  __esModule: true,
  default: jest.fn(),
  fetchPlusPlus: jest.fn(),
}))

jest.mock('@/lib/header', () => ({
  getContentTypeHeader: jest.fn(),
}))

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

jest.mock('@/lib/space.storage', () => ({
  listStorage: jest.fn(),
  downloadStorageFile: jest.fn(),
  getStorageFileDownloadUrl: jest.fn(),
  uploadStorageFile: jest.fn(),
  moveStorageFile: jest.fn(),
  copyStorageFile: jest.fn(),
  deleteStorageFile: jest.fn(),
  searchStorageFiles: jest.fn(),
  storageFileExists: jest.fn(),
}))

// @note the storage contract's body, not a raw stream
function bodyOf(text) {
  return {
    body: { arrayBuffer: async () => new TextEncoder().encode(text).buffer },
  }
}

describe('action.exec.space', () => {
  const userId = 'user-123'
  const spaceId = 'space-456'

  const baseOptions = {
    userId,
    linkedResources: {
      spaceId: spaceId,
    },
    contextResources: {
      blueprintId: 'bp-123',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    getContextContact.mockReturnValue(null)
    getContextNamespace.mockReturnValue(null)
    storageFileExists.mockResolvedValue(true)
  })

  describe('schemas', () => {
    describe('spaceStorageListSchema', () => {
      it('should require @scope field', () => {
        expect(() =>
          spaceStorageListSchema.parse({
            spaceId: 'sp-123',
          })
        ).toThrow()
      })

      it('should accept all valid scope values', () => {
        const scopes = ['user', 'blueprint', 'contact']

        for (const scopeValue of scopes) {
          const result = spaceStorageListSchema.parse({
            '@scope': scopeValue,
            spaceId: 'sp-123',
          })

          expect(result['@scope']).toBe(scopeValue)
        }
      })

      it('should reject invalid scope values', () => {
        expect(() =>
          spaceStorageListSchema.parse({
            '@scope': 'invalid',
            spaceId: 'sp-123',
          })
        ).toThrow()
      })
    })

    describe('spaceStorageReadSchema', () => {
      it('should require @scope field', () => {
        expect(() =>
          spaceStorageReadSchema.parse({
            spaceId: 'sp-123',
            path: '/file.txt',
          })
        ).toThrow()
      })

      it('should parse with valid @scope', () => {
        const result = spaceStorageReadSchema.parse({
          '@scope': 'user',
          spaceId: 'sp-123',
          path: '/file.txt',
        })

        expect(result['@scope']).toBe('user')
      })
    })

    describe('spaceStorageWriteSchema', () => {
      it('should require @scope field', () => {
        expect(() =>
          spaceStorageWriteSchema.parse({
            spaceId: 'sp-123',
            path: '/file.txt',
            content: 'hello',
          })
        ).toThrow()
      })

      it('should parse with valid @scope', () => {
        const result = spaceStorageWriteSchema.parse({
          '@scope': 'blueprint',
          spaceId: 'sp-123',
          path: '/file.txt',
          content: 'hello',
        })

        expect(result['@scope']).toBe('blueprint')
      })
    })

    describe('spaceStorageMoveSchema', () => {
      it('should require @scope field', () => {
        expect(() =>
          spaceStorageMoveSchema.parse({
            spaceId: 'sp-123',
            path: '/old.txt',
            destinationPath: '/new.txt',
          })
        ).toThrow()
      })

      it('should parse with valid @scope', () => {
        const result = spaceStorageMoveSchema.parse({
          '@scope': 'contact',
          spaceId: 'sp-123',
          path: '/old.txt',
          destinationPath: '/new.txt',
        })

        expect(result['@scope']).toBe('contact')
      })
    })

    describe('spaceStorageCopySchema', () => {
      it('should require @scope field', () => {
        expect(() =>
          spaceStorageCopySchema.parse({
            spaceId: 'sp-123',
            path: '/source.txt',
            destinationPath: '/dest.txt',
          })
        ).toThrow()
      })

      it('should parse with valid @scope', () => {
        const result = spaceStorageCopySchema.parse({
          '@scope': 'user',
          spaceId: 'sp-123',
          path: '/source.txt',
          destinationPath: '/dest.txt',
        })

        expect(result['@scope']).toBe('user')
      })
    })

    describe('spaceStorageDeleteSchema', () => {
      it('should require @scope field', () => {
        expect(() =>
          spaceStorageDeleteSchema.parse({
            spaceId: 'sp-123',
            path: '/file.txt',
          })
        ).toThrow()
      })

      it('should parse with valid @scope', () => {
        const result = spaceStorageDeleteSchema.parse({
          '@scope': 'blueprint',
          spaceId: 'sp-123',
          path: '/file.txt',
        })

        expect(result['@scope']).toBe('blueprint')
      })
    })

    describe('spaceStorageSearchSchema', () => {
      it('should require @scope field', () => {
        expect(() =>
          spaceStorageSearchSchema.parse({
            spaceId: 'sp-123',
            query: 'search term',
          })
        ).toThrow()
      })

      it('should parse with valid @scope', () => {
        const result = spaceStorageSearchSchema.parse({
          '@scope': 'contact',
          spaceId: 'sp-123',
          query: 'search term',
        })

        expect(result['@scope']).toBe('contact')
      })
    })

    describe('spaceStorageImportSchema', () => {
      it('should require @scope field', () => {
        expect(() =>
          spaceStorageImportSchema.parse({
            spaceId: 'sp-123',
            url: 'https://example.com/file.txt',
            path: '/imported.txt',
          })
        ).toThrow()
      })

      it('should parse with valid @scope', () => {
        const result = spaceStorageImportSchema.parse({
          '@scope': 'user',
          spaceId: 'sp-123',
          url: 'https://example.com/file.txt',
          path: '/imported.txt',
        })

        expect(result['@scope']).toBe('user')
      })

      it('should require valid URL', () => {
        expect(() =>
          spaceStorageImportSchema.parse({
            '@scope': 'user',
            spaceId: 'sp-123',
            url: 'not-a-valid-url',
            path: '/imported.txt',
          })
        ).toThrow()
      })
    })
  })

  describe('doSpaceStorageRead', () => {
    it('should find space with scoped filter when linked resource matches', async () => {
      prisma.space.findFirst.mockResolvedValue({ id: spaceId })
      downloadStorageFile.mockResolvedValue({ body: null })

      await doSpaceStorageRead({
        input: '/file.txt',
        params: { '@scope': 'user', spaceId },
        options: baseOptions,
      })

      // Check that findFirst was called with userId filter
      expect(prisma.space.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            id: spaceId,
          }),
        })
      )
    })

    it('should throw UserResourceNotFoundError when space not found', async () => {
      prisma.space.findFirst.mockResolvedValue(null)

      await expect(
        doSpaceStorageRead({
          input: '/file.txt',
          params: { '@scope': 'user', spaceId },
          options: baseOptions,
        })
      ).rejects.toThrow('Space not found')
    })

    it('should call downloadStorageFile with correct params', async () => {
      prisma.space.findFirst.mockResolvedValue({ id: spaceId })
      downloadStorageFile.mockResolvedValue({ body: null })

      await doSpaceStorageRead({
        input: '/documents/file.txt',
        params: { '@scope': 'user', spaceId },
        options: baseOptions,
      })

      expect(downloadStorageFile).toHaveBeenCalledWith({
        spaceId,
        path: '/documents/file.txt',
      })
    })

    it('should log event with correct type', async () => {
      prisma.space.findFirst.mockResolvedValue({ id: spaceId })
      downloadStorageFile.mockResolvedValue({ body: null })

      await doSpaceStorageRead({
        input: '/file.txt',
        params: { '@scope': 'user', spaceId },
        options: baseOptions,
      })

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'action.space.storage.read',
          user: { id: userId },
        })
      )
    })

    describe('line range extraction', () => {
      // @note create content with 200 lines to satisfy .min(100) validation on endLine
      const mockFileContent = Array.from(
        { length: 200 },
        (_, i) => `line${i + 1}`
      ).join('\n')

      // @note helper to create a readable stream from text content
      // @note the storage contract's body, not a raw stream: callers ask for
      // `arrayBuffer()`/`text()` rather than reaching into a vendor's stream.
      function createMockBody(content) {
        const uint8 = new TextEncoder().encode(content)

        return {
          async arrayBuffer() {
            return uint8.buffer
          },

          async text() {
            return content
          },

          stream() {
            return new ReadableStream({
              start(controller) {
                controller.enqueue(uint8)
                controller.close()
              },
            })
          },
        }
      }

      beforeEach(() => {
        prisma.space.findFirst.mockResolvedValue({ id: spaceId })
        downloadStorageFile.mockResolvedValue({
          body: createMockBody(mockFileContent),
        })
      })

      it('should return full file content when no line range specified', async () => {
        const result = await doSpaceStorageRead({
          input: '/file.txt',
          params: { '@scope': 'user', spaceId },
          options: baseOptions,
        })

        expect(result.result.content).toEqual(mockFileContent)
        expect(result.result.totalLines).toEqual(200)
        expect(result.result.startLine).toEqual(1)
        expect(result.result.endLine).toEqual(200)
      })

      it('should return lines starting from startLine (1-indexed)', async () => {
        const result = await doSpaceStorageRead({
          input: '/file.txt',
          params: { '@scope': 'user', spaceId, startLine: 50 },
          options: baseOptions,
        })

        // @note should contain line50-200, but NOT line1-49
        expect(result.result.content).not.toContain('line1\n')
        expect(result.result.content).not.toContain('line49\n')
        expect(result.result.content).toContain('line50')
        expect(result.result.content).toContain('line200')
        expect(result.result.totalLines).toEqual(200)
        expect(result.result.startLine).toEqual(50)
        expect(result.result.endLine).toEqual(200)
      })

      it('should return lines up to endLine (inclusive, 1-indexed)', async () => {
        const result = await doSpaceStorageRead({
          input: '/file.txt',
          params: { '@scope': 'user', spaceId, endLine: 100 },
          options: baseOptions,
        })

        expect(result.result.content).toContain('line1')
        expect(result.result.content).toContain('line100')
        // @note line101 and later should not be in the output
        expect(result.result.content).not.toContain('line101')
        expect(result.result.content).not.toContain('line200')
        expect(result.result.totalLines).toEqual(200)
        expect(result.result.startLine).toEqual(1)
        expect(result.result.endLine).toEqual(100)
      })

      it('should return lines in range (both startLine and endLine)', async () => {
        const result = await doSpaceStorageRead({
          input: '/file.txt',
          params: { '@scope': 'user', spaceId, startLine: 50, endLine: 150 },
          options: baseOptions,
        })

        // @note should contain line50-150 only
        expect(result.result.content).toContain('line50')
        expect(result.result.content).toContain('line100')
        expect(result.result.content).toContain('line150')
        // @note should NOT contain line1-49 or line151-200
        expect(result.result.content).not.toContain('line1\n')
        expect(result.result.content).not.toContain('line49\n')
        expect(result.result.content).not.toContain('line151')
        expect(result.result.totalLines).toEqual(200)
        expect(result.result.startLine).toEqual(50)
        expect(result.result.endLine).toEqual(150)
      })

      it('should handle single line extraction', async () => {
        const result = await doSpaceStorageRead({
          input: '/file.txt',
          params: { '@scope': 'user', spaceId, startLine: 100, endLine: 100 },
          options: baseOptions,
        })

        expect(result.result.content).toEqual('line100')
        expect(result.result.totalLines).toEqual(200)
        expect(result.result.startLine).toEqual(100)
        expect(result.result.endLine).toEqual(100)
      })

      it('should handle startLine beyond content by returning empty', async () => {
        const result = await doSpaceStorageRead({
          input: '/file.txt',
          params: { '@scope': 'user', spaceId, startLine: 300 },
          options: baseOptions,
        })

        // @note contents should be empty but totalLines should still be reported
        expect(result.result.content).toEqual('')
        expect(result.result.totalLines).toEqual(200)
        expect(result.result.startLine).toEqual(300)
      })

      it('should handle endLine beyond content by clamping', async () => {
        const result = await doSpaceStorageRead({
          input: '/file.txt',
          params: { '@scope': 'user', spaceId, startLine: 190, endLine: 500 },
          options: baseOptions,
        })

        expect(result.result.content).toContain('line190')
        expect(result.result.content).toContain('line200')
        expect(result.result.totalLines).toEqual(200)
        expect(result.result.startLine).toEqual(190)
        expect(result.result.endLine).toEqual(500)
      })

      it('should handle string startLine and endLine params (coercion)', async () => {
        const result = await doSpaceStorageRead({
          input: '/file.txt',
          params: {
            '@scope': 'user',
            spaceId,
            startLine: '50',
            endLine: '150',
          },
          options: baseOptions,
        })

        expect(result.result.content).toContain('line50')
        expect(result.result.content).toContain('line150')
        expect(result.result.content).not.toContain('line1\n')
        expect(result.result.content).not.toContain('line49\n')
      })
    })

    it('should throw UserInputError when file does not exist', async () => {
      prisma.space.findFirst.mockResolvedValue({ id: spaceId })

      storageFileExists.mockResolvedValue(false)

      await expect(
        doSpaceStorageRead({
          input: '/missing-file.txt',
          params: { '@scope': 'user', spaceId },
          options: baseOptions,
        })
      ).rejects.toThrow('File not found at path')
    })
  })

  describe('doSpaceStorageWrite', () => {
    it('should find space with scoped filter', async () => {
      prisma.space.findFirst.mockResolvedValue({ id: spaceId })
      uploadStorageFile.mockResolvedValue({})

      await doSpaceStorageWrite({
        input: 'file content',
        params: { '@scope': 'user', spaceId, path: '/file.txt' },
        options: baseOptions,
      })

      expect(prisma.space.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            id: spaceId,
          }),
        })
      )
    })

    it('should throw UserResourceNotFoundError when space not found', async () => {
      prisma.space.findFirst.mockResolvedValue(null)

      await expect(
        doSpaceStorageWrite({
          input: 'content',
          params: { '@scope': 'user', spaceId, path: '/file.txt' },
          options: baseOptions,
        })
      ).rejects.toThrow('Space not found')
    })

    it('should call uploadStorageFile with correct params', async () => {
      prisma.space.findFirst.mockResolvedValue({ id: spaceId })
      uploadStorageFile.mockResolvedValue({})

      await doSpaceStorageWrite({
        input: 'hello world',
        params: { '@scope': 'user', spaceId, path: '/greeting.txt' },
        options: baseOptions,
      })

      expect(uploadStorageFile).toHaveBeenCalledWith({
        spaceId,
        path: '/greeting.txt',
        body: 'hello world',
        contentType: 'text/plain',
      })
    })

    it('should return path in result', async () => {
      prisma.space.findFirst.mockResolvedValue({ id: spaceId })
      uploadStorageFile.mockResolvedValue({})

      const response = await doSpaceStorageWrite({
        input: 'content',
        params: { '@scope': 'user', spaceId, path: '/file.txt' },
        options: baseOptions,
      })

      expect(response.result).toEqual({ path: '/file.txt' })
    })
  })

  // @note the line-edit and read/write paths read the existing file through the
  // storage contract's body. Only the plain read path covered that before, so
  // three of the four body reads in this module were unexercised - and they are
  // exactly the lines the object storage migration rewrote.

  describe('doSpaceStorageWrite line editing', () => {
    beforeEach(() => {
      prisma.space.findFirst.mockResolvedValue({ id: spaceId })
      uploadStorageFile.mockResolvedValue({})
    })

    it('reads the existing content before replacing a line range', async () => {
      downloadStorageFile.mockResolvedValue(bodyOf('line1\nline2\nline3'))

      await doSpaceStorageWrite({
        input: 'replaced',
        params: {
          '@scope': 'user',
          spaceId,
          path: '/file.txt',
          startLine: 2,
          endLine: 2,
        },
        options: baseOptions,
      })

      expect(uploadStorageFile).toHaveBeenCalledWith(
        expect.objectContaining({ body: 'line1\nreplaced\nline3' })
      )
    })

    it('treats an absent body as empty rather than failing', async () => {
      downloadStorageFile.mockResolvedValue({ body: null })

      await doSpaceStorageWrite({
        input: 'first',
        params: { '@scope': 'user', spaceId, path: '/new.txt', startLine: 1 },
        options: baseOptions,
      })

      expect(uploadStorageFile).toHaveBeenCalled()
    })
  })

  describe('doSpaceStorageRw', () => {
    beforeEach(() => {
      prisma.space.findFirst.mockResolvedValue({ id: spaceId })
      uploadStorageFile.mockResolvedValue({})
    })

    it('reads the file through the contract body in read mode', async () => {
      downloadStorageFile.mockResolvedValue(bodyOf('hello world'))

      const response = await doSpaceStorageRw({
        input: '',
        params: { '@scope': 'user', spaceId, path: '/file.txt', mode: 'read' },
        options: baseOptions,
      })

      expect(downloadStorageFile).toHaveBeenCalledWith(
        expect.objectContaining({ spaceId, path: '/file.txt' })
      )
      expect(JSON.stringify(response)).toContain('hello world')
    })

    it('reads the existing file before writing a line range', async () => {
      downloadStorageFile.mockResolvedValue(bodyOf('a\nb\nc'))

      await doSpaceStorageRw({
        input: '',
        params: {
          '@scope': 'user',
          spaceId,
          path: '/file.txt',
          mode: 'write',
          content: 'B',
          startLine: 2,
          endLine: 2,
        },
        options: baseOptions,
      })

      expect(uploadStorageFile).toHaveBeenCalledWith(
        expect.objectContaining({ body: 'a\nB\nc' })
      )
    })
  })

  describe('doSpaceStorageCopy', () => {
    it('should find space with scoped filter', async () => {
      prisma.space.findFirst.mockResolvedValue({ id: spaceId })
      copyStorageFile.mockResolvedValue({})

      await doSpaceStorageCopy({
        input: '',
        params: {
          '@scope': 'user',
          spaceId,
          path: '/source.txt',
          destinationPath: '/dest.txt',
        },
        options: baseOptions,
      })

      expect(prisma.space.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            id: spaceId,
          }),
        })
      )
    })

    it('should throw UserResourceNotFoundError when space not found', async () => {
      prisma.space.findFirst.mockResolvedValue(null)

      await expect(
        doSpaceStorageCopy({
          input: '',
          params: {
            '@scope': 'user',
            spaceId,
            path: '/source.txt',
            destinationPath: '/dest.txt',
          },
          options: baseOptions,
        })
      ).rejects.toThrow('Space not found')
    })

    it('should call copyStorageFile with correct params', async () => {
      prisma.space.findFirst.mockResolvedValue({ id: spaceId })
      copyStorageFile.mockResolvedValue({})

      await doSpaceStorageCopy({
        input: '',
        params: {
          '@scope': 'user',
          spaceId,
          path: '/source.txt',
          destinationPath: '/copy.txt',
        },
        options: baseOptions,
      })

      expect(copyStorageFile).toHaveBeenCalledWith({
        spaceId,
        path: '/source.txt',
        destinationPath: '/copy.txt',
      })
    })

    it('should return path and destinationPath in result', async () => {
      prisma.space.findFirst.mockResolvedValue({ id: spaceId })
      copyStorageFile.mockResolvedValue({})

      const response = await doSpaceStorageCopy({
        input: '',
        params: {
          '@scope': 'user',
          spaceId,
          path: '/a.txt',
          destinationPath: '/b.txt',
        },
        options: baseOptions,
      })

      expect(response.result).toEqual({
        path: '/a.txt',
        destinationPath: '/b.txt',
      })
    })
  })

  describe('doSpaceStorageDelete', () => {
    it('should find space with scoped filter', async () => {
      prisma.space.findFirst.mockResolvedValue({ id: spaceId })
      deleteStorageFile.mockResolvedValue({})

      await doSpaceStorageDelete({
        input: '/file.txt',
        params: { '@scope': 'user', spaceId },
        options: baseOptions,
      })

      expect(prisma.space.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            id: spaceId,
          }),
        })
      )
    })

    it('should throw UserResourceNotFoundError when space not found', async () => {
      prisma.space.findFirst.mockResolvedValue(null)

      await expect(
        doSpaceStorageDelete({
          input: '/file.txt',
          params: { '@scope': 'user', spaceId },
          options: baseOptions,
        })
      ).rejects.toThrow('Space not found')
    })

    it('should call deleteStorageFile with correct params', async () => {
      prisma.space.findFirst.mockResolvedValue({ id: spaceId })
      deleteStorageFile.mockResolvedValue({})

      await doSpaceStorageDelete({
        input: '/to-delete.txt',
        params: { '@scope': 'user', spaceId },
        options: baseOptions,
      })

      expect(deleteStorageFile).toHaveBeenCalledWith({
        spaceId,
        path: '/to-delete.txt',
      })
    })

    it('should return path in result', async () => {
      prisma.space.findFirst.mockResolvedValue({ id: spaceId })
      deleteStorageFile.mockResolvedValue({})

      const response = await doSpaceStorageDelete({
        input: '/file.txt',
        params: { '@scope': 'user', spaceId },
        options: baseOptions,
      })

      expect(response.result).toEqual({ path: '/file.txt' })
    })
  })

  describe('doSpaceStorageSearch', () => {
    it('should find space with scoped filter', async () => {
      prisma.space.findFirst.mockResolvedValue({ id: spaceId })
      searchStorageFiles.mockResolvedValue([])

      await doSpaceStorageSearch({
        input: '',
        params: { '@scope': 'user', spaceId, query: 'search term' },
        options: baseOptions,
      })

      expect(prisma.space.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            id: spaceId,
          }),
        })
      )
    })

    it('should throw UserResourceNotFoundError when space not found', async () => {
      prisma.space.findFirst.mockResolvedValue(null)

      await expect(
        doSpaceStorageSearch({
          input: '',
          params: { '@scope': 'user', spaceId, query: 'test' },
          options: baseOptions,
        })
      ).rejects.toThrow('Space not found')
    })

    it('should call searchStorageFiles with correct params', async () => {
      prisma.space.findFirst.mockResolvedValue({ id: spaceId })
      searchStorageFiles.mockResolvedValue([])

      await doSpaceStorageSearch({
        input: '',
        params: { '@scope': 'user', spaceId, query: 'find me' },
        options: baseOptions,
      })

      expect(searchStorageFiles).toHaveBeenCalledWith({
        spaceId,
        query: 'find me',
      })
    })

    it('should return query and results in result', async () => {
      const mockResults = [{ path: '/found.txt', score: 0.9 }]

      prisma.space.findFirst.mockResolvedValue({ id: spaceId })
      searchStorageFiles.mockResolvedValue(mockResults)

      const response = await doSpaceStorageSearch({
        input: '',
        params: { '@scope': 'user', spaceId, query: 'test query' },
        options: baseOptions,
      })

      expect(response.result).toEqual({
        query: 'test query',
        results: mockResults,
      })
    })
  })

  describe('doSpaceStorageImport', () => {
    it('should find space with scoped filter', async () => {
      prisma.space.findFirst.mockResolvedValue({ id: spaceId })
      fetchPlusPlus.mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/plain' },
      })
      download.mockResolvedValue(new ArrayBuffer(0))
      uploadStorageFile.mockResolvedValue({})

      await doSpaceStorageImport({
        input: 'https://example.com/file.txt',
        params: { '@scope': 'user', spaceId, path: '/imported.txt' },
        options: baseOptions,
      })

      expect(prisma.space.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            id: spaceId,
          }),
        })
      )
    })

    it('should throw UserResourceNotFoundError when space not found', async () => {
      prisma.space.findFirst.mockResolvedValue(null)

      await expect(
        doSpaceStorageImport({
          input: 'https://example.com/file.txt',
          params: { '@scope': 'user', spaceId, path: '/imported.txt' },
          options: baseOptions,
        })
      ).rejects.toThrow('Space not found')
    })

    it('should throw UserInputError when fetch fails', async () => {
      prisma.space.findFirst.mockResolvedValue({ id: spaceId })
      fetchPlusPlus.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      })

      await expect(
        doSpaceStorageImport({
          input: 'https://example.com/not-found.txt',
          params: { '@scope': 'user', spaceId, path: '/imported.txt' },
          options: baseOptions,
        })
      ).rejects.toThrow('Failed to fetch URL: Not Found')
    })

    it('should call uploadStorageFile with correct params', async () => {
      const mockContent = 'Hello World'
      const encoder = new TextEncoder()
      const mockBuffer = encoder.encode(mockContent).buffer

      prisma.space.findFirst.mockResolvedValue({ id: spaceId })
      fetchPlusPlus.mockResolvedValue({
        ok: true,
      })
      getContentTypeHeader.mockReturnValue('text/plain')
      download.mockResolvedValue(mockBuffer)
      uploadStorageFile.mockResolvedValue({})

      await doSpaceStorageImport({
        input: 'https://example.com/file.txt',
        params: { '@scope': 'user', spaceId, path: '/imported.txt' },
        options: baseOptions,
      })

      expect(uploadStorageFile).toHaveBeenCalledWith({
        spaceId,
        path: '/imported.txt',
        body: Buffer.from(mockBuffer),
        contentType: 'text/plain',
      })
    })

    it('should return url and path in result', async () => {
      prisma.space.findFirst.mockResolvedValue({ id: spaceId })
      fetchPlusPlus.mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
      })
      download.mockResolvedValue(new ArrayBuffer(0))
      uploadStorageFile.mockResolvedValue({})

      const response = await doSpaceStorageImport({
        input: 'https://example.com/data.json',
        params: { '@scope': 'user', spaceId, path: '/data.json' },
        options: baseOptions,
      })

      expect(response.result).toEqual({
        url: 'https://example.com/data.json',
        path: '/data.json',
      })
    })
  })

  describe('executeSpaceAction', () => {
    beforeEach(() => {
      prisma.space.findFirst.mockResolvedValue({ id: spaceId })
      listStorage.mockResolvedValue({ items: [] })
      downloadStorageFile.mockResolvedValue({ body: null })
      uploadStorageFile.mockResolvedValue({})
      moveStorageFile.mockResolvedValue({})
      copyStorageFile.mockResolvedValue({})
      deleteStorageFile.mockResolvedValue({})
      searchStorageFiles.mockResolvedValue([])
      fetchPlusPlus.mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/octet-stream' },
      })
      download.mockResolvedValue(new ArrayBuffer(0))
    })

    it('should route to storage/list operation', async () => {
      const response = await executeSpaceAction(
        '',
        { '@scope': 'user', storage: true, list: true, spaceId },
        baseOptions
      )

      expect(listStorage).toHaveBeenCalled()
      expect(response.result).toEqual([])
    })

    it('should route to storage/read operation', async () => {
      await executeSpaceAction(
        '/file.txt',
        { '@scope': 'user', storage: true, read: true, spaceId },
        baseOptions
      )

      expect(downloadStorageFile).toHaveBeenCalled()
    })

    it('should route to storage/write operation', async () => {
      await executeSpaceAction(
        'content',
        {
          '@scope': 'user',
          storage: true,
          write: true,
          spaceId,
          path: '/file.txt',
        },
        baseOptions
      )

      expect(uploadStorageFile).toHaveBeenCalled()
    })

    it('should route to storage/move operation', async () => {
      await executeSpaceAction(
        '',
        {
          '@scope': 'user',
          storage: true,
          move: true,
          spaceId,
          path: '/old.txt',
          destinationPath: '/new.txt',
        },
        baseOptions
      )

      expect(moveStorageFile).toHaveBeenCalled()
    })

    it('should route to storage/copy operation', async () => {
      await executeSpaceAction(
        '',
        {
          '@scope': 'user',
          storage: true,
          copy: true,
          spaceId,
          path: '/src.txt',
          destinationPath: '/dst.txt',
        },
        baseOptions
      )

      expect(copyStorageFile).toHaveBeenCalled()
    })

    it('should route to storage/delete operation', async () => {
      await executeSpaceAction(
        '/file.txt',
        { '@scope': 'user', storage: true, delete: true, spaceId },
        baseOptions
      )

      expect(deleteStorageFile).toHaveBeenCalled()
    })

    it('should route to storage/search operation', async () => {
      await executeSpaceAction(
        '',
        {
          '@scope': 'user',
          storage: true,
          search: true,
          spaceId,
          query: 'test',
        },
        baseOptions
      )

      expect(searchStorageFiles).toHaveBeenCalled()
    })

    it('should route to storage/import operation', async () => {
      await executeSpaceAction(
        'https://example.com/file.txt',
        {
          '@scope': 'user',
          storage: true,
          import: true,
          spaceId,
          path: '/imported.txt',
        },
        baseOptions
      )

      expect(fetchPlusPlus).toHaveBeenCalled()
      expect(uploadStorageFile).toHaveBeenCalled()
    })

    it('should throw UserInputError for unknown operation', async () => {
      await expect(
        executeSpaceAction(
          '',
          { '@scope': 'user', unknown: true, spaceId },
          baseOptions
        )
      ).rejects.toThrow('Unknown operation')
    })
  })

  describe('scope behavior integration', () => {
    it('should use user-only filter when scope is user', async () => {
      prisma.space.findFirst.mockResolvedValue({ id: spaceId })
      downloadStorageFile.mockResolvedValue({ body: null })

      await doSpaceStorageRead({
        input: '/file.txt',
        params: { '@scope': 'user', spaceId },
        options: baseOptions,
      })

      // With user scope, filter should have userId only (no contactId/namespace)
      expect(prisma.space.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
          }),
        })
      )
    })

    it('should use contact filter when scope is contact', async () => {
      const contact = { id: 'contact-789' }

      getContextContact.mockReturnValue(contact)

      prisma.space.findFirst.mockResolvedValue({ id: spaceId })
      downloadStorageFile.mockResolvedValue({ body: null })

      await doSpaceStorageRead({
        input: '/file.txt',
        params: { '@scope': 'contact', spaceId },
        options: baseOptions,
      })

      expect(prisma.space.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            contactId: 'contact-789',
          }),
        })
      )
    })

    it('should use blueprint filter when scope is blueprint', async () => {
      prisma.space.findFirst.mockResolvedValue({ id: spaceId })
      downloadStorageFile.mockResolvedValue({ body: null })

      await doSpaceStorageRead({
        input: '/file.txt',
        params: { '@scope': 'blueprint', spaceId },
        options: baseOptions,
      })

      expect(prisma.space.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            blueprintId: 'bp-123',
          }),
        })
      )
    })
  })
})
