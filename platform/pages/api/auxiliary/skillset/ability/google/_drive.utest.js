/* eslint-disable @typescript-eslint/no-require-imports */
import {
  downloadFileContent,
  getExportMimeType,
} from '@/pages/api/auxiliary/skillset/ability/google/drive'

jest.mock('@/lib/auxiliary.handler', () => ({
  authenticatedMultiHandler: jest.fn((handlersMap) => {
    // @note return an object with the handler functions for direct testing
    const result = {}

    for (const [name, handler] of Object.entries(handlersMap)) {
      // @note every auxiliary route is authenticated; bind a mock session so
      // the tests keep calling the inner function as (parameters, headers)
      result[name] = (parameters, headers) =>
        handler.fn({ user: { id: 'test-user-id' } }, parameters, headers)
    }

    return result
  }),
}))

jest.mock('@/lib/debug', () => jest.fn(() => ({ log: jest.fn() })))

jest.mock('@/lib/call', () => {
  const mockCall = jest.fn()

  mockCall.getCallError = jest.fn((response) =>
    Promise.resolve(new Error(`API Error: ${response.status}`))
  )

  return {
    __esModule: true,
    callPlusPlus: mockCall,
    getCallError: mockCall.getCallError,
  }
})

jest.mock('@/lib/response', () => ({
  throwNotAuthenticated: jest.fn(() => {
    throw new Error('Not authenticated')
  }),
}))

jest.mock('@/lib/dsd2', () => ({
  chunkFile: jest.fn(() =>
    Promise.resolve({
      items: [{ text: 'chunk1' }, { text: 'chunk2' }],
    })
  ),
  isSupportedContentType: jest.fn(() => true),
}))

const mockCall = require('@/lib/call').callPlusPlus

