/* eslint-disable @typescript-eslint/no-require-imports */
import {
  fileObjectExists,
  getFileInstance,
  getFileObjectDownloadUrl,
  getFileObjectLocation,
  getFileObjectUploadUrl,
  uploadFileObject,
} from '@/lib/file.storage'

jest.mock('@/lib/storage', () => ({
  getObject: jest.fn(),
  getObjectDownloadUrl: jest.fn(),
  getObjectUploadUrl: jest.fn(),
  headObject: jest.fn(),
  putObject: jest.fn(),
}))

jest.mock('@/lib/error', () => ({
  captureError: jest.fn(),
}))

jest.mock('@/lib/fetch', () => jest.fn())

describe('file.storage', () => {
  const testFileId = 'file-123'

  // @note the platform names a store, not a location. Which container backs
  // the file store is the storage module's business and is not observable from
  // here - which is the point of the scope.
  const scope = 'file'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getFileObjectLocation', () => {
    it('should return store and key for file ID', () => {
      const location = getFileObjectLocation(testFileId)

      expect(location).toEqual({
        scope,
        key: 'file-123/original',
      })
    })

    it('should handle file IDs with special characters', () => {
      const location = getFileObjectLocation('file-with-dashes-123')

      expect(location).toEqual({
        scope,
        key: 'file-with-dashes-123/original',
      })
    })

    it('should handle UUID-style file IDs', () => {
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
      const location = getFileObjectLocation(uuid)

      expect(location).toEqual({
        scope,
        key: `${uuid}/original`,
      })
    })

    it('should always append /original to key', () => {
      const location = getFileObjectLocation('any-file-id')

      expect(location.key).toMatch(/\/original$/)
    })

    it('should handle empty string file ID', () => {
      const location = getFileObjectLocation('')

      expect(location).toEqual({
        scope,
        key: 'original',
      })
    })
  })

  describe('getFileObjectUploadUrl', () => {
    it('should generate upload URL for file ID', async () => {
      const storage = require('@/lib/storage')

      storage.getObjectUploadUrl.mockResolvedValue(
        'https://s3.amazonaws.com/upload-url'
      )

      const url = await getFileObjectUploadUrl(testFileId)

      expect(storage.getObjectUploadUrl).toHaveBeenCalledWith(
        scope,
        'file-123/original',
        undefined
      )
      expect(url).toBe('https://s3.amazonaws.com/upload-url')
    })

    it('should pass options to getObjectUploadUrl', async () => {
      const storage = require('@/lib/storage')

      storage.getObjectUploadUrl.mockResolvedValue('https://upload-url')

      const options = {
        contentType: 'application/pdf',
        expiresIn: 3600,
      }

      await getFileObjectUploadUrl(testFileId, options)

      expect(storage.getObjectUploadUrl).toHaveBeenCalledWith(
        scope,
        'file-123/original',
        options
      )
    })

    it('should handle S3 errors', async () => {
      const storage = require('@/lib/storage')

      storage.getObjectUploadUrl.mockRejectedValue(new Error('S3 error'))

      await expect(getFileObjectUploadUrl(testFileId)).rejects.toThrow(
        'S3 error'
      )
    })
  })

  describe('getFileObjectDownloadUrl', () => {
    it('should generate download URL for file ID', async () => {
      const storage = require('@/lib/storage')

      storage.getObjectDownloadUrl.mockResolvedValue(
        'https://s3.amazonaws.com/download-url'
      )

      const url = await getFileObjectDownloadUrl(testFileId)

      expect(storage.getObjectDownloadUrl).toHaveBeenCalledWith(
        scope,
        'file-123/original',
        undefined
      )
      expect(url).toBe('https://s3.amazonaws.com/download-url')
    })

    it('should pass options to getObjectDownloadUrl', async () => {
      const storage = require('@/lib/storage')

      storage.getObjectDownloadUrl.mockResolvedValue('https://download-url')

      const options = {
        expiresIn: 7200,
        responseContentDisposition: 'attachment',
      }

      await getFileObjectDownloadUrl(testFileId, options)

      expect(storage.getObjectDownloadUrl).toHaveBeenCalledWith(
        scope,
        'file-123/original',
        options
      )
    })

    it('should handle S3 errors', async () => {
      const storage = require('@/lib/storage')

      storage.getObjectDownloadUrl.mockRejectedValue(new Error('Access denied'))

      await expect(getFileObjectDownloadUrl(testFileId)).rejects.toThrow(
        'Access denied'
      )
    })
  })

  describe('fileObjectExists', () => {
    it('should return true when file exists in S3', async () => {
      const storage = require('@/lib/storage')

      storage.headObject.mockResolvedValue({
        size: 100,
      })

      const exists = await fileObjectExists(testFileId)

      expect(storage.headObject).toHaveBeenCalledWith(
        scope,
        'file-123/original'
      )
      expect(exists).toBe(true)
    })

    it('should return false when file does not exist in S3', async () => {
      const storage = require('@/lib/storage')

      storage.headObject.mockRejectedValue(new Error('Not Found'))

      const exists = await fileObjectExists(testFileId)

      expect(exists).toBe(false)
    })
  })

  describe('uploadFileObject', () => {
    it('should upload file object to S3', async () => {
      const storage = require('@/lib/storage')

      storage.putObject.mockResolvedValue(undefined)

      const file = Buffer.from('test file content')
      const options = { contentType: 'text/plain' }

      await uploadFileObject(testFileId, file, options)

      expect(storage.putObject).toHaveBeenCalledWith(
        scope,
        'file-123/original',
        file,
        options
      )
    })

    it('should handle file upload without options', async () => {
      const storage = require('@/lib/storage')

      storage.putObject.mockResolvedValue(undefined)

      const file = Buffer.from('content')

      await uploadFileObject(testFileId, file)

      expect(storage.putObject).toHaveBeenCalledWith(
        scope,
        'file-123/original',
        file,
        undefined
      )
    })

    it('should handle upload errors', async () => {
      const storage = require('@/lib/storage')

      storage.putObject.mockRejectedValue(new Error('Upload failed'))

      const file = Buffer.from('content')

      await expect(uploadFileObject(testFileId, file)).rejects.toThrow(
        'Upload failed'
      )
    })

    it('should handle different file types', async () => {
      const storage = require('@/lib/storage')

      storage.putObject.mockResolvedValue(undefined)

      const file = Buffer.from('image data')
      const options = { contentType: 'image/png' }

      await uploadFileObject(testFileId, file, options)

      expect(storage.putObject).toHaveBeenCalledWith(
        scope,
        'file-123/original',
        file,
        options
      )
    })
  })

  describe('getFileInstance', () => {
    it('should return file instance with metadata from S3', async () => {
      const storage = require('@/lib/storage')

      storage.headObject.mockResolvedValue({
        contentType: 'image/png',
        size: 1024,
        contentDisposition: 'attachment; filename=test-image.png',
      })

      const fileInstance = await getFileInstance(testFileId)

      expect(storage.headObject).toHaveBeenCalledWith(
        scope,
        'file-123/original'
      )
      expect(fileInstance).not.toBeNull()
      expect(fileInstance.type).toBe('image/png')
      expect(fileInstance.size).toBe(1024)
      expect(fileInstance.name).toBe('test-image.png')
    })

    it('should use default content type when not provided', async () => {
      const storage = require('@/lib/storage')

      storage.headObject.mockResolvedValue({
        size: 512,
      })

      const fileInstance = await getFileInstance(testFileId)

      expect(fileInstance).not.toBeNull()
      expect(fileInstance.type).toBe('application/octet-stream')
      expect(fileInstance.size).toBe(512)
      expect(fileInstance.name).toBeNull()
    })

    it('should handle missing content disposition', async () => {
      const storage = require('@/lib/storage')

      storage.headObject.mockResolvedValue({
        contentType: 'text/plain',
        size: 100,
      })

      const fileInstance = await getFileInstance(testFileId)

      expect(fileInstance).not.toBeNull()
      expect(fileInstance.name).toBeNull()
    })

    it('should call arrayBuffer and return data from S3', async () => {
      const storage = require('@/lib/storage')
      const testData = new Uint8Array([1, 2, 3, 4, 5])

      storage.headObject.mockResolvedValue({
        contentType: 'application/octet-stream',
        size: 5,
      })
      storage.getObject.mockResolvedValue({
        body: {
          arrayBuffer: jest.fn().mockResolvedValue(testData.buffer),
        },
      })

      const fileInstance = await getFileInstance(testFileId)
      const buffer = await fileInstance.arrayBuffer()

      expect(storage.getObject).toHaveBeenCalledWith(
        scope,
        'file-123/original'
      )
      expect(buffer).toBe(testData.buffer)
    })

    it('should call text and return string from S3', async () => {
      const storage = require('@/lib/storage')
      const testText = 'Hello, World!'

      storage.headObject.mockResolvedValue({
        contentType: 'text/plain',
        size: testText.length,
      })
      storage.getObject.mockResolvedValue({
        body: {
          text: jest.fn().mockResolvedValue(testText),
        },
      })

      const fileInstance = await getFileInstance(testFileId)
      const text = await fileInstance.text()

      expect(text).toBe('Hello, World!')
    })

    it('should throw error when arrayBuffer body is empty', async () => {
      const storage = require('@/lib/storage')

      storage.headObject.mockResolvedValue({
        contentType: 'application/octet-stream',
        size: 0,
      })
      storage.getObject.mockResolvedValue({
        body: undefined,
      })

      const fileInstance = await getFileInstance(testFileId)

      await expect(fileInstance.arrayBuffer()).rejects.toThrow(
        'Empty response body'
      )
    })

    it('should throw error when text body is empty', async () => {
      const storage = require('@/lib/storage')

      storage.headObject.mockResolvedValue({
        contentType: 'text/plain',
        size: 0,
      })
      storage.getObject.mockResolvedValue({
        body: undefined,
      })

      const fileInstance = await getFileInstance(testFileId)

      await expect(fileInstance.text()).rejects.toThrow('Empty response body')
    })

    it('should return null when headObject fails', async () => {
      const storage = require('@/lib/storage')
      const errorLib = require('@/lib/error')

      storage.headObject.mockRejectedValue(new Error('File not found'))

      const fileInstance = await getFileInstance(testFileId)

      expect(fileInstance).toBeNull()
      expect(errorLib.captureError).toHaveBeenCalled()
    })

    it('should return null when file retrieval fails', async () => {
      // getFileInstance uses the Upload SDK internally which we can't easily mock
      // We test the error path by calling with an invalid file ID that will fail
      const errorLib = require('@/lib/error')

      const fileInstance = await getFileInstance('non-existent-file-id-12345')

      // The function should return null on error and capture the error
      expect(fileInstance).toBeNull()
      expect(errorLib.captureError).toHaveBeenCalled()
    })
  })

  describe('store selection', () => {
    it('names the file store rather than a location', () => {
      const location = getFileObjectLocation('test')

      expect(location.scope).toBe('file')
    })
  })
})
