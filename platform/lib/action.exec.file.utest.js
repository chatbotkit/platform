/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import {
  doAppendFile,
  doPrependFile,
  doReadFile,
  doReplaceFile,
  doRwFile,
  doWriteFile,
  executeFileAction,
} from '@/lib/action.exec.file'
import * as dsd2 from '@/lib/dsd2'
import * as fileAccess from '@/lib/file.access'
import * as fileStorage from '@/lib/file.storage'

Object.assign(process.env, {
  STORAGE_REGION: 'us-east-1',
  STORAGE_ACCESS_KEY_ID: 'test-key',
  STORAGE_SECRET_ACCESS_KEY: 'test-secret',
})

jest.mock('@/lib/storage', () => ({
  client: {},
}))

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/temp.file', () => ({
  createTempFile: jest.fn(),
  cleanupTempFile: jest.fn(),
}))

jest.mock('@/lib/dsd2', () => ({
  chunkUrl: jest.fn(),
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/file.storage')

jest.mock('@/lib/file.access', () => ({
  canUseFile: jest.fn(),
}))

describe('doReadFile', () => {
  // @note create content with 200 lines to satisfy .min(100) validation on endLine
  const mockFileContent = Array.from(
    { length: 200 },
    (_, i) => `line${i + 1}`
  ).join('\n')

  beforeEach(() => {
    jest.clearAllMocks()
    mockReset(prisma)

    // @note set up default mock behavior
    prisma.file.findUnique.mockResolvedValue({
      id: 'file-123',
      userId: 'user-123',
    })

    fileAccess.canUseFile.mockReturnValue(true)
    fileStorage.fileObjectExists.mockResolvedValue(true)
    fileStorage.getFileObjectDownloadUrl.mockResolvedValue(
      'https://example.com/file.txt'
    )
    dsd2.chunkUrl.mockResolvedValue({
      items: [{ text: mockFileContent }],
    })
  })

  describe('basic read functionality', () => {
    it('should read full file content when no line range specified', async () => {
      const result = await doReadFile({
        input: '',
        params: { fileId: 'file-123' },
        options: { userId: 'user-123' },
      })

      expect(result.result.text).toEqual(mockFileContent)
      expect(result.result.totalLines).toEqual(200)
      expect(result.result.startLine).toEqual(1)
      expect(result.result.endLine).toEqual(200)
      expect(result.messages).toEqual([])
    })

    it('should throw error when file not found', async () => {
      prisma.file.findUnique.mockResolvedValue(null)

      await expect(
        doReadFile({
          input: '',
          params: { fileId: 'non-existent' },
          options: { userId: 'user-123' },
        })
      ).rejects.toThrow('File not found')
    })

    it('should throw error when user cannot access file', async () => {
      fileAccess.canUseFile.mockReturnValue(false)

      await expect(
        doReadFile({
          input: '',
          params: { fileId: 'file-123' },
          options: { userId: 'user-456' },
        })
      ).rejects.toThrow('Cannot use file')
    })

    it('should throw error when file content does not exist', async () => {
      fileStorage.fileObjectExists.mockResolvedValue(false)

      await expect(
        doReadFile({
          input: '',
          params: { fileId: 'file-123' },
          options: { userId: 'user-123' },
        })
      ).rejects.toThrow('File content not found')
    })

    it('should throw error when fileId or id is missing', async () => {
      await expect(
        doReadFile({
          input: '',
          params: {},
          options: { userId: 'user-123' },
        })
      ).rejects.toThrow("Missing 'fileId' or 'id' parameter")
    })

    it('should accept id parameter as alternative to fileId', async () => {
      const result = await doReadFile({
        input: '',
        params: { id: 'file-123' },
        options: { userId: 'user-123' },
      })

      expect(result.result.text).toEqual(mockFileContent)
      expect(prisma.file.findUnique).toHaveBeenCalledWith({
        where: { id: 'file-123' },
      })
    })
  })

  describe('line range extraction', () => {
    it('should return lines starting from startLine (1-indexed)', async () => {
      const result = await doReadFile({
        input: '',
        params: { fileId: 'file-123', startLine: 50 },
        options: { userId: 'user-123' },
      })

      // @note should contain line50-200, but NOT line1-49
      expect(result.result.text).not.toContain('line1\n')
      expect(result.result.text).not.toContain('line49\n')
      expect(result.result.text).toContain('line50')
      expect(result.result.text).toContain('line200')
      expect(result.result.totalLines).toEqual(200)
      expect(result.result.startLine).toEqual(50)
      expect(result.result.endLine).toEqual(200)
    })

    it('should return lines up to endLine (inclusive, 1-indexed)', async () => {
      const result = await doReadFile({
        input: '',
        params: { fileId: 'file-123', endLine: 100 },
        options: { userId: 'user-123' },
      })

      expect(result.result.text).toContain('line1')
      expect(result.result.text).toContain('line100')
      // @note line101 and later should not be in the output
      expect(result.result.text).not.toContain('line101')
      expect(result.result.text).not.toContain('line200')
      expect(result.result.totalLines).toEqual(200)
      expect(result.result.startLine).toEqual(1)
      expect(result.result.endLine).toEqual(100)
    })

    it('should return lines in range (both startLine and endLine)', async () => {
      const result = await doReadFile({
        input: '',
        params: { fileId: 'file-123', startLine: 50, endLine: 150 },
        options: { userId: 'user-123' },
      })

      // @note should contain line50-150 only
      expect(result.result.text).toContain('line50')
      expect(result.result.text).toContain('line100')
      expect(result.result.text).toContain('line150')
      // @note should NOT contain line1-49 or line151-200
      expect(result.result.text).not.toContain('line1\n')
      expect(result.result.text).not.toContain('line49\n')
      expect(result.result.text).not.toContain('line151')
      expect(result.result.totalLines).toEqual(200)
      expect(result.result.startLine).toEqual(50)
      expect(result.result.endLine).toEqual(150)
    })

    it('should handle single line extraction', async () => {
      const result = await doReadFile({
        input: '',
        params: { fileId: 'file-123', startLine: 100, endLine: 100 },
        options: { userId: 'user-123' },
      })

      expect(result.result.text).toEqual('line100')
      expect(result.result.totalLines).toEqual(200)
      expect(result.result.startLine).toEqual(100)
      expect(result.result.endLine).toEqual(100)
    })

    it('should handle startLine at first line (1-indexed)', async () => {
      const result = await doReadFile({
        input: '',
        params: { fileId: 'file-123', startLine: 1, endLine: 100 },
        options: { userId: 'user-123' },
      })

      expect(result.result.text).toContain('line1')
      expect(result.result.text).toContain('line100')
      expect(result.result.text).not.toContain('line101')
      expect(result.result.totalLines).toEqual(200)
    })

    it('should handle startLine beyond content by returning empty', async () => {
      const result = await doReadFile({
        input: '',
        params: { fileId: 'file-123', startLine: 300 },
        options: { userId: 'user-123' },
      })

      // @note contents should be empty but totalLines should still be reported
      expect(result.result.text).toEqual('')
      expect(result.result.totalLines).toEqual(200)
      expect(result.result.startLine).toEqual(300)
    })

    it('should handle endLine beyond content by clamping', async () => {
      const result = await doReadFile({
        input: '',
        params: { fileId: 'file-123', startLine: 190, endLine: 500 },
        options: { userId: 'user-123' },
      })

      expect(result.result.text).toContain('line190')
      expect(result.result.text).toContain('line200')
      expect(result.result.totalLines).toEqual(200)
      expect(result.result.startLine).toEqual(190)
      expect(result.result.endLine).toEqual(500)
    })

    it('should handle string startLine and endLine params (coercion)', async () => {
      const result = await doReadFile({
        input: '',
        params: { fileId: 'file-123', startLine: '50', endLine: '150' },
        options: { userId: 'user-123' },
      })

      expect(result.result.text).toContain('line50')
      expect(result.result.text).toContain('line150')
      expect(result.result.text).not.toContain('line1\n')
      expect(result.result.text).not.toContain('line49\n')
    })

    it('should accept endLine values less than 100', async () => {
      const result = await doReadFile({
        input: '',
        params: { fileId: 'file-123', startLine: 1, endLine: 10 },
        options: { userId: 'user-123' },
      })

      expect(result.result.text).toContain('line1')
      expect(result.result.text).toContain('line10')
      expect(result.result.text).not.toContain('line11')
      expect(result.result.totalLines).toEqual(200)
      expect(result.result.startLine).toEqual(1)
      expect(result.result.endLine).toEqual(10)
    })
  })
})

describe('doRwFile', () => {
  // @note create content with 200 lines to satisfy .min(100) validation on endLine
  const mockFileContent = Array.from(
    { length: 200 },
    (_, i) => `line${i + 1}`
  ).join('\n')

  beforeEach(() => {
    jest.clearAllMocks()
    mockReset(prisma)

    // @note set up default mock behavior
    prisma.file.findUnique.mockResolvedValue({
      id: 'file-123',
      userId: 'user-123',
    })

    fileAccess.canUseFile.mockReturnValue(true)
    fileStorage.fileObjectExists.mockResolvedValue(true)
    fileStorage.getFileObjectDownloadUrl.mockResolvedValue(
      'https://example.com/file.txt'
    )
    fileStorage.uploadFileObject.mockResolvedValue({})
    dsd2.chunkUrl.mockResolvedValue({
      items: [{ text: mockFileContent }],
    })
  })

  describe('read mode', () => {
    it('should read full file content when mode is read', async () => {
      const result = await doRwFile({
        input: '',
        params: { fileId: 'file-123', mode: 'read' },
        options: { userId: 'user-123' },
      })

      expect(result.result.text).toEqual(mockFileContent)
      expect(result.result.totalLines).toEqual(200)
      expect(result.result.startLine).toEqual(1)
      expect(result.result.endLine).toEqual(200)
    })

    it('should read lines in range for read mode', async () => {
      const result = await doRwFile({
        input: '',
        params: {
          fileId: 'file-123',
          mode: 'read',
          startLine: 50,
          endLine: 150,
        },
        options: { userId: 'user-123' },
      })

      expect(result.result.text).toContain('line50')
      expect(result.result.text).toContain('line150')
      expect(result.result.text).not.toContain('line1\n')
      expect(result.result.text).not.toContain('line49\n')
      expect(result.result.startLine).toEqual(50)
      expect(result.result.endLine).toEqual(150)
    })

    it('should coerce string startLine and endLine to numbers (read mode)', async () => {
      const result = await doRwFile({
        input: '',
        params: {
          fileId: 'file-123',
          mode: 'read',
          startLine: '50',
          endLine: '150',
        },
        options: { userId: 'user-123' },
      })

      expect(result.result.text).toContain('line50')
      expect(result.result.text).toContain('line150')
      expect(result.result.startLine).toEqual(50)
      expect(result.result.endLine).toEqual(150)
    })

    it('should throw error when file content does not exist in read mode', async () => {
      fileStorage.fileObjectExists.mockResolvedValue(false)

      await expect(
        doRwFile({
          input: '',
          params: { fileId: 'file-123', mode: 'read' },
          options: { userId: 'user-123' },
        })
      ).rejects.toThrow('File content not found')
    })
  })

  describe('write mode', () => {
    it('should write full file content when mode is write', async () => {
      const result = await doRwFile({
        input: '',
        params: { fileId: 'file-123', mode: 'write', text: 'new content' },
        options: { userId: 'user-123' },
      })

      expect(fileStorage.uploadFileObject).toHaveBeenCalledWith(
        'file-123',
        'new content',
        { contentType: 'text/plain' }
      )
      expect(result.result.startLine).toBeUndefined()
      expect(result.result.endLine).toBeUndefined()
    })

    it('should throw error when text is missing in write mode', async () => {
      await expect(
        doRwFile({
          input: '',
          params: { fileId: 'file-123', mode: 'write' },
          options: { userId: 'user-123' },
        })
      ).rejects.toThrow("Missing 'text' parameter for write mode")
    })

    it('should replace lines when startLine and endLine are provided', async () => {
      const result = await doRwFile({
        input: '',
        params: {
          fileId: 'file-123',
          mode: 'write',
          text: 'replaced content',
          startLine: 5,
          endLine: 10,
        },
        options: { userId: 'user-123' },
      })

      // @note verify upload was called with modified content
      expect(fileStorage.uploadFileObject).toHaveBeenCalled()
      expect(result.result.startLine).toEqual(5)
      expect(result.result.endLine).toEqual(10)
    })

    it('should coerce string startLine and endLine to numbers (write mode)', async () => {
      const result = await doRwFile({
        input: '',
        params: {
          fileId: 'file-123',
          mode: 'write',
          text: 'replaced content',
          startLine: '5',
          endLine: '10',
        },
        options: { userId: 'user-123' },
      })

      expect(fileStorage.uploadFileObject).toHaveBeenCalled()
      expect(result.result.startLine).toEqual(5)
      expect(result.result.endLine).toEqual(10)
    })

    it('should throw error when file content does not exist for line-based write', async () => {
      fileStorage.fileObjectExists.mockResolvedValue(false)

      await expect(
        doRwFile({
          input: '',
          params: {
            fileId: 'file-123',
            mode: 'write',
            text: 'new content',
            startLine: 5,
            endLine: 10,
          },
          options: { userId: 'user-123' },
        })
      ).rejects.toThrow('File content not found')
    })
  })

  describe('common functionality', () => {
    it('should throw error when file not found', async () => {
      prisma.file.findUnique.mockResolvedValue(null)

      await expect(
        doRwFile({
          input: '',
          params: { fileId: 'non-existent', mode: 'read' },
          options: { userId: 'user-123' },
        })
      ).rejects.toThrow('File not found')
    })

    it('should throw error when user cannot access file', async () => {
      fileAccess.canUseFile.mockReturnValue(false)

      await expect(
        doRwFile({
          input: '',
          params: { fileId: 'file-123', mode: 'read' },
          options: { userId: 'user-456' },
        })
      ).rejects.toThrow('Cannot use file')
    })

    it('should throw error when fileId or id is missing', async () => {
      await expect(
        doRwFile({
          input: '',
          params: { mode: 'read' },
          options: { userId: 'user-123' },
        })
      ).rejects.toThrow("Missing 'fileId' or 'id' parameter")
    })

    it('should accept id parameter as alternative to fileId', async () => {
      const result = await doRwFile({
        input: '',
        params: { id: 'file-123', mode: 'read' },
        options: { userId: 'user-123' },
      })

      expect(result.result.text).toEqual(mockFileContent)
      expect(prisma.file.findUnique).toHaveBeenCalledWith({
        where: { id: 'file-123' },
      })
    })
  })
})

describe('doPrependFile', () => {
  const noSuchKeyError = Object.assign(new Error('NoSuchKey'), {
    name: 'NoSuchKey',
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockReset(prisma)

    prisma.file.findUnique.mockResolvedValue({
      id: 'file-123',
      userId: 'user-123',
    })

    fileAccess.canUseFile.mockReturnValue(true)
    fileStorage.uploadFileObject.mockResolvedValue(undefined)
  })

  it('should treat file as empty when S3 object does not exist (NoSuchKey)', async () => {
    fileStorage.downloadFileObject.mockRejectedValue(noSuchKeyError)

    const result = await doPrependFile({
      input: 'new content',
      params: { fileId: 'file-123', text: 'new content' },
      options: { userId: 'user-123' },
    })

    expect(fileStorage.uploadFileObject).toHaveBeenCalledWith(
      'file-123',
      'new content',
      { contentType: 'text/plain' }
    )
    expect(result).toEqual({ result: {}, messages: [] })
  })

  it('should prepend to existing content when file exists', async () => {
    fileStorage.downloadFileObject.mockResolvedValue({
      body: {
        arrayBuffer: async () =>
          new TextEncoder().encode('existing content').buffer,
      },
    })

    await doPrependFile({
      input: 'new content\n',
      params: { fileId: 'file-123', text: 'new content\n' },
      options: { userId: 'user-123' },
    })

    expect(fileStorage.uploadFileObject).toHaveBeenCalledWith(
      'file-123',
      expect.stringContaining('new content'),
      { contentType: 'text/plain' }
    )
  })

  it('should rethrow non-NoSuchKey errors', async () => {
    const networkError = new Error('Network error')

    fileStorage.downloadFileObject.mockRejectedValue(networkError)

    await expect(
      doPrependFile({
        input: 'text',
        params: { fileId: 'file-123', text: 'text' },
        options: { userId: 'user-123' },
      })
    ).rejects.toThrow('Network error')
  })
})

describe('doAppendFile', () => {
  const noSuchKeyError = Object.assign(new Error('NoSuchKey'), {
    name: 'NoSuchKey',
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockReset(prisma)

    prisma.file.findUnique.mockResolvedValue({
      id: 'file-123',
      userId: 'user-123',
    })

    fileAccess.canUseFile.mockReturnValue(true)
    fileStorage.uploadFileObject.mockResolvedValue(undefined)
  })

  it('should treat file as empty when S3 object does not exist (NoSuchKey)', async () => {
    fileStorage.downloadFileObject.mockRejectedValue(noSuchKeyError)

    const result = await doAppendFile({
      input: 'appended content',
      params: { fileId: 'file-123', text: 'appended content' },
      options: { userId: 'user-123' },
    })

    expect(fileStorage.uploadFileObject).toHaveBeenCalledWith(
      'file-123',
      'appended content',
      { contentType: 'text/plain' }
    )
    expect(result).toEqual({ result: {}, messages: [] })
  })

  it('should rethrow non-NoSuchKey errors', async () => {
    const networkError = new Error('Network error')

    fileStorage.downloadFileObject.mockRejectedValue(networkError)

    await expect(
      doAppendFile({
        input: 'text',
        params: { fileId: 'file-123', text: 'text' },
        options: { userId: 'user-123' },
      })
    ).rejects.toThrow('Network error')
  })
})

describe('doReplaceFile', () => {
  const noSuchKeyError = Object.assign(new Error('NoSuchKey'), {
    name: 'NoSuchKey',
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockReset(prisma)

    prisma.file.findUnique.mockResolvedValue({
      id: 'file-123',
      userId: 'user-123',
    })

    fileAccess.canUseFile.mockReturnValue(true)
    fileStorage.uploadFileObject.mockResolvedValue(undefined)
  })

  const bodyOf = (text) => ({
    body: { arrayBuffer: async () => new TextEncoder().encode(text).buffer },
  })

  it('should report no replacements (and not write) when the file is empty (NoSuchKey)', async () => {
    fileStorage.downloadFileObject.mockRejectedValue(noSuchKeyError)

    const result = await doReplaceFile({
      input: '',
      params: { fileId: 'file-123', search: 'old', replace: 'new' },
      options: { userId: 'user-123' },
    })

    // @note a no-op must not be silently reported as a successful edit, nor
    // re-upload the unchanged file
    expect(fileStorage.uploadFileObject).not.toHaveBeenCalled()
    expect(result.result.replacements).toEqual(0)
    expect(result.result.changed).toBe(false)
    expect(result.result.warning).toContain('search text not found')
  })

  it('should rethrow non-NoSuchKey errors', async () => {
    const networkError = new Error('Network error')

    fileStorage.downloadFileObject.mockRejectedValue(networkError)

    await expect(
      doReplaceFile({
        input: '',
        params: { fileId: 'file-123', search: 'old', replace: 'new' },
        options: { userId: 'user-123' },
      })
    ).rejects.toThrow('Network error')
  })

  it('should replace all occurrences and report a preview', async () => {
    fileStorage.downloadFileObject.mockResolvedValue(bodyOf('foo\nbar\nfoo'))

    const result = await doReplaceFile({
      input: '',
      params: { fileId: 'file-123', search: 'foo', replace: 'baz' },
      options: { userId: 'user-123' },
    })

    expect(fileStorage.uploadFileObject).toHaveBeenCalledWith(
      'file-123',
      'baz\nbar\nbaz',
      { contentType: 'text/plain' }
    )
    expect(result.result.replacements).toEqual(2)
    expect(result.result.changed).toBe(true)
    expect(typeof result.result.preview).toBe('string')
  })

  it('should respect the count parameter (ReDoS-safe literal replace)', async () => {
    fileStorage.downloadFileObject.mockResolvedValue(bodyOf('foo foo foo'))

    const result = await doReplaceFile({
      input: '',
      params: { fileId: 'file-123', search: 'foo', replace: 'x', count: 2 },
      options: { userId: 'user-123' },
    })

    expect(fileStorage.uploadFileObject).toHaveBeenCalledWith(
      'file-123',
      'x x foo',
      { contentType: 'text/plain' }
    )
    expect(result.result.replacements).toEqual(2)
  })

  it('should treat a regex-special search string literally', async () => {
    fileStorage.downloadFileObject.mockResolvedValue(bodyOf('a.b.c a+b'))

    const result = await doReplaceFile({
      input: '',
      // @note "." and "+" would be wildcards under RegExp; here they are literal
      params: { fileId: 'file-123', search: 'a.b', replace: 'Z' },
      options: { userId: 'user-123' },
    })

    expect(fileStorage.uploadFileObject).toHaveBeenCalledWith(
      'file-123',
      'Z.c a+b',
      { contentType: 'text/plain' }
    )
    expect(result.result.replacements).toEqual(1)
  })

  it('should report changed false and not write when search is absent', async () => {
    fileStorage.downloadFileObject.mockResolvedValue(bodyOf('nothing here'))

    const result = await doReplaceFile({
      input: '',
      params: { fileId: 'file-123', search: 'absent', replace: 'x' },
      options: { userId: 'user-123' },
    })

    expect(fileStorage.uploadFileObject).not.toHaveBeenCalled()
    expect(result.result.replacements).toEqual(0)
    expect(result.result.changed).toBe(false)
    expect(result.result.warning).toContain('search text not found')
  })
})

describe('doWriteFile', () => {
  // @note 20 lines is enough for line-based write tests (no .min(100) on endLine)
  const mockFileContent = Array.from(
    { length: 20 },
    (_, i) => `line${i + 1}`
  ).join('\n')

  beforeEach(() => {
    jest.clearAllMocks()
    mockReset(prisma)

    prisma.file.findUnique.mockResolvedValue({
      id: 'file-123',
      userId: 'user-123',
    })

    fileAccess.canUseFile.mockReturnValue(true)
    fileStorage.fileObjectExists.mockResolvedValue(true)
    fileStorage.uploadFileObject.mockResolvedValue(undefined)
    fileStorage.getFileObjectDownloadUrl.mockResolvedValue(
      'https://example.com/file.txt'
    )
    dsd2.chunkUrl.mockResolvedValue({
      items: [{ text: mockFileContent }],
    })
  })

  it('should throw error when file content does not exist for line-based write', async () => {
    fileStorage.fileObjectExists.mockResolvedValue(false)

    await expect(
      doWriteFile({
        input: '',
        params: {
          fileId: 'file-123',
          text: 'new content',
          startLine: 5,
          endLine: 10,
        },
        options: { userId: 'user-123' },
      })
    ).rejects.toThrow('File content not found')
  })

  it('should overwrite entire file when no startLine or endLine provided', async () => {
    const result = await doWriteFile({
      input: '',
      params: { fileId: 'file-123', text: 'completely new content' },
      options: { userId: 'user-123' },
    })

    expect(fileStorage.uploadFileObject).toHaveBeenCalledWith(
      'file-123',
      'completely new content',
      { contentType: 'text/plain' }
    )
    expect(result.result.startLine).toBeUndefined()
    expect(result.result.endLine).toBeUndefined()
    expect(result.messages).toEqual([])
  })

  it('should not call getFileObjectDownloadUrl when doing a full overwrite', async () => {
    await doWriteFile({
      input: '',
      params: { fileId: 'file-123', text: 'new content' },
      options: { userId: 'user-123' },
    })

    expect(fileStorage.getFileObjectDownloadUrl).not.toHaveBeenCalled()
    expect(dsd2.chunkUrl).not.toHaveBeenCalled()
  })

  it('should perform line-based write when startLine and endLine are provided', async () => {
    const result = await doWriteFile({
      input: '',
      params: {
        fileId: 'file-123',
        text: 'replaced',
        startLine: 3,
        endLine: 5,
      },
      options: { userId: 'user-123' },
    })

    expect(fileStorage.getFileObjectDownloadUrl).toHaveBeenCalledWith(
      'file-123'
    )
    expect(dsd2.chunkUrl).toHaveBeenCalled()
    expect(fileStorage.uploadFileObject).toHaveBeenCalled()
    expect(result.result.startLine).toEqual(3)
    expect(result.result.endLine).toEqual(5)
  })

  it('should perform line-based write when only startLine is provided', async () => {
    const result = await doWriteFile({
      input: '',
      params: { fileId: 'file-123', text: 'inserted', startLine: 5 },
      options: { userId: 'user-123' },
    })

    expect(fileStorage.getFileObjectDownloadUrl).toHaveBeenCalledWith(
      'file-123'
    )
    expect(fileStorage.uploadFileObject).toHaveBeenCalled()
    expect(result.result.startLine).toEqual(5)
    expect(result.result.endLine).toBeUndefined()
  })

  it('should report a preview and changed range for a line-based write', async () => {
    const result = await doWriteFile({
      input: '',
      params: {
        fileId: 'file-123',
        text: 'replaced',
        startLine: 3,
        endLine: 5,
      },
      options: { userId: 'user-123' },
    })

    expect(result.result.changed).toBe(true)
    expect(result.result.affectedStartLine).toEqual(3)
    expect(typeof result.result.preview).toBe('string')
    expect(result.result.preview).toContain('replaced')
  })

  it('should warn when a line range falls outside the file', async () => {
    // @note mockFileContent is 20 lines; ask to replace lines 50-60
    const result = await doWriteFile({
      input: '',
      params: {
        fileId: 'file-123',
        text: 'X',
        startLine: 50,
        endLine: 60,
      },
      options: { userId: 'user-123' },
    })

    expect(result.result.warning).toContain('past the end of the file')
    // @note the agent can see the requested range vs where it actually landed
    expect(result.result.startLine).toEqual(50)
    expect(result.result.affectedStartLine).toEqual(21)
  })

  it('should use input as default text when params.text is not provided', async () => {
    await doWriteFile({
      input: 'text from input',
      params: { fileId: 'file-123' },
      options: { userId: 'user-123' },
    })

    expect(fileStorage.uploadFileObject).toHaveBeenCalledWith(
      'file-123',
      'text from input',
      { contentType: 'text/plain' }
    )
  })

  it('should throw UserInputError when fileId and id are both missing', async () => {
    await expect(
      doWriteFile({
        input: '',
        params: { text: 'content' },
        options: { userId: 'user-123' },
      })
    ).rejects.toThrow("Missing 'fileId' or 'id' parameter")
  })

  it('should throw UserInputError when file is not found', async () => {
    prisma.file.findUnique.mockResolvedValue(null)

    await expect(
      doWriteFile({
        input: '',
        params: { fileId: 'nonexistent', text: 'content' },
        options: { userId: 'user-123' },
      })
    ).rejects.toThrow('File not found')
  })

  it('should throw UserInputError when user cannot access the file', async () => {
    fileAccess.canUseFile.mockReturnValue(false)

    await expect(
      doWriteFile({
        input: '',
        params: { fileId: 'file-123', text: 'content' },
        options: { userId: 'user-123' },
      })
    ).rejects.toThrow('Cannot use file')
  })

  it('should accept id parameter as alternative to fileId', async () => {
    const result = await doWriteFile({
      input: '',
      params: { id: 'file-123', text: 'content via id' },
      options: { userId: 'user-123' },
    })

    expect(prisma.file.findUnique).toHaveBeenCalledWith({
      where: { id: 'file-123' },
    })
    expect(fileStorage.uploadFileObject).toHaveBeenCalled()
    expect(result.messages).toEqual([])
  })

  it('should throw UserInputError when file content does not exist for line-based write', async () => {
    fileStorage.fileObjectExists.mockResolvedValue(false)

    await expect(
      doWriteFile({
        input: '',
        params: { fileId: 'file-123', text: 'new content', startLine: 5 },
        options: { userId: 'user-123' },
      })
    ).rejects.toThrow('File content not found')

    expect(fileStorage.getFileObjectDownloadUrl).not.toHaveBeenCalled()
    expect(fileStorage.uploadFileObject).not.toHaveBeenCalled()
  })
})

describe('executeFileAction', () => {
  // @note 20 lines is sufficient for routing tests
  const mockFileContent = Array.from(
    { length: 20 },
    (_, i) => `line${i + 1}`
  ).join('\n')

  beforeEach(() => {
    jest.clearAllMocks()
    mockReset(prisma)

    prisma.file.findUnique.mockResolvedValue({
      id: 'file-123',
      userId: 'user-123',
    })

    fileAccess.canUseFile.mockReturnValue(true)
    fileStorage.fileObjectExists.mockResolvedValue(true)
    fileStorage.getFileObjectDownloadUrl.mockResolvedValue(
      'https://example.com/file.txt'
    )
    fileStorage.uploadFileObject.mockResolvedValue(undefined)
    // @note used by prepend/append/replace operations
    fileStorage.downloadFileObject.mockResolvedValue({
      body: {
        arrayBuffer: async () =>
          new TextEncoder().encode('existing content').buffer,
      },
    })
    dsd2.chunkUrl.mockResolvedValue({
      items: [{ text: mockFileContent }],
    })
  })

  it('should route read operation to doReadFile', async () => {
    const result = await executeFileAction(
      '',
      { read: true, fileId: 'file-123' },
      { userId: 'user-123' }
    )

    expect(result.result).toHaveProperty('text')
    expect(result.result).toHaveProperty('totalLines')
  })

  it('should route write operation to doWriteFile', async () => {
    const result = await executeFileAction(
      '',
      { write: true, fileId: 'file-123', text: 'new content' },
      { userId: 'user-123' }
    )

    expect(fileStorage.uploadFileObject).toHaveBeenCalledWith(
      'file-123',
      'new content',
      { contentType: 'text/plain' }
    )
    expect(result.messages).toEqual([])
  })

  it('should route prepend operation to doPrependFile', async () => {
    const result = await executeFileAction(
      'prefix content\n',
      { prepend: true, fileId: 'file-123', text: 'prefix content\n' },
      { userId: 'user-123' }
    )

    expect(fileStorage.uploadFileObject).toHaveBeenCalled()

    const uploadedContent = fileStorage.uploadFileObject.mock.calls[0][1]

    expect(uploadedContent).toContain('prefix content')
    expect(uploadedContent).toContain('existing content')
    expect(result.messages).toEqual([])
  })

  it('should route append operation to doAppendFile', async () => {
    const result = await executeFileAction(
      'appended content',
      { append: true, fileId: 'file-123', text: 'appended content' },
      { userId: 'user-123' }
    )

    expect(fileStorage.uploadFileObject).toHaveBeenCalled()

    const uploadedContent = fileStorage.uploadFileObject.mock.calls[0][1]

    expect(uploadedContent).toContain('existing content')
    expect(uploadedContent).toContain('appended content')
    expect(result.messages).toEqual([])
  })

  it('should route replace operation to doReplaceFile', async () => {
    // @note replace key holds the replacement string, not the boolean true,
    // because fileReplaceSchema uses replace as a field name
    const result = await executeFileAction(
      '',
      { replace: 'goodbye', search: 'existing', fileId: 'file-123' },
      { userId: 'user-123' }
    )

    expect(fileStorage.uploadFileObject).toHaveBeenCalled()

    const uploadedContent = fileStorage.uploadFileObject.mock.calls[0][1]

    expect(uploadedContent).toContain('goodbye')
    expect(result.messages).toEqual([])
  })

  it('should route rw operation to doRwFile', async () => {
    const result = await executeFileAction(
      '',
      { rw: true, fileId: 'file-123', mode: 'read' },
      { userId: 'user-123' }
    )

    expect(result.result).toHaveProperty('text')
    expect(result.result).toHaveProperty('totalLines')
  })

  it('should throw UserInputError for unknown operation', async () => {
    await expect(
      executeFileAction(
        '',
        { unknown: true, fileId: 'file-123' },
        { userId: 'user-123' }
      )
    ).rejects.toThrow('Unknown operation')
  })
})
