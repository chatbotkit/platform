import FileEditButton, { isEditableFileType } from './FileEditButton'

import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

const mockFetch = jest.fn()
const mockOpenPopup = jest.fn()
const OriginalFile = global.File

jest.mock(
  '@/components/AutoTextarea',
  () =>
    function MockAutoTextarea(props) {
      return <textarea data-testid="auto-textarea" {...props} />
    }
)

jest.mock('@/hooks/useFetch', () => () => ({
  fetch: mockFetch,
}))

jest.mock('@/hooks/usePopup', () => () => ({
  popup: null,
  openPopup: mockOpenPopup,
}))

describe('isEditableFileType', () => {
  it('returns true for empty or text-like types', () => {
    expect(isEditableFileType()).toBe(true)
    expect(isEditableFileType('text/plain')).toBe(true)
    expect(isEditableFileType('text/custom')).toBe(true)
    expect(isEditableFileType('application/json')).toBe(true)
  })

  it('returns false for binary types', () => {
    expect(isEditableFileType('image/png')).toBe(false)
    expect(isEditableFileType('application/octet-stream')).toBe(false)
  })
})

describe('FileEditButton', () => {
  beforeAll(() => {
    global.File = class MockFile {
      constructor(parts, name, options = {}) {
        this.parts = parts
        this.name = name
        this.type = options.type || ''
        this.size = parts.reduce(
          (total, part) => total + (part?.size || part?.byteLength || 0),
          0
        )
      }

      async arrayBuffer() {
        const chunks = await Promise.all(
          this.parts.map(async (part) => {
            if (part instanceof ArrayBuffer) {
              return new Uint8Array(part)
            }

            if (ArrayBuffer.isView(part)) {
              return new Uint8Array(part.buffer)
            }

            if (part?.arrayBuffer) {
              return new Uint8Array(await part.arrayBuffer())
            }

            return new Uint8Array()
          })
        )

        const size = chunks.reduce((total, chunk) => total + chunk.length, 0)
        const merged = new Uint8Array(size)

        let offset = 0

        for (const chunk of chunks) {
          merged.set(chunk, offset)
          offset += chunk.length
        }

        return merged.buffer
      }
    }
  })

  afterAll(() => {
    global.File = OriginalFile
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('disables the button for non-editable content types', () => {
    render(
      <FileEditButton fileId="file-1" contentType="image/png">
        Edit file
      </FileEditButton>
    )

    expect(screen.getByRole('button', { name: 'Edit file' })).toBeDisabled()
  })

  it('does not open popup when download fails', async () => {
    mockFetch.mockResolvedValueOnce({ error: { message: 'download failed' } })

    render(<FileEditButton fileId="file-1">Edit</FileEditButton>)

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/file/file-1/download', {
        dataType: 'text',
        loadingMessage: 'Loading file content...',
        failureMessage: true,
      })
    })

    expect(mockOpenPopup).not.toHaveBeenCalled()
  })

  it('opens popup and runs upload plus sync flow on save', async () => {
    const close = jest.fn()

    mockFetch
      .mockResolvedValueOnce({ error: null, data: 'hello world' })
      .mockResolvedValueOnce({
        error: null,
        data: {
          uploadRequest: {
            url: '/upload-url',
            method: 'PUT',
            headers: { 'x-test': '1' },
          },
        },
      })
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null })

    render(
      <FileEditButton
        fileId="file-1"
        fileName="note.txt"
        contentType="text/plain"
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

    await waitFor(() => {
      expect(mockOpenPopup).toHaveBeenCalledTimes(1)
    })

    const popupOptions = mockOpenPopup.mock.calls[0][1]

    expect(popupOptions.title).toBe('Edit - note.txt')

    await act(async () => {
      await popupOptions.actions.Save.fn(
        { content: 'updated content' },
        { close }
      )
    })

    expect(mockFetch).toHaveBeenNthCalledWith(2, '/api/v1/file/file-1/upload', {
      method: 'POST',
      data: {
        file: {
          size: expect.any(Number),
          type: 'text/plain',
          name: 'note.txt',
        },
      },
      loadingMessage: 'Creating file upload...',
      failureMessage: true,
    })

    expect(mockFetch).toHaveBeenNthCalledWith(3, '/upload-url', {
      method: 'PUT',
      headers: { 'x-test': '1' },
      body: expect.anything(),
      dataType: 'body',
      loadingMessage: 'Updating file...',
      successMessage: 'File updated!',
      uploadProgress: true,
      failureMessage: true,
    })
    expect(mockFetch.mock.calls[2][1].body.byteLength).toBeGreaterThan(0)

    expect(mockFetch).toHaveBeenNthCalledWith(4, '/api/v1/file/file-1/sync', {
      data: {},
      loadingMessage: 'Syncing file...',
      failureMessage: true,
    })

    expect(close).toHaveBeenCalledTimes(1)
  })

  it('uses default file metadata when name and content type are missing', async () => {
    const close = jest.fn()

    mockFetch
      .mockResolvedValueOnce({ error: null, data: '' })
      .mockResolvedValueOnce({
        error: null,
        data: {
          uploadRequest: {
            url: '/upload-url',
            method: 'PUT',
            headers: {},
          },
        },
      })
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null })

    render(<FileEditButton fileId="file-2" />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

    await waitFor(() => {
      expect(mockOpenPopup).toHaveBeenCalledTimes(1)
    })

    const popupOptions = mockOpenPopup.mock.calls[0][1]

    expect(popupOptions.title).toBe('Edit File Content')

    await act(async () => {
      await popupOptions.actions.Save.fn({ content: 'abc' }, { close })
    })

    expect(mockFetch).toHaveBeenNthCalledWith(2, '/api/v1/file/file-2/upload', {
      method: 'POST',
      data: {
        file: {
          size: expect.any(Number),
          type: 'text/plain',
          name: 'file.txt',
        },
      },
      loadingMessage: 'Creating file upload...',
      failureMessage: true,
    })
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('does not close popup when sync fails', async () => {
    const close = jest.fn()

    mockFetch
      .mockResolvedValueOnce({ error: null, data: 'x' })
      .mockResolvedValueOnce({
        error: null,
        data: {
          uploadRequest: {
            url: '/upload-url',
            method: 'PUT',
            headers: {},
          },
        },
      })
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'sync failed' } })

    render(<FileEditButton fileId="file-3" />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

    await waitFor(() => {
      expect(mockOpenPopup).toHaveBeenCalledTimes(1)
    })

    const popupOptions = mockOpenPopup.mock.calls[0][1]

    await act(async () => {
      await popupOptions.actions.Save.fn({ content: 'abc' }, { close })
    })

    expect(close).not.toHaveBeenCalled()
  })
})
