import { findManyByGlob, importManyByGlob } from '@/lib/ability.catalogue'

jest.mock('@/lib/instruction.template.parse', () => ({
  buildTemplateInstruction: jest.fn(({ template, params }) => {
    if (params) {
      return `instruction for ${template} with params ${JSON.stringify(params)}`
    }

    return `instruction for ${template}`
  }),
}))

jest.mock('@/data/abilities/visible', () => ({
  fetch_web_page: { name: 'fetch_web_page', description: 'Fetch web page' },
  'fetch_web_page[research]': {
    name: 'fetch_web_page[research]',
    description: 'Fetch web page for research',
  },

  search_web: { name: 'search_web', description: 'Search the web' },
  'search_web[research]': {
    name: 'search_web[research]',
    description: 'Search the web for research',
  },
  'search_web[general]': {
    name: 'search_web[general]',
    description: 'Search the web for general info',
  },

  send_email: { name: 'send_email', description: 'Send an email' },
  'send_email[communication]': {
    name: 'send_email[communication]',
    description: 'Send email for communication',
  },

  calculate_numbers: {
    name: 'calculate_numbers',
    description: 'Calculate numbers',
  },

  // Path-like abilities for testing subpath matching
  'test/123': { name: 'test/123', description: 'Test item 123' },
  'test/123/abc': { name: 'test/123/abc', description: 'Test nested item' },
  'test/456': { name: 'test/456', description: 'Test item 456' },
  'test/456/def/ghi': {
    name: 'test/456/def/ghi',
    description: 'Test deeply nested item',
  },
  'prod/789': { name: 'prod/789', description: 'Prod item 789' },
}))

