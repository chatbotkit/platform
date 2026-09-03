/* eslint-disable @typescript-eslint/no-explicit-any */
import type { TrimmedNonEmptyString } from '@chatbotkit-dev/typescript-utils'

import { jest } from '@jest/globals'

jest.unstable_mockModule('./client', () => ({
  getClient: jest.fn(),
}))

jest.unstable_mockModule('./database', () => ({
  introspectDatabaseProperties: jest.fn(),
  convertDatabaseItemFilter: jest.fn(),
  convertDatabaseCreateProperties: jest.fn(),
  convertDatabaseUpdateProperties: jest.fn(),
  getSimplifiedDatabaseProperties: jest.fn(),
}))

jest.unstable_mockModule('./page', () => ({
  getSimplifiedPageProperties: jest.fn(),
}))

const { getClient } = await import('./client')
const {
  introspectDatabaseProperties,
  convertDatabaseItemFilter,
  convertDatabaseCreateProperties,
  convertDatabaseUpdateProperties,
} = await import('./database')
const { getSimplifiedPageProperties } = await import('./page')
const { UnsupportedPropertiesError } = await import('./errors')
const { DatabaseDriver } = await import('./sql')

const TOKEN = 'test_token' as TrimmedNonEmptyString
const DATABASE_ID = 'test_database_id' as TrimmedNonEmptyString

const mockedGetClient = getClient as jest.MockedFunction<typeof getClient>
const mockedIntrospect = introspectDatabaseProperties as jest.MockedFunction<
  typeof introspectDatabaseProperties
>
const mockedConvertFilter = convertDatabaseItemFilter as jest.MockedFunction<
  typeof convertDatabaseItemFilter
>
const mockedConvertCreate =
  convertDatabaseCreateProperties as jest.MockedFunction<
    typeof convertDatabaseCreateProperties
  >
const mockedConvertUpdate =
  convertDatabaseUpdateProperties as jest.MockedFunction<
    typeof convertDatabaseUpdateProperties
  >
const mockedGetSimplifiedPage =
  getSimplifiedPageProperties as jest.MockedFunction<
    typeof getSimplifiedPageProperties
  >

