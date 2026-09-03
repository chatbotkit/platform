import makeHandler, { makeHandler2 } from './auxiliary.sql'

jest.mock('@chatbotkit-dev/sql/parse', () => ({
  parseSingle: jest.fn(),
  getTableName: jest.fn(),
}))

jest.mock('@/lib/auxiliary.handler', () => ({
  authenticatedHandler: jest.fn(
    // @note every auxiliary route is authenticated; bind a mock session so
    // the tests keep calling the inner function as (parameters, headers)
    (schema, fn) => (parameters, headers) =>
      fn({ user: { id: 'test-user-id' } }, parameters, headers)
  ),
}))

jest.mock('@/lib/error', () => ({
  UserInputError: class UserInputError extends Error {
    constructor(message) {
      super(message)
      this.name = 'UserInputError'
    }
  },
}))

jest.mock('pluralize', () => jest.fn((str) => str))

describe('auxiliary.sql', () => {
  let mockParseSingle
  let mockGetTableName
  let mockPluralize
  let mockDriver

  beforeEach(() => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    mockParseSingle = require('@chatbotkit-dev/sql/parse').parseSingle
    mockGetTableName = require('@chatbotkit-dev/sql/parse').getTableName
    mockPluralize = require('pluralize')

    jest.clearAllMocks()

    mockDriver = {
      describe: jest.fn().mockResolvedValue({ columns: [] }),
      select: jest.fn().mockResolvedValue({ rows: [] }),
      insert: jest.fn().mockResolvedValue({ insertedId: 1 }),
      update: jest.fn().mockResolvedValue({ updated: 1 }),
      delete: jest.fn().mockResolvedValue({ deleted: 1 }),
    }

    mockGetTableName.mockReturnValue('users')
    mockPluralize.mockImplementation((str, count) =>
      count === 1 ? str.replace(/s$/, '') : str
    )
    /* eslint-enable @typescript-eslint/no-require-imports */
  })

  describe('makeHandler', () => {
    it('should handle SHOW TABLES query', async () => {
      const schema = {}
      const tables = [
        { database: 'db1', name: 'users' },
        { database: 'db2', name: 'posts' },
      ]
      const getDriver = jest.fn().mockResolvedValue(mockDriver)

      mockParseSingle.mockReturnValue({
        type: 'show',
        table: { name: 'tables' },
      })

      const handlerFn = makeHandler(schema, tables, getDriver)
      const result = await handlerFn({ sql: 'SHOW TABLES' }, new Headers())

      expect(result).toEqual({
        sql: 'SHOW TABLES',
        result: [
          {
            DATABASE_NAME: 'db1',
            TABLE_NAME: 'users',
            FULL_NAME: 'db1.users',
          },
          {
            DATABASE_NAME: 'db2',
            TABLE_NAME: 'posts',
            FULL_NAME: 'db2.posts',
          },
        ],
      })
    })

    it('should handle SHOW for unknown table', async () => {
      const schema = {}
      const tables = []
      const getDriver = jest.fn().mockResolvedValue(mockDriver)

      mockParseSingle.mockReturnValue({
        type: 'show',
        table: { name: 'unknown' },
      })
      mockGetTableName.mockReturnValue('unknown')

      const handlerFn = makeHandler(schema, tables, getDriver)

      await expect(
        handlerFn({ sql: 'SHOW UNKNOWN' }, new Headers())
      ).rejects.toThrow('Unknown table unknown')
    })

    it('should handle DESCRIBE query', async () => {
      const schema = {}
      const tables = [{ name: 'users' }]
      const getDriver = jest.fn().mockResolvedValue(mockDriver)

      mockParseSingle.mockReturnValue({
        type: 'describe',
        table: { name: 'users' },
      })

      const handlerFn = makeHandler(schema, tables, getDriver)
      const result = await handlerFn({ sql: 'DESCRIBE users' }, new Headers())

      expect(mockDriver.describe).toHaveBeenCalledWith({
        type: 'describe',
        table: { name: 'users' },
      })
      expect(result.result).toEqual({ columns: [] })
    })

    it('should handle SELECT query', async () => {
      const schema = {}
      const tables = [{ name: 'users' }]
      const getDriver = jest.fn().mockResolvedValue(mockDriver)

      mockParseSingle.mockReturnValue({
        type: 'select',
        table: { name: 'users' },
      })

      const handlerFn = makeHandler(schema, tables, getDriver)
      const result = await handlerFn(
        { sql: 'SELECT * FROM users' },
        new Headers()
      )

      expect(mockDriver.select).toHaveBeenCalled()
      expect(result.result).toEqual({ rows: [] })
    })

    it('should handle INSERT query', async () => {
      const schema = {}
      const tables = [{ name: 'users' }]
      const getDriver = jest.fn().mockResolvedValue(mockDriver)

      mockParseSingle.mockReturnValue({
        type: 'insert',
        table: { name: 'users' },
      })

      const handlerFn = makeHandler(schema, tables, getDriver)
      const result = await handlerFn(
        { sql: "INSERT INTO users VALUES ('test')" },
        new Headers()
      )

      expect(mockDriver.insert).toHaveBeenCalled()
      expect(result.result).toEqual({ insertedId: 1 })
    })

    it('should handle UPDATE query', async () => {
      const schema = {}
      const tables = [{ name: 'users' }]
      const getDriver = jest.fn().mockResolvedValue(mockDriver)

      mockParseSingle.mockReturnValue({
        type: 'update',
        table: { name: 'users' },
      })

      const handlerFn = makeHandler(schema, tables, getDriver)
      const result = await handlerFn(
        { sql: 'UPDATE users SET name = "test"' },
        new Headers()
      )

      expect(mockDriver.update).toHaveBeenCalled()
      expect(result.result).toEqual({ updated: 1 })
    })

    it('should handle DELETE query', async () => {
      const schema = {}
      const tables = [{ name: 'users' }]
      const getDriver = jest.fn().mockResolvedValue(mockDriver)

      mockParseSingle.mockReturnValue({
        type: 'delete',
        table: { name: 'users' },
      })

      const handlerFn = makeHandler(schema, tables, getDriver)
      const result = await handlerFn(
        { sql: 'DELETE FROM users WHERE id = 1' },
        new Headers()
      )

      expect(mockDriver.delete).toHaveBeenCalled()
      expect(result.result).toEqual({ deleted: 1 })
    })

    it('should throw UserInputError on parse failure', async () => {
      const schema = {}
      const tables = []
      const getDriver = jest.fn().mockResolvedValue(mockDriver)

      mockParseSingle.mockImplementation(() => {
        throw new Error('Invalid SQL syntax')
      })

      const handlerFn = makeHandler(schema, tables, getDriver)

      await expect(
        handlerFn({ sql: 'INVALID SQL' }, new Headers())
      ).rejects.toThrow('Invalid SQL syntax')
    })

    it('should pass parameters and headers to getDriver', async () => {
      const schema = {}
      const tables = [{ name: 'users' }]
      const getDriver = jest.fn().mockResolvedValue(mockDriver)
      const headers = new Headers({ 'X-Custom': 'value' })

      mockParseSingle.mockReturnValue({
        type: 'select',
        table: { name: 'users' },
      })

      const handlerFn = makeHandler(schema, tables, getDriver)

      await handlerFn({ sql: 'SELECT * FROM users' }, headers)

      expect(getDriver).toHaveBeenCalledWith(
        { name: 'users' },
        { sql: 'SELECT * FROM users' },
        headers
      )
    })
  })

  describe('makeHandler2', () => {
    it('should handle SHOW TABLES query', async () => {
      const schema = {}
      const tables = [
        {
          database: 'db1',
          name: 'users',
          getDriver: jest.fn().mockResolvedValue(mockDriver),
        },
        {
          database: 'db2',
          name: 'posts',
          getDriver: jest.fn().mockResolvedValue(mockDriver),
        },
      ]

      mockParseSingle.mockReturnValue({
        type: 'show',
        table: { name: 'tables' },
      })

      const handlerFn = makeHandler2(schema, tables)
      const result = await handlerFn({ sql: 'SHOW TABLES' }, new Headers())

      expect(result).toEqual({
        sql: 'SHOW TABLES',
        result: [
          {
            DATABASE_NAME: 'db1',
            TABLE_NAME: 'users',
            FULL_NAME: 'db1.users',
          },
          {
            DATABASE_NAME: 'db2',
            TABLE_NAME: 'posts',
            FULL_NAME: 'db2.posts',
          },
        ],
      })
    })

    it('should find table by singular name', async () => {
      const schema = {}
      const tables = [
        {
          name: 'users',
          getDriver: jest.fn().mockResolvedValue(mockDriver),
        },
      ]

      mockGetTableName.mockReturnValue('user')
      mockPluralize.mockImplementation((str, count) => {
        if (count === 1) {
          return 'user'
        }

        return 'users'
      })

      mockParseSingle.mockReturnValue({
        type: 'select',
        table: { name: 'user' },
      })

      const handlerFn = makeHandler2(schema, tables)
      const result = await handlerFn(
        { sql: 'SELECT * FROM user' },
        new Headers()
      )

      expect(result.result).toEqual({ rows: [] })
    })

    it('should throw error for unknown table', async () => {
      const schema = {}
      const tables = [
        {
          name: 'users',
          getDriver: jest.fn().mockResolvedValue(mockDriver),
        },
      ]

      mockGetTableName.mockImplementation((table) => table.name)
      mockPluralize.mockImplementation((str) => str)

      mockParseSingle.mockReturnValue({
        type: 'select',
        table: { name: 'unknown' },
      })

      const handlerFn = makeHandler2(schema, tables)

      await expect(
        handlerFn({ sql: 'SELECT * FROM unknown' }, new Headers())
      ).rejects.toThrow('Unknown table unknown - available tables: users')
    })

    it('should handle DESCRIBE query', async () => {
      const schema = {}
      const tables = [
        {
          name: 'users',
          getDriver: jest.fn().mockResolvedValue(mockDriver),
        },
      ]

      mockParseSingle.mockReturnValue({
        type: 'describe',
        table: { name: 'users' },
      })

      const handlerFn = makeHandler2(schema, tables)
      const result = await handlerFn({ sql: 'DESCRIBE users' }, new Headers())

      expect(mockDriver.describe).toHaveBeenCalled()
      expect(result.result).toEqual({ columns: [] })
    })

    it('should handle INSERT query', async () => {
      const schema = {}
      const tables = [
        {
          name: 'users',
          getDriver: jest.fn().mockResolvedValue(mockDriver),
        },
      ]

      mockParseSingle.mockReturnValue({
        type: 'insert',
        table: { name: 'users' },
      })

      const handlerFn = makeHandler2(schema, tables)
      const result = await handlerFn(
        { sql: "INSERT INTO users VALUES ('test')" },
        new Headers()
      )

      expect(mockDriver.insert).toHaveBeenCalled()
      expect(result.result).toEqual({ insertedId: 1 })
    })

    it('should handle UPDATE query', async () => {
      const schema = {}
      const tables = [
        {
          name: 'users',
          getDriver: jest.fn().mockResolvedValue(mockDriver),
        },
      ]

      mockParseSingle.mockReturnValue({
        type: 'update',
        table: { name: 'users' },
      })

      const handlerFn = makeHandler2(schema, tables)
      const result = await handlerFn(
        { sql: 'UPDATE users SET name = "test"' },
        new Headers()
      )

      expect(mockDriver.update).toHaveBeenCalled()
      expect(result.result).toEqual({ updated: 1 })
    })

    it('should handle DELETE query', async () => {
      const schema = {}
      const tables = [
        {
          name: 'users',
          getDriver: jest.fn().mockResolvedValue(mockDriver),
        },
      ]

      mockParseSingle.mockReturnValue({
        type: 'delete',
        table: { name: 'users' },
      })

      const handlerFn = makeHandler2(schema, tables)
      const result = await handlerFn(
        { sql: 'DELETE FROM users WHERE id = 1' },
        new Headers()
      )

      expect(mockDriver.delete).toHaveBeenCalled()
      expect(result.result).toEqual({ deleted: 1 })
    })

    it('should throw UserInputError on parse failure', async () => {
      const schema = {}
      const tables = [
        {
          name: 'users',
          getDriver: jest.fn().mockResolvedValue(mockDriver),
        },
      ]

      mockParseSingle.mockImplementation(() => {
        throw new Error('Invalid SQL syntax')
      })

      const handlerFn = makeHandler2(schema, tables)

      await expect(
        handlerFn({ sql: 'INVALID SQL' }, new Headers())
      ).rejects.toThrow('Invalid SQL syntax')
    })

    it('should pass parameters and headers to table getDriver', async () => {
      const schema = {}
      const getDriverMock = jest.fn().mockResolvedValue(mockDriver)
      const tables = [
        {
          name: 'users',
          getDriver: getDriverMock,
        },
      ]
      const headers = new Headers({ 'X-Custom': 'value' })

      mockParseSingle.mockReturnValue({
        type: 'select',
        table: { name: 'users' },
      })

      const handlerFn = makeHandler2(schema, tables)

      await handlerFn({ sql: 'SELECT * FROM users' }, headers)

      expect(getDriverMock).toHaveBeenCalledWith(
        { sql: 'SELECT * FROM users' },
        headers
      )
    })
  })
})