describe('findManyByGlob', () => {
  describe('basic glob pattern matching', () => {
    it('should return all abilities matching a wildcard pattern', () => {
      const result = findManyByGlob('fetch_*')

      expect(Object.keys(result)).toHaveLength(2)
      expect(result['fetch_web_page']).toBeDefined()
      expect(result['fetch_web_page[research]']).toBeDefined()
    })

    it('should return abilities with exact match', () => {
      const result = findManyByGlob('search_web')

      expect(Object.keys(result)).toHaveLength(1)
      expect(result['search_web']).toBeDefined()
      expect(result['search_web[research]']).toBeUndefined()
      expect(result['search_web[general]']).toBeUndefined()
    })

    it('should return all abilities matching pattern with brackets', () => {
      const result = findManyByGlob('search_web*')

      expect(Object.keys(result)).toHaveLength(3)
      expect(result['search_web']).toBeDefined()
      expect(result['search_web[research]']).toBeDefined()
      expect(result['search_web[general]']).toBeDefined()
    })

    it('should return empty object when no abilities match the pattern', () => {
      const result = findManyByGlob('nonexistent_*')

      expect(result).toEqual({})
      expect(Object.keys(result)).toHaveLength(0)
    })

    it('should return empty object for empty pattern', () => {
      const result = findManyByGlob('')

      expect(Object.keys(result)).toHaveLength(0)
    })
  })

  describe('category filtering', () => {
    it('should filter by single category with wildcard pattern', () => {
      const result = findManyByGlob('search_web*', {
        categories: ['research'],
      })

      expect(Object.keys(result)).toHaveLength(1)
      expect(result['search_web[research]']).toBeDefined()
      expect(result['search_web']).toBeUndefined()
      expect(result['search_web[general]']).toBeUndefined()
    })

    it('should filter by multiple categories with wildcard pattern', () => {
      const result = findManyByGlob('search_web*', {
        categories: ['research', 'general'],
      })

      expect(Object.keys(result)).toHaveLength(2)
      expect(result['search_web[research]']).toBeDefined()
      expect(result['search_web[general]']).toBeDefined()
      expect(result['search_web']).toBeUndefined()
    })

    it('should return empty object when no abilities match category filter', () => {
      const result = findManyByGlob('fetch_web_page*', {
        categories: ['nonexistent'],
      })

      expect(result).toEqual({})
      expect(Object.keys(result)).toHaveLength(0)
    })

    it('should exclude abilities without category when filtering', () => {
      const result = findManyByGlob('send_email*', {
        categories: ['communication'],
      })

      expect(Object.keys(result)).toHaveLength(1)
      expect(result['send_email[communication]']).toBeDefined()
      expect(result['send_email']).toBeUndefined()
    })

    it('should return empty object with empty categories array', () => {
      const result = findManyByGlob('search_web*', {
        categories: [],
      })

      expect(result).toEqual({})
      expect(Object.keys(result)).toHaveLength(0)
    })
  })

  describe('excludeAllCategories option', () => {
    it('should exclude all abilities with categories when excludeAllCategories is true', () => {
      const result = findManyByGlob('search_web*', {
        excludeAllCategories: true,
      })

      expect(Object.keys(result)).toHaveLength(1)
      expect(result['search_web']).toBeDefined()
      expect(result['search_web[research]']).toBeUndefined()
      expect(result['search_web[general]']).toBeUndefined()
    })

    it('should only return abilities without categories', () => {
      const result = findManyByGlob('*', {
        excludeAllCategories: true,
      })

      // @note should only include abilities without [category] suffix
      const keys = Object.keys(result)

      keys.forEach((key) => {
        expect(key).not.toMatch(/\[.+\]$/)
      })

      expect(result['fetch_web_page']).toBeDefined()
      expect(result['search_web']).toBeDefined()
      expect(result['send_email']).toBeDefined()
      expect(result['calculate_numbers']).toBeDefined()
      expect(result['fetch_web_page[research]']).toBeUndefined()
      expect(result['search_web[research]']).toBeUndefined()
    })

    it('should work with specific glob patterns', () => {
      const result = findManyByGlob('fetch_*', {
        excludeAllCategories: true,
      })

      expect(Object.keys(result)).toHaveLength(1)
      expect(result['fetch_web_page']).toBeDefined()
      expect(result['fetch_web_page[research]']).toBeUndefined()
    })

    it('should return empty object when all matching abilities have categories', () => {
      const result = findManyByGlob('send_email[*', {
        excludeAllCategories: true,
      })

      expect(result).toEqual({})
      expect(Object.keys(result)).toHaveLength(0)
    })

    it('should work with path-like abilities', () => {
      const result = findManyByGlob('test/*', {
        excludeAllCategories: true,
      })

      // @note all test/* abilities don't have [category] suffix
      expect(Object.keys(result)).toHaveLength(2)
      expect(result['test/123']).toBeDefined()
      expect(result['test/456']).toBeDefined()
    })

    it('should ignore categories option when excludeAllCategories is true', () => {
      // @note excludeAllCategories takes precedence
      const result = findManyByGlob('search_web*', {
        categories: ['research'],
        excludeAllCategories: true,
      })

      expect(Object.keys(result)).toHaveLength(1)
      expect(result['search_web']).toBeDefined()
      expect(result['search_web[research]']).toBeUndefined()
    })
  })

  describe('glob pattern edge cases', () => {
    it('should match using question mark for single character', () => {
      const result = findManyByGlob('send_emai?')

      expect(Object.keys(result)).toHaveLength(1)
      expect(result['send_email']).toBeDefined()
    })

    it('should support multiple wildcard patterns', () => {
      const result = findManyByGlob('*_web_*')

      expect(Object.keys(result)).toHaveLength(2)
      expect(result['fetch_web_page']).toBeDefined()
      expect(result['fetch_web_page[research]']).toBeDefined()
    })

    it('should handle undefined filter', () => {
      const result = findManyByGlob('fetch_*', undefined)

      expect(Object.keys(result)).toHaveLength(2)
      expect(result['fetch_web_page']).toBeDefined()
      expect(result['fetch_web_page[research]']).toBeDefined()
    })

    it('should handle filter without categories', () => {
      const result = findManyByGlob('fetch_*', {})

      expect(Object.keys(result)).toHaveLength(2)
      expect(result['fetch_web_page']).toBeDefined()
      expect(result['fetch_web_page[research]']).toBeDefined()
    })

    it('should preserve ability objects intact', () => {
      const result = findManyByGlob('calculate_*')

      expect(result['calculate_numbers']).toEqual({
        name: 'calculate_numbers',
        description: 'Calculate numbers',
      })
    })

    it('should handle case-sensitive pattern matching', () => {
      const result = findManyByGlob('FETCH_*')

      expect(result).toEqual({})
      expect(Object.keys(result)).toHaveLength(0)
    })

    it('should match all abilities with catch-all pattern', () => {
      const result = findManyByGlob('*')

      expect(Object.keys(result).length).toBeGreaterThan(0)
    })
  })

  describe('return value structure', () => {
    it('should return an object with ability names as keys', () => {
      const result = findManyByGlob('send_email*')

      expect(typeof result).toBe('object')
      expect(Array.isArray(result)).toBe(false)
      expect(result['send_email']).toBeDefined()
    })

    it('should return abilities with correct structure', () => {
      const result = findManyByGlob('send_email*')

      Object.values(result).forEach((ability) => {
        expect(ability).toHaveProperty('name')
        expect(ability).toHaveProperty('description')
      })
    })
  })

  describe('subpath matching with * vs **', () => {
    it('should match only single-level subpaths with test/*', () => {
      const result = findManyByGlob('test/*')

      expect(Object.keys(result)).toHaveLength(2)
      expect(result['test/123']).toBeDefined()
      expect(result['test/456']).toBeDefined()
      expect(result['test/123/abc']).toBeUndefined()
      expect(result['test/456/def/ghi']).toBeUndefined()
    })

    it('should match all subpaths (single and nested) with test/**', () => {
      const result = findManyByGlob('test/**')

      // ** matches zero or more path segments, so it matches everything under test/
      expect(Object.keys(result)).toHaveLength(4)
      expect(result['test/123']).toBeDefined()
      expect(result['test/456']).toBeDefined()
      expect(result['test/123/abc']).toBeDefined()
      expect(result['test/456/def/ghi']).toBeDefined()
    })

    it('should match only nested paths (2+ levels) with test/*/*', () => {
      const result = findManyByGlob('test/*/*')

      expect(Object.keys(result)).toHaveLength(1)
      expect(result['test/123/abc']).toBeDefined()
      expect(result['test/123']).toBeUndefined()
      expect(result['test/456']).toBeUndefined()
      expect(result['test/456/def/ghi']).toBeUndefined()
    })

    it('should match deeply nested paths with test/*/*/*', () => {
      const result = findManyByGlob('test/*/*/*')

      expect(Object.keys(result)).toHaveLength(1)
      expect(result['test/456/def/ghi']).toBeDefined()
      expect(result['test/123/abc']).toBeUndefined()
    })

    it('should not match different top-level paths', () => {
      const result = findManyByGlob('test/*')

      expect(result['prod/789']).toBeUndefined()
    })

    it('should match specific depth with test/*/abc', () => {
      const result = findManyByGlob('test/*/abc')

      expect(Object.keys(result)).toHaveLength(1)
      expect(result['test/123/abc']).toBeDefined()
      expect(result['test/456/def/ghi']).toBeUndefined()
    })

    it('should match deep paths with test/**/ghi', () => {
      const result = findManyByGlob('test/**/ghi')

      expect(Object.keys(result)).toHaveLength(1)
      expect(result['test/456/def/ghi']).toBeDefined()
    })

    it('should demonstrate difference: test/* vs test/**', () => {
      const singleLevel = findManyByGlob('test/*')
      const allLevels = findManyByGlob('test/**')

      // test/* matches only direct children (1 level deep)
      expect(Object.keys(singleLevel)).toHaveLength(2)

      // test/** matches all descendants (any depth)
      expect(Object.keys(allLevels)).toHaveLength(4)
      expect(Object.keys(allLevels).length).toBeGreaterThan(
        Object.keys(singleLevel).length
      )
    })
  })
})

