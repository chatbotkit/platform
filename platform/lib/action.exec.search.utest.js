/**
 * @jest-environment node
 */
import searchEngine from '@chatbotkit-dev/searchengine'
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { executeSearchAction } from '@/lib/action.exec.search'
import { canUseDataset } from '@/lib/dataset.access'
import { applyDataset } from '@/lib/dataset.apply'

jest.mock('@/prisma/client', () => ({
  __esModule: true,

  default: mockDeep(),
}))

// @note the action no longer knows which engine answers a search, so the seam
// is the module rather than the network. What Brave returns and how it is
// adapted is tested where that lives, in the installed
// @chatbotkit-dev/searchengine implementation.

jest.mock('@chatbotkit-dev/searchengine', () => ({
  __esModule: true,

  default: { search: jest.fn() },
}))

jest.mock('@/lib/dataset.access', () => ({
  canUseDataset: jest.fn(),
}))

jest.mock('@/lib/dataset.apply', () => ({
  applyDataset: jest.fn(),
}))

jest.mock('@/lib/error', () => {
  class SystemError extends Error {
    constructor(message, code, data) {
      super(message)

      this.code = code
      this.data = data
      this.name = 'SystemError'
    }
  }

  class UserInputError extends SystemError {
    constructor(message) {
      super(message, 'BAD_REQUEST')
      this.name = 'UserInputError'
    }
  }

  return {
    SystemError,
    UserInputError,
    BAD_REQUEST_ERROR_CODE: 'BAD_REQUEST',
  }
})

