import { useDropzone as _useDropzone } from 'react-dropzone'

import toast from '@/lib/toast'

import useDropzone from './useDropzone'

import { renderHook } from '@testing-library/react'

jest.mock('react-dropzone', () => ({
  useDropzone: jest.fn(),
}))

jest.mock('@/lib/toast', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}))

describe('useDropzone', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should call underlying useDropzone with props', () => {
      const mockProps = {
        accept: { 'image/*': [] },
        maxSize: 1024 * 1024,
      }

      const mockReturn = {
        getRootProps: jest.fn(),
        getInputProps: jest.fn(),
        isDragActive: false,
      }

      _useDropzone.mockReturnValue(mockReturn)

      const { result } = renderHook(() => useDropzone(mockProps))

      expect(_useDropzone).toHaveBeenCalledWith(
        expect.objectContaining({
          accept: mockProps.accept,
          maxSize: mockProps.maxSize,
          onDropRejected: expect.any(Function),
        })
      )
      expect(result.current).toEqual(mockReturn)
    })

    it('should pass through onDropRejected handler', () => {
      let capturedHandler

      _useDropzone.mockImplementation((props) => {
        capturedHandler = props.onDropRejected

        return {
          getRootProps: jest.fn(),
          getInputProps: jest.fn(),
        }
      })

      renderHook(() => useDropzone({}))

      expect(capturedHandler).toBeDefined()
      expect(typeof capturedHandler).toBe('function')
    })
  })

  describe('error handling', () => {
    it('should show toast for single error', () => {
      let capturedHandler

      _useDropzone.mockImplementation((props) => {
        capturedHandler = props.onDropRejected

        return { getRootProps: jest.fn(), getInputProps: jest.fn() }
      })

      renderHook(() => useDropzone({}))

      const rejectedEntries = [
        {
          errors: [{ message: 'File is too large', code: 'file-too-large' }],
        },
      ]

      capturedHandler(rejectedEntries)

      expect(toast.error).toHaveBeenCalledTimes(1)
      expect(toast.error).toHaveBeenCalledWith('File is too large')
    })

    it('should show toast for multiple errors in single entry', () => {
      let capturedHandler

      _useDropzone.mockImplementation((props) => {
        capturedHandler = props.onDropRejected

        return { getRootProps: jest.fn(), getInputProps: jest.fn() }
      })

      renderHook(() => useDropzone({}))

      const rejectedEntries = [
        {
          errors: [
            { message: 'File is too large', code: 'file-too-large' },
            { message: 'Invalid file type', code: 'file-invalid-type' },
          ],
        },
      ]

      capturedHandler(rejectedEntries)

      expect(toast.error).toHaveBeenCalledTimes(2)
      expect(toast.error).toHaveBeenNthCalledWith(1, 'File is too large')
      expect(toast.error).toHaveBeenNthCalledWith(2, 'Invalid file type')
    })

    it('should show toast for multiple rejected entries', () => {
      let capturedHandler

      _useDropzone.mockImplementation((props) => {
        capturedHandler = props.onDropRejected

        return { getRootProps: jest.fn(), getInputProps: jest.fn() }
      })

      renderHook(() => useDropzone({}))

      const rejectedEntries = [
        {
          errors: [{ message: 'File 1 error', code: 'error-1' }],
        },
        {
          errors: [{ message: 'File 2 error', code: 'error-2' }],
        },
      ]

      capturedHandler(rejectedEntries)

      expect(toast.error).toHaveBeenCalledTimes(2)
      expect(toast.error).toHaveBeenNthCalledWith(1, 'File 1 error')
      expect(toast.error).toHaveBeenNthCalledWith(2, 'File 2 error')
    })

    it('should handle empty rejected entries', () => {
      let capturedHandler

      _useDropzone.mockImplementation((props) => {
        capturedHandler = props.onDropRejected

        return { getRootProps: jest.fn(), getInputProps: jest.fn() }
      })

      renderHook(() => useDropzone({}))

      capturedHandler([])

      expect(toast.error).not.toHaveBeenCalled()
    })

    it('should handle entry with empty errors array', () => {
      let capturedHandler

      _useDropzone.mockImplementation((props) => {
        capturedHandler = props.onDropRejected

        return { getRootProps: jest.fn(), getInputProps: jest.fn() }
      })

      renderHook(() => useDropzone({}))

      capturedHandler([{ errors: [] }])

      expect(toast.error).not.toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle props with spread operator', () => {
      const mockProps = {
        accept: { 'image/*': [] },
        maxSize: 1024,
        disabled: true,
        multiple: false,
      }

      _useDropzone.mockReturnValue({
        getRootProps: jest.fn(),
        getInputProps: jest.fn(),
      })

      renderHook(() => useDropzone(mockProps))

      expect(_useDropzone).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockProps,
          onDropRejected: expect.any(Function),
        })
      )
    })

    it('should handle empty props object', () => {
      _useDropzone.mockReturnValue({
        getRootProps: jest.fn(),
        getInputProps: jest.fn(),
      })

      renderHook(() => useDropzone({}))

      expect(_useDropzone).toHaveBeenCalledWith({
        onDropRejected: expect.any(Function),
      })
    })

    it('should preserve custom onDropAccepted handler', () => {
      const customOnDropAccepted = jest.fn()

      _useDropzone.mockReturnValue({
        getRootProps: jest.fn(),
        getInputProps: jest.fn(),
      })

      renderHook(() => useDropzone({ onDropAccepted: customOnDropAccepted }))

      expect(_useDropzone).toHaveBeenCalledWith(
        expect.objectContaining({
          onDropAccepted: customOnDropAccepted,
          onDropRejected: expect.any(Function),
        })
      )
    })
  })
})
