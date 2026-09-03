/**
 * @jest-environment jsdom
 */
import { nameToType, typeToFileName } from './mime'
import { saveBlob, saveData, saveUrl } from './save'
import { tryFilename } from './url'

jest.mock('./mime', () => ({
  nameToType: jest.fn(),
  typeToFileName: jest.fn(),
}))

jest.mock('./url', () => ({
  tryFilename: jest.fn(),
}))

describe('save', () => {
  let createElementSpy
  let mockLink
  let createdURLs
  let windowOpenSpy

  beforeEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
    jest.useFakeTimers()

    createdURLs = new Set()

    // Provide minimal polyfill for URL.createObjectURL and revokeObjectURL
    // jsdom doesn't include these by default
    if (!URL.createObjectURL) {
      URL.createObjectURL = jest.fn((_blob) => {
        const url = `blob:${Math.random().toString(36).substring(2)}`

        createdURLs.add(url)

        return url
      })
    }

    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = jest.fn((url) => {
        createdURLs.delete(url)
      })
    }

    // Mock window.open for jsdom (not implemented by default)
    windowOpenSpy = jest.spyOn(window, 'open').mockImplementation(() => null)

    mockLink = {
      href: '',
      download: '',
      target: '',
      rel: '',
      click: jest.fn(),
    }

    createElementSpy = jest
      .spyOn(document, 'createElement')
      .mockReturnValue(mockLink)

    nameToType.mockReturnValue('text/plain')
    typeToFileName.mockReturnValue('txt')

    tryFilename.mockReturnValue('file.txt')
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  describe('saveUrl', () => {
    describe('same-origin URLs', () => {
      it('should create a link element and trigger download with provided name', async () => {
        // Use relative URL (same-origin)
        await saveUrl('/api/file.pdf', { name: 'my-file.pdf' })

        expect(createElementSpy).toHaveBeenCalledWith('a')
        expect(mockLink.href).toBe('/api/file.pdf')
        expect(mockLink.download).toBe('my-file.pdf')
        expect(mockLink.click).toHaveBeenCalled()
      })

      it('should extract filename from URL when name is not provided', async () => {
        tryFilename.mockReturnValue('extracted.pdf')

        await saveUrl('/api/extracted.pdf')

        expect(tryFilename).toHaveBeenCalledWith('/api/extracted.pdf')
        expect(mockLink.download).toBe('extracted.pdf')
      })

      it('should open in new tab when download attribute is empty (same-origin)', async () => {
        tryFilename.mockReturnValue(null)

        await saveUrl('/api/file')

        expect(windowOpenSpy).toHaveBeenCalledWith(
          '/api/file',
          '_blank',
          'noopener,noreferrer'
        )
      })

      it('should not set target when download attribute has value', async () => {
        await saveUrl('/api/file.pdf', { name: 'file.pdf' })

        expect(mockLink.target).toBe('')
        expect(windowOpenSpy).not.toHaveBeenCalled()
      })
    })

    describe('cross-origin URLs', () => {
      let originalFetch

      beforeEach(() => {
        // Save original fetch if it exists
        originalFetch = global.fetch
        // Create mock fetch
        global.fetch = jest.fn()
      })

      afterEach(() => {
        // Restore original fetch
        if (originalFetch) {
          global.fetch = originalFetch
        } else {
          delete global.fetch
        }
      })

      it('should fetch cross-origin URL and download as blob', async () => {
        const mockBlob = new Blob(['test'], { type: 'application/pdf' })

        global.fetch.mockResolvedValue({
          ok: true,
          blob: () => Promise.resolve(mockBlob),
        })

        await saveUrl('https://example.com/file.pdf', { name: 'my-file.pdf' })

        expect(global.fetch).toHaveBeenCalledWith(
          'https://example.com/file.pdf'
        )
        // Should download as blob (blob URL)
        expect(mockLink.href).toMatch(/^blob:/)
        expect(mockLink.download).toBe('my-file.pdf')
        expect(mockLink.click).toHaveBeenCalled()
      })

      it('should open in new tab when fetch fails (CORS error)', async () => {
        global.fetch.mockRejectedValue(new Error('CORS error'))

        await saveUrl('https://example.com/file.pdf', { name: 'my-file.pdf' })

        expect(windowOpenSpy).toHaveBeenCalledWith(
          'https://example.com/file.pdf',
          '_blank',
          'noopener,noreferrer'
        )
      })

      it('should open in new tab when response is not ok', async () => {
        global.fetch.mockResolvedValue({
          ok: false,
          status: 404,
        })

        await saveUrl('https://example.com/file.pdf', { name: 'my-file.pdf' })

        expect(windowOpenSpy).toHaveBeenCalledWith(
          'https://example.com/file.pdf',
          '_blank',
          'noopener,noreferrer'
        )
      })
    })
  })

  describe('saveBlob', () => {
    it('should create object URL and download blob with provided name', () => {
      const blob = new Blob(['test'], { type: 'text/plain' })

      saveBlob(blob, { name: 'test.txt' })

      expect(mockLink.href).toMatch(/^blob:/)
      expect(mockLink.download).toBe('test.txt')
      expect(mockLink.click).toHaveBeenCalled()
    })

    it('should append extension when name has no extension', () => {
      const blob = new Blob(['test'], { type: 'text/plain' })

      typeToFileName.mockReturnValue('txt')

      saveBlob(blob, { name: 'test' })

      expect(typeToFileName).toHaveBeenCalledWith('text/plain')
      expect(mockLink.download).toBe('test.txt')
    })

    it('should not append extension when name already has one', () => {
      const blob = new Blob(['test'], { type: 'text/plain' })

      saveBlob(blob, { name: 'test.txt' })

      expect(mockLink.download).toBe('test.txt')
      expect(typeToFileName).not.toHaveBeenCalled()
    })

    it('should use File name when blob is a File instance and no name provided', () => {
      const file = new File(['test'], 'original.txt', { type: 'text/plain' })

      saveBlob(file)

      expect(mockLink.download).toBe('original.txt')
    })

    it('should use typeToFileName when no name provided and blob is not a File', () => {
      const blob = new Blob(['test'], { type: 'application/json' })

      typeToFileName.mockReturnValue('json')

      saveBlob(blob)

      expect(typeToFileName).toHaveBeenCalledWith('application/json')
      expect(mockLink.download).toBe('json')
    })

    it('should schedule cleanup of object URL after timeout', () => {
      const blob = new Blob(['test'], { type: 'text/plain' })

      saveBlob(blob, { name: 'test.txt' })

      // Verify a timer was scheduled
      expect(jest.getTimerCount()).toBeGreaterThan(0)

      jest.advanceTimersByTime(100)

      // Verify all timers have been executed
      expect(jest.getTimerCount()).toBe(0)
    })
  })

  describe('saveData', () => {
    it('should create blob with provided type and name', () => {
      saveData('{"name": "John"}', {
        name: 'data.json',
        type: 'application/json',
      })

      expect(mockLink.href).toMatch(/^blob:/)
      expect(mockLink.download).toBe('data.json')
      expect(mockLink.click).toHaveBeenCalled()
    })

    it('should infer type from name when type is not provided', () => {
      nameToType.mockReturnValue('application/json')

      saveData('{"name": "John"}', { name: 'data.json' })

      expect(nameToType).toHaveBeenCalledWith('data.json')
    })

    it('should use default filename when name is not provided', () => {
      nameToType.mockReturnValue('text/plain')
      typeToFileName.mockReturnValue('txt')

      saveData('Hello, World!')

      expect(nameToType).toHaveBeenCalledWith('file')
      expect(mockLink.click).toHaveBeenCalled()
    })

    it('should handle ArrayBuffer data', () => {
      const buffer = new ArrayBuffer(8)

      saveData(buffer, { name: 'data.bin', type: 'application/octet-stream' })

      expect(mockLink.href).toMatch(/^blob:/)
      expect(mockLink.download).toBe('data.bin')
      expect(mockLink.click).toHaveBeenCalled()
    })

    it('should create blob and call saveBlob', () => {
      saveData('test content', { name: 'test.txt', type: 'text/plain' })

      // Verify the flow: saveData -> saveBlob -> saveUrl
      expect(mockLink.href).toMatch(/^blob:/)
      expect(mockLink.click).toHaveBeenCalled()

      // Verify cleanup timer is scheduled
      expect(jest.getTimerCount()).toBeGreaterThan(0)
      jest.advanceTimersByTime(100)
      expect(jest.getTimerCount()).toBe(0)
    })
  })

  describe('integration tests', () => {
    it('should handle complete download flow for text data', () => {
      nameToType.mockReturnValue('text/plain')

      saveData('Hello, World!', { name: 'hello.txt' })

      // Verify download triggered with blob URL
      expect(mockLink.href).toMatch(/^blob:/)
      expect(mockLink.download).toBe('hello.txt')
      expect(mockLink.click).toHaveBeenCalled()

      // Verify cleanup timer is scheduled and executed
      expect(jest.getTimerCount()).toBeGreaterThan(0)
      jest.advanceTimersByTime(100)
      expect(jest.getTimerCount()).toBe(0)
    })

    it('should handle complete download flow for blob', () => {
      const blob = new Blob(['test'], { type: 'text/plain' })

      saveBlob(blob, { name: 'test.txt' })

      expect(mockLink.href).toMatch(/^blob:/)
      expect(mockLink.download).toBe('test.txt')
      expect(mockLink.click).toHaveBeenCalled()

      jest.advanceTimersByTime(100)
      expect(jest.getTimerCount()).toBe(0)
    })

    it('should handle complete download flow for same-origin URL', async () => {
      tryFilename.mockReturnValue('download.pdf')

      await saveUrl('/api/download.pdf')

      expect(createElementSpy).toHaveBeenCalledWith('a')
      expect(mockLink.href).toBe('/api/download.pdf')
      expect(mockLink.download).toBe('download.pdf')
      expect(mockLink.click).toHaveBeenCalled()
    })

    it('should handle complete download flow for cross-origin URL', async () => {
      const mockBlob = new Blob(['test'], { type: 'application/pdf' })
      const originalFetch = global.fetch

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      })

      tryFilename.mockReturnValue('download.pdf')

      await saveUrl('https://example.com/download.pdf')

      // Should download as blob since it's cross-origin
      expect(mockLink.href).toMatch(/^blob:/)
      expect(mockLink.click).toHaveBeenCalled()

      // Restore
      if (originalFetch) {
        global.fetch = originalFetch
      } else {
        delete global.fetch
      }
    })
  })

  describe('edge cases', () => {
    it('should handle blob with no type', () => {
      const blob = new Blob(['test'])

      typeToFileName.mockReturnValue('bin')

      saveBlob(blob)

      expect(typeToFileName).toHaveBeenCalledWith('')
      expect(mockLink.download).toBe('bin')
    })

    it('should handle empty string data', () => {
      nameToType.mockReturnValue('text/plain')

      saveData('', { name: 'empty.txt' })

      expect(mockLink.click).toHaveBeenCalled()
    })

    it('should handle name with multiple dots', () => {
      const blob = new Blob(['test'], { type: 'text/plain' })

      saveBlob(blob, { name: 'my.file.name.txt' })

      expect(mockLink.download).toBe('my.file.name.txt')
    })
  })
})
