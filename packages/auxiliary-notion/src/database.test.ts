/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  DatabaseProperties} from './database';
import {
  convertDatabaseCreatePropertiesFromKnownProperties,
  getMultiSelectUpsertValues,
  getSimplifiedDatabaseProperties,
} from './database'

describe('getSimplifiedDatabaseProperties', () => {
  test('should handle title property', () => {
    const properties: DatabaseProperties = {
      Name: {
        id: 'title',
        type: 'title',
        name: 'Test Title',
      },
    } as any

    const result = getSimplifiedDatabaseProperties(properties)

    expect(result).toEqual({ Name: 'Test Title' })
  })

  test('should handle title property when null', () => {
    const properties: DatabaseProperties = {
      Name: {
        id: 'title',
        type: 'title',
        name: null,
      },
    } as any

    const result = getSimplifiedDatabaseProperties(properties)

    expect(result).toEqual({ Name: null })
  })

  test('should handle status property', () => {
    const properties: DatabaseProperties = {
      Status: {
        id: 'status',
        type: 'status',
        name: 'In Progress',
      },
    } as any

    const result = getSimplifiedDatabaseProperties(properties)

    expect(result).toEqual({ Status: 'In Progress' })
  })

  test('should handle rich_text property', () => {
    const properties: DatabaseProperties = {
      Description: {
        id: 'desc',
        type: 'rich_text',
        name: 'Text Description',
      },
    } as any

    const result = getSimplifiedDatabaseProperties(properties)

    expect(result).toEqual({ Description: 'Text Description' })
  })

  test('should handle number property', () => {
    const properties: DatabaseProperties = {
      Count: {
        id: 'count',
        type: 'number',
        number: 42,
      },
    } as any

    const result = getSimplifiedDatabaseProperties(properties)

    expect(result).toEqual({ Count: 42 })
  })

  test('should handle checkbox property', () => {
    const properties: DatabaseProperties = {
      Completed: {
        id: 'completed',
        type: 'checkbox',
        checkbox: true,
      },
    } as any

    const result = getSimplifiedDatabaseProperties(properties)

    expect(result).toEqual({ Completed: true })
  })

  test('should handle select property', () => {
    const properties: DatabaseProperties = {
      Category: {
        id: 'category',
        type: 'select',
        select: {
          options: [
            { name: 'Work', id: '1', color: 'blue' },
            { name: 'Personal', id: '2', color: 'green' },
          ],
        },
      },
    } as any

    const result = getSimplifiedDatabaseProperties(properties)

    expect(result).toEqual({ Category: ['Work', 'Personal'] })
  })

  test('should handle multi_select property', () => {
    const properties: DatabaseProperties = {
      Tags: {
        id: 'tags',
        type: 'multi_select',
        multi_select: {
          options: [
            { name: 'urgent', id: '1', color: 'red' },
            { name: 'bug', id: '2', color: 'orange' },
          ],
        },
      },
    } as any

    const result = getSimplifiedDatabaseProperties(properties)

    expect(result).toEqual({ Tags: ['urgent', 'bug'] })
  })

  test('should handle date property', () => {
    const properties: DatabaseProperties = {
      DueDate: {
        id: 'due',
        type: 'date',
        date: { start: '2023-01-01' },
      },
    } as any

    const result = getSimplifiedDatabaseProperties(properties)

    expect(result).toEqual({ DueDate: '2023-01-01' })
  })

  test('should handle date property when null', () => {
    const properties: DatabaseProperties = {
      DueDate: {
        id: 'due',
        type: 'date',
        date: null,
      },
    } as any

    const result = getSimplifiedDatabaseProperties(properties)

    expect(result).toEqual({ DueDate: null })
  })

  test('should handle url property', () => {
    const properties: DatabaseProperties = {
      Website: {
        id: 'website',
        type: 'url',
        url: 'https://example.com',
      },
    } as any

    const result = getSimplifiedDatabaseProperties(properties)

    expect(result).toEqual({ Website: 'https://example.com' })
  })

  test('should handle url property when null', () => {
    const properties: DatabaseProperties = {
      Website: {
        id: 'website',
        type: 'url',
        url: null,
      },
    } as any

    const result = getSimplifiedDatabaseProperties(properties)

    expect(result).toEqual({ Website: null })
  })

  test('should handle email property', () => {
    const properties: DatabaseProperties = {
      Email: {
        id: 'email',
        type: 'email',
        email: 'test@example.com',
      },
    } as any

    const result = getSimplifiedDatabaseProperties(properties)

    expect(result).toEqual({ Email: 'test@example.com' })
  })

  test('should handle phone_number property', () => {
    const properties: DatabaseProperties = {
      Phone: {
        id: 'phone',
        type: 'phone_number',
        phone_number: '123-456-7890',
      },
    } as any

    const result = getSimplifiedDatabaseProperties(properties)

    expect(result).toEqual({ Phone: '123-456-7890' })
  })

  test('should handle created_time property', () => {
    const timestamp = '2023-01-01T12:00:00Z'
    const properties: DatabaseProperties = {
      Created: {
        id: 'created',
        type: 'created_time',
        created_time: timestamp,
      },
    } as any

    const result = getSimplifiedDatabaseProperties(properties)

    expect(result).toEqual({ Created: timestamp })
  })

  test('should handle last_edited_time property', () => {
    const timestamp = '2023-01-01T12:00:00Z'
    const properties: DatabaseProperties = {
      LastEdited: {
        id: 'edited',
        type: 'last_edited_time',
        last_edited_time: timestamp,
      },
    } as any

    const result = getSimplifiedDatabaseProperties(properties)

    expect(result).toEqual({ LastEdited: timestamp })
  })

  test('should skip ignored property types', () => {
    const properties: DatabaseProperties = {
      UniqueID: {
        id: 'uid',
        type: 'unique_id',
        unique_id: { number: 123 },
      },
      Formula: {
        id: 'formula',
        type: 'formula',
        formula: { string: 'result' },
      },
      Rollup: {
        id: 'rollup',
        type: 'rollup',
        rollup: { number: 42 },
      },
      Relation: {
        id: 'relation',
        type: 'relation',
        relation: {},
      },
      People: {
        id: 'people',
        type: 'people',
        people: {},
      },
      Files: {
        id: 'files',
        type: 'files',
        files: [],
      },
      CreatedBy: {
        id: 'created_by',
        type: 'created_by',
        created_by: {},
      },
      LastEditedBy: {
        id: 'last_edited_by',
        type: 'last_edited_by',
        last_edited_by: {},
      },
      Name: {
        id: 'title',
        type: 'title',
        name: 'Test',
      },
    } as any

    const result = getSimplifiedDatabaseProperties(properties)

    expect(result).toEqual({ Name: 'Test' })
  })

  test('should handle multiple properties', () => {
    const properties: DatabaseProperties = {
      Name: {
        id: 'title',
        type: 'title',
        name: 'Test Database',
      },
      Done: {
        id: 'done',
        type: 'checkbox',
        checkbox: false,
      },
      Priority: {
        id: 'priority',
        type: 'select',
        select: {
          options: [
            { name: 'High', id: '1', color: 'red' },
            { name: 'Medium', id: '2', color: 'yellow' },
            { name: 'Low', id: '3', color: 'green' },
          ],
        },
      },
    } as any

    const result = getSimplifiedDatabaseProperties(properties)

    expect(result).toEqual({
      Name: 'Test Database',
      Done: false,
      Priority: ['High', 'Medium', 'Low'],
    })
  })
})

