import useClipboardContainer from './useClipboardContainer'

import { act, renderHook } from '@testing-library/react'

describe('useClipboardContainer', () => {
  let mockClipboard

  beforeEach(() => {
    // Mock ClipboardItem constructor
    global.ClipboardItem = class ClipboardItem {
      constructor(data) {
        this.data = data
      }
    }

    // Mock the navigator.clipboard API
    mockClipboard = {
      write: jest.fn(),
      read: jest.fn(),
    }

    Object.defineProperty(navigator, 'clipboard', {
      value: mockClipboard,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('copyToClipboard', () => {
    it('should copy blob to clipboard with correct content type', async () => {
      const contentType = 'text/plain'
      const { result } = renderHook(() => useClipboardContainer(contentType))

      const blob = new Blob(['test content'], { type: contentType })

      mockClipboard.write.mockResolvedValue()

      await act(async () => {
        await result.current.copyToClipboard(blob)
      })

      expect(mockClipboard.write).toHaveBeenCalledTimes(1)

      const clipboardItems = mockClipboard.write.mock.calls[0][0]

      expect(clipboardItems).toHaveLength(1)
      expect(clipboardItems[0]).toBeInstanceOf(ClipboardItem)
    })

    it('should convert string to blob when copying', async () => {
      const contentType = 'text/html'
      const { result } = renderHook(() => useClipboardContainer(contentType))

      const stringContent = '<p>Hello World</p>'

      mockClipboard.write.mockResolvedValue()

      await act(async () => {
        await result.current.copyToClipboard(stringContent)
      })

      expect(mockClipboard.write).toHaveBeenCalledTimes(1)

      const clipboardItems = mockClipboard.write.mock.calls[0][0]

      expect(clipboardItems).toHaveLength(1)
      expect(clipboardItems[0]).toBeInstanceOf(ClipboardItem)
    })

    it('should handle clipboard write errors gracefully', async () => {
      const contentType = 'text/plain'
      const { result } = renderHook(() => useClipboardContainer(contentType))

      const blob = new Blob(['test'], { type: contentType })

      mockClipboard.write.mockRejectedValue(new Error('Permission denied'))

      // should not throw error
      await act(async () => {
        await result.current.copyToClipboard(blob)
      })

      expect(mockClipboard.write).toHaveBeenCalledTimes(1)
    })

    it('should work with different content types', async () => {
      const contentTypes = [
        'text/plain',
        'text/html',
        'application/json',
        'image/png',
      ]

      for (const contentType of contentTypes) {
        const { result } = renderHook(() => useClipboardContainer(contentType))

        const blob = new Blob(['content'], { type: contentType })

        mockClipboard.write.mockResolvedValue()

        await act(async () => {
          await result.current.copyToClipboard(blob)
        })

        expect(mockClipboard.write).toHaveBeenCalled()

        jest.clearAllMocks()
      }
    })
  })

  describe('pasteFromClipboard', () => {
    it('should paste blob with matching content type', async () => {
      const contentType = 'text/plain'
      const { result } = renderHook(() => useClipboardContainer(contentType))

      const mockBlob = new Blob(['pasted content'], { type: contentType })

      const mockClipboardItem = {
        types: [contentType],
        getType: jest.fn().mockResolvedValue(mockBlob),
      }

      mockClipboard.read.mockResolvedValue([mockClipboardItem])

      let pastedBlob

      await act(async () => {
        pastedBlob = await result.current.pasteFromClipboard()
      })

      expect(mockClipboard.read).toHaveBeenCalledTimes(1)
      expect(mockClipboardItem.getType).toHaveBeenCalledWith(contentType)
      expect(pastedBlob).toBe(mockBlob)
    })

    it('should return undefined when content type does not match', async () => {
      const contentType = 'text/plain'
      const { result } = renderHook(() => useClipboardContainer(contentType))

      const mockClipboardItem = {
        types: ['text/html'], // different type
        getType: jest.fn(),
      }

      mockClipboard.read.mockResolvedValue([mockClipboardItem])

      let pastedBlob

      await act(async () => {
        pastedBlob = await result.current.pasteFromClipboard()
      })

      expect(mockClipboard.read).toHaveBeenCalledTimes(1)
      expect(mockClipboardItem.getType).not.toHaveBeenCalled()
      expect(pastedBlob).toBeUndefined()
    })

    it('should handle multiple clipboard items and find matching type', async () => {
      const contentType = 'text/html'
      const { result } = renderHook(() => useClipboardContainer(contentType))

      const mockBlob = new Blob(['<p>content</p>'], { type: contentType })

      const mockClipboardItem1 = {
        types: ['text/plain'],
        getType: jest.fn(),
      }

      const mockClipboardItem2 = {
        types: ['text/html', 'text/plain'],
        getType: jest.fn().mockResolvedValue(mockBlob),
      }

      mockClipboard.read.mockResolvedValue([
        mockClipboardItem1,
        mockClipboardItem2,
      ])

      let pastedBlob

      await act(async () => {
        pastedBlob = await result.current.pasteFromClipboard()
      })

      expect(mockClipboard.read).toHaveBeenCalledTimes(1)
      expect(mockClipboardItem1.getType).not.toHaveBeenCalled()
      expect(mockClipboardItem2.getType).toHaveBeenCalledWith(contentType)
      expect(pastedBlob).toBe(mockBlob)
    })

    it('should handle clipboard read errors gracefully', async () => {
      const contentType = 'text/plain'
      const { result } = renderHook(() => useClipboardContainer(contentType))

      mockClipboard.read.mockRejectedValue(new Error('Permission denied'))

      let pastedBlob

      // should not throw error
      await act(async () => {
        pastedBlob = await result.current.pasteFromClipboard()
      })

      expect(mockClipboard.read).toHaveBeenCalledTimes(1)
      expect(pastedBlob).toBeUndefined()
    })

    it('should return undefined for empty clipboard', async () => {
      const contentType = 'text/plain'
      const { result } = renderHook(() => useClipboardContainer(contentType))

      mockClipboard.read.mockResolvedValue([])

      let pastedBlob

      await act(async () => {
        pastedBlob = await result.current.pasteFromClipboard()
      })

      expect(mockClipboard.read).toHaveBeenCalledTimes(1)
      expect(pastedBlob).toBeUndefined()
    })

    it('should handle getType errors gracefully', async () => {
      const contentType = 'text/plain'
      const { result } = renderHook(() => useClipboardContainer(contentType))

      const mockClipboardItem = {
        types: [contentType],
        getType: jest.fn().mockRejectedValue(new Error('Read failed')),
      }

      mockClipboard.read.mockResolvedValue([mockClipboardItem])

      let pastedBlob

      // should not throw error
      await act(async () => {
        pastedBlob = await result.current.pasteFromClipboard()
      })

      expect(mockClipboard.read).toHaveBeenCalledTimes(1)
      expect(pastedBlob).toBeUndefined()
    })
  })

  describe('contentType handling', () => {
    it('should use different content types for different hook instances', async () => {
      const { result: result1 } = renderHook(() =>
        useClipboardContainer('text/plain')
      )
      const { result: result2 } = renderHook(() =>
        useClipboardContainer('text/html')
      )

      const blob1 = new Blob(['plain'], { type: 'text/plain' })
      const blob2 = new Blob(['<p>html</p>'], { type: 'text/html' })

      mockClipboard.write.mockResolvedValue()

      await act(async () => {
        await result1.current.copyToClipboard(blob1)
      })

      expect(mockClipboard.write).toHaveBeenCalledTimes(1)

      mockClipboard.write.mockClear()

      await act(async () => {
        await result2.current.copyToClipboard(blob2)
      })

      expect(mockClipboard.write).toHaveBeenCalledTimes(1)
    })
  })

  describe('callback stability', () => {
    it('should maintain stable callback references', () => {
      const { result, rerender } = renderHook(
        ({ contentType }) => useClipboardContainer(contentType),
        { initialProps: { contentType: 'text/plain' } }
      )

      const { copyToClipboard: copy1, pasteFromClipboard: paste1 } =
        result.current

      rerender({ contentType: 'text/plain' })

      const { copyToClipboard: copy2, pasteFromClipboard: paste2 } =
        result.current

      expect(copy1).toBe(copy2)
      expect(paste1).toBe(paste2)
    })

    it('should update callbacks when contentType changes', () => {
      const { result, rerender } = renderHook(
        ({ contentType }) => useClipboardContainer(contentType),
        { initialProps: { contentType: 'text/plain' } }
      )

      const { copyToClipboard: copy1, pasteFromClipboard: paste1 } =
        result.current

      rerender({ contentType: 'text/html' })

      const { copyToClipboard: copy2, pasteFromClipboard: paste2 } =
        result.current

      expect(copy1).not.toBe(copy2)
      expect(paste1).not.toBe(paste2)
    })
  })
})
