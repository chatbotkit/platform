import { getConfigBySchema } from '@/lib/action.config'
import { executeListenAction } from '@/lib/action.exec.listen'
import { executeViewAction } from '@/lib/action.exec.view'
import {
  getContextConversation,
  getContextNamespace,
} from '@/lib/context.store'
import { getConversationAttachmentDownloadURL } from '@/lib/conversation.attachment'
import { chunkUrl } from '@/lib/dsd2'
import { UserInputError } from '@/lib/error'
import { getNamespaceAttachmentTempDownloadURL } from '@/lib/namespace.attachment'

import {
  doReadAttachment,
  executeAttachmentAction,
} from './action.exec.attachment'

jest.mock('@/lib/action.config', () => ({
  getConfigBySchema: jest.fn(),
}))

jest.mock('@/lib/context.store', () => ({
  getContextConversation: jest.fn(),
  getContextNamespace: jest.fn(),
}))

jest.mock('@/lib/conversation.attachment', () => ({
  getConversationAttachmentDownloadURL: jest.fn(),
}))

jest.mock('@/lib/namespace.attachment', () => ({
  getNamespaceAttachmentTempDownloadURL: jest.fn(),
}))

jest.mock('@/lib/dsd2', () => ({
  chunkUrl: jest.fn(),
}))

jest.mock('@/lib/action.exec.view', () => ({
  executeViewAction: jest.fn(),
}))

jest.mock('@/lib/action.exec.listen', () => ({
  executeListenAction: jest.fn(),
}))

