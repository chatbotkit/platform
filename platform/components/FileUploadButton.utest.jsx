/* eslint-disable @typescript-eslint/no-require-imports */
import FileUploadButton from './FileUploadButton'

import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

jest.mock('@/hooks/useDropzone', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/hooks/useFetch', () => ({
  __esModule: true,
  default: jest.fn(),
}))

const mockUseDropzone = require('@/hooks/useDropzone').default
const mockUseFetch = require('@/hooks/useFetch').default

describe('FileUploadButton', () => {
  let mockFetch
  let onDropAccepted

  beforeEach(() => {
    jest.clearAllMocks()

    mockFetch = jest.fn()
    onDropAccepted = undefined

    mockUseFetch.mockReturnValue({
      fetch: mockFetch,
    })

    mockUseDropzone.mockImplementation((options) => {
      onDropAccepted = options.onDropAccepted

      return {
        getRootProps: () => ({ 'data-testid': 'upload-button-props' }),
        getInputProps: () => ({ 'data-testid': 'upload-input', type: 'file' }),
      }
    })
  })

  function createFile({ name = 'sample.txt', type = '', size = 6 } = {}) {
    return {
      name,
      type,
      size,
      async arrayBuffer() {
        return new Uint8Array(size).buffer
      },
    }
  }

  it('renders button and input with defaults', () => {
    render(<FileUploadButton fileId="file-1" />)

    expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument()
    expect(screen.getByTestId('upload-input')).toBeInTheDocument()
  })

  it('propagates disabled and custom children', () => {
    render(
      <FileUploadButton fileId="file-1" disabled>
        Send File
      </FileUploadButton>
    )

    expect(screen.getByRole('button', { name: 'Send File' })).toBeDisabled()
  })

  it('uploads and syncs when drop is accepted', async () => {
    mockFetch
      .mockResolvedValueOnce({
        data: {
          uploadRequest: {
            url: 'https://upload.local/request',
            method: 'PUT',
            headers: { 'x-custom': '1' },
          },
        },
      })
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ data: {} })

    render(<FileUploadButton fileId="file-7" />)

    const acceptedFile = createFile({ type: '' })

    await onDropAccepted([acceptedFile])

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      '/api/v1/file/file-7/upload',
      expect.objectContaining({
        method: 'POST',
        data: expect.objectContaining({
          file: expect.objectContaining({
            name: 'sample.txt',
            type: 'text/plain',
            size: 6,
          }),
        }),
      })
    )

    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://upload.local/request',
      expect.objectContaining({
        method: 'PUT',
        headers: { 'x-custom': '1' },
        dataType: 'body',
      })
    )

    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      '/api/v1/file/file-7/sync',
      expect.objectContaining({
        data: {},
      })
    )
  })

  it('stops when upload creation returns error', async () => {
    mockFetch.mockResolvedValueOnce({ error: { message: 'no upload' } })

    render(<FileUploadButton fileId="file-9" />)

    await onDropAccepted([createFile()])

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('continues to sync even when direct upload returns an error payload', async () => {
    mockFetch
      .mockResolvedValueOnce({
        data: {
          uploadRequest: {
            url: 'https://upload.local/request',
            method: 'PUT',
            headers: {},
          },
        },
      })
      .mockResolvedValueOnce({ error: { message: 'upload failed' } })
      .mockResolvedValueOnce({ data: {} })

    render(<FileUploadButton fileId="file-3" />)

    await onDropAccepted([createFile({ type: 'text/plain' })])

    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('stops after sync error and does not throw', async () => {
    mockFetch
      .mockResolvedValueOnce({
        data: {
          uploadRequest: {
            url: 'https://upload.local/request',
            method: 'PUT',
            headers: {},
          },
        },
      })
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ error: { message: 'sync failed' } })

    render(<FileUploadButton fileId="file-4" />)

    await expect(
      onDropAccepted([createFile({ type: 'text/plain' })])
    ).resolves.toBeUndefined()
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(3))
  })

  it('passes root props through button and keeps extra props', () => {
    render(
      <FileUploadButton
        fileId="file-1"
        className="btn"
        data-track-id="upload-track"
      >
        Upload now
      </FileUploadButton>
    )

    const button = screen.getByRole('button', { name: 'Upload now' })

    expect(button).toHaveClass('btn')
    expect(button).toHaveAttribute('data-testid', 'upload-button-props')
    expect(button).toHaveAttribute('data-track-id', 'upload-track')
    fireEvent.click(button)
  })
})
