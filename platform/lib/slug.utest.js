import { generateThreeWordSlug } from '@/lib/slug'

import { forbiddenWords } from '@/schemas/slug'

describe('generateThreeWordSlug', () => {
  test('should generate a valid three-part slug', () => {
    const slug = generateThreeWordSlug()

    expect(typeof slug).toBe('string')
    expect(slug.length).toBeGreaterThan(0)

    // should have exactly two hyphens (separating three parts: adjective-connector-noun)

    const parts = slug.split('-')

    expect(parts).toHaveLength(3)

    // all parts should be non-empty words

    parts.forEach((part) => {
      expect(part.length).toBeGreaterThan(0)
      expect(part).toMatch(/^[a-z]+$/) // only lowercase letters
    })
  })

  test('should generate different slugs on subsequent calls', () => {
    // test multiple generated slugs to ensure variety

    const slugs = new Set()

    for (let i = 0; i < 10; i++) {
      slugs.add(generateThreeWordSlug())
    }

    expect(slugs.size).toBeGreaterThan(1)
  })

  test('should follow the adjective-connector-noun pattern', () => {
    const slug = generateThreeWordSlug()
    const parts = slug.split('-')

    expect(parts).toHaveLength(3)
    // we can't test specific words without exposing the word lists, but we can test the general pattern

    expect(parts[0]).toMatch(/^[a-z]+$/) // adjective
    expect(parts[1]).toMatch(/^[a-z]+$/) // connector
    expect(parts[2]).toMatch(/^[a-z]+$/) // noun
  })

  test('should not contain forbidden words', () => {
    // test multiple generated slugs to ensure no forbidden words

    for (let i = 0; i < 50; i++) {
      const slug = generateThreeWordSlug()

      forbiddenWords.forEach((forbiddenWord) => {
        expect(slug).not.toContain(forbiddenWord)
      })
    }
  })
})