describe('action.exec.attachment', () => {
  const mockOptions = {
    userId: 'user-123',
    linkedResources: {
      blueprintId: 'blueprint-123',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('doReadAttachment', () => {
    describe('reading from conversation context', () => {
      it('should read attachment from conversation when context is available', async () => {
        const mockName = 'document.pdf'
        const mockInput = 'Read the document'
        const mockConversation = { id: 'conv-123' }
        const mockUrl = 'https://storage.example.com/document.pdf'
        const mockChunks = {
          items: [
            { text: 'First chunk of text' },
            { text: 'Second chunk of text' },
          ],
        }

        getContextConversation.mockReturnValue(mockConversation)
        getConversationAttachmentDownloadURL.mockResolvedValue(mockUrl)
        chunkUrl.mockResolvedValue(mockChunks)

        const result = await doReadAttachment({
          name: mockName,
          input: mockInput,
          options: mockOptions,
        })

        expect(getContextConversation).toHaveBeenCalled()
        expect(getConversationAttachmentDownloadURL).toHaveBeenCalledWith(
          'conv-123',
          mockName,
          false
        )
        expect(chunkUrl).toHaveBeenCalledWith(new URL(mockUrl), {
          size: Infinity,
          overlap: 0,
        })
        expect(result).toEqual({
          result: { text: 'First chunk of textSecond chunk of text' },
          messages: [],
        })
      })

      it('should fallback to namespace when conversation URL not found', async () => {
        const mockName = 'file.txt'
        const mockNamespace = { id: 'ns-123' }
        const mockUrl = 'https://storage.example.com/file.txt'
        const mockChunks = {
          items: [{ text: 'File content' }],
        }

        getContextConversation.mockReturnValue({ id: 'conv-123' })
        getConversationAttachmentDownloadURL.mockResolvedValue(null)
        getContextNamespace.mockReturnValue(mockNamespace)
        getNamespaceAttachmentTempDownloadURL.mockResolvedValue(mockUrl)
        chunkUrl.mockResolvedValue(mockChunks)

        const result = await doReadAttachment({
          name: mockName,
          input: 'test',
          options: mockOptions,
        })

        expect(getContextConversation).toHaveBeenCalled()
        expect(getContextNamespace).toHaveBeenCalled()
        expect(getNamespaceAttachmentTempDownloadURL).toHaveBeenCalledWith(
          mockNamespace,
          mockName,
          false
        )
        expect(result.result.text).toBe('File content')
      })
    })

    describe('reading from namespace context', () => {
      it('should read attachment from namespace when no conversation context', async () => {
        const mockName = 'report.pdf'
        const mockNamespace = { id: 'ns-456' }
        const mockUrl = 'https://storage.example.com/report.pdf'
        const mockChunks = {
          items: [{ text: 'Report data' }],
        }

        getContextConversation.mockReturnValue(null)
        getContextNamespace.mockReturnValue(mockNamespace)
        getNamespaceAttachmentTempDownloadURL.mockResolvedValue(mockUrl)
        chunkUrl.mockResolvedValue(mockChunks)

        const result = await doReadAttachment({
          name: mockName,
          input: 'test',
          options: mockOptions,
        })

        expect(getContextConversation).toHaveBeenCalled()
        expect(getContextNamespace).toHaveBeenCalled()
        expect(getNamespaceAttachmentTempDownloadURL).toHaveBeenCalledWith(
          mockNamespace,
          mockName,
          false
        )
        expect(result.result.text).toBe('Report data')
      })
    })

    describe('attachment not found', () => {
      it('should throw error when attachment not found in conversation', async () => {
        const mockName = 'missing.pdf'

        getContextConversation.mockReturnValue({ id: 'conv-123' })
        getConversationAttachmentDownloadURL.mockResolvedValue(null)
        getContextNamespace.mockReturnValue(null)

        await expect(
          doReadAttachment({
            name: mockName,
            input: 'test',
            options: mockOptions,
          })
        ).rejects.toThrow(UserInputError)

        await expect(
          doReadAttachment({
            name: mockName,
            input: 'test',
            options: mockOptions,
          })
        ).rejects.toThrow('Attachment not found')
      })

      it('should throw error when attachment not found in namespace', async () => {
        const mockName = 'missing.pdf'
        const mockNamespace = { id: 'ns-123' }

        getContextConversation.mockReturnValue(null)
        getContextNamespace.mockReturnValue(mockNamespace)
        getNamespaceAttachmentTempDownloadURL.mockResolvedValue(null)

        await expect(
          doReadAttachment({
            name: mockName,
            input: 'test',
            options: mockOptions,
          })
        ).rejects.toThrow(UserInputError)
      })

      it('should throw error when no context is available', async () => {
        getContextConversation.mockReturnValue(null)
        getContextNamespace.mockReturnValue(null)

        await expect(
          doReadAttachment({
            name: 'file.pdf',
            input: 'test',
            options: mockOptions,
          })
        ).rejects.toThrow(UserInputError)
      })
    })

    describe('text extraction and chunking', () => {
      it('should handle single chunk', async () => {
        const mockUrl = 'https://storage.example.com/doc.txt'
        const mockChunks = {
          items: [{ text: 'Single chunk' }],
        }

        getContextConversation.mockReturnValue({ id: 'conv-123' })
        getConversationAttachmentDownloadURL.mockResolvedValue(mockUrl)
        chunkUrl.mockResolvedValue(mockChunks)

        const result = await doReadAttachment({
          name: 'doc.txt',
          input: 'test',
          options: mockOptions,
        })

        expect(result.result.text).toBe('Single chunk')
      })

      it('should handle multiple chunks', async () => {
        const mockUrl = 'https://storage.example.com/doc.txt'
        const mockChunks = {
          items: [
            { text: 'Chunk 1 ' },
            { text: 'Chunk 2 ' },
            { text: 'Chunk 3' },
          ],
        }

        getContextConversation.mockReturnValue({ id: 'conv-123' })
        getConversationAttachmentDownloadURL.mockResolvedValue(mockUrl)
        chunkUrl.mockResolvedValue(mockChunks)

        const result = await doReadAttachment({
          name: 'doc.txt',
          input: 'test',
          options: mockOptions,
        })

        expect(result.result.text).toBe('Chunk 1 Chunk 2 Chunk 3')
      })

      it('should handle empty chunks', async () => {
        const mockUrl = 'https://storage.example.com/empty.txt'
        const mockChunks = {
          items: [],
        }

        getContextConversation.mockReturnValue({ id: 'conv-123' })
        getConversationAttachmentDownloadURL.mockResolvedValue(mockUrl)
        chunkUrl.mockResolvedValue(mockChunks)

        const result = await doReadAttachment({
          name: 'empty.txt',
          input: 'test',
          options: mockOptions,
        })

        expect(result.result.text).toBe('')
      })

      it('should handle chunks with empty text', async () => {
        const mockUrl = 'https://storage.example.com/doc.txt'
        const mockChunks = {
          items: [{ text: '' }, { text: 'Some text' }, { text: '' }],
        }

        getContextConversation.mockReturnValue({ id: 'conv-123' })
        getConversationAttachmentDownloadURL.mockResolvedValue(mockUrl)
        chunkUrl.mockResolvedValue(mockChunks)

        const result = await doReadAttachment({
          name: 'doc.txt',
          input: 'test',
          options: mockOptions,
        })

        expect(result.result.text).toBe('Some text')
      })
    })

    describe('edge cases', () => {
      it('should handle very long attachment names', async () => {
        const longName = 'very-long-filename-'.repeat(50) + '.pdf'
        const mockUrl = 'https://storage.example.com/file.pdf'
        const mockChunks = { items: [{ text: 'content' }] }

        getContextConversation.mockReturnValue({ id: 'conv-123' })
        getConversationAttachmentDownloadURL.mockResolvedValue(mockUrl)
        chunkUrl.mockResolvedValue(mockChunks)

        const result = await doReadAttachment({
          name: longName,
          input: 'test',
          options: mockOptions,
        })

        expect(result.result.text).toBe('content')
      })

      it('should handle special characters in attachment names', async () => {
        const specialName = 'file (1) & [test].pdf'
        const mockUrl = 'https://storage.example.com/file.pdf'
        const mockChunks = { items: [{ text: 'content' }] }

        getContextConversation.mockReturnValue({ id: 'conv-123' })
        getConversationAttachmentDownloadURL.mockResolvedValue(mockUrl)
        chunkUrl.mockResolvedValue(mockChunks)

        const result = await doReadAttachment({
          name: specialName,
          input: 'test',
          options: mockOptions,
        })

        expect(result.result.text).toBe('content')
      })
    })

    describe('error handling', () => {
      it('should propagate chunkUrl errors', async () => {
        const mockUrl = 'https://storage.example.com/doc.txt'

        getContextConversation.mockReturnValue({ id: 'conv-123' })
        getConversationAttachmentDownloadURL.mockResolvedValue(mockUrl)
        chunkUrl.mockRejectedValue(new Error('Chunking failed'))

        await expect(
          doReadAttachment({
            name: 'doc.txt',
            input: 'test',
            options: mockOptions,
          })
        ).rejects.toThrow('Chunking failed')
      })

      it('should propagate URL download errors', async () => {
        getContextConversation.mockReturnValue({ id: 'conv-123' })
        getConversationAttachmentDownloadURL.mockRejectedValue(
          new Error('Download URL generation failed')
        )

        await expect(
          doReadAttachment({
            name: 'doc.txt',
            input: 'test',
            options: mockOptions,
          })
        ).rejects.toThrow('Download URL generation failed')
      })
    })

    describe('image detection', () => {
      it.each([
        'photo.png',
        'image.jpg',
        'photo.jpeg',
        'anim.gif',
        'pic.webp',
        'icon.svg',
        'scan.tiff',
        'scan.tif',
        'photo.bmp',
      ])(
        'should use executeViewAction for image attachment: %s',
        async (imageName) => {
          const mockUrl = `https://storage.example.com/${imageName}`
          const mockViewResult = {
            result: { text: 'image description' },
            messages: [],
          }

          getContextConversation.mockReturnValue({ id: 'conv-123' })
          getConversationAttachmentDownloadURL.mockResolvedValue(mockUrl)
          executeViewAction.mockResolvedValue(mockViewResult)

          const result = await doReadAttachment({
            name: imageName,
            input: 'Read the image',
            params: {},
            options: mockOptions,
          })

          expect(executeViewAction).toHaveBeenCalledWith(
            mockUrl,
            {},
            mockOptions
          )
          expect(chunkUrl).not.toHaveBeenCalled()
          expect(result).toEqual(mockViewResult)
        }
      )

      it.each([
        'document.pdf',
        'data.csv',
        'notes.txt',
        'report.docx',
        'archive.zip',
      ])(
        'should use chunkUrl for non-image attachment: %s',
        async (fileName) => {
          const mockUrl = `https://storage.example.com/${fileName}`
          const mockChunks = { items: [{ text: 'content' }] }

          getContextConversation.mockReturnValue({ id: 'conv-123' })
          getConversationAttachmentDownloadURL.mockResolvedValue(mockUrl)
          chunkUrl.mockResolvedValue(mockChunks)

          const result = await doReadAttachment({
            name: fileName,
            input: 'Read the file',
            params: {},
            options: mockOptions,
          })

          expect(chunkUrl).toHaveBeenCalled()
          expect(executeViewAction).not.toHaveBeenCalled()
          expect(result.result.text).toBe('content')
        }
      )
    })

    describe('audio detection', () => {
      it.each([
        'voice.oga',
        'voice.ogg',
        'note.opus',
        'song.mp3',
        'clip.m4a',
        'recording.wav',
        'track.flac',
        'sound.aac',
        'audio.mpga',
        'voice.weba',
      ])(
        'should use executeListenAction for audio attachment: %s',
        async (audioName) => {
          const mockUrl = `https://storage.example.com/${audioName}`
          const mockListenResult = {
            result: ['transcribed text'],
          }

          getContextConversation.mockReturnValue({ id: 'conv-123' })
          getConversationAttachmentDownloadURL.mockResolvedValue(mockUrl)
          executeListenAction.mockResolvedValue(mockListenResult)

          const result = await doReadAttachment({
            name: audioName,
            input: 'Read the voice note',
            params: {},
            options: mockOptions,
          })

          expect(executeListenAction).toHaveBeenCalledWith(
            mockUrl,
            {},
            mockOptions
          )
          expect(chunkUrl).not.toHaveBeenCalled()
          expect(executeViewAction).not.toHaveBeenCalled()
          expect(result).toEqual(mockListenResult)
        }
      )
    })
  })

  describe('executeAttachmentAction', () => {
    describe('operation detection', () => {
      it('should detect read operation and call doReadAttachment', async () => {
        const mockInput = 'document.pdf'
        const mockParams = { read: true }
        const mockUrl = 'https://storage.example.com/doc.pdf'
        const mockChunks = { items: [{ text: 'content' }] }

        getConfigBySchema.mockReturnValue({
          name: mockInput,
        })
        getContextConversation.mockReturnValue({ id: 'conv-123' })
        getConversationAttachmentDownloadURL.mockResolvedValue(mockUrl)
        chunkUrl.mockResolvedValue(mockChunks)

        const result = await executeAttachmentAction(
          mockInput,
          mockParams,
          mockOptions
        )

        expect(getConfigBySchema).toHaveBeenCalledWith({
          input: mockInput,
          params: mockParams,
          initial: {
            name: mockInput,
          },
          schema: expect.any(Object),
          options: mockOptions,
        })
        expect(result).toEqual({
          result: { text: 'content' },
          messages: [],
        })
      })

      it('should throw error for unknown operation', async () => {
        const mockParams = { unknownOp: true }

        getConfigBySchema.mockReturnValue({
          name: 'test.pdf',
        })

        await expect(
          executeAttachmentAction('test.pdf', mockParams, mockOptions)
        ).rejects.toThrow(UserInputError)

        await expect(
          executeAttachmentAction('test.pdf', mockParams, mockOptions)
        ).rejects.toThrow('Unknown operation')
      })

      it('should throw error for empty params object', async () => {
        getConfigBySchema.mockReturnValue({
          name: 'test.pdf',
        })

        await expect(
          executeAttachmentAction('test.pdf', {}, mockOptions)
        ).rejects.toThrow(UserInputError)
      })
    })

    describe('name parameter validation', () => {
      it('should throw error when name is missing', async () => {
        const mockParams = { read: true }

        getConfigBySchema.mockReturnValue({
          name: '',
        })

        await expect(
          executeAttachmentAction('', mockParams, mockOptions)
        ).rejects.toThrow(UserInputError)

        await expect(
          executeAttachmentAction('', mockParams, mockOptions)
        ).rejects.toThrow("Missing 'name' parameter")
      })

      it('should throw error when name is null', async () => {
        const mockParams = { read: true }

        getConfigBySchema.mockReturnValue({
          name: null,
        })

        await expect(
          executeAttachmentAction('test', mockParams, mockOptions)
        ).rejects.toThrow(UserInputError)
      })

      it('should throw error when name is undefined', async () => {
        const mockParams = { read: true }

        getConfigBySchema.mockReturnValue({
          name: undefined,
        })

        await expect(
          executeAttachmentAction('test', mockParams, mockOptions)
        ).rejects.toThrow(UserInputError)
      })

      it('should use input as default name', async () => {
        const mockInput = 'default-name.pdf'
        const mockParams = { read: true }
        const mockUrl = 'https://storage.example.com/doc.pdf'
        const mockChunks = { items: [{ text: 'content' }] }

        getConfigBySchema.mockReturnValue({
          name: mockInput,
        })
        getContextConversation.mockReturnValue({ id: 'conv-123' })
        getConversationAttachmentDownloadURL.mockResolvedValue(mockUrl)
        chunkUrl.mockResolvedValue(mockChunks)

        await executeAttachmentAction(mockInput, mockParams, mockOptions)

        expect(getConfigBySchema).toHaveBeenCalledWith(
          expect.objectContaining({
            initial: {
              name: mockInput,
            },
          })
        )
      })
    })

    describe('integration with doReadAttachment', () => {
      it('should pass all parameters to doReadAttachment correctly', async () => {
        const mockInput = 'file.txt'
        const mockParams = { read: true }
        const mockUrl = 'https://storage.example.com/file.txt'
        const mockChunks = { items: [{ text: 'File content' }] }

        getConfigBySchema.mockReturnValue({
          name: mockInput,
        })
        getContextConversation.mockReturnValue({ id: 'conv-123' })
        getConversationAttachmentDownloadURL.mockResolvedValue(mockUrl)
        chunkUrl.mockResolvedValue(mockChunks)

        const result = await executeAttachmentAction(
          mockInput,
          mockParams,
          mockOptions
        )

        expect(result.result.text).toBe('File content')
      })
    })

    describe('edge cases', () => {
      it('should handle null input with valid name in params', async () => {
        const mockParams = { read: true, name: 'explicit-name.pdf' }
        const mockUrl = 'https://storage.example.com/doc.pdf'
        const mockChunks = { items: [{ text: 'content' }] }

        getConfigBySchema.mockReturnValue({
          name: 'explicit-name.pdf',
        })
        getContextConversation.mockReturnValue({ id: 'conv-123' })
        getConversationAttachmentDownloadURL.mockResolvedValue(mockUrl)
        chunkUrl.mockResolvedValue(mockChunks)

        const result = await executeAttachmentAction(
          null,
          mockParams,
          mockOptions
        )

        expect(result.result.text).toBe('content')
      })

      it('should handle undefined input with valid name in params', async () => {
        const mockParams = { read: true, name: 'explicit-name.pdf' }
        const mockUrl = 'https://storage.example.com/doc.pdf'
        const mockChunks = { items: [{ text: 'content' }] }

        getConfigBySchema.mockReturnValue({
          name: 'explicit-name.pdf',
        })
        getContextConversation.mockReturnValue({ id: 'conv-123' })
        getConversationAttachmentDownloadURL.mockResolvedValue(mockUrl)
        chunkUrl.mockResolvedValue(mockChunks)

        const result = await executeAttachmentAction(
          undefined,
          mockParams,
          mockOptions
        )

        expect(result.result.text).toBe('content')
      })
    })
  })
})
