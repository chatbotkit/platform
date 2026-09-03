import yamlLoader from './yaml'

describe('yaml-loader', () => {
  function createLoaderContext(options = {}) {
    return {
      cacheable: jest.fn(),
      emitError: jest.fn(),
      emitWarning: jest.fn(),
      resourcePath: '/path/to/file.yaml',
      resourceQuery: '',
      ...options,
    }
  }

  it('should load a single YAML document', () => {
    const yamlContent = `
name: Test
value: 123
enabled: true
`

    const context = createLoaderContext()
    const result = yamlLoader.call(context, yamlContent)

    expect(result).toMatch(/^const data = /)
    expect(result).toMatch(/module\.exports = /)

    const exportedData = eval(
      result.replace('module.exports =', 'var result =') + '; result'
    )

    expect(exportedData).toEqual({
      name: 'Test',
      value: 123,
      enabled: true,
    })
  })

  it('should handle YAML arrays', () => {
    const yamlContent = `
- slug: item1
  name: Item 1
  value: 100
- slug: item2
  name: Item 2
  value: 200
`

    const context = createLoaderContext()
    const result = yamlLoader.call(context, yamlContent)

    const exportedData = eval(
      result.replace('module.exports =', 'var result =') + '; result'
    )

    expect(Array.isArray(exportedData)).toBe(true)
    expect(exportedData).toHaveLength(2)
    expect(exportedData[0]).toEqual({
      slug: 'item1',
      name: 'Item 1',
      value: 100,
    })
    expect(exportedData[1]).toEqual({
      slug: 'item2',
      name: 'Item 2',
      value: 200,
    })
  })

  it('should call cacheable', () => {
    const yamlContent = 'name: Test'
    const context = createLoaderContext()

    yamlLoader.call(context, yamlContent)

    expect(context.cacheable).toHaveBeenCalled()
  })

  it('should emit error on invalid YAML syntax', () => {
    const yamlContent = `
name: Test
  invalid: indentation
bad syntax here
`

    const context = createLoaderContext()
    const result = yamlLoader.call(context, yamlContent)

    expect(context.emitError).toHaveBeenCalled()
    expect(result).toBeNull()
  })

  it('should handle when cacheable is not available', () => {
    const yamlContent = `
name: Test
value: 123
`

    const context = createLoaderContext()

    delete context.cacheable

    const result = yamlLoader.call(context, yamlContent)

    expect(result).toBeDefined()

    const exportedData = eval(
      result.replace('module.exports =', 'var result =') + '; result'
    )

    expect(exportedData).toEqual({
      name: 'Test',
      value: 123,
    })
  })

  describe('lookupKey parameter', () => {
    it('should extract a specific key from an object', () => {
      const yamlContent = `
name: Test
description: A test object
value: 123
`

      const context = createLoaderContext({
        resourceQuery: '?lookupKey=description',
      })
      const result = yamlLoader.call(context, yamlContent)

      const exportedData = eval(
        result.replace('module.exports =', 'var result =') + '; result'
      )

      expect(exportedData).toBe('A test object')
    })

    it('should extract a key from all items in an array', () => {
      const yamlContent = `
- slug: item1
  name: Item 1
  value: 100
- slug: item2
  name: Item 2
  value: 200
- slug: item3
  name: Item 3
  value: 300
`

      const context = createLoaderContext({
        resourceQuery: '?lookupKey=name',
      })
      const result = yamlLoader.call(context, yamlContent)

      const exportedData = eval(
        result.replace('module.exports =', 'var result =') + '; result'
      )

      expect(Array.isArray(exportedData)).toBe(true)
      expect(exportedData).toEqual(['Item 1', 'Item 2', 'Item 3'])
    })

    it('should return array when extracting key results in one value', () => {
      const yamlContent = `
- slug: only-item
  name: Only Item
  value: 100
`

      const context = createLoaderContext({
        resourceQuery: '?lookupKey=name',
      })
      const result = yamlLoader.call(context, yamlContent)

      const exportedData = eval(
        result.replace('module.exports =', 'var result =') + '; result'
      )

      expect(Array.isArray(exportedData)).toBe(true)
      expect(exportedData).toEqual(['Only Item'])
    })

    it('should handle extracting nested objects', () => {
      const yamlContent = `
database:
  host: localhost
  port: 5432
cache:
  enabled: true
`

      const context = createLoaderContext({
        resourceQuery: '?lookupKey=database',
      })
      const result = yamlLoader.call(context, yamlContent)

      const exportedData = eval(
        result.replace('module.exports =', 'var result =') + '; result'
      )

      expect(exportedData).toEqual({
        host: 'localhost',
        port: 5432,
      })
    })
  })

  describe('lookupKey and lookupValue parameters', () => {
    it('should filter array items by key-value match', () => {
      const yamlContent = `
- slug: item1
  name: Item 1
  type: active
  value: 100
- slug: item2
  name: Item 2
  type: inactive
  value: 200
- slug: item3
  name: Item 3
  type: active
  value: 300
`

      const context = createLoaderContext({
        resourceQuery: '?lookupKey=type&lookupValue=active',
      })
      const result = yamlLoader.call(context, yamlContent)

      const exportedData = eval(
        result.replace('module.exports =', 'var result =') + '; result'
      )

      expect(Array.isArray(exportedData)).toBe(true)
      expect(exportedData).toHaveLength(2)
      expect(exportedData[0].slug).toBe('item1')
      expect(exportedData[1].slug).toBe('item3')
    })

    it('should return array when filtering results in one match', () => {
      const yamlContent = `
- slug: item1
  name: Item 1
  type: active
- slug: item2
  name: Item 2
  type: inactive
- slug: item3
  name: Item 3
  type: pending
`

      const context = createLoaderContext({
        resourceQuery: '?lookupKey=slug&lookupValue=item2',
      })
      const result = yamlLoader.call(context, yamlContent)

      const exportedData = eval(
        result.replace('module.exports =', 'var result =') + '; result'
      )

      expect(Array.isArray(exportedData)).toBe(true)
      expect(exportedData).toHaveLength(1)
      expect(exportedData[0]).toEqual({
        slug: 'item2',
        name: 'Item 2',
        type: 'inactive',
      })
    })

    it('should return empty array when no items match filter', () => {
      const yamlContent = `
- slug: item1
  type: active
- slug: item2
  type: inactive
`

      const context = createLoaderContext({
        resourceQuery: '?lookupKey=type&lookupValue=pending',
      })
      const result = yamlLoader.call(context, yamlContent)

      const exportedData = eval(
        result.replace('module.exports =', 'var result =') + '; result'
      )

      expect(Array.isArray(exportedData)).toBe(true)
      expect(exportedData).toHaveLength(0)
    })

    it('should handle numeric values in filter', () => {
      const yamlContent = `
- id: 1
  name: First
- id: 2
  name: Second
- id: 3
  name: Third
`

      const context = createLoaderContext({
        resourceQuery: '?lookupKey=id&lookupValue=2',
      })
      const result = yamlLoader.call(context, yamlContent)

      const exportedData = eval(
        result.replace('module.exports =', 'var result =') + '; result'
      )

      expect(Array.isArray(exportedData)).toBe(true)
      expect(exportedData).toHaveLength(1)
      expect(exportedData[0]).toEqual({
        id: 2,
        name: 'Second',
      })
    })

    it('should handle boolean values in filter', () => {
      const yamlContent = `
- name: Feature A
  enabled: true
- name: Feature B
  enabled: false
- name: Feature C
  enabled: true
`

      const context = createLoaderContext({
        resourceQuery: '?lookupKey=enabled&lookupValue=false',
      })
      const result = yamlLoader.call(context, yamlContent)

      const exportedData = eval(
        result.replace('module.exports =', 'var result =') + '; result'
      )

      expect(Array.isArray(exportedData)).toBe(true)
      expect(exportedData).toHaveLength(1)
      expect(exportedData[0]).toEqual({
        name: 'Feature B',
        enabled: false,
      })
    })

    it('should handle null values in filter', () => {
      const yamlContent = `
- name: Item A
  value: 100
- name: Item B
  value: null
- name: Item C
  value: 200
`

      const context = createLoaderContext({
        resourceQuery: '?lookupKey=value&lookupValue=null',
      })
      const result = yamlLoader.call(context, yamlContent)

      const exportedData = eval(
        result.replace('module.exports =', 'var result =') + '; result'
      )

      expect(Array.isArray(exportedData)).toBe(true)
      expect(exportedData).toHaveLength(1)
      expect(exportedData[0]).toEqual({
        name: 'Item B',
        value: null,
      })
    })

    it('should filter single object by matching key-value with boolean true', () => {
      const yamlContent = `
name: Test Feature
enabled: true
type: experimental
`

      const context = createLoaderContext({
        resourceQuery: '?lookupKey=enabled&lookupValue=true',
      })
      const result = yamlLoader.call(context, yamlContent)

      const exportedData = eval(
        result.replace('module.exports =', 'var result =') + '; result'
      )

      expect(exportedData).toEqual({
        name: 'Test Feature',
        enabled: true,
        type: 'experimental',
      })
    })

    it('should return null when single object does not match boolean filter', () => {
      const yamlContent = `
name: Test Feature
enabled: true
type: experimental
`

      const context = createLoaderContext({
        resourceQuery: '?lookupKey=enabled&lookupValue=false',
      })
      const result = yamlLoader.call(context, yamlContent)

      const exportedData = eval(
        result.replace('module.exports =', 'var result =') + '; result'
      )

      expect(exportedData).toBeNull()
    })

    it('should filter single object with null value match', () => {
      const yamlContent = `
name: Test Item
value: null
description: Test
`

      const context = createLoaderContext({
        resourceQuery: '?lookupKey=value&lookupValue=null',
      })
      const result = yamlLoader.call(context, yamlContent)

      const exportedData = eval(
        result.replace('module.exports =', 'var result =') + '; result'
      )

      expect(exportedData).toEqual({
        name: 'Test Item',
        value: null,
        description: 'Test',
      })
    })

    it('should handle string values that look like numbers', () => {
      const yamlContent = `
- name: Item 1
  code: ''
- name: Item 2
  code: '123'
`

      const context = createLoaderContext({
        resourceQuery: '?lookupKey=name&lookupValue=Item 2',
      })
      const result = yamlLoader.call(context, yamlContent)

      const exportedData = eval(
        result.replace('module.exports =', 'var result =') + '; result'
      )

      expect(Array.isArray(exportedData)).toBe(true)
      expect(exportedData).toHaveLength(1)
      expect(exportedData[0]).toEqual({
        name: 'Item 2',
        code: '123',
      })
    })

    it('should handle whitespace-only string values', () => {
      const yamlContent = `
- name: Item 1
  tag: '   '
- name: Item 2
  tag: test
`

      const context = createLoaderContext({
        resourceQuery: '?lookupKey=tag&lookupValue=test',
      })
      const result = yamlLoader.call(context, yamlContent)

      const exportedData = eval(
        result.replace('module.exports =', 'var result =') + '; result'
      )

      expect(Array.isArray(exportedData)).toBe(true)
      expect(exportedData).toHaveLength(1)
      expect(exportedData[0]).toEqual({
        name: 'Item 2',
        tag: 'test',
      })
    })

    it('should handle filtering with items containing undefined/null in array', () => {
      const yamlContent = `
- name: Item 1
  type: active
- name: Item 2
  type: inactive
`

      const context = createLoaderContext({
        resourceQuery: '?lookupKey=missingKey&lookupValue=test',
      })
      const result = yamlLoader.call(context, yamlContent)

      const exportedData = eval(
        result.replace('module.exports =', 'var result =') + '; result'
      )

      expect(Array.isArray(exportedData)).toBe(true)
      expect(exportedData).toHaveLength(0)
    })

    it('should coerce string "true" to boolean true in filter', () => {
      const yamlContent = `
- name: Feature 1
  active: true
- name: Feature 2
  active: false
`

      const context = createLoaderContext({
        resourceQuery: '?lookupKey=active&lookupValue=true',
      })
      const result = yamlLoader.call(context, yamlContent)

      const exportedData = eval(
        result.replace('module.exports =', 'var result =') + '; result'
      )

      expect(Array.isArray(exportedData)).toBe(true)
      expect(exportedData).toHaveLength(1)
      expect(exportedData[0]).toEqual({
        name: 'Feature 1',
        active: true,
      })
    })

    it('should coerce string "false" to boolean false in filter', () => {
      const yamlContent = `
- name: Setting 1
  disabled: true
- name: Setting 2
  disabled: false
`

      const context = createLoaderContext({
        resourceQuery: '?lookupKey=disabled&lookupValue=false',
      })
      const result = yamlLoader.call(context, yamlContent)

      const exportedData = eval(
        result.replace('module.exports =', 'var result =') + '; result'
      )

      expect(Array.isArray(exportedData)).toBe(true)
      expect(exportedData).toHaveLength(1)
      expect(exportedData[0]).toEqual({
        name: 'Setting 2',
        disabled: false,
      })
    })

    it('should coerce string "null" to null in filter', () => {
      const yamlContent = `
- name: Config 1
  optional: test
- name: Config 2
  optional: null
`

      const context = createLoaderContext({
        resourceQuery: '?lookupKey=optional&lookupValue=null',
      })
      const result = yamlLoader.call(context, yamlContent)

      const exportedData = eval(
        result.replace('module.exports =', 'var result =') + '; result'
      )

      expect(Array.isArray(exportedData)).toBe(true)
      expect(exportedData).toHaveLength(1)
      expect(exportedData[0]).toEqual({
        name: 'Config 2',
        optional: null,
      })
    })
  })
})
