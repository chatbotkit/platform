import FileManager, { FileList } from './FileManager'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

// Mock child components
jest.mock('@/components/FileDrop', () => {
  return function FileDrop({ onDropAccepted, accept }) {
    return (
      <div data-testid="file-drop" data-accept={accept}>
        <button
          type="button"
          onClick={() => {
            const mockFile = new File(['content'], 'test.txt', {
              type: 'text/plain',
            })

            mockFile.path = 'test.txt'
            onDropAccepted([mockFile])
          }}
        >
          Drop Files
        </button>
      </div>
    )
  }
})

jest.mock('@/components/FileIcon', () => {
  return function FileIcon({ name, className }) {
    return (
      <span data-testid="file-icon" data-name={name} className={className} />
    )
  }
})

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url')

describe('FileList', () => {
  describe('basic rendering', () => {
    it('should render empty list when files is undefined', () => {
      const { container } = render(
        <FileList files={undefined} setFiles={jest.fn()} />
      )

      expect(container.textContent).toBe('')
    })

    it('should render empty list when files is null', () => {
      const { container } = render(
        <FileList files={null} setFiles={jest.fn()} />
      )

      expect(container.textContent).toBe('')
    })

    it('should render empty list when files is empty array', () => {
      const { container } = render(<FileList files={[]} setFiles={jest.fn()} />)

      expect(container.textContent).toBe('')
    })

    it('should render single file', () => {
      const files = [{ name: 'test.txt', path: 'test.txt' }]

      render(<FileList files={files} setFiles={jest.fn()} />)

      expect(screen.getByText('test.txt')).toBeInTheDocument()
      expect(screen.getByTestId('file-icon')).toHaveAttribute(
        'data-name',
        'test.txt'
      )
    })

    it('should render multiple files', () => {
      const files = [
        { name: 'file1.txt', path: 'file1.txt' },
        { name: 'file2.pdf', path: 'file2.pdf' },
        { name: 'file3.jpg', path: 'file3.jpg' },
      ]

      render(<FileList files={files} setFiles={jest.fn()} />)

      expect(screen.getByText('file1.txt')).toBeInTheDocument()
      expect(screen.getByText('file2.pdf')).toBeInTheDocument()
      expect(screen.getByText('file3.jpg')).toBeInTheDocument()

      const icons = screen.getAllByTestId('file-icon')

      expect(icons).toHaveLength(3)
    })
  })

  describe('file removal', () => {
    it('should call setFiles when remove button clicked', () => {
      const setFiles = jest.fn()
      const files = [
        { name: 'test.txt', path: 'test.txt' },
        { name: 'other.txt', path: 'other.txt' },
      ]

      render(<FileList files={files} setFiles={setFiles} />)

      const removeButtons = screen.getAllByRole('button')

      fireEvent.click(removeButtons[0])

      expect(setFiles).toHaveBeenCalledWith([
        { name: 'other.txt', path: 'other.txt' },
      ])
    })

    it('should filter out correct file by path', () => {
      const setFiles = jest.fn()
      const files = [
        { name: 'file1.txt', path: '/path/to/file1.txt' },
        { name: 'file2.txt', path: '/path/to/file2.txt' },
        { name: 'file3.txt', path: '/path/to/file3.txt' },
      ]

      render(<FileList files={files} setFiles={setFiles} />)

      const removeButtons = screen.getAllByRole('button')

      fireEvent.click(removeButtons[1])

      expect(setFiles).toHaveBeenCalledWith([
        { name: 'file1.txt', path: '/path/to/file1.txt' },
        { name: 'file3.txt', path: '/path/to/file3.txt' },
      ])
    })

    it('should handle removing last file', () => {
      const setFiles = jest.fn()
      const files = [{ name: 'last.txt', path: 'last.txt' }]

      render(<FileList files={files} setFiles={setFiles} />)

      const removeButton = screen.getByRole('button')

      fireEvent.click(removeButton)

      expect(setFiles).toHaveBeenCalledWith([])
    })
  })

  describe('file display', () => {
    it('should display file path', () => {
      const files = [{ name: 'document.pdf', path: '/uploads/document.pdf' }]

      render(<FileList files={files} setFiles={jest.fn()} />)

      expect(screen.getByText('/uploads/document.pdf')).toBeInTheDocument()
    })

    it('should pass file name to FileIcon', () => {
      const files = [{ name: 'image.jpg', path: 'image.jpg' }]

      render(<FileList files={files} setFiles={jest.fn()} />)

      const icon = screen.getByTestId('file-icon')

      expect(icon).toHaveAttribute('data-name', 'image.jpg')
      expect(icon).toHaveClass('w-5')
    })
  })
})