describe('getMultiSelectUpsertValues', () => {
  test('should return array of trimmed strings from array input', () => {
    const input = ['foo', 'bar', 'baz']
    const result = getMultiSelectUpsertValues(input)

    expect(result).toEqual(['foo', 'bar', 'baz'])
  })

  test('should split comma-separated strings in array input', () => {
    const input = ['foo, bar', 'baz']
    const result = getMultiSelectUpsertValues(input)

    expect(result).toEqual(['foo', 'bar', 'baz'])
  })

  test('should trim whitespace from each value in array input', () => {
    const input = ['  foo  ', ' bar ', 'baz']
    const result = getMultiSelectUpsertValues(input)

    expect(result).toEqual(['foo', 'bar', 'baz'])
  })

  test('should filter out empty strings in array input', () => {
    const input = ['foo', '', '  ', 'bar']
    const result = getMultiSelectUpsertValues(input)

    expect(result).toEqual(['foo', 'bar'])
  })

  test('should ignore non-string values in array input', () => {
    const input = ['foo', 123 as any, null as any, 'bar']
    const result = getMultiSelectUpsertValues(input)

    expect(result).toEqual(['foo', 'bar'])
  })

  test('should return array of trimmed strings from comma-separated string input', () => {
    const input = 'foo, bar, baz'
    const result = getMultiSelectUpsertValues(input)

    expect(result).toEqual(['foo', 'bar', 'baz'])
  })

  test('should handle single string input', () => {
    const input = 'foo'
    const result = getMultiSelectUpsertValues(input)

    expect(result).toEqual(['foo'])
  })

  test('should trim whitespace from string input', () => {
    const input = '  foo  ,  bar ,baz '
    const result = getMultiSelectUpsertValues(input)

    expect(result).toEqual(['foo', 'bar', 'baz'])
  })

  test('should filter out empty strings in string input', () => {
    const input = 'foo, , ,bar'
    const result = getMultiSelectUpsertValues(input)

    expect(result).toEqual(['foo', 'bar'])
  })

  test('should return empty array for non-string, non-array input', () => {
    expect(getMultiSelectUpsertValues(123)).toEqual([])
    expect(getMultiSelectUpsertValues(null)).toEqual([])
    expect(getMultiSelectUpsertValues(undefined)).toEqual([])
    expect(getMultiSelectUpsertValues({})).toEqual([])
  })

  test('should handle String object input', () => {
    const input = new String('foo,bar') as any
    const result = getMultiSelectUpsertValues(input)

    expect(result).toEqual(['foo', 'bar'])
  })

  test('should handle array with String objects', () => {
    const input = [new String('foo, bar'), 'baz'] as any
    const result = getMultiSelectUpsertValues(input)

    expect(result).toEqual(['foo', 'bar', 'baz'])
  })
})

