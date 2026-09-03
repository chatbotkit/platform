/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PageProperties} from './page';
import { getSimplifiedPageProperties } from './page'

describe('getSimplifiedPageProperties', () => {
  test('should handle title property', () => {
    const properties: PageProperties = {
      Title: {
        id: 'title',
        type: 'title',
        title: [
          { plain_text: 'Hello', type: 'text', annotations: {}, href: null },
        ],
      },
    } as any

    const result = getSimplifiedPageProperties(properties)

    expect(result).toEqual({ Title: 'Hello' })
  })

  test('should handle status property', () => {
    const properties: PageProperties = {
      Status: {
        id: 'status',
        type: 'status',
        status: { name: 'Done', color: 'green', id: '1' },
      },
    } as any

    const result = getSimplifiedPageProperties(properties)

    expect(result).toEqual({ Status: 'Done' })
  })

  test('should handle status property when null', () => {
    const properties: PageProperties = {
      Status: {
        id: 'status',
        type: 'status',
        status: null,
      },
    } as any

    const result = getSimplifiedPageProperties(properties)

    expect(result).toEqual({ Status: null })
  })

  test('should handle rich_text property', () => {
    const properties: PageProperties = {
      Description: {
        id: 'desc',
        type: 'rich_text',
        rich_text: [
          { plain_text: 'Hello', type: 'text', annotations: {}, href: null },
          { plain_text: 'World', type: 'text', annotations: {}, href: null },
        ],
      },
    } as any

    const result = getSimplifiedPageProperties(properties)

    expect(result).toEqual({ Description: 'Hello World' })
  })

  test('should handle number property', () => {
    const properties: PageProperties = {
      Count: {
        id: 'count',
        type: 'number',
        number: 42,
      },
    } as any

    const result = getSimplifiedPageProperties(properties)

    expect(result).toEqual({ Count: 42 })
  })

  test('should handle checkbox property', () => {
    const properties: PageProperties = {
      Completed: {
        id: 'completed',
        type: 'checkbox',
        checkbox: true,
      },
    } as any

    const result = getSimplifiedPageProperties(properties)

    expect(result).toEqual({ Completed: true })
  })

  test('should handle select property', () => {
    const properties: PageProperties = {
      Category: {
        id: 'category',
        type: 'select',
        select: { name: 'Work', color: 'blue', id: '1' },
      },
    } as any

    const result = getSimplifiedPageProperties(properties)

    expect(result).toEqual({ Category: 'Work' })
  })

  test('should handle select property when null', () => {
    const properties: PageProperties = {
      Category: {
        id: 'category',
        type: 'select',
        select: null,
      },
    } as any

    const result = getSimplifiedPageProperties(properties)

    expect(result).toEqual({ Category: null })
  })

  test('should handle multi_select property', () => {
    const properties: PageProperties = {
      Tags: {
        id: 'tags',
        type: 'multi_select',
        multi_select: [
          { name: 'urgent', color: 'red', id: '1' },
          { name: 'bug', color: 'orange', id: '2' },
        ],
      },
    } as any

    const result = getSimplifiedPageProperties(properties)

    expect(result).toEqual({ Tags: ['urgent', 'bug'] })
  })

  test('should handle date property', () => {
    const properties: PageProperties = {
      DueDate: {
        id: 'due',
        type: 'date',
        date: { start: '2023-01-01', end: null, time_zone: null },
      },
    } as any

    const result = getSimplifiedPageProperties(properties)

    expect(result).toEqual({ DueDate: '2023-01-01' })
  })

  test('should handle date property when null', () => {
    const properties: PageProperties = {
      DueDate: {
        id: 'due',
        type: 'date',
        date: null,
      },
    } as any

    const result = getSimplifiedPageProperties(properties)

    expect(result).toEqual({ DueDate: null })
  })

  test('should handle url property', () => {
    const properties: PageProperties = {
      Website: {
        id: 'website',
        type: 'url',
        url: 'https://example.com',
      },
    } as any

    const result = getSimplifiedPageProperties(properties)

    expect(result).toEqual({ Website: 'https://example.com' })
  })

  test('should handle url property when null', () => {
    const properties: PageProperties = {
      Website: {
        id: 'website',
        type: 'url',
        url: null,
      },
    } as any

    const result = getSimplifiedPageProperties(properties)

    expect(result).toEqual({ Website: null })
  })

  test('should handle email property', () => {
    const properties: PageProperties = {
      Email: {
        id: 'email',
        type: 'email',
        email: 'test@example.com',
      },
    } as any

    const result = getSimplifiedPageProperties(properties)

    expect(result).toEqual({ Email: 'test@example.com' })
  })

  test('should handle phone_number property', () => {
    const properties: PageProperties = {
      Phone: {
        id: 'phone',
        type: 'phone_number',
        phone_number: '123-456-7890',
      },
    } as any

    const result = getSimplifiedPageProperties(properties)

    expect(result).toEqual({ Phone: '123-456-7890' })
  })

  test('should handle created_time property', () => {
    const timestamp = '2023-01-01T12:00:00Z'
    const properties: PageProperties = {
      Created: {
        id: 'created',
        type: 'created_time',
        created_time: timestamp,
      },
    } as any

    const result = getSimplifiedPageProperties(properties)

    expect(result).toEqual({ Created: timestamp })
  })

  test('should handle last_edited_time property', () => {
    const timestamp = '2023-01-01T12:00:00Z'
    const properties: PageProperties = {
      LastEdited: {
        id: 'edited',
        type: 'last_edited_time',
        last_edited_time: timestamp,
      },
    } as any

    const result = getSimplifiedPageProperties(properties)

    expect(result).toEqual({ LastEdited: timestamp })
  })

  test('should skip ignored property types', () => {
    const properties: PageProperties = {
      UniqueID: {
        id: 'uid',
        type: 'unique_id',
        unique_id: { number: 123, prefix: null },
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
      Name: {
        id: 'title',
        type: 'title',
        title: [
          { plain_text: 'Test', type: 'text', annotations: {}, href: null },
        ],
      },
    } as any

    const result = getSimplifiedPageProperties(properties)

    expect(result).toEqual({ Name: 'Test' })
  })

  test('should handle multiple properties', () => {
    const properties: PageProperties = {
      Name: {
        id: 'title',
        type: 'title',
        title: [
          {
            plain_text: 'Test Task',
            type: 'text',
            annotations: {},
            href: null,
          },
        ],
      },
      Done: {
        id: 'done',
        type: 'checkbox',
        checkbox: false,
      },
      Priority: {
        id: 'priority',
        type: 'select',
        select: { name: 'High', color: 'red', id: '1' },
      },
    } as any

    const result = getSimplifiedPageProperties(properties)

    expect(result).toEqual({
      Name: 'Test Task',
      Done: false,
      Priority: 'High',
    })
  })
})