describe('FileManager', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic rendering', () => {
    it('should render FileDrop and FileList', () => {
      render(<FileManager />)

      expect(screen.getByTestId('file-drop')).toBeInTheDocument()
      expect(screen.getByText('Drop Files')).toBeInTheDocument()
    })

    it('should pass accept prop to FileDrop', () => {
      render(<FileManager accept="image/*" />)

      const fileDrop = screen.getByTestId('file-drop')

      expect(fileDrop).toHaveAttribute('data-accept', 'image/*')
    })

    it('should render with initial files', () => {
      const initialFiles = [{ name: 'initial.txt', path: 'initial.txt' }]

      render(<FileManager files={initialFiles} />)

      expect(screen.getByText('initial.txt')).toBeInTheDocument()
    })

    it('should render with empty initial files array', () => {
      render(<FileManager files={[]} />)

      expect(screen.getByTestId('file-drop')).toBeInTheDocument()
      expect(screen.queryByTestId('file-icon')).not.toBeInTheDocument()
    })
  })

  describe('file dropping', () => {
    it('should add files when dropped', () => {
      render(<FileManager />)

      const dropButton = screen.getByText('Drop Files')

      fireEvent.click(dropButton)

      expect(screen.getByText('test.txt')).toBeInTheDocument()
      expect(URL.createObjectURL).toHaveBeenCalled()
    })

    it('should create preview URL for dropped files', () => {
      render(<FileManager />)

      fireEvent.click(screen.getByText('Drop Files'))

      expect(URL.createObjectURL).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test.txt',
          type: 'text/plain',
        })
      )
    })

    it('should prevent duplicate files by path', () => {
      const initialFiles = [{ name: 'test.txt', path: 'test.txt' }]

      render(<FileManager files={initialFiles} />)

      // Initial file should be displayed
      expect(screen.getAllByText('test.txt')).toHaveLength(1)

      // Try to add duplicate
      fireEvent.click(screen.getByText('Drop Files'))

      // Should still only have one instance
      expect(screen.getAllByText('test.txt')).toHaveLength(1)
    })

    it('should call external setFiles when provided', () => {
      const setFiles = jest.fn()

      render(<FileManager setFiles={setFiles} />)

      fireEvent.click(screen.getByText('Drop Files'))

      expect(setFiles).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'test.txt',
            path: 'test.txt',
            preview: 'blob:mock-url',
          }),
        ])
      )
    })

    it('should not call external setFiles when not provided', () => {
      render(<FileManager />)

      // Should not throw error
      expect(() => {
        fireEvent.click(screen.getByText('Drop Files'))
      }).not.toThrow()
    })
  })

  describe('file removal integration', () => {
    it('should remove files from internal state', () => {
      render(<FileManager />)

      // Add file
      fireEvent.click(screen.getByText('Drop Files'))
      expect(screen.getByText('test.txt')).toBeInTheDocument()

      // Remove file
      const removeButton = screen.getByRole('button', { name: '' })

      fireEvent.click(removeButton)

      expect(screen.queryByText('test.txt')).not.toBeInTheDocument()
    })

    it('should call external setFiles on removal', () => {
      const setFiles = jest.fn()

      render(<FileManager setFiles={setFiles} />)

      // Add file
      fireEvent.click(screen.getByText('Drop Files'))

      // Remove file
      const removeButton = screen.getByRole('button', { name: '' })

      fireEvent.click(removeButton)

      expect(setFiles).toHaveBeenLastCalledWith([])
    })

    it('should remove correct file from multiple files', () => {
      const setFiles = jest.fn()
      const initialFiles = [
        { name: 'file1.txt', path: 'file1.txt' },
        { name: 'file2.txt', path: 'file2.txt' },
      ]

      render(<FileManager files={initialFiles} setFiles={setFiles} />)

      const removeButtons = screen.getAllByRole('button', { name: '' })

      fireEvent.click(removeButtons[0])

      expect(setFiles).toHaveBeenCalledWith([
        { name: 'file2.txt', path: 'file2.txt' },
      ])
    })
  })

  describe('controlled vs uncontrolled', () => {
    it('should work as uncontrolled (no external setFiles)', () => {
      render(<FileManager />)

      fireEvent.click(screen.getByText('Drop Files'))

      expect(screen.getByText('test.txt')).toBeInTheDocument()
    })

    it('should work as controlled (with external setFiles)', () => {
      const setFiles = jest.fn()
      const initialFiles = []

      const { rerender } = render(
        <FileManager files={initialFiles} setFiles={setFiles} />
      )

      fireEvent.click(screen.getByText('Drop Files'))

      const newFiles = [
        { name: 'test.txt', path: 'test.txt', preview: 'blob:mock-url' },
      ]

      expect(setFiles).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ path: 'test.txt' })])
      )

      rerender(<FileManager files={newFiles} setFiles={setFiles} />)

      expect(screen.getByText('test.txt')).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('should handle undefined accept prop', () => {
      render(<FileManager accept={undefined} />)

      const fileDrop = screen.getByTestId('file-drop')

      expect(fileDrop).toBeInTheDocument()
    })

    it('should handle null initial files', () => {
      render(<FileManager files={null} />)

      expect(screen.getByTestId('file-drop')).toBeInTheDocument()
    })

    it('should maintain file order', () => {
      const initialFiles = [
        { name: 'first.txt', path: 'first.txt' },
        { name: 'second.txt', path: 'second.txt' },
      ]

      render(<FileManager files={initialFiles} />)

      const paths = screen.getAllByText(/\.txt$/).map((el) => el.textContent)

      expect(paths).toEqual(['first.txt', 'second.txt'])
    })
  })
})
