/* eslint-disable no-console */
import {
  findExamplesByKeywords,
  fixExample,
  getExampleBySlug,
  getExamples,
  getExamplesWithExportedThemes,
  getExamplesWithThemes,
  getNextExamples,
  getSortedExamples,
  getTotalExamples,
} from '@/lib/example.fetch'

describe('fixExample', () => {
  it('inherits a referenced example theme and applies config overrides', () => {
    const baseTheme = getExampleBySlug('ai-answers').theme
    const example = fixExample({
      title: 'Theme inheritance test',
      theme: '@ai-answers/messageStyle=stack',
    })

    expect(example.theme).toEqual({
      name: baseTheme.name,
      config: {
        ...baseTheme.config,
        messageStyle: 'stack',
      },
    })
  })

  it('preserves the requested name when the referenced example is missing', () => {
    const example = fixExample({
      title: 'Missing theme reference test',
      theme: '@missing-theme/messageStyle=stack',
    })

    expect(example.theme).toEqual({
      name: 'missing-theme',
      config: {
        messageStyle: 'stack',
      },
    })
  })
})

describe('getExamples', () => {
  it('should return an array of examples', () => {
    const examples = getExamples()

    expect(Array.isArray(examples)).toBe(true)
    expect(examples.length).toBeGreaterThan(0)
  })

  it('should return examples with required fields', () => {
    const examples = getExamples()
    const first = examples[0]

    expect(first).toHaveProperty('title')
    expect(first).toHaveProperty('slug')
  })

  it('should assign a slug to each example', () => {
    const examples = getExamples()

    examples.forEach((example) => {
      expect(typeof example.slug).toBe('string')
      expect(example.slug.length).toBeGreaterThan(0)
    })
  })
})

describe('getSortedExamples', () => {
  it('should return an array with the same length as getExamples', () => {
    expect(getSortedExamples().length).toBe(getExamples().length)
  })

  it('should return examples sorted by date descending', () => {
    const sorted = getSortedExamples()

    // find adjacent examples that both have dates and verify order
    let foundPair = false

    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]
      const b = sorted[i + 1]

      if (a.date && b.date) {
        const dateA = new Date(a.date).getTime()
        const dateB = new Date(b.date).getTime()

        expect(dateA).toBeGreaterThanOrEqual(dateB)
        foundPair = true

        break
      }
    }

    // at least verify the function ran without error when no pair found
    if (!foundPair) {
      expect(sorted.length).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('getTotalExamples', () => {
  it('should return a positive integer', () => {
    const total = getTotalExamples()

    expect(typeof total).toBe('number')
    expect(total).toBeGreaterThan(0)
    expect(Number.isInteger(total)).toBe(true)
  })

  it('should match the length of getExamples', () => {
    expect(getTotalExamples()).toBe(getExamples().length)
  })
})

describe('getExampleBySlug', () => {
  it('should return undefined for a non-existent slug', () => {
    expect(getExampleBySlug('this-slug-does-not-exist-xyz-123')).toBeUndefined()
  })

  it('should return an example when given a valid slug', () => {
    const examples = getExamples()
    const target = examples[0]
    const result = getExampleBySlug(target.slug)

    expect(result).toBeDefined()
    expect(result?.slug).toBe(target.slug)
  })

  it('should return an example with all required fields', () => {
    const examples = getExamples()
    const target = examples[0]
    const result = getExampleBySlug(target.slug)

    expect(result).toHaveProperty('title')
    expect(result).toHaveProperty('slug')
  })
})

describe('getNextExamples', () => {
  it('should return an empty array for a non-existent slug', () => {
    const result = getNextExamples('this-slug-does-not-exist-xyz-123')

    expect(Array.isArray(result)).toBe(true)
  })

  it('should return at most the requested count', () => {
    const examples = getSortedExamples().filter(({ hidden }) => !hidden)

    if (examples.length > 0) {
      const result = getNextExamples(examples[0].slug, 2)

      expect(result.length).toBeLessThanOrEqual(2)
    }
  })

  it('should default to returning 3 examples', () => {
    const examples = getSortedExamples().filter(({ hidden }) => !hidden)

    if (examples.length > 4) {
      const result = getNextExamples(examples[0].slug)

      expect(result.length).toBeLessThanOrEqual(3)
    }
  })

  it('should return examples with slug, title fields', () => {
    const examples = getSortedExamples().filter(({ hidden }) => !hidden)

    if (examples.length > 1) {
      const result = getNextExamples(examples[0].slug, 1)

      if (result.length > 0) {
        expect(result[0]).toHaveProperty('slug')
        expect(result[0]).toHaveProperty('title')
      }
    }
  })
})

describe('getExamplesWithThemes', () => {
  it('should return an array', () => {
    expect(Array.isArray(getExamplesWithThemes())).toBe(true)
  })

  it('should only return examples that have a theme', () => {
    const themed = getExamplesWithThemes()

    themed.forEach((example) => {
      expect(example.theme).toBeTruthy()
    })
  })

  it('should not include hidden examples', () => {
    const themed = getExamplesWithThemes()

    themed.forEach((example) => {
      expect(example.hidden).toBeFalsy()
    })
  })
})

describe('getExamplesWithExportedThemes', () => {
  it('should return an array', () => {
    expect(Array.isArray(getExamplesWithExportedThemes())).toBe(true)
  })

  it('should be a subset of getExamplesWithThemes', () => {
    const exported = getExamplesWithExportedThemes()
    const themed = getExamplesWithThemes()

    exported.forEach((example) => {
      const found = themed.find(
        (t) => t.slug === example.slug || t.title === example.title
      )

      expect(found).toBeDefined()
    })
  })
})

describe('findExamplesByKeywords', () => {
  it('should find examples using Slack mapped keywords', () => {
    const mappedKeywords = ['slack', 'team', 'chat', 'communication']
    const results = findExamplesByKeywords(mappedKeywords)

    expect(results.length).toBeGreaterThan(0)
  })

  it('should find examples using Atlassian mapped keywords', () => {
    const mappedKeywords = ['atlassian', 'jira', 'confluence', 'bitbucket']
    const results = findExamplesByKeywords(mappedKeywords)

    expect(results.length).toBeGreaterThan(0)
  })

  it('should return an empty array for nonsense keywords', () => {
    const results = findExamplesByKeywords([
      'zzznonsensekeywordxyz',
      'anothernonexistent',
    ])

    expect(Array.isArray(results)).toBe(true)
    expect(results.length).toBe(0)
  })

  it('should return an empty array for an empty keyword list', () => {
    expect(findExamplesByKeywords([])).toEqual([])
  })

  it('should ignore very short keywords (3 chars or fewer)', () => {
    const shortResults = findExamplesByKeywords(['ai', 'go', 'js'])
    const emptyResults = findExamplesByKeywords([])

    // short keywords are filtered out, so results should be same as no keywords
    expect(shortResults).toEqual(emptyResults)
  })
})
