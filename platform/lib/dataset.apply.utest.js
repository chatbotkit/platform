import {
  RECORD_JOINER,
  matchInstructionToText,
  mismatchInstructionToText,
  recordsToText,
} from './dataset.apply'

jest.mock('@/lib/debug', () => {
  const mockDebug = () => ({ log: jest.fn() })

  return {
    __esModule: true,
    default: mockDebug,
  }
})

jest.mock('@/lib/dataset.search', () => ({
  searchDataset: jest.fn(),
}))

jest.mock('@/prisma/types', () => ({
  MessageType: {
    context: 'context',
  },
}))

jest.mock('@/config/datasets', () => ({
  __esModule: true,
  default: {
    defaultMatchInstruction:
      'Use the following information to answer: {search}',
    defaultMismatchInstruction: 'No information found for: {search}',
  },
}))

describe('recordsToText', () => {
  describe('basic functionality', () => {
    it('should convert single record to text', () => {
      const records = [
        {
          text: 'This is the content',
          meta: {},
        },
      ]

      const result = recordsToText(records)

      expect(result).toBe('...This is the content...')
    })

    it('should join multiple records with separator', () => {
      const records = [
        { text: 'First record', meta: {} },
        { text: 'Second record', meta: {} },
      ]

      const result = recordsToText(records)

      expect(result).toBe(
        `...First record...${RECORD_JOINER}...Second record...`
      )
    })

    it('should include metadata fields in output', () => {
      const records = [
        {
          text: 'Content here',
          meta: {
            Source: 'Documentation',
            URL: 'https://example.com',
            Title: 'Example Page',
            Date: '2024-01-01',
          },
        },
      ]

      const result = recordsToText(records)

      expect(result).toContain('Source: Documentation')
      expect(result).toContain('URL: https://example.com')
      expect(result).toContain('Title: Example Page')
      expect(result).toContain('Date: 2024-01-01')
      expect(result).toContain('...Content here...')
    })

    it('should handle lowercase metadata keys', () => {
      const records = [
        {
          text: 'Content',
          meta: {
            source: 'Blog',
            url: 'https://blog.example.com',
            title: 'Blog Post',
          },
        },
      ]

      const result = recordsToText(records)

      expect(result).toContain('Source: Blog')
      expect(result).toContain('URL: https://blog.example.com')
      expect(result).toContain('Title: Blog Post')
    })
  })

  describe('edge cases', () => {
    it('should handle empty records array', () => {
      const result = recordsToText([])

      expect(result).toBe('')
    })

    it('should handle record with no text', () => {
      const records = [{ text: '', meta: {} }]

      const result = recordsToText(records)

      expect(result).toBe('')
    })

    it('should handle record with null text', () => {
      const records = [{ text: null, meta: {} }]

      const result = recordsToText(records)

      expect(result).toBe('')
    })

    it('should handle record with undefined meta', () => {
      const records = [{ text: 'Content here' }]

      const result = recordsToText(records)

      expect(result).toBe('...Content here...')
    })

    it('should handle record with null meta', () => {
      const records = [{ text: 'Content', meta: null }]

      const result = recordsToText(records)

      expect(result).toBe('...Content...')
    })

    it('should skip unknown metadata fields', () => {
      const records = [
        {
          text: 'Content',
          meta: {
            Source: 'Docs',
            customField: 'ignored',
            anotherField: 'also ignored',
          },
        },
      ]

      const result = recordsToText(records)

      expect(result).toContain('Source: Docs')
      expect(result).not.toContain('customField')
      expect(result).not.toContain('anotherField')
    })

    it('should handle mixed case metadata keys', () => {
      const records = [
        {
          text: 'Content',
          meta: {
            Source: 'Primary',
            source: 'Secondary',
          },
        },
      ]

      const result = recordsToText(records)

      // Should include first occurrence (capitalized)
      expect(result).toContain('Source: Primary')
    })
  })

  describe('complex scenarios', () => {
    it('should handle multiple records with varied metadata', () => {
      const records = [
        {
          text: 'First content',
          meta: {
            Source: 'Doc1',
            Title: 'Title 1',
          },
        },
        {
          text: 'Second content',
          meta: {
            URL: 'https://example.com',
            Date: '2024-01-01',
          },
        },
        {
          text: 'Third content',
          meta: {},
        },
      ]

      const result = recordsToText(records)

      expect(result).toContain('Source: Doc1')
      expect(result).toContain('Title: Title 1')
      expect(result).toContain('...First content...')
      expect(result).toContain('URL: https://example.com')
      expect(result).toContain('Date: 2024-01-01')
      expect(result).toContain('...Second content...')
      expect(result).toContain('...Third content...')
    })

    it('should preserve content and join with separator', () => {
      const records = [
        { text: '  Content with spaces  ', meta: {} },
        { text: 'Normal content', meta: {} },
      ]

      const result = recordsToText(records)

      expect(result).toContain('...  Content with spaces  ...')
      expect(result).toContain('...Normal content...')
      expect(result).toContain(RECORD_JOINER)
    })
  })
})

