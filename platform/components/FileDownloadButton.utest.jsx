/* eslint-disable @typescript-eslint/no-require-imports */
import FileDownloadButton from './FileDownloadButton'

import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

jest.mock('@/hooks/useFetch', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/lib/save', () => ({
  saveUrl: jest.fn(),
}))

const useFetch = require('@/hooks/useFetch').default
const { saveUrl } = require('@/lib/save')

describe('FileDownloadButton', () => {
  const fetch = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    useFetch.mockReturnValue({ fetch })
  })

  it('renders default button label and forwards common props', () => {
    render(
      <FileDownloadButton
        fileId="file-1"
        className="download-btn"
        data-testid="download-button"
      />
    )

    const button = screen.getByTestId('download-button')

    expect(button).toHaveTextContent('Download')
    expect(button).toHaveClass('download-btn')
    expect(button).toHaveAttribute('type', 'button')
  })

  it('fetches signed download url and calls saveUrl on success', async () => {
    fetch.mockResolvedValue({
      error: null,
      data: { url: 'https://example.com/file.bin' },
    })

    render(<FileDownloadButton fileId="file-1">Save file</FileDownloadButton>)

    fireEvent.click(screen.getByRole('button', { name: 'Save file' }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/v1/file/file-1/download', {
        headers: { Accept: 'application/json' },
        loadingMessage: 'Preparing download...',
        failureMessage: true,
      })
    })
    expect(saveUrl).toHaveBeenCalledWith('https://example.com/file.bin')
  })

  it('does not call saveUrl when request returns an error', async () => {
    fetch.mockResolvedValue({
      error: new Error('not found'),
      data: null,
    })

    render(<FileDownloadButton fileId="file-2" />)

    fireEvent.click(screen.getByRole('button', { name: 'Download' }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1)
    })
    expect(saveUrl).not.toHaveBeenCalled()
  })

  it('respects disabled state', () => {
    render(<FileDownloadButton fileId="file-3" disabled />)

    expect(screen.getByRole('button', { name: 'Download' })).toBeDisabled()
  })
})