describe('importManyByGlob', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic import functionality', () => {
    it('should import all abilities matching the glob pattern', () => {
      const result = importManyByGlob('fetch_*')

      expect(result).toHaveLength(2)
      expect(result[0]).toHaveProperty('name')
      expect(result[0]).toHaveProperty('description')
      expect(result[0]).toHaveProperty('instruction')
    })

    it('should build instructions for each ability', () => {
      const result = importManyByGlob('search_web*')

      expect(result).toHaveLength(3)

      result.forEach((ability) => {
        expect(ability.instruction).toMatch(/^instruction for search_web/)
      })
    })

    it('should return empty array when no abilities match the pattern', () => {
      const result = importManyByGlob('nonexistent_*')

      expect(result).toEqual([])
      expect(result).toHaveLength(0)
    })

    it('should return empty array for empty pattern', () => {
      const result = importManyByGlob('')

      expect(result).toEqual([])
      expect(result).toHaveLength(0)
    })
  })

  describe('category filtering', () => {
    it('should filter by single category', () => {
      const result = importManyByGlob('search_web*', {
        categories: ['research'],
      })

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('search_web[research]')
      expect(result[0].description).toBe('Search the web for research')
    })

    it('should filter by multiple categories', () => {
      const result = importManyByGlob('search_web*', {
        categories: ['research', 'general'],
      })

      expect(result).toHaveLength(2)

      const names = result.map((a) => a.name)

      expect(names).toContain('search_web[research]')
      expect(names).toContain('search_web[general]')
    })

    it('should return empty array when no abilities match category filter', () => {
      const result = importManyByGlob('fetch_web_page*', {
        categories: ['nonexistent'],
      })

      expect(result).toEqual([])
      expect(result).toHaveLength(0)
    })

    it('should exclude abilities without category when filtering', () => {
      const result = importManyByGlob('send_email*', {
        categories: ['communication'],
      })

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('send_email[communication]')
    })
  })

  describe('excludeAllCategories option', () => {
    it('should exclude all abilities with categories', () => {
      const result = importManyByGlob('search_web*', {
        excludeAllCategories: true,
      })

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('search_web')
      expect(result[0].description).toBe('Search the web')
    })

    it('should only import abilities without categories', () => {
      const result = importManyByGlob('*_email*', {
        excludeAllCategories: true,
      })

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('send_email')

      // @note should not include any abilities with [category] suffix
      result.forEach((ability) => {
        expect(ability.name).not.toMatch(/\[.+\]$/)
      })
    })

    it('should return empty array when all matching abilities have categories', () => {
      const result = importManyByGlob('send_email[*', {
        excludeAllCategories: true,
      })

      expect(result).toEqual([])
      expect(result).toHaveLength(0)
    })

    it('should work with params', () => {
      const params = { key: 'value' }

      const result = importManyByGlob('calculate_*', {
        excludeAllCategories: true,
        params,
      })

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('calculate_numbers')
      expect(result[0].instruction).toContain('with params')
      expect(result[0].instruction).toContain('value')
    })

    it('should ignore categories option when excludeAllCategories is true', () => {
      const result = importManyByGlob('search_web*', {
        categories: ['research', 'general'],
        excludeAllCategories: true,
      })

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('search_web')

      // @note should not include categorized abilities
      const names = result.map((a) => a.name)

      expect(names).not.toContain('search_web[research]')
      expect(names).not.toContain('search_web[general]')
    })

    it('should build instructions for non-categorized abilities', () => {
      const result = importManyByGlob('fetch_*', {
        excludeAllCategories: true,
      })

      expect(result).toHaveLength(1)
      expect(result[0].instruction).toBe('instruction for fetch_web_page')
    })
  })

  describe('parameter passing', () => {
    it('should pass params to buildTemplateInstruction', () => {
      const params = { userId: 'user123', spaceId: 'space456' }

      const result = importManyByGlob('calculate_*', { params })

      expect(result).toHaveLength(1)
      expect(result[0].instruction).toContain('with params')
      expect(result[0].instruction).toContain('user123')
      expect(result[0].instruction).toContain('space456')
    })

    it('should work without params', () => {
      const result = importManyByGlob('calculate_*')

      expect(result).toHaveLength(1)
      expect(result[0].instruction).toBe('instruction for calculate_numbers')
    })

    it('should pass both categories and params together', () => {
      const params = { key: 'value' }

      const result = importManyByGlob('search_web*', {
        categories: ['research'],
        params,
      })

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('search_web[research]')
      expect(result[0].instruction).toContain('with params')
      expect(result[0].instruction).toContain('value')
    })
  })

  describe('return value structure', () => {
    it('should return an array of ability objects', () => {
      const result = importManyByGlob('send_email*')

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
    })

    it('should return abilities with correct structure', () => {
      const result = importManyByGlob('send_email*')

      result.forEach((ability) => {
        expect(ability).toHaveProperty('name')
        expect(ability).toHaveProperty('description')
        expect(ability).toHaveProperty('instruction')
        expect(typeof ability.name).toBe('string')
        expect(typeof ability.description).toBe('string')
        expect(typeof ability.instruction).toBe('string')
      })
    })

    it('should preserve name and description from original abilities', () => {
      const result = importManyByGlob('calculate_*')

      expect(result[0].name).toBe('calculate_numbers')
      expect(result[0].description).toBe('Calculate numbers')
    })
  })

  describe('edge cases', () => {
    it('should handle undefined options', () => {
      const result = importManyByGlob('fetch_*', undefined)

      expect(result).toHaveLength(2)
      expect(result[0]).toHaveProperty('instruction')
    })

    it('should handle empty options object', () => {
      const result = importManyByGlob('fetch_*', {})

      expect(result).toHaveLength(2)
      expect(result[0]).toHaveProperty('instruction')
    })

    it('should handle options with only categories', () => {
      const result = importManyByGlob('search_web*', {
        categories: ['research'],
      })

      expect(result).toHaveLength(1)
      expect(result[0].instruction).toBe('instruction for search_web[research]')
    })

    it('should handle options with only params', () => {
      const result = importManyByGlob('calculate_*', {
        params: { test: 'value' },
      })

      expect(result).toHaveLength(1)
      expect(result[0].instruction).toContain('with params')
    })

    it('should handle empty categories array', () => {
      const result = importManyByGlob('search_web*', {
        categories: [],
      })

      expect(result).toEqual([])
      expect(result).toHaveLength(0)
    })

    it('should handle empty params object', () => {
      const result = importManyByGlob('calculate_*', {
        params: {},
      })

      expect(result).toHaveLength(1)
      expect(result[0].instruction).toContain('with params')
    })
  })

  describe('integration with findManyByGlob', () => {
    it('should use findManyByGlob internally', () => {
      const result1 = findManyByGlob('fetch_*')
      const result2 = importManyByGlob('fetch_*')

      // @note same number of abilities should be found
      expect(Object.keys(result1).length).toBe(result2.length)
    })

    it('should apply category filters through findManyByGlob', () => {
      const result1 = findManyByGlob('search_web*', {
        categories: ['research'],
      })
      const result2 = importManyByGlob('search_web*', {
        categories: ['research'],
      })

      // @note same filtering should be applied
      expect(Object.keys(result1).length).toBe(result2.length)
    })
  })
})
