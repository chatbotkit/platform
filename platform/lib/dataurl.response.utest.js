import { buf2b64d } from '@chatbotkit-dev/buffer'

import { responseToDataUrl } from '@/lib/dataurl.response'

jest.mock('@chatbotkit-dev/buffer', () => ({
  buf2b64d: jest.fn(),
}))

describe('responseToDataUrl', () => {
  let mockResponse

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should convert response with content-type to data URL', async () => {
      const mockArrayBuffer = new ArrayBuffer(8)

      mockResponse = {
        headers: {
          get: jest.fn((key) => {
            if (key === 'content-type') {
              return 'image/png'
            }

            return null
          }),
        },
        arrayBuffer: jest.fn().mockResolvedValue(mockArrayBuffer),
      }

      buf2b64d.mockReturnValue('base64encodeddata')

      const result = await responseToDataUrl(mockResponse)

      expect(mockResponse.headers.get).toHaveBeenCalledWith('content-type')
      expect(mockResponse.arrayBuffer).toHaveBeenCalled()
      expect(buf2b64d).toHaveBeenCalledWith(expect.any(Uint8Array))
      expect(result).toBe('data:image/png;base64,base64encodeddata')
    })

    it('should handle JSON content-type', async () => {
      const mockArrayBuffer = new ArrayBuffer(4)

      mockResponse = {
        headers: {
          get: jest.fn(() => 'application/json'),
        },
        arrayBuffer: jest.fn().mockResolvedValue(mockArrayBuffer),
      }

      buf2b64d.mockReturnValue('anNvbmRhdGE=')

      const result = await responseToDataUrl(mockResponse)

      expect(result).toBe('data:application/json;base64,anNvbmRhdGE=')
    })

    it('should handle text/html content-type', async () => {
      const mockArrayBuffer = new ArrayBuffer(4)

      mockResponse = {
        headers: {
          get: jest.fn(() => 'text/html; charset=utf-8'),
        },
        arrayBuffer: jest.fn().mockResolvedValue(mockArrayBuffer),
      }

      buf2b64d.mockReturnValue('aHRtbA==')

      const result = await responseToDataUrl(mockResponse)

      expect(result).toBe('data:text/html; charset=utf-8;base64,aHRtbA==')
    })

    it('should handle image/jpeg content-type', async () => {
      const mockArrayBuffer = new ArrayBuffer(8)

      mockResponse = {
        headers: {
          get: jest.fn(() => 'image/jpeg'),
        },
        arrayBuffer: jest.fn().mockResolvedValue(mockArrayBuffer),
      }

      buf2b64d.mockReturnValue('jpegdata123')

      const result = await responseToDataUrl(mockResponse)

      expect(result).toBe('data:image/jpeg;base64,jpegdata123')
    })
  })

  describe('default content-type handling', () => {
    it('should use default content-type when header is missing', async () => {
      const mockArrayBuffer = new ArrayBuffer(4)

      mockResponse = {
        headers: {
          get: jest.fn(() => null),
        },
        arrayBuffer: jest.fn().mockResolvedValue(mockArrayBuffer),
      }

      buf2b64d.mockReturnValue('ZGVmYXVsdA==')

      const result = await responseToDataUrl(mockResponse)

      expect(result).toBe('data:application/octet-stream;base64,ZGVmYXVsdA==')
    })

    it('should use default content-type when header is undefined', async () => {
      const mockArrayBuffer = new ArrayBuffer(4)

      mockResponse = {
        headers: {
          get: jest.fn(() => undefined),
        },
        arrayBuffer: jest.fn().mockResolvedValue(mockArrayBuffer),
      }

      buf2b64d.mockReturnValue('ZGVmYXVsdA==')

      const result = await responseToDataUrl(mockResponse)

      expect(result).toBe('data:application/octet-stream;base64,ZGVmYXVsdA==')
    })

    it('should use default content-type when header is empty string', async () => {
      const mockArrayBuffer = new ArrayBuffer(4)

      mockResponse = {
        headers: {
          get: jest.fn(() => ''),
        },
        arrayBuffer: jest.fn().mockResolvedValue(mockArrayBuffer),
      }

      buf2b64d.mockReturnValue('ZGVmYXVsdA==')

      const result = await responseToDataUrl(mockResponse)

      expect(result).toBe('data:application/octet-stream;base64,ZGVmYXVsdA==')
    })
  })

  describe('binary data handling', () => {
    it('should handle empty array buffer', async () => {
      const mockArrayBuffer = new ArrayBuffer(0)

      mockResponse = {
        headers: {
          get: jest.fn(() => 'image/png'),
        },
        arrayBuffer: jest.fn().mockResolvedValue(mockArrayBuffer),
      }

      buf2b64d.mockReturnValue('')

      const result = await responseToDataUrl(mockResponse)

      expect(result).toBe('data:image/png;base64,')
      expect(buf2b64d).toHaveBeenCalledWith(expect.any(Uint8Array))

      const calledWithArray = buf2b64d.mock.calls[0][0]

      expect(calledWithArray.length).toBe(0)
    })

    it('should handle large array buffer', async () => {
      const mockArrayBuffer = new ArrayBuffer(1024 * 1024) // 1MB

      mockResponse = {
        headers: {
          get: jest.fn(() => 'application/pdf'),
        },
        arrayBuffer: jest.fn().mockResolvedValue(mockArrayBuffer),
      }

      buf2b64d.mockReturnValue('largebase64data...')

      const result = await responseToDataUrl(mockResponse)

      expect(result).toBe('data:application/pdf;base64,largebase64data...')

      const calledWithArray = buf2b64d.mock.calls[0][0]

      expect(calledWithArray.length).toBe(1024 * 1024)
    })

    it('should correctly convert array buffer to Uint8Array', async () => {
      const mockArrayBuffer = new ArrayBuffer(4)
      const view = new DataView(mockArrayBuffer)

      view.setUint8(0, 255)
      view.setUint8(1, 128)
      view.setUint8(2, 64)
      view.setUint8(3, 0)

      mockResponse = {
        headers: {
          get: jest.fn(() => 'application/octet-stream'),
        },
        arrayBuffer: jest.fn().mockResolvedValue(mockArrayBuffer),
      }

      buf2b64d.mockImplementation((uint8Array) => {
        // Verify the Uint8Array has the correct values
        expect(uint8Array[0]).toBe(255)
        expect(uint8Array[1]).toBe(128)
        expect(uint8Array[2]).toBe(64)
        expect(uint8Array[3]).toBe(0)

        return 'encodeddata'
      })

      await responseToDataUrl(mockResponse)

      expect(buf2b64d).toHaveBeenCalledWith(expect.any(Uint8Array))
    })
  })

  describe('edge cases', () => {
    it('should handle special characters in content-type', async () => {
      const mockArrayBuffer = new ArrayBuffer(4)

      mockResponse = {
        headers: {
          get: jest.fn(() => 'application/vnd.ms-excel; name="file.xlsx"'),
        },
        arrayBuffer: jest.fn().mockResolvedValue(mockArrayBuffer),
      }

      buf2b64d.mockReturnValue('ZXhjZWw=')

      const result = await responseToDataUrl(mockResponse)

      expect(result).toBe(
        'data:application/vnd.ms-excel; name="file.xlsx";base64,ZXhjZWw='
      )
    })

    it('should handle async arrayBuffer resolution', async () => {
      const mockArrayBuffer = new ArrayBuffer(4)

      mockResponse = {
        headers: {
          get: jest.fn(() => 'text/plain'),
        },
        arrayBuffer: jest.fn().mockImplementation(() => {
          return new Promise((resolve) => {
            setTimeout(() => resolve(mockArrayBuffer), 10)
          })
        }),
      }

      buf2b64d.mockReturnValue('dGV4dA==')

      const result = await responseToDataUrl(mockResponse)

      expect(result).toBe('data:text/plain;base64,dGV4dA==')
    })

    it('should handle arrayBuffer errors', async () => {
      mockResponse = {
        headers: {
          get: jest.fn(() => 'image/png'),
        },
        arrayBuffer: jest
          .fn()
          .mockRejectedValue(new Error('Failed to read body')),
      }

      await expect(responseToDataUrl(mockResponse)).rejects.toThrow(
        'Failed to read body'
      )
    })

    it('should handle buf2b64d errors', async () => {
      const mockArrayBuffer = new ArrayBuffer(4)

      mockResponse = {
        headers: {
          get: jest.fn(() => 'image/png'),
        },
        arrayBuffer: jest.fn().mockResolvedValue(mockArrayBuffer),
      }

      buf2b64d.mockImplementation(() => {
        throw new Error('Encoding failed')
      })

      await expect(responseToDataUrl(mockResponse)).rejects.toThrow(
        'Encoding failed'
      )
    })
  })

  describe('various content types', () => {
    const testCases = [
      { contentType: 'video/mp4', expected: 'data:video/mp4;base64,' },
      { contentType: 'audio/mpeg', expected: 'data:audio/mpeg;base64,' },
      {
        contentType: 'application/zip',
        expected: 'data:application/zip;base64,',
      },
      { contentType: 'text/css', expected: 'data:text/css;base64,' },
      {
        contentType: 'application/javascript',
        expected: 'data:application/javascript;base64,',
      },
      { contentType: 'image/svg+xml', expected: 'data:image/svg+xml;base64,' },
      { contentType: 'font/woff2', expected: 'data:font/woff2;base64,' },
    ]

    testCases.forEach(({ contentType, expected }) => {
      it(`should handle ${contentType}`, async () => {
        const mockArrayBuffer = new ArrayBuffer(4)

        mockResponse = {
          headers: {
            get: jest.fn(() => contentType),
          },
          arrayBuffer: jest.fn().mockResolvedValue(mockArrayBuffer),
        }

        buf2b64d.mockReturnValue('data123')

        const result = await responseToDataUrl(mockResponse)

        expect(result).toBe(`${expected}data123`)
      })
    })
  })
})