describe('action.exec.search', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockReset(prisma)

    searchEngine.search.mockResolvedValue([])
  })

  describe('executeSearchAction', () => {
    const mockOptions = {
      userId: 'user-123',
      linkedResources: {
        blueprintId: 'blueprint-456',
        skillsetId: 'skillset-789',
        abilityId: 'ability-012',
      },
    }

    describe('dataset search', () => {
      it('should search dataset when datasetId provided', async () => {
        const params = { datasetId: 'dataset-123' }
        const mockDataset = {
          id: 'dataset-123',
          name: 'Test Dataset',
          userId: 'user-123',
        }

        prisma.dataset.findUnique.mockResolvedValue(mockDataset)

        canUseDataset.mockResolvedValue(true)
        applyDataset.mockResolvedValue({
          result: 'Dataset search result',
          messages: [{ type: 'activity', text: 'Found relevant information' }],
        })

        const result = await executeSearchAction(
          'test query',
          params,
          mockOptions
        )

        expect(prisma.dataset.findUnique).toHaveBeenCalledWith({
          where: { id: 'dataset-123' },
        })
        expect(canUseDataset).toHaveBeenCalledWith('user-123', mockDataset)
        expect(applyDataset).toHaveBeenCalledWith(
          'user-123',
          mockDataset,
          'test query'
        )
        expect(result).toEqual({
          result: 'Dataset search result',
          messages: [{ type: 'activity', text: 'Found relevant information' }],
        })
      })

      it('should search dataset when id provided (alternative parameter)', async () => {
        const params = { id: 'dataset-456' }
        const mockDataset = {
          id: 'dataset-456',
          name: 'Another Dataset',
          userId: 'user-123',
        }

        prisma.dataset.findUnique.mockResolvedValue(mockDataset)

        canUseDataset.mockResolvedValue(true)
        applyDataset.mockResolvedValue({
          result: 'Alternative dataset result',
          messages: [],
        })

        const result = await executeSearchAction(
          'another query',
          params,
          mockOptions
        )

        expect(prisma.dataset.findUnique).toHaveBeenCalledWith({
          where: { id: 'dataset-456' },
        })
        expect(result).toEqual({
          result: 'Alternative dataset result',
          messages: [],
        })
      })

      it('should handle case-insensitive dataset parameter names', async () => {
        const params = { DATASETID: 'dataset-789' }
        const mockDataset = {
          id: 'dataset-789',
          name: 'Case Test Dataset',
          userId: 'user-123',
        }

        prisma.dataset.findUnique.mockResolvedValue(mockDataset)

        canUseDataset.mockResolvedValue(true)
        applyDataset.mockResolvedValue({
          result: 'Case insensitive result',
          messages: [],
        })

        const result = await executeSearchAction(
          'case test',
          params,
          mockOptions
        )

        expect(prisma.dataset.findUnique).toHaveBeenCalledWith({
          where: { id: 'dataset-789' },
        })
        expect(result.result).toBe('Case insensitive result')
      })

      it('should throw error when dataset not found', async () => {
        const params = { datasetId: 'non-existent' }

        prisma.dataset.findUnique.mockResolvedValue(null)

        await expect(
          executeSearchAction('test query', params, mockOptions)
        ).rejects.toThrow('Dataset not found')
      })

      it('should throw error when user cannot use dataset', async () => {
        const params = { datasetId: 'dataset-123' }
        const mockDataset = {
          id: 'dataset-123',
          name: 'Restricted Dataset',
          userId: 'other-user',
        }

        prisma.dataset.findUnique.mockResolvedValue(mockDataset)

        canUseDataset.mockResolvedValue(false)

        await expect(
          executeSearchAction('test query', params, mockOptions)
        ).rejects.toThrow('Cannot use dataset')
      })
    })

    describe('web search', () => {
      const mockResults = [
        {
          link: 'https://example.com/page1',
          title: 'Example Page 1',
          source: 'example.com',
          description: 'This is a test description',
        },
        {
          link: 'https://example.com/page2',
          title: 'Example Page 2',
          source: 'example.com',
          description: 'Another test snippet',
        },
      ]

      beforeEach(() => {
        searchEngine.search.mockResolvedValue(mockResults)
      })

      it('should hand the query to the search engine', async () => {
        const result = await executeSearchAction('test query', {}, mockOptions)

        expect(searchEngine.search).toHaveBeenCalledWith('test query', {
          type: 'web',
        })

        expect(result).toEqual({ result: mockResults })
      })

      it('should handle web search type explicitly', async () => {
        await executeSearchAction('web search', { type: 'web' }, mockOptions)

        expect(searchEngine.search).toHaveBeenCalledWith('web search', {
          type: 'web',
        })
      })

      it.each(['web', 'news', 'images', 'videos'])(
        'should handle %s search type',
        async (type) => {
          await executeSearchAction(`${type} search`, { type }, mockOptions)

          expect(searchEngine.search).toHaveBeenCalledWith(`${type} search`, {
            type,
          })
        }
      )

      it.each(['web', 'news', 'images', 'videos'])(
        'should handle the %s search parameter flag',
        async (type) => {
          await executeSearchAction(
            `${type} flag search`,
            { [type]: true },
            mockOptions
          )

          expect(searchEngine.search).toHaveBeenCalledWith(
            `${type} flag search`,
            { type }
          )
        }
      )
    })

    describe('search result formatting', () => {
      const withImage = [
        {
          link: 'https://example.com/page1',
          title: 'Test Page',
          source: 'example.com',
          description: 'Test description',
          image: 'https://example.com/image.jpg',
        },
      ]

      // @note `{ images: true }` keeps the image, but by way of the search type
      // rather than the flag: the parameter selects an image search, and an
      // image search always keeps images. The flag itself is parsed under the
      // wrong key - see the note in action.exec.search.ts - which is why the
      // explicit `type` below drops it.

      it('should include images when images=true', async () => {
        searchEngine.search.mockResolvedValue(withImage)

        const result = await executeSearchAction(
          'test query',
          { images: true },
          mockOptions
        )

        expect(result.result[0]).toHaveProperty(
          'image',
          'https://example.com/image.jpg'
        )
      })

      it('should drop images for a web search that asked for them', async () => {
        searchEngine.search.mockResolvedValue(withImage)

        const result = await executeSearchAction(
          'test query',
          { type: 'web', images: true },
          mockOptions
        )

        expect(result.result[0]).not.toHaveProperty('image')
      })

      it('should drop images by default, because they cost tokens', async () => {
        searchEngine.search.mockResolvedValue(withImage)

        const result = await executeSearchAction('test query', {}, mockOptions)

        expect(result.result[0]).not.toHaveProperty('image')
      })

      it.each(['images', 'videos'])(
        'should keep images for a %s search without being asked',
        async (type) => {
          searchEngine.search.mockResolvedValue(withImage)

          const result = await executeSearchAction(
            'test query',
            { type },
            mockOptions
          )

          expect(result.result[0]).toHaveProperty(
            'image',
            'https://example.com/image.jpg'
          )
        }
      )

      // @note asserts the current behaviour, which is that `descriptions:
      // false` has no effect - the parameter is parsed under the wrong key and
      // never reaches the schema. See the note in action.exec.search.ts.

      it('should ignore descriptions=false, which never reaches the schema', async () => {
        searchEngine.search.mockResolvedValue(withImage)

        const result = await executeSearchAction(
          'test query',
          { descriptions: false },
          mockOptions
        )

        expect(result.result[0]).toHaveProperty(
          'description',
          'Test description'
        )
      })

      it('should preserve the order the engine returned', async () => {
        searchEngine.search.mockResolvedValue([
          { link: 'https://example.com/c', title: 'C' },
          { link: 'https://example.com/a', title: 'A' },
          { link: 'https://example.com/b', title: 'B' },
        ])

        const result = await executeSearchAction('test query', {}, mockOptions)

        expect(result.result.map(({ title }) => title)).toEqual(['C', 'A', 'B'])
      })

      it('should handle empty results', async () => {
        searchEngine.search.mockResolvedValue([])

        const result = await executeSearchAction('test query', {}, mockOptions)

        expect(result).toEqual({ result: [] })
      })
    })

    describe('parameter edge cases', () => {
      it('should handle multiple search type flags (prioritize first)', async () => {
        const params = { web: true, news: true, images: true }

        await executeSearchAction('multi flag search', params, mockOptions)

        // Should use web since it's checked first in the switch statement
        expect(searchEngine.search).toHaveBeenCalledWith('multi flag search', {
          type: 'web',
        })
      })

      it('should handle empty query string', async () => {
        const result = await executeSearchAction('', {}, mockOptions)

        expect(searchEngine.search).toHaveBeenCalledWith('', { type: 'web' })
        expect(result).toEqual({ result: [] })
      })

      it('should prioritize datasetId over id when both provided', async () => {
        const params = { datasetId: 'dataset-primary', id: 'dataset-secondary' }
        const mockDataset = {
          id: 'dataset-primary',
          name: 'Primary Dataset',
          userId: 'user-123',
        }

        prisma.dataset.findUnique.mockResolvedValue(mockDataset)

        canUseDataset.mockResolvedValue(true)
        applyDataset.mockResolvedValue({
          result: 'Primary dataset result',
          messages: [],
        })

        const result = await executeSearchAction(
          'test query',
          params,
          mockOptions
        )

        expect(prisma.dataset.findUnique).toHaveBeenCalledWith({
          where: { id: 'dataset-primary' },
        })
        expect(result.result).toBe('Primary dataset result')
      })
    })

    describe('integration tests', () => {
      it('should handle complete web search flow', async () => {
        searchEngine.search.mockResolvedValue([
          {
            link: 'https://example.com/comprehensive',
            title: 'Comprehensive Test Result',
            source: 'example.com',
            description: 'A detailed description',
            image: 'https://example.com/image.jpg',
          },
        ])

        const result = await executeSearchAction(
          'comprehensive test query',
          { type: 'web', descriptions: true, images: true },
          mockOptions
        )

        // @note no image, because an explicit `type: 'web'` means the images
        // flag is the only thing asking for one - and it never reaches the
        // schema. See the note in action.exec.search.ts.

        expect(result).toEqual({
          result: [
            {
              link: 'https://example.com/comprehensive',
              title: 'Comprehensive Test Result',
              source: 'example.com',
              description: 'A detailed description',
            },
          ],
        })

        expect(searchEngine.search).toHaveBeenCalledWith(
          'comprehensive test query',
          { type: 'web' }
        )
      })

      it('should handle complete dataset search flow', async () => {
        const mockDataset = {
          id: 'dataset-comprehensive',
          name: 'Comprehensive Test Dataset',
          userId: 'user-123',
        }

        prisma.dataset.findUnique.mockResolvedValue(mockDataset)

        canUseDataset.mockResolvedValue(true)
        applyDataset.mockResolvedValue({
          result: 'Comprehensive dataset search result',
          messages: [
            { type: 'activity', text: 'Searching dataset...' },
            { type: 'activity', text: 'Found relevant documents' },
          ],
        })

        const result = await executeSearchAction(
          'comprehensive dataset query',
          { datasetId: 'dataset-comprehensive' },
          mockOptions
        )

        expect(result).toEqual({
          result: 'Comprehensive dataset search result',
          messages: [
            { type: 'activity', text: 'Searching dataset...' },
            { type: 'activity', text: 'Found relevant documents' },
          ],
        })

        expect(searchEngine.search).not.toHaveBeenCalled()
      })
    })
  })
})