describe('DatabaseDriver', () => {
  let mockClient: any

  beforeEach(() => {
    jest.clearAllMocks()

    mockClient = {
      pages: {
        retrieve: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      databases: {
        query: jest.fn(),
      },
    }

    mockedGetClient.mockReturnValue(mockClient)
  })

  describe('describeColumns', () => {
    it('should return id column plus introspected database columns', async () => {
      mockedIntrospect.mockResolvedValue({
        Name: { type: 'string', format: 'title', enum: undefined },
        Status: {
          type: 'string',
          format: 'select',
          enum: ['Active', 'Inactive'],
        },
      })

      const driver = new DatabaseDriver({
        token: TOKEN,
        databaseId: DATABASE_ID,
      })

      const columns = await driver.describeColumns()

      expect(columns).toEqual([
        { name: 'id', type: 'string' },
        { name: 'Name', type: 'string', options: undefined },
        { name: 'Status', type: 'string', options: ['Active', 'Inactive'] },
      ])

      expect(introspectDatabaseProperties).toHaveBeenCalledWith({
        auth: TOKEN,
        databaseId: DATABASE_ID,
      })
    })
  })

  describe('doSelect', () => {
    it('should query by page id when id is in where clause', async () => {
      const mockPage = {
        id: 'page_123',
        object: 'page',
        properties: {
          Name: { type: 'title', title: [{ plain_text: 'Test' }] },
        },
        url: 'https://notion.so/test',
      }

      mockClient.pages.retrieve.mockResolvedValue(mockPage)
      mockedGetSimplifiedPage.mockReturnValue({ Name: 'Test' } as any)

      const driver = new DatabaseDriver({
        token: TOKEN,
        databaseId: DATABASE_ID,
      })

      const results = await driver.doSelect([], {
        or: [
          {
            and: [
              {
                column: 'id',
                operator: 'EQ',
                criteria: { type: 'string', value: 'page_123' },
              },
            ],
          },
        ],
      })

      expect(mockClient.pages.retrieve).toHaveBeenCalledWith({
        page_id: 'page_123',
      })

      expect(results).toEqual([
        {
          row: { id: 'page_123', Name: 'Test' },
          url: 'https://notion.so/test',
        },
      ])
    })

    it('should query database using constructor databaseId, not where properties', async () => {
      mockedConvertFilter.mockResolvedValue({
        unsupported: [],
        filter: { property: 'Name', rich_text: { equals: 'John' } },
      })

      mockClient.databases.query.mockResolvedValue({
        results: [
          {
            object: 'page',
            properties: {},
            url: 'https://notion.so/test',
          },
        ],
      })

      mockedGetSimplifiedPage.mockReturnValue({ Name: 'John' } as any)

      const driver = new DatabaseDriver({
        token: TOKEN,
        databaseId: DATABASE_ID,
      })

      await driver.doSelect([], {
        or: [
          {
            and: [
              {
                column: 'Name',
                operator: 'EQ',
                criteria: { type: 'string', value: 'John' },
              },
            ],
          },
        ],
      })

      expect(mockClient.databases.query).toHaveBeenCalledWith(
        expect.objectContaining({
          database_id: DATABASE_ID,
        })
      )
    })

    it('should not use database_id from where properties', async () => {
      mockedConvertFilter.mockResolvedValue({
        unsupported: [],
        filter: undefined,
      })

      mockClient.databases.query.mockResolvedValue({ results: [] })

      const driver = new DatabaseDriver({
        token: TOKEN,
        databaseId: DATABASE_ID,
      })

      await driver.doSelect([], {
        or: [
          {
            and: [
              {
                column: 'database_id',
                operator: 'EQ',
                criteria: { type: 'string', value: 'some_other_database' },
              },
            ],
          },
        ],
      })

      const callArg = mockClient.databases.query.mock.calls[0][0]

      expect(callArg.database_id).toBe(DATABASE_ID)
      expect(callArg.database_id).not.toBe('some_other_database')
    })

    it('should throw when unsupported properties are present in filter', async () => {
      mockedConvertFilter.mockResolvedValue({
        unsupported: ['unknownField'],
        filter: undefined,
      })

      const driver = new DatabaseDriver({
        token: TOKEN,
        databaseId: DATABASE_ID,
      })

      await expect(
        driver.doSelect([], {
          or: [
            {
              and: [
                {
                  column: 'unknownField',
                  operator: 'EQ',
                  criteria: { type: 'string', value: 'x' },
                },
              ],
            },
          ],
        })
      ).rejects.toThrow('Unsupported properties: unknownField')
    })

    it('should return empty array when database query returns no results', async () => {
      mockedConvertFilter.mockResolvedValue({
        unsupported: [],
        filter: undefined,
      })

      mockClient.databases.query.mockResolvedValue({ results: [] })

      const driver = new DatabaseDriver({
        token: TOKEN,
        databaseId: DATABASE_ID,
      })

      const results = await driver.doSelect([])

      expect(results).toEqual([])
    })
  })

  describe('doInsert', () => {
    it('should create a page in the correct database', async () => {
      mockedConvertCreate.mockResolvedValue({
        unsupported: [],
        properties: { Name: { title: [{ text: { content: 'New Item' } }] } },
      })

      mockClient.pages.create.mockResolvedValue({})

      const driver = new DatabaseDriver({
        token: TOKEN,
        databaseId: DATABASE_ID,
      })

      await driver.doInsert({ Name: 'New Item' })

      expect(mockClient.pages.create).toHaveBeenCalledWith({
        parent: { database_id: DATABASE_ID },
        properties: { Name: { title: [{ text: { content: 'New Item' } }] } },
      })
    })

    it('should throw when insert has unsupported properties', async () => {
      mockedConvertCreate.mockResolvedValue({
        unsupported: ['unknownProp'],
        properties: {},
      })

      const driver = new DatabaseDriver({
        token: TOKEN,
        databaseId: DATABASE_ID,
      })

      await expect(driver.doInsert({ unknownProp: 'value' })).rejects.toThrow(
        'Unsupported properties: unknownProp'
      )

      await expect(
        driver.doInsert({ unknownProp: 'value' })
      ).rejects.toBeInstanceOf(UnsupportedPropertiesError)
    })
  })

  describe('doUpdate', () => {
    it('should update a page using the row id', async () => {
      mockedConvertUpdate.mockResolvedValue({
        unsupported: [],
        properties: { Status: { select: { name: 'Done' } } },
      })

      mockClient.pages.update.mockResolvedValue({})

      const driver = new DatabaseDriver({
        token: TOKEN,
        databaseId: DATABASE_ID,
      })

      await driver.doUpdate({ row: { id: 'page_456' } }, { Status: 'Done' })

      expect(mockClient.pages.update).toHaveBeenCalledWith({
        page_id: 'page_456',
        properties: { Status: { select: { name: 'Done' } } },
      })
    })

    it('should throw when row id is missing', async () => {
      const driver = new DatabaseDriver({
        token: TOKEN,
        databaseId: DATABASE_ID,
      })

      await expect(
        driver.doUpdate({ row: {} }, { Status: 'Done' })
      ).rejects.toThrow('Cannot update row: missing id')
    })

    it('should throw when update has unsupported properties', async () => {
      mockedConvertUpdate.mockResolvedValue({
        unsupported: ['unknownProp'],
        properties: {},
      })

      const driver = new DatabaseDriver({
        token: TOKEN,
        databaseId: DATABASE_ID,
      })

      await expect(
        driver.doUpdate({ row: { id: 'page_456' } }, { unknownProp: 'value' })
      ).rejects.toThrow('Unsupported properties: unknownProp')
    })
  })

  describe('doDelete', () => {
    it('should archive a page using the row id', async () => {
      mockClient.pages.update.mockResolvedValue({})

      const driver = new DatabaseDriver({
        token: TOKEN,
        databaseId: DATABASE_ID,
      })

      await driver.doDelete({ row: { id: 'page_789' } })

      expect(mockClient.pages.update).toHaveBeenCalledWith({
        page_id: 'page_789',
        archived: true,
      })
    })

    it('should throw when row id is missing', async () => {
      const driver = new DatabaseDriver({
        token: TOKEN,
        databaseId: DATABASE_ID,
      })

      await expect(driver.doDelete({ row: {} })).rejects.toThrow(
        'Cannot delete row: missing id'
      )
    })
  })
})
