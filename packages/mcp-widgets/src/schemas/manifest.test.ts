import { describe, it, expect } from 'vitest'
import {
  ManifestMetadataSchema,
  parseManifest,
  validateManifest,
  ComponentFrameworkSchema,
  ComponentCategorySchema,
} from './manifest'

describe('ManifestMetadataSchema', () => {
  const validManifest = {
    name: 'data-card',
    displayName: 'Data Card',
    description: 'A card widget for displaying data',
    version: '1.0.0',
    tagName: 'mcp-data-card',
    framework: 'web-component',
  }

  it('should validate a valid manifest', () => {
    const result = ManifestMetadataSchema.safeParse(validManifest)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('data-card')
      expect(result.data.tagName).toBe('mcp-data-card')
    }
  })

  it('should validate manifest with optional fields', () => {
    const manifest = {
      ...validManifest,
      category: 'data-display',
      keywords: ['card', 'data', 'display'],
      author: 'ChatBotKit',
    }

    const result = ManifestMetadataSchema.safeParse(manifest)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.category).toBe('data-display')
      expect(result.data.keywords).toEqual(['card', 'data', 'display'])
      expect(result.data.author).toBe('ChatBotKit')
    }
  })

  it('should reject manifest without required name', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { name: _, ...manifest } = validManifest

    const result = ManifestMetadataSchema.safeParse(manifest)

    expect(result.success).toBe(false)
  })

  it('should reject manifest without hyphen in tagName', () => {
    const manifest = {
      ...validManifest,
      tagName: 'datacard', // no hyphen
    }

    const result = ManifestMetadataSchema.safeParse(manifest)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('hyphen')
    }
  })

  it('should reject invalid framework', () => {
    const manifest = {
      ...validManifest,
      framework: 'vue', // invalid
    }

    const result = ManifestMetadataSchema.safeParse(manifest)

    expect(result.success).toBe(false)
  })

  it('should reject invalid category', () => {
    const manifest = {
      ...validManifest,
      category: 'invalid-category',
    }

    const result = ManifestMetadataSchema.safeParse(manifest)

    expect(result.success).toBe(false)
  })
})

describe('parseManifest', () => {
  it('should return parsed manifest for valid data', () => {
    const data = {
      name: 'test-widget',
      displayName: 'Test Widget',
      description: 'A test widget',
      version: '1.0.0',
      tagName: 'mcp-test-widget',
      framework: 'react',
    }

    const result = parseManifest(data)

    expect(result).not.toBeNull()
    expect(result?.name).toBe('test-widget')
  })

  it('should return null for invalid data', () => {
    const result = parseManifest({ invalid: 'data' })

    expect(result).toBeNull()
  })
})

describe('validateManifest', () => {
  it('should return manifest for valid data', () => {
    const data = {
      name: 'test-widget',
      displayName: 'Test Widget',
      description: 'A test widget',
      version: '1.0.0',
      tagName: 'mcp-test-widget',
      framework: 'web-component',
    }

    const result = validateManifest(data)

    expect(result.name).toBe('test-widget')
  })

  it('should throw for invalid data', () => {
    expect(() => validateManifest({ invalid: 'data' })).toThrow()
  })
})

describe('ComponentFrameworkSchema', () => {
  it('should accept valid frameworks', () => {
    expect(ComponentFrameworkSchema.parse('web-component')).toBe(
      'web-component'
    )
    expect(ComponentFrameworkSchema.parse('react')).toBe('react')
  })

  it('should reject invalid frameworks', () => {
    expect(() => ComponentFrameworkSchema.parse('vue')).toThrow()
  })
})

describe('ComponentCategorySchema', () => {
  it('should accept valid categories', () => {
    expect(ComponentCategorySchema.parse('data-display')).toBe('data-display')
    expect(ComponentCategorySchema.parse('feedback')).toBe('feedback')
    expect(ComponentCategorySchema.parse('input')).toBe('input')
  })

  it('should reject invalid categories', () => {
    expect(() => ComponentCategorySchema.parse('invalid')).toThrow()
  })
})
