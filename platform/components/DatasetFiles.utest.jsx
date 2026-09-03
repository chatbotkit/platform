import { act } from 'react'

import DatasetFiles from './DatasetFiles'

import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const mockUseDropzone = jest.fn()
const mockUseFetch = jest.fn()
const mockConfirmDelete = jest.fn()
const mockRunJob = jest.fn()

let latestDropzoneOptions

jest.mock('@/hooks/useDropzone', () => {
  return (options) => {
    latestDropzoneOptions = options

    return mockUseDropzone(options)
  }
})

jest.mock('@/hooks/useFetch', () => {
  return () => mockUseFetch()
})

jest.mock('@/hooks/usePopupJob', () => {
  return () => ({
    popup: null,
    runJob: mockRunJob,
  })
})

jest.mock('@/components/Confirm', () => ({
  useConfirmDelete: () => mockConfirmDelete,
}))

jest.mock('@/components/DynamicImage', () => {
  return function DynamicImage() {
    return <div data-testid="dynamic-image" />
  }
})

jest.mock('@/components/Link', () => {
  return function Link({ children, href, ...props }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  }
})

jest.mock('@/lib/string', () => ({
  getRandomId: () => 'toast-id',
}))

describe('DatasetFiles', () => {
  beforeEach(() => {
    latestDropzoneOptions = undefined

    mockUseDropzone.mockReturnValue({
      getRootProps: () => ({}),
      getInputProps: () => ({}),
    })

    mockUseFetch.mockReturnValue({
      fetch: jest.fn(),
    })

    mockConfirmDelete.mockReset()

    mockRunJob.mockReset()
    mockRunJob.mockImplementation(async (job) => {
      await job({
        isCancelled: () => false,
        setProgress: jest.fn(),
      })
    })
  })

  it('should upload and attach multiple files from one drop', async () => {
    const fetch = jest.fn((url, options = {}) => {
      if (url === '/api/v1/file/create') {
        const fileId = options.data.name === 'first.txt' ? 'file-1' : 'file-2'

        return Promise.resolve({ error: false, data: { id: fileId } })
      }

      const uploadMatch = String(url).match(
        /^\/api\/v1\/file\/(file-[12])\/upload$/
      )

      if (uploadMatch) {
        const fileId = uploadMatch[1]

        return Promise.resolve({
          error: false,
          data: {
            uploadRequest: {
              url: `https://upload.test/${fileId}`,
              method: 'PUT',
              headers: { 'x-upload': fileId },
            },
          },
        })
      }

      if (String(url).startsWith('https://upload.test/')) {
        return Promise.resolve({ error: false })
      }

      if (String(url).includes('/attach') || String(url).includes('/sync')) {
        return Promise.resolve({ error: false })
      }

      return Promise.resolve({ error: false, data: {} })
    })

    mockUseFetch.mockReturnValue({ fetch })

    render(<DatasetFiles dataset={{ id: 'dataset-1', files: [] }} />)

    const file1 = {
      name: 'first.txt',
      size: 111,
      type: 'text/plain',
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
    }

    const file2 = {
      name: 'second.csv',
      size: 222,
      type: 'text/csv',
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
    }

    await act(async () => {
      await latestDropzoneOptions.onDropAccepted([file1, file2])
    })

    await waitFor(() => {
      expect(screen.getByText('first.txt')).toBeInTheDocument()
      expect(screen.getByText('second.csv')).toBeInTheDocument()
    })

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/file/create',
      expect.objectContaining({
        data: { name: 'first.txt' },
        loadingMessage: 'Creating file...',
        failureMessage: true,
      })
    )

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/file/create',
      expect.objectContaining({
        data: { name: 'second.csv' },
      })
    )

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/dataset/dataset-1/file/file-1/attach',
      expect.any(Object)
    )

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/dataset/dataset-1/file/file-2/attach',
      expect.any(Object)
    )

    expect(file1.arrayBuffer).toHaveBeenCalledTimes(1)
    expect(file2.arrayBuffer).toHaveBeenCalledTimes(1)
    expect(mockRunJob).not.toHaveBeenCalled()
  })

  it('should start uploads in batches of 5', async () => {
    const fetch = jest.fn((url) => {
      if (url === '/api/v1/file/create') {
        return new Promise(() => {})
      }

      return Promise.resolve({ error: true })
    })

    mockUseFetch.mockReturnValue({ fetch })

    render(<DatasetFiles dataset={{ id: 'dataset-1', files: [] }} />)

    const files = Array.from({ length: 6 }).map((_, index) => ({
      name: `file-${index + 1}.txt`,
      size: 1,
      type: 'text/plain',
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
    }))

    void latestDropzoneOptions.onDropAccepted(files)

    await act(async () => {
      await Promise.resolve()
    })

    expect(
      fetch.mock.calls.filter(([url]) => url === '/api/v1/file/create')
    ).toHaveLength(5)

    const [firstCreateUrl, firstCreateOptions] = fetch.mock.calls.find(
      ([url]) => url === '/api/v1/file/create'
    )

    expect(firstCreateUrl).toBe('/api/v1/file/create')
    expect(firstCreateOptions).toEqual(
      expect.objectContaining({
        loadingMessage: false,
        failureMessage: false,
      })
    )

    expect(mockRunJob).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        total: 6,
      })
    )
  })

  it('should render uploaded files progressively before all uploads finish', async () => {
    let resolveSecondCreate

    const fetch = jest.fn((url, options = {}) => {
      if (url === '/api/v1/file/create') {
        if (options.data.name === 'first.txt') {
          return Promise.resolve({ error: false, data: { id: 'file-1' } })
        }

        return new Promise((resolve) => {
          resolveSecondCreate = resolve
        })
      }

      if (url === '/api/v1/file/file-1/upload') {
        return Promise.resolve({
          error: false,
          data: {
            uploadRequest: {
              url: 'https://upload.test/file-1',
              method: 'PUT',
              headers: {},
            },
          },
        })
      }

      if (url === '/api/v1/file/file-2/upload') {
        return Promise.resolve({
          error: false,
          data: {
            uploadRequest: {
              url: 'https://upload.test/file-2',
              method: 'PUT',
              headers: {},
            },
          },
        })
      }

      if (String(url).startsWith('https://upload.test/')) {
        return Promise.resolve({ error: false })
      }

      if (String(url).includes('/attach') || String(url).includes('/sync')) {
        return Promise.resolve({ error: false })
      }

      return Promise.resolve({ error: false, data: {} })
    })

    mockUseFetch.mockReturnValue({ fetch })

    render(<DatasetFiles dataset={{ id: 'dataset-1', files: [] }} />)

    const file1 = {
      name: 'first.txt',
      size: 111,
      type: 'text/plain',
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
    }

    const file2 = {
      name: 'second.csv',
      size: 222,
      type: 'text/csv',
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
    }

    const uploadPromise = latestDropzoneOptions.onDropAccepted([file1, file2])

    await waitFor(() => {
      expect(screen.getByText('first.txt')).toBeInTheDocument()
    })

    expect(screen.queryByText('second.csv')).not.toBeInTheDocument()

    await act(async () => {
      resolveSecondCreate({ error: false, data: { id: 'file-2' } })
      await uploadPromise
    })

    await waitFor(() => {
      expect(screen.getByText('second.csv')).toBeInTheDocument()
    })
  })

  it('should remove all files when deleting files quickly one after another', async () => {
    const fetch = jest.fn(() => Promise.resolve({ error: false }))

    mockUseFetch.mockReturnValue({ fetch })

    mockConfirmDelete
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)

    const { container } = render(
      <DatasetFiles
        dataset={{
          id: 'dataset-1',
          files: [
            { fileId: 'file-1', file: { name: 'first.txt' } },
            { fileId: 'file-2', file: { name: 'second.txt' } },
          ],
        }}
      />
    )

    const deleteControls = container.querySelectorAll('.bg-red-600.text-white')

    fireEvent.click(deleteControls[0])
    fireEvent.click(deleteControls[1])

    await waitFor(() => {
      expect(screen.queryByText('first.txt')).not.toBeInTheDocument()
      expect(screen.queryByText('second.txt')).not.toBeInTheDocument()
    })
  })
})
