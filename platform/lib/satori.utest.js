/* eslint-disable @typescript-eslint/no-require-imports */
import { generateImage } from './satori'

jest.mock('@resvg/resvg-wasm/index_bg.wasm', () => ({
  __esModule: true,
  default: {
    data: new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]),
  },
}))

jest.mock('@resvg/resvg-wasm', () => ({
  Resvg: jest.fn(),
  initWasm: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('satori', () => jest.fn())

describe('generateImage', () => {
  let satori
  let Resvg
  let initWasm

  beforeEach(() => {
    jest.clearAllMocks()

    satori = require('satori')

    const resvgWasm = require('@resvg/resvg-wasm')

    Resvg = resvgWasm.Resvg
    initWasm = resvgWasm.initWasm
  })

  describe('basic functionality', () => {
    it('should generate PNG image from JSX element', async () => {
      const mockSvg = '<svg><rect width="100" height="100"/></svg>'
      const mockPngData = new Uint8Array([137, 80, 78, 71])

      satori.mockResolvedValue(mockSvg)

      const mockRender = { asPng: jest.fn().mockReturnValue(mockPngData) }
      const mockResvgInstance = {
        render: jest.fn().mockReturnValue(mockRender),
      }

      Resvg.mockImplementation(() => mockResvgInstance)

      const element = <div>Test</div>
      const options = { width: 100, height: 100 }

      const result = await generateImage(element, options)

      expect(satori).toHaveBeenCalledWith(element, options)
      expect(Resvg).toHaveBeenCalledWith(mockSvg)
      expect(mockResvgInstance.render).toHaveBeenCalled()
      expect(mockRender.asPng).toHaveBeenCalled()
      expect(result).toBe(mockPngData)
    })

    it('should pass options to satori', async () => {
      const mockSvg = '<svg></svg>'
      const mockPngData = new Uint8Array([])

      satori.mockResolvedValue(mockSvg)

      const mockRender = { asPng: jest.fn().mockReturnValue(mockPngData) }
      const mockResvgInstance = {
        render: jest.fn().mockReturnValue(mockRender),
      }

      Resvg.mockImplementation(() => mockResvgInstance)

      const element = <div>Content</div>
      const options = {
        width: 1200,
        height: 630,
        fonts: [{ name: 'Arial', data: new ArrayBuffer(8) }],
      }

      await generateImage(element, options)

      expect(satori).toHaveBeenCalledWith(element, options)
      expect(Resvg).toHaveBeenCalledWith(mockSvg)
    })
  })

  describe('null handling', () => {
    it('should return null when satori returns null', async () => {
      satori.mockResolvedValue(null)

      const result = await generateImage(<div>Test</div>, {
        width: 100,
        height: 100,
      })

      expect(result).toBeNull()
      expect(Resvg).not.toHaveBeenCalled()
    })

    it('should return null when satori returns undefined', async () => {
      satori.mockResolvedValue(undefined)

      const result = await generateImage(<div>Test</div>, {
        width: 100,
        height: 100,
      })

      expect(result).toBeNull()
      expect(Resvg).not.toHaveBeenCalled()
    })

    it('should return null when satori returns empty string', async () => {
      satori.mockResolvedValue('')

      const result = await generateImage(<div>Test</div>, {
        width: 100,
        height: 100,
      })

      expect(result).toBeNull()
      expect(Resvg).not.toHaveBeenCalled()
    })
  })

  describe('complex elements', () => {
    it('should handle nested JSX elements', async () => {
      const mockSvg = '<svg><g><rect/></g></svg>'
      const mockPngData = new Uint8Array([137, 80, 78, 71])

      satori.mockResolvedValue(mockSvg)

      const mockRender = { asPng: jest.fn().mockReturnValue(mockPngData) }
      const mockResvgInstance = {
        render: jest.fn().mockReturnValue(mockRender),
      }

      Resvg.mockImplementation(() => mockResvgInstance)

      const element = (
        <div style={{ display: 'flex' }}>
          <div>Child 1</div>
          <div>Child 2</div>
        </div>
      )

      const result = await generateImage(element, { width: 200, height: 200 })

      expect(result).toBe(mockPngData)
      expect(satori).toHaveBeenCalledWith(element, { width: 200, height: 200 })
    })

    it('should handle elements with custom fonts', async () => {
      const mockSvg = '<svg><text>Text</text></svg>'
      const mockPngData = new Uint8Array([137, 80, 78, 71])

      satori.mockResolvedValue(mockSvg)

      const mockRender = { asPng: jest.fn().mockReturnValue(mockPngData) }
      const mockResvgInstance = {
        render: jest.fn().mockReturnValue(mockRender),
      }

      Resvg.mockImplementation(() => mockResvgInstance)

      const options = {
        width: 400,
        height: 400,
        fonts: [
          { name: 'Inter', data: new ArrayBuffer(100), weight: 400 },
          { name: 'Inter', data: new ArrayBuffer(100), weight: 700 },
        ],
      }

      await generateImage(<div>Styled text</div>, options)

      expect(satori).toHaveBeenCalledWith(<div>Styled text</div>, options)
    })

    it('should handle elements with loadAdditionalAsset callback', async () => {
      const mockSvg = '<svg><image/></svg>'
      const mockPngData = new Uint8Array([137, 80, 78, 71])

      satori.mockResolvedValue(mockSvg)

      const mockRender = { asPng: jest.fn().mockReturnValue(mockPngData) }
      const mockResvgInstance = {
        render: jest.fn().mockReturnValue(mockRender),
      }

      Resvg.mockImplementation(() => mockResvgInstance)

      const loadAdditionalAsset = jest.fn()
      const options = {
        width: 300,
        height: 300,
        loadAdditionalAsset,
      }

      await generateImage(<div>Content with assets</div>, options)

      expect(satori).toHaveBeenCalledWith(
        <div>Content with assets</div>,
        options
      )
    })
  })

  describe('error handling', () => {
    it('should propagate errors from satori', async () => {
      const error = new Error('Satori rendering failed')

      satori.mockRejectedValue(error)

      await expect(
        generateImage(<div>Test</div>, { width: 100, height: 100 })
      ).rejects.toThrow('Satori rendering failed')
    })

    it('should propagate errors from Resvg', async () => {
      const mockSvg = '<svg></svg>'

      satori.mockResolvedValue(mockSvg)

      const error = new Error('Resvg rendering failed')

      Resvg.mockImplementation(() => {
        throw error
      })

      await expect(
        generateImage(<div>Test</div>, { width: 100, height: 100 })
      ).rejects.toThrow('Resvg rendering failed')
    })

    it('should propagate errors from asPng', async () => {
      const mockSvg = '<svg></svg>'

      satori.mockResolvedValue(mockSvg)

      const error = new Error('PNG conversion failed')
      const mockRender = {
        asPng: jest.fn().mockImplementation(() => {
          throw error
        }),
      }
      const mockResvgInstance = {
        render: jest.fn().mockReturnValue(mockRender),
      }

      Resvg.mockImplementation(() => mockResvgInstance)

      await expect(
        generateImage(<div>Test</div>, { width: 100, height: 100 })
      ).rejects.toThrow('PNG conversion failed')
    })
  })

  describe('edge cases', () => {
    it('should handle very large dimensions', async () => {
      const mockSvg = '<svg></svg>'
      const mockPngData = new Uint8Array([137, 80, 78, 71])

      satori.mockResolvedValue(mockSvg)

      const mockRender = { asPng: jest.fn().mockReturnValue(mockPngData) }
      const mockResvgInstance = {
        render: jest.fn().mockReturnValue(mockRender),
      }

      Resvg.mockImplementation(() => mockResvgInstance)

      const result = await generateImage(<div>Test</div>, {
        width: 4096,
        height: 4096,
      })

      expect(result).toBe(mockPngData)
    })

    it('should handle minimal dimensions', async () => {
      const mockSvg = '<svg></svg>'
      const mockPngData = new Uint8Array([137, 80, 78, 71])

      satori.mockResolvedValue(mockSvg)

      const mockRender = { asPng: jest.fn().mockReturnValue(mockPngData) }
      const mockResvgInstance = {
        render: jest.fn().mockReturnValue(mockRender),
      }

      Resvg.mockImplementation(() => mockResvgInstance)

      const result = await generateImage(<div>Test</div>, {
        width: 1,
        height: 1,
      })

      expect(result).toBe(mockPngData)
    })

    it('should handle empty element', async () => {
      const mockSvg = '<svg></svg>'
      const mockPngData = new Uint8Array([])

      satori.mockResolvedValue(mockSvg)

      const mockRender = { asPng: jest.fn().mockReturnValue(mockPngData) }
      const mockResvgInstance = {
        render: jest.fn().mockReturnValue(mockRender),
      }

      Resvg.mockImplementation(() => mockResvgInstance)

      const result = await generateImage(<></>, { width: 100, height: 100 })

      expect(result).toBe(mockPngData)
    })
  })
})
