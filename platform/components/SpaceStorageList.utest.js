import SpaceStorageList, { useSpaceFileActions } from './SpaceStorageList'

import '@testing-library/jest-dom'
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react'

// Mock dependencies
jest.mock('@/lib/save', () => ({
  saveUrl: jest.fn(),
}))

jest.mock('@/lib/toast', () => ({
  __esModule: true,
  default: {
    loading: jest.fn(() => 'toast-id'),
    success: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('@/components/Confirm', () => ({
  useConfirmDelete: () => mockConfirmDeleteFn,
}))

// Mock FileIcon to avoid SVG import issues
jest.mock('@/components/FileIcon', () => ({
  __esModule: true,
  default: (props) => <div data-testid="file-icon" {...props} />,
}))

// Mock CodeBlock to avoid complex component loading
jest.mock('@/components/CodeBlock', () => ({
  __esModule: true,
  default: ({ children, language }) => (
    <pre data-testid="code-block" data-language={language}>
      {children}
    </pre>
  ),
}))

const mockOpenPopup = jest.fn()
const mockClosePopup = jest.fn()
const mockSetDisabled = jest.fn()
let mockConfirmDeleteFn = jest.fn(() => Promise.resolve(true))

jest.mock('@/hooks/usePopup', () => () => ({
  popup: null,
  openPopup: mockOpenPopup,
  closePopup: mockClosePopup,
  setDisabled: mockSetDisabled,
}))

const mockFetch = jest.fn(() => Promise.resolve({ error: null, data: {} }))

jest.mock('@/hooks/useFetch', () => () => ({
  fetch: mockFetch,
}))

jest.mock('@/hooks/useDropzone', () => () => ({
  getRootProps: () => ({}),
  getInputProps: () => ({}),
  isDragActive: false,
}))

describe('SpaceStorageList', () => {
  const mockFiles = [
    {
      path: 'document.pdf',
      size: 1024,
      updatedAt: 1735689600000,
      isDirectory: false,
    },
    {
      path: 'folder/nested.txt',
      size: 512,
      updatedAt: 1735776000000,
      isDirectory: false,
    },
  ]

  it('renders with default empty state', () => {
    render(<SpaceStorageList spaceId="test-space-id" />)
    expect(
      screen.getByText('No files in this space. Upload files to get started.')
    ).toBeInTheDocument()
  })

  it('renders file list with provided files', () => {
    render(
      <SpaceStorageList spaceId="test-space-id" defaultItems={mockFiles} />
    )
    expect(screen.getByText('document.pdf')).toBeInTheDocument()
    expect(screen.getByText('folder/nested.txt')).toBeInTheDocument()
  })

  it('shows upload button when uploadEnabled is true', () => {
    render(<SpaceStorageList spaceId="test-space-id" uploadEnabled={true} />)
    expect(
      screen.getByRole('button', { name: 'Upload Files' })
    ).toBeInTheDocument()
  })

  it('hides upload button when uploadEnabled is false', () => {
    render(<SpaceStorageList spaceId="test-space-id" uploadEnabled={false} />)
    expect(
      screen.queryByRole('button', { name: 'Upload Files' })
    ).not.toBeInTheDocument()
  })

  it('displays file size in KB for small files', () => {
    render(
      <SpaceStorageList
        spaceId="test-space-id"
        defaultItems={[
          {
            path: 'small.txt',
            size: 1536, // 1.5 KB
            updatedAt: 1735689600000,
            isDirectory: false,
          },
        ]}
      />
    )
    expect(screen.getByText('Size: 1.50 KB')).toBeInTheDocument()
  })

  it('displays file size in MB for large files', () => {
    render(
      <SpaceStorageList
        spaceId="test-space-id"
        defaultItems={[
          {
            path: 'large.zip',
            size: 2 * 1024 * 1024,
            updatedAt: 1735689600000,
            isDirectory: false,
          },
        ]}
      />
    )
    expect(screen.getByText('Size: 2.00 MB')).toBeInTheDocument()
  })

  it('filters out directories from the list', () => {
    const filesWithDir = [
      {
        path: 'regular.txt',
        size: 100,
        updatedAt: 1735689600000,
        isDirectory: false,
      },
      {
        path: 'mydir',
        size: 0,
        updatedAt: 1735862400000,
        isDirectory: true,
      },
    ]

    render(
      <SpaceStorageList spaceId="test-space-id" defaultItems={filesWithDir} />
    )
    expect(screen.getByText('regular.txt')).toBeInTheDocument()
    // mydir should not appear because isDirectory is true
    expect(screen.queryByText('mydir')).not.toBeInTheDocument()
  })

  describe('file preview', () => {
    beforeEach(() => {
      mockOpenPopup.mockClear()
    })

    it('opens preview popup when clicking on a previewable image file', async () => {
      const imageFiles = [
        {
          path: 'photo.png',
          size: 1024,
          updatedAt: 1735689600000,
          isDirectory: false,
        },
      ]

      render(
        <SpaceStorageList spaceId="test-space-id" defaultItems={imageFiles} />
      )

      const listItem = screen.getByText('photo.png').closest('li')

      fireEvent.click(listItem)

      expect(mockOpenPopup).toHaveBeenCalled()

      const popupOptions = mockOpenPopup.mock.calls[0][1]

      expect(popupOptions.title).toBe('photo.png')
    })

    it('opens preview popup when clicking on a previewable PDF file', async () => {
      const pdfFiles = [
        {
          path: 'document.pdf',
          size: 2048,
          updatedAt: 1735689600000,
          isDirectory: false,
        },
      ]

      render(
        <SpaceStorageList spaceId="test-space-id" defaultItems={pdfFiles} />
      )

      const listItem = screen.getByText('document.pdf').closest('li')

      fireEvent.click(listItem)

      expect(mockOpenPopup).toHaveBeenCalled()

      const popupOptions = mockOpenPopup.mock.calls[0][1]

      expect(popupOptions.title).toBe('document.pdf')
    })

    it('opens preview popup when clicking on a previewable text file', async () => {
      const textFiles = [
        {
          path: 'notes.txt',
          size: 512,
          updatedAt: 1735689600000,
          isDirectory: false,
        },
      ]

      render(
        <SpaceStorageList spaceId="test-space-id" defaultItems={textFiles} />
      )

      const listItem = screen.getByText('notes.txt').closest('li')

      fireEvent.click(listItem)

      expect(mockOpenPopup).toHaveBeenCalled()

      const popupOptions = mockOpenPopup.mock.calls[0][1]

      expect(popupOptions.title).toBe('notes.txt')
    })

    it('opens action-only popup when clicking on non-previewable file', async () => {
      const binaryFiles = [
        {
          path: 'archive.zip',
          size: 4096,
          updatedAt: 1735689600000,
          isDirectory: false,
        },
      ]

      render(
        <SpaceStorageList spaceId="test-space-id" defaultItems={binaryFiles} />
      )

      const listItem = screen.getByText('archive.zip').closest('li')

      fireEvent.click(listItem)

      expect(mockOpenPopup).toHaveBeenCalled()

      const popupOptions = mockOpenPopup.mock.calls[0][1]

      expect(popupOptions.title).toBe('archive.zip')
      expect(popupOptions.actions).toHaveProperty('Move')
      expect(popupOptions.actions).toHaveProperty('Delete')
      expect(popupOptions.actions).not.toHaveProperty('Edit')
    })

    it('opens preview popup when clicking on JSON file', async () => {
      const jsonFiles = [
        {
          path: 'config.json',
          size: 256,
          updatedAt: 1735689600000,
          isDirectory: false,
        },
      ]

      render(
        <SpaceStorageList spaceId="test-space-id" defaultItems={jsonFiles} />
      )

      const listItem = screen.getByText('config.json').closest('li')

      fireEvent.click(listItem)

      expect(mockOpenPopup).toHaveBeenCalled()

      const popupOptions = mockOpenPopup.mock.calls[0][1]

      expect(popupOptions.title).toBe('config.json')
    })
  })
})

describe('useSpaceFileActions', () => {
  const spaceId = 'space-123'
  const textFile = { path: 'notes.txt' }
  const imageFile = { path: 'photo.png' }
  const binaryFile = { path: 'archive.zip' }
  const namedSkill = { path: '.skills/my-skill/SKILL.md', name: 'my-skill' }

  const toast = jest.requireMock('@/lib/toast').default

  beforeEach(() => {
    mockOpenPopup.mockClear()
    mockClosePopup.mockClear()
    mockSetDisabled.mockClear()
    mockFetch.mockReset()
    mockFetch.mockResolvedValue({ error: null, data: {} })
    mockConfirmDeleteFn.mockReset()
    mockConfirmDeleteFn.mockResolvedValue(true)
  })

  describe('handleFilePreview', () => {
    it('opens loading popup immediately then text popup with Edit and Delete actions', async () => {
      mockFetch.mockResolvedValue({ error: null, data: 'hello world' })

      const { result } = renderHook(() => useSpaceFileActions(spaceId))

      await act(async () => {
        await result.current.handleFilePreview(textFile)
      })

      // @note first call is the loading state, second is the loaded content
      expect(mockOpenPopup).toHaveBeenCalledTimes(2)

      const [, loadedOptions] = mockOpenPopup.mock.calls[1]

      expect(loadedOptions.title).toBe('notes.txt')
      expect(loadedOptions.actions).toHaveProperty('Download')
      expect(loadedOptions.actions).toHaveProperty('Edit')
      expect(loadedOptions.actions).toHaveProperty('Move')
      expect(loadedOptions.actions).toHaveProperty('Delete')
    })

    it('uses file.name as the popup title when provided', async () => {
      mockFetch.mockResolvedValue({ error: null, data: '# My Skill' })

      const { result } = renderHook(() => useSpaceFileActions(spaceId))

      await act(async () => {
        await result.current.handleFilePreview(namedSkill)
      })

      const [, loadedOptions] = mockOpenPopup.mock.calls[1]

      expect(loadedOptions.title).toBe('my-skill')
    })

    it('opens binary/image popup with Move and Delete actions but without Edit', async () => {
      mockFetch.mockResolvedValue({
        error: null,
        data: { url: 'https://example.com/photo.png' },
      })

      const { result } = renderHook(() => useSpaceFileActions(spaceId))

      await act(async () => {
        await result.current.handleFilePreview(imageFile)
      })

      expect(mockOpenPopup).toHaveBeenCalledTimes(2)

      const [, loadedOptions] = mockOpenPopup.mock.calls[1]

      expect(loadedOptions.actions).toHaveProperty('Download')
      expect(loadedOptions.actions).toHaveProperty('Move')
      expect(loadedOptions.actions).toHaveProperty('Delete')
      expect(loadedOptions.actions).not.toHaveProperty('Edit')
    })

    it('shows error popup when download fails', async () => {
      mockFetch.mockResolvedValue({ error: 'network error', data: null })

      const { result } = renderHook(() => useSpaceFileActions(spaceId))

      await act(async () => {
        await result.current.handleFilePreview(textFile)
      })

      // @note loading popup + error popup
      expect(mockOpenPopup).toHaveBeenCalledTimes(2)

      const [, errorOptions] = mockOpenPopup.mock.calls[1]

      expect(errorOptions.noActions).toBe(true)
    })

    it('opens placeholder popup with Move and Delete actions for non-previewable files', async () => {
      const { result } = renderHook(() => useSpaceFileActions(spaceId))

      await act(async () => {
        await result.current.handleFilePreview(binaryFile)
      })

      expect(mockOpenPopup).toHaveBeenCalledTimes(1)
      expect(mockFetch).not.toHaveBeenCalled()

      const [, loadedOptions] = mockOpenPopup.mock.calls[0]

      expect(loadedOptions.title).toBe('archive.zip')
      expect(loadedOptions.actions).toHaveProperty('Download')
      expect(loadedOptions.actions).toHaveProperty('Move')
      expect(loadedOptions.actions).toHaveProperty('Delete')
      expect(loadedOptions.actions).not.toHaveProperty('Edit')
    })
  })

  describe('handleFileDownload', () => {
    it('fetches the download URL and triggers a save', async () => {
      const { saveUrl } = jest.requireMock('@/lib/save')

      mockFetch.mockResolvedValue({
        error: null,
        data: { url: 'https://example.com/notes.txt' },
      })

      const { result } = renderHook(() => useSpaceFileActions(spaceId))

      await act(async () => {
        await result.current.handleFileDownload(textFile)
      })

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/v1/space/${spaceId}/storage/download/notes.txt`,
        { headers: { Accept: 'application/json' } }
      )
      expect(saveUrl).toHaveBeenCalledWith('https://example.com/notes.txt', {
        name: 'notes.txt',
      })
    })

    it('shows a toast error when the download URL cannot be retrieved', async () => {
      mockFetch.mockResolvedValue({ error: 'server error', data: null })

      const { result } = renderHook(() => useSpaceFileActions(spaceId))

      await act(async () => {
        await result.current.handleFileDownload(textFile)
      })

      expect(toast.error).toHaveBeenCalled()
    })
  })

  describe('handleFileDelete', () => {
    it('returns false and does not call fetch when user cancels', async () => {
      mockConfirmDeleteFn.mockResolvedValueOnce(false)

      const { result } = renderHook(() => useSpaceFileActions(spaceId))

      let returnValue

      await act(async () => {
        returnValue = await result.current.handleFileDelete(textFile)
      })

      expect(returnValue).toBe(false)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('returns true, calls fetch, and calls onFilesChanged when deletion succeeds', async () => {
      const onFilesChanged = jest.fn()

      const { result } = renderHook(() =>
        useSpaceFileActions(spaceId, { onFilesChanged })
      )

      let returnValue

      await act(async () => {
        returnValue = await result.current.handleFileDelete(textFile)
      })

      expect(returnValue).toBe(true)
      expect(mockFetch).toHaveBeenCalled()
      expect(onFilesChanged).toHaveBeenCalled()
    })

    it('returns false and shows toast error when API delete fails', async () => {
      mockFetch.mockResolvedValue({ error: 'server error', data: null })

      const { result } = renderHook(() => useSpaceFileActions(spaceId))

      let returnValue

      await act(async () => {
        returnValue = await result.current.handleFileDelete(textFile)
      })

      expect(returnValue).toBe(false)
      expect(toast.error).toHaveBeenCalled()
    })
  })

  describe('handleFileMove', () => {
    it('opens move popup with Move action', async () => {
      const { result } = renderHook(() => useSpaceFileActions(spaceId))

      await act(async () => {
        await result.current.handleFileMove(textFile)
      })

      expect(mockOpenPopup).toHaveBeenCalledTimes(1)

      const [, moveOptions] = mockOpenPopup.mock.calls[0]

      expect(moveOptions.title).toBe('Move: notes.txt')
      expect(moveOptions.cancelButtonCaption).toBe('Cancel')
      expect(moveOptions.actions).toHaveProperty('Move')
    })

    it('moves file and refreshes the list when the move succeeds', async () => {
      const onFilesChanged = jest.fn()

      const { result } = renderHook(() =>
        useSpaceFileActions(spaceId, { onFilesChanged })
      )

      await act(async () => {
        await result.current.handleFileMove(textFile)
      })

      const [, moveOptions] = mockOpenPopup.mock.calls[0]

      await act(async () => {
        await moveOptions.actions.Move.fn({ newPath: 'archive/notes.txt' })
      })

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/v1/space/${spaceId}/storage/move/notes.txt`,
        { data: { destinationPath: 'archive/notes.txt' } }
      )
      expect(onFilesChanged).toHaveBeenCalled()
      expect(mockClosePopup).toHaveBeenCalled()
    })

    it('closes the popup without moving when the destination path is unchanged', async () => {
      const { result } = renderHook(() => useSpaceFileActions(spaceId))

      await act(async () => {
        await result.current.handleFileMove(textFile)
      })

      const [, moveOptions] = mockOpenPopup.mock.calls[0]

      await act(async () => {
        await moveOptions.actions.Move.fn({ newPath: 'notes.txt' })
      })

      expect(mockFetch).not.toHaveBeenCalled()
      expect(mockClosePopup).toHaveBeenCalled()
    })
  })

  describe('handleFileEdit', () => {
    it('opens loading popup then edit popup with Save action and Back cancel button', async () => {
      mockFetch.mockResolvedValue({ error: null, data: 'file content' })

      const { result } = renderHook(() => useSpaceFileActions(spaceId))

      await act(async () => {
        await result.current.handleFileEdit(textFile)
      })

      expect(mockOpenPopup).toHaveBeenCalledTimes(2)

      const [, editOptions] = mockOpenPopup.mock.calls[1]

      expect(editOptions.title).toBe('Edit: notes.txt')
      expect(editOptions.cancelButtonCaption).toBe('Back')
      expect(editOptions.actions).toHaveProperty('Save')
      expect(editOptions.onClose).toBeInstanceOf(Function)
    })

    it('shows toast error and does not open edit popup for non-text files', async () => {
      const { result } = renderHook(() => useSpaceFileActions(spaceId))

      await act(async () => {
        await result.current.handleFileEdit(imageFile)
      })

      expect(mockOpenPopup).not.toHaveBeenCalled()
      expect(toast.error).toHaveBeenCalled()
    })

    it('navigates back to preview when onClose (Back button) is called', async () => {
      mockFetch.mockResolvedValue({ error: null, data: 'file content' })

      const { result } = renderHook(() => useSpaceFileActions(spaceId))

      await act(async () => {
        await result.current.handleFileEdit(textFile)
      })

      const [, editOptions] = mockOpenPopup.mock.calls[1]

      mockOpenPopup.mockClear()
      mockFetch.mockResolvedValue({ error: null, data: 'file content' })

      await act(async () => {
        editOptions.onClose()
      })

      // @note onClose should re-open the preview (calls openPopup for the loading state)
      expect(mockOpenPopup).toHaveBeenCalled()
      expect(mockOpenPopup.mock.calls[0][1].title).toBe('notes.txt')
    })

    it('navigates back to preview after successful save', async () => {
      mockFetch
        .mockResolvedValueOnce({ error: null, data: 'file content' }) // download for edit
        .mockResolvedValueOnce({ error: null, data: { uploadRequest: null } }) // upload metadata
        .mockResolvedValue({ error: null, data: 'file content' }) // download for preview

      const { result } = renderHook(() => useSpaceFileActions(spaceId))

      await act(async () => {
        await result.current.handleFileEdit(textFile)
      })

      const [, editOptions] = mockOpenPopup.mock.calls[1]

      mockOpenPopup.mockClear()

      await act(async () => {
        await editOptions.actions.Save.fn({ fileContent: 'new content' })
      })

      // @note after save, preview popup should be opened
      expect(mockOpenPopup).toHaveBeenCalled()
      expect(mockOpenPopup.mock.calls[0][1].title).toBe('notes.txt')
    })
  })

  describe('delete from preview popup', () => {
    it('disables popup before confirming and re-enables after cancellation', async () => {
      mockConfirmDeleteFn.mockResolvedValueOnce(false)

      mockFetch.mockResolvedValue({ error: null, data: 'file content' })

      const { result } = renderHook(() => useSpaceFileActions(spaceId))

      await act(async () => {
        await result.current.handleFilePreview(textFile)
      })

      const [, previewOptions] = mockOpenPopup.mock.calls[1]

      mockOpenPopup.mockClear()

      await act(async () => {
        await previewOptions.actions.Delete.fn()
      })

      expect(mockSetDisabled).toHaveBeenCalledWith(true)
      expect(mockSetDisabled).toHaveBeenCalledWith(false)

      // @note popup should NOT close when deletion is cancelled
      expect(mockClosePopup).not.toHaveBeenCalled()
    })

    it('closes popup after confirmed deletion', async () => {
      mockFetch.mockResolvedValue({ error: null, data: 'file content' })

      const { result } = renderHook(() => useSpaceFileActions(spaceId))

      await act(async () => {
        await result.current.handleFilePreview(textFile)
      })

      const [, previewOptions] = mockOpenPopup.mock.calls[1]

      // @note first mockFetch call was for the text download; next is for delete
      mockFetch.mockResolvedValue({ error: null, data: null })

      await act(async () => {
        await previewOptions.actions.Delete.fn()
      })

      expect(mockSetDisabled).toHaveBeenCalledWith(true)
      expect(mockClosePopup).toHaveBeenCalled()
      expect(mockSetDisabled).toHaveBeenCalledWith(false)
    })
  })
})