describe('convertDatabaseCreatePropertiesFromKnownProperties', () => {
  test('should truncate rich_text content exceeding 2000 characters', () => {
    const knownDatabaseProperties = {
      Description: {
        format: 'rich_text' as const,
        type: 'string' as const,
      },
    }

    const longContent = 'a'.repeat(2060)

    const result = convertDatabaseCreatePropertiesFromKnownProperties({
      knownDatabaseProperties,
      properties: { Description: longContent },
    })

    const richText = result.properties.Description as {
      rich_text: { text: { content: string } }[]
    }

    expect(richText.rich_text[0].text.content.length).toBeLessThanOrEqual(2000)
    expect(richText.rich_text[0].text.content).toBe('a'.repeat(2000))
  })

  test('should truncate title content exceeding 2000 characters', () => {
    const knownDatabaseProperties = {
      Name: {
        format: 'title' as const,
        type: 'string' as const,
      },
    }

    const longContent = 'b'.repeat(2050)

    const result = convertDatabaseCreatePropertiesFromKnownProperties({
      knownDatabaseProperties,
      properties: { Name: longContent },
    })

    const title = result.properties.Name as {
      title: { text: { content: string } }[]
    }

    expect(title.title[0].text.content.length).toBeLessThanOrEqual(2000)
    expect(title.title[0].text.content).toBe('b'.repeat(2000))
  })

  test('should not truncate rich_text content within 2000 characters', () => {
    const knownDatabaseProperties = {
      Description: {
        format: 'rich_text' as const,
        type: 'string' as const,
      },
    }

    const normalContent = 'Hello world'

    const result = convertDatabaseCreatePropertiesFromKnownProperties({
      knownDatabaseProperties,
      properties: { Description: normalContent },
    })

    const richText = result.properties.Description as {
      rich_text: { text: { content: string } }[]
    }

    expect(richText.rich_text[0].text.content).toBe('Hello world')
  })

  test('should handle email property with empty string', () => {
    const knownDatabaseProperties = {
      Email: {
        format: 'email' as const,
        type: 'string' as const,
        description: 'Valid email address',
      },
    }

    const properties = {
      Email: '',
    }

    const result = convertDatabaseCreatePropertiesFromKnownProperties({
      knownDatabaseProperties,
      properties,
    })

    // @note Notion API requires email to be null, not empty string
    expect(result.properties.Email).toEqual({ email: null })
  })

  test('should handle email property with valid email', () => {
    const knownDatabaseProperties = {
      Email: {
        format: 'email' as const,
        type: 'string' as const,
        description: 'Valid email address',
      },
    }

    const properties = {
      Email: 'test@example.com',
    }

    const result = convertDatabaseCreatePropertiesFromKnownProperties({
      knownDatabaseProperties,
      properties,
    })

    expect(result.properties.Email).toEqual({ email: 'test@example.com' })
  })

  test('should handle url property with empty string', () => {
    const knownDatabaseProperties = {
      Website: {
        format: 'url' as const,
        type: 'string' as const,
        description: 'Valid URL',
      },
    }

    const properties = {
      Website: '',
    }

    const result = convertDatabaseCreatePropertiesFromKnownProperties({
      knownDatabaseProperties,
      properties,
    })

    // @note Notion API requires url to be null, not empty string
    expect(result.properties.Website).toEqual({ url: null })
  })

  test('should handle phone_number property with empty string', () => {
    const knownDatabaseProperties = {
      Phone: {
        format: 'phone_number' as const,
        type: 'string' as const,
        description: 'Valid phone number',
      },
    }

    const properties = {
      Phone: '',
    }

    const result = convertDatabaseCreatePropertiesFromKnownProperties({
      knownDatabaseProperties,
      properties,
    })

    // @note Notion API requires phone_number to be null, not empty string
    expect(result.properties.Phone).toEqual({ phone_number: null })
  })
})