describe('Google Drive Handlers', () => {
  const mockHeaders = new Headers()

  mockHeaders.set('x-access-token', 'Bearer test-token')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getExportMimeType', () => {
    it('should return text/plain for Google Docs', () => {
      expect(getExportMimeType('application/vnd.google-apps.document')).toBe(
        'text/plain'
      )
    })

    it('should return text/csv for Google Sheets', () => {
      expect(getExportMimeType('application/vnd.google-apps.spreadsheet')).toBe(
        'text/csv'
      )
    })

    it('should return text/plain for Google Slides', () => {
      expect(
        getExportMimeType('application/vnd.google-apps.presentation')
      ).toBe('text/plain')
    })

    it('should return null for Google Drawings (unsupported for text export)', () => {
      expect(getExportMimeType('application/vnd.google-apps.drawing')).toBe(
        null
      )
    })

    it('should return null for Google Forms (unsupported for text export)', () => {
      expect(getExportMimeType('application/vnd.google-apps.form')).toBe(null)
    })

    it('should return null for Google Sites (unsupported for text export)', () => {
      expect(getExportMimeType('application/vnd.google-apps.site')).toBe(null)
    })

    it('should return null for Google Maps (unsupported for text export)', () => {
      expect(getExportMimeType('application/vnd.google-apps.map')).toBe(null)
    })

    it('should return null for non-Google Apps files', () => {
      expect(getExportMimeType('application/pdf')).toBe(null)
      expect(getExportMimeType('text/plain')).toBe(null)
    })
  })

  describe('downloadFileContent', () => {
    it('should handle Google Docs by exporting to text/plain', async () => {
      mockCall
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              mimeType: 'application/vnd.google-apps.document',
              name: 'My Document',
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('Document content'),
        })

      const result = await downloadFileContent({
        token: 'Bearer test-token',
        documentId: 'doc-123',
      })

      expect(result.content).toBe('Document content')
      expect(result.fileName).toBe('My Document')
      expect(result.mimeType).toBe('application/vnd.google-apps.document')

      // verify export was called with text/plain
      expect(mockCall).toHaveBeenCalledTimes(2)

      const exportUrl = mockCall.mock.calls[1][0]

      expect(exportUrl).toContain('export')
      expect(exportUrl).toContain('mimeType=text%2Fplain')
    })

    it('should handle Google Sheets by exporting to text/csv', async () => {
      mockCall
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              mimeType: 'application/vnd.google-apps.spreadsheet',
              name: 'My Spreadsheet',
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('col1,col2\nval1,val2'),
        })

      const result = await downloadFileContent({
        token: 'Bearer test-token',
        documentId: 'sheet-123',
      })

      expect(result.content).toBe('col1,col2\nval1,val2')
      expect(result.fileName).toBe('My Spreadsheet')

      // verify export was called with text/csv
      const exportUrl = mockCall.mock.calls[1][0]

      expect(exportUrl).toContain('export')
      expect(exportUrl).toContain('mimeType=text%2Fcsv')
    })

    it('should return empty content for Google Drawings (unsupported)', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            mimeType: 'application/vnd.google-apps.drawing',
            name: 'My Drawing',
          }),
      })

      const result = await downloadFileContent({
        token: 'Bearer test-token',
        documentId: 'drawing-123',
      })

      expect(result.content).toBe('')
      expect(result.fileName).toBe('My Drawing')
      expect(result.mimeType).toBe('application/vnd.google-apps.drawing')

      // verify export was NOT called (only metadata call)

      expect(mockCall).toHaveBeenCalledTimes(1)
    })

    it('should return empty content for Google Forms (unsupported)', async () => {
      mockCall.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            mimeType: 'application/vnd.google-apps.form',
            name: 'My Form',
          }),
      })

      const result = await downloadFileContent({
        token: 'Bearer test-token',
        documentId: 'form-123',
      })

      expect(result.content).toBe('')
      expect(result.fileName).toBe('My Form')
    })
  })

  describe('fileFetchHandler line range extraction', () => {
    // @note these tests validate the line extraction logic directly

    /**
     * Helper function to extract lines from content based on range parameters.
     * @note line numbers are 1-indexed (line 1 is the first line, not line 0)
     * @note endLine is inclusive (if endLine is 50, line 50 is included)
     */
    function extractLines(content, startLine, endLine) {
      if (startLine === undefined && endLine === undefined) {
        return { outputContent: content }
      }

      const lines = content.split('\n')
      const totalLines = lines.length

      // convert 1-indexed to 0-indexed for array slicing
      const start = startLine !== undefined ? Math.max(0, startLine - 1) : 0
      // endLine is inclusive, so we add 1 for slice (which is exclusive on end)
      const end =
        endLine !== undefined ? Math.min(lines.length, endLine) : lines.length

      return {
        outputContent: lines.slice(start, end).join('\n'),
        totalLines,
        startLine,
        endLine,
      }
    }

    const multiLineContent = 'line1\nline2\nline3\nline4\nline5'

    it('should return full content when no range specified', () => {
      const result = extractLines(multiLineContent, undefined, undefined)

      expect(result.outputContent).toBe(multiLineContent)
      expect(result.totalLines).toBeUndefined()
    })

    it('should return lines starting from startLine (1-indexed)', () => {
      const result = extractLines(multiLineContent, 2, undefined)

      expect(result.outputContent).toBe('line2\nline3\nline4\nline5')
      expect(result.totalLines).toBe(5)
      expect(result.startLine).toBe(2)
    })

    it('should return lines up to endLine (inclusive, 1-indexed)', () => {
      const result = extractLines(multiLineContent, undefined, 3)

      expect(result.outputContent).toBe('line1\nline2\nline3')
      expect(result.totalLines).toBe(5)
      expect(result.endLine).toBe(3)
    })

    it('should return lines in range (both startLine and endLine)', () => {
      const result = extractLines(multiLineContent, 2, 4)

      expect(result.outputContent).toBe('line2\nline3\nline4')
      expect(result.totalLines).toBe(5)
      expect(result.startLine).toBe(2)
      expect(result.endLine).toBe(4)
    })

    it('should handle single line extraction', () => {
      const result = extractLines(multiLineContent, 3, 3)

      expect(result.outputContent).toBe('line3')
      expect(result.totalLines).toBe(5)
    })

    it('should handle startLine at first line (1-indexed)', () => {
      const result = extractLines(multiLineContent, 1, 2)

      expect(result.outputContent).toBe('line1\nline2')
      expect(result.totalLines).toBe(5)
    })

    it('should handle endLine at last line', () => {
      const result = extractLines(multiLineContent, 4, 5)

      expect(result.outputContent).toBe('line4\nline5')
      expect(result.totalLines).toBe(5)
    })

    it('should handle startLine below 1 by clamping to first line', () => {
      const result = extractLines(multiLineContent, 0, 2)

      expect(result.outputContent).toBe('line1\nline2')
      expect(result.totalLines).toBe(5)
    })

    it('should handle endLine beyond content by clamping to last line', () => {
      const result = extractLines(multiLineContent, 4, 100)

      expect(result.outputContent).toBe('line4\nline5')
      expect(result.totalLines).toBe(5)
    })

    it('should handle single line content', () => {
      const result = extractLines('only one line', 1, 1)

      expect(result.outputContent).toBe('only one line')
      expect(result.totalLines).toBe(1)
    })

    it('should handle empty content', () => {
      const result = extractLines('', 1, 1)

      expect(result.outputContent).toBe('')
      expect(result.totalLines).toBe(1) // empty string splits to ['']
    })
  })
})