describe('matchInstructionToText', () => {
  describe('basic functionality', () => {
    it('should use dataset match instruction when provided', () => {
      const search = 'test query'
      const dataset = {
        matchInstruction: 'Use this info for {search}',
      }

      const result = matchInstructionToText(search, dataset)

      expect(result).toBe('Use this info for test query')
    })

    it('should use default match instruction when not provided', () => {
      const search = 'test query'
      const dataset = {}

      const result = matchInstructionToText(search, dataset)

      expect(result).toBe('Use the following information to answer: test query')
    })

    it('should replace search placeholder', () => {
      const search = 'user question here'
      const dataset = {
        matchInstruction: 'Answer based on {search} context',
      }

      const result = matchInstructionToText(search, dataset)

      expect(result).toBe('Answer based on user question here context')
    })

    it('should return dash when instruction is dash', () => {
      const search = 'test'
      const dataset = {
        matchInstruction: '-',
      }

      const result = matchInstructionToText(search, dataset)

      expect(result).toBe('-')
    })
  })

  describe('edge cases', () => {
    it('should handle empty search', () => {
      const dataset = {
        matchInstruction: 'Context: {search}',
      }

      const result = matchInstructionToText('', dataset)

      expect(result).toBe('Context: ')
    })

    it('should handle null match instruction', () => {
      const search = 'test'
      const dataset = {
        matchInstruction: null,
      }

      const result = matchInstructionToText(search, dataset)

      expect(result).toBe('Use the following information to answer: test')
    })

    it('should handle empty string match instruction', () => {
      const search = 'test'
      const dataset = {
        matchInstruction: '',
      }

      const result = matchInstructionToText(search, dataset)

      expect(result).toBe('Use the following information to answer: test')
    })

    it('should handle instruction without placeholder', () => {
      const search = 'test query'
      const dataset = {
        matchInstruction: 'Use the information provided',
      }

      const result = matchInstructionToText(search, dataset)

      expect(result).toBe('Use the information provided')
    })

    it('should handle multiple placeholders', () => {
      const search = 'question'
      const dataset = {
        matchInstruction: 'Query: {search}. Answer: {search}',
      }

      const result = matchInstructionToText(search, dataset)

      expect(result).toBe('Query: question. Answer: question')
    })
  })

  describe('special characters', () => {
    it('should handle search with special characters', () => {
      const search = 'test & query <script>'
      const dataset = {
        matchInstruction: 'Search: {search}',
      }

      const result = matchInstructionToText(search, dataset)

      expect(result).toBe('Search: test & query <script>')
    })

    it('should handle search with quotes', () => {
      const search = 'query with "quotes"'
      const dataset = {
        matchInstruction: 'Answer "{search}"',
      }

      const result = matchInstructionToText(search, dataset)

      expect(result).toBe('Answer "query with "quotes""')
    })
  })
})

describe('mismatchInstructionToText', () => {
  describe('basic functionality', () => {
    it('should use dataset mismatch instruction when provided', () => {
      const search = 'test query'
      const dataset = {
        mismatchInstruction: 'No results for {search}',
      }

      const result = mismatchInstructionToText(search, dataset)

      expect(result).toBe('No results for test query')
    })

    it('should use default mismatch instruction when not provided', () => {
      const search = 'test query'
      const dataset = {}

      const result = mismatchInstructionToText(search, dataset)

      expect(result).toBe('No information found for: test query')
    })

    it('should replace search placeholder', () => {
      const search = 'user question'
      const dataset = {
        mismatchInstruction: 'Cannot find info about {search}',
      }

      const result = mismatchInstructionToText(search, dataset)

      expect(result).toBe('Cannot find info about user question')
    })

    it('should return dash when instruction is dash', () => {
      const search = 'test'
      const dataset = {
        mismatchInstruction: '-',
      }

      const result = mismatchInstructionToText(search, dataset)

      expect(result).toBe('-')
    })
  })

  describe('edge cases', () => {
    it('should handle empty search', () => {
      const dataset = {
        mismatchInstruction: 'No results for: {search}',
      }

      const result = mismatchInstructionToText('', dataset)

      expect(result).toBe('No results for: ')
    })

    it('should handle null mismatch instruction', () => {
      const search = 'test'
      const dataset = {
        mismatchInstruction: null,
      }

      const result = mismatchInstructionToText(search, dataset)

      expect(result).toBe('No information found for: test')
    })

    it('should handle empty string mismatch instruction', () => {
      const search = 'test'
      const dataset = {
        mismatchInstruction: '',
      }

      const result = mismatchInstructionToText(search, dataset)

      expect(result).toBe('No information found for: test')
    })

    it('should handle instruction without placeholder', () => {
      const search = 'test query'
      const dataset = {
        mismatchInstruction: 'No information available',
      }

      const result = mismatchInstructionToText(search, dataset)

      expect(result).toBe('No information available')
    })

    it('should handle multiple placeholders', () => {
      const search = 'question'
      const dataset = {
        mismatchInstruction: 'No match: {search} (tried: {search})',
      }

      const result = mismatchInstructionToText(search, dataset)

      expect(result).toBe('No match: question (tried: question)')
    })
  })

  describe('special characters', () => {
    it('should handle search with special characters', () => {
      const search = 'test & query <html>'
      const dataset = {
        mismatchInstruction: 'Nothing for {search}',
      }

      const result = mismatchInstructionToText(search, dataset)

      expect(result).toBe('Nothing for test & query <html>')
    })

    it('should handle search with newlines', () => {
      const search = 'multi\nline\nquery'
      const dataset = {
        mismatchInstruction: 'No info: {search}',
      }

      const result = mismatchInstructionToText(search, dataset)

      expect(result).toBe('No info: multi\nline\nquery')
    })
  })
})
