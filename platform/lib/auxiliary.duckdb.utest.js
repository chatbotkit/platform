/**
 * @jest-environment node
 */
import {
  introspectDatabase,
  lockDownDuckDB,
  runReadOnlyDuckDBQuery,
} from './auxiliary.duckdb'

import { DuckDBInstance } from '@duckdb/node-api'

jest.mock('@/lib/error', () => ({
  captureException: jest.fn(),
}))

describe('auxiliary.duckdb', () => {
  describe('introspectDatabase', () => {
    let mockConnection

    beforeEach(() => {
      jest.clearAllMocks()

      mockConnection = {
        runAndReadAll: jest.fn(),
      }
    })

    describe('basic functionality', () => {
      it('should introspect a single table successfully', async () => {
        const mockResult = {
          getRowObjectsJson: jest.fn().mockReturnValue([
            { column_name: 'id', column_type: 'INTEGER', null: 'NO' },
            { column_name: 'name', column_type: 'VARCHAR', null: 'YES' },
          ]),
        }

        mockConnection.runAndReadAll.mockResolvedValue(mockResult)

        const result = await introspectDatabase(mockConnection, ['users'])

        expect(mockConnection.runAndReadAll).toHaveBeenCalledWith(
          'DESCRIBE "users"'
        )
        expect(result).toEqual({
          users: [
            { name: 'id', type: 'INTEGER', nullable: false },
            { name: 'name', type: 'VARCHAR', nullable: true },
          ],
        })
      })

      it('should introspect multiple tables', async () => {
        const mockResult1 = {
          getRowObjectsJson: jest.fn().mockReturnValue([
            { column_name: 'id', column_type: 'INTEGER', null: 'NO' },
          ]),
        }

        const mockResult2 = {
          getRowObjectsJson: jest.fn().mockReturnValue([
            { column_name: 'user_id', column_type: 'INTEGER', null: 'NO' },
            { column_name: 'content', column_type: 'TEXT', null: 'YES' },
          ]),
        }

        mockConnection.runAndReadAll
          .mockResolvedValueOnce(mockResult1)
          .mockResolvedValueOnce(mockResult2)

        const result = await introspectDatabase(mockConnection, [
          'users',
          'posts',
        ])

        expect(mockConnection.runAndReadAll).toHaveBeenCalledTimes(2)
        expect(result).toEqual({
          users: [{ name: 'id', type: 'INTEGER', nullable: false }],
          posts: [
            { name: 'user_id', type: 'INTEGER', nullable: false },
            { name: 'content', type: 'TEXT', nullable: true },
          ],
        })
      })

      it('should handle empty table list', async () => {
        const result = await introspectDatabase(mockConnection, [])

        expect(mockConnection.runAndReadAll).not.toHaveBeenCalled()
        expect(result).toEqual({})
      })
    })

    describe('column info handling', () => {
      it('should correctly map nullable columns', async () => {
        const mockResult = {
          getRowObjectsJson: jest.fn().mockReturnValue([
            { column_name: 'nullable_col', column_type: 'VARCHAR', null: 'YES' },
            {
              column_name: 'non_nullable_col',
              column_type: 'INTEGER',
              null: 'NO',
            },
          ]),
        }

        mockConnection.runAndReadAll.mockResolvedValue(mockResult)

        const result = await introspectDatabase(mockConnection, ['test_table'])

        expect(result.test_table).toEqual([
          { name: 'nullable_col', type: 'VARCHAR', nullable: true },
          { name: 'non_nullable_col', type: 'INTEGER', nullable: false },
        ])
      })

      it('should handle various column types', async () => {
        const mockResult = {
          getRowObjectsJson: jest.fn().mockReturnValue([
            { column_name: 'int_col', column_type: 'INTEGER', null: 'NO' },
            { column_name: 'text_col', column_type: 'TEXT', null: 'YES' },
            { column_name: 'bool_col', column_type: 'BOOLEAN', null: 'NO' },
            { column_name: 'date_col', column_type: 'DATE', null: 'YES' },
            { column_name: 'json_col', column_type: 'JSON', null: 'YES' },
          ]),
        }

        mockConnection.runAndReadAll.mockResolvedValue(mockResult)

        const result = await introspectDatabase(mockConnection, ['types_table'])

        expect(result.types_table).toHaveLength(5)
        expect(result.types_table.map((c) => c.type)).toEqual([
          'INTEGER',
          'TEXT',
          'BOOLEAN',
          'DATE',
          'JSON',
        ])
      })
    })

    describe('error handling', () => {
      it('should handle table not found error', async () => {
        const error = new Error('Table not found')

        mockConnection.runAndReadAll.mockRejectedValue(error)

        const result = await introspectDatabase(mockConnection, [
          'nonexistent_table',
        ])

        expect(result).toEqual({
          nonexistent_table: {
            error: 'Could not describe table: Table not found',
          },
        })
      })

      it('should continue processing after table error', async () => {
        const mockResult = {
          getRowObjectsJson: jest.fn().mockReturnValue([
            { column_name: 'id', column_type: 'INTEGER', null: 'NO' },
          ]),
        }

        mockConnection.runAndReadAll
          .mockRejectedValueOnce(new Error('Access denied'))
          .mockResolvedValueOnce(mockResult)

        const result = await introspectDatabase(mockConnection, [
          'restricted_table',
          'accessible_table',
        ])

        expect(result).toEqual({
          restricted_table: {
            error: 'Could not describe table: Access denied',
          },
          accessible_table: [{ name: 'id', type: 'INTEGER', nullable: false }],
        })
      })

      it('should handle connection errors gracefully', async () => {
        const connectionError = new Error('Connection lost')

        mockConnection.runAndReadAll.mockRejectedValue(connectionError)

        const result = await introspectDatabase(mockConnection, ['test_table'])

        // @note captureException is only called if outer try/catch triggers, but table errors are caught in inner try/catch
        expect(result).toEqual({
          test_table: {
            error: 'Could not describe table: Connection lost',
          },
        })
      })
    })

    describe('edge cases', () => {
      it('should handle missing column_name field', async () => {
        const mockResult = {
          getRowObjectsJson: jest.fn().mockReturnValue([
            { column_type: 'INTEGER', null: 'NO' },
          ]),
        }

        mockConnection.runAndReadAll.mockResolvedValue(mockResult)

        const result = await introspectDatabase(mockConnection, ['test_table'])

        expect(result.test_table[0].name).toBe('')
      })

      it('should handle missing column_type field', async () => {
        const mockResult = {
          getRowObjectsJson: jest.fn().mockReturnValue([
            { column_name: 'id', null: 'NO' },
          ]),
        }

        mockConnection.runAndReadAll.mockResolvedValue(mockResult)

        const result = await introspectDatabase(mockConnection, ['test_table'])

        expect(result.test_table[0].type).toBe('')
      })

      it('should handle table names with special characters', async () => {
        const mockResult = {
          getRowObjectsJson: jest.fn().mockReturnValue([]),
        }

        mockConnection.runAndReadAll.mockResolvedValue(mockResult)

        await introspectDatabase(mockConnection, ['table-with-dashes'])

        expect(mockConnection.runAndReadAll).toHaveBeenCalledWith(
          'DESCRIBE "table-with-dashes"'
        )
      })

      it('should handle empty column results', async () => {
        const mockResult = {
          getRowObjectsJson: jest.fn().mockReturnValue([]),
        }

        mockConnection.runAndReadAll.mockResolvedValue(mockResult)

        const result = await introspectDatabase(mockConnection, ['empty_table'])

        expect(result.empty_table).toEqual([])
      })

      it('should convert non-string column names to strings', async () => {
        const mockResult = {
          getRowObjectsJson: jest.fn().mockReturnValue([
            { column_name: 123, column_type: 456, null: 'NO' },
          ]),
        }

        mockConnection.runAndReadAll.mockResolvedValue(mockResult)

        const result = await introspectDatabase(mockConnection, ['test_table'])

        expect(result.test_table[0]).toEqual({
          name: '123',
          type: '456',
          nullable: false,
        })
      })
    })

    describe('nullable field variations', () => {
      it('should handle null field with different values', async () => {
        const mockResult = {
          getRowObjectsJson: jest.fn().mockReturnValue([
            { column_name: 'col1', column_type: 'TEXT', null: 'YES' },
            { column_name: 'col2', column_type: 'TEXT', null: 'NO' },
            { column_name: 'col3', column_type: 'TEXT', null: 'yes' },
            { column_name: 'col4', column_type: 'TEXT', null: 'no' },
            { column_name: 'col5', column_type: 'TEXT', null: null },
          ]),
        }

        mockConnection.runAndReadAll.mockResolvedValue(mockResult)

        const result = await introspectDatabase(mockConnection, ['test_table'])

        expect(result.test_table.map((c) => c.nullable)).toEqual([
          true,
          false,
          false,
          false,
          false,
        ])
      })
    })
  })
  describe('sandbox', () => {
    let instance
    let connection

    beforeEach(async () => {
      instance = await DuckDBInstance.create(':memory:')

      connection = await instance.connect()

      await connection.run(
        `CREATE TABLE "records" AS SELECT 1 AS id, 'allowed' AS value`
      )

      await lockDownDuckDB(connection)
    })

    afterEach(() => {
      connection.closeSync()
      instance.closeSync()
    })

    it('runs one read-only query over a generated table', async () => {
      const reader = await runReadOnlyDuckDBQuery(
        connection,
        'SELECT id, value FROM records'
      )

      expect(reader.getRowObjectsJson()).toEqual([{ id: 1, value: 'allowed' }])
    })

    it('rejects mutations and leaves the generated table unchanged', async () => {
      await expect(
        runReadOnlyDuckDBQuery(connection, 'DELETE FROM records')
      ).rejects.toThrow('DuckDB query must be a read-only SELECT statement')

      const reader = await connection.runAndReadAll(
        'SELECT count(*) AS count FROM records'
      )

      expect(reader.getRowObjectsJson()).toEqual([{ count: '1' }])
    })

    it('rejects multiple statements even when each is a select', async () => {
      await expect(
        runReadOnlyDuckDBQuery(connection, 'SELECT 1; SELECT 2')
      ).rejects.toThrow('DuckDB query must contain exactly one statement')
    })

    it('blocks local file reads', async () => {
      await expect(
        runReadOnlyDuckDBQuery(
          connection,
          `SELECT * FROM read_text('/etc/passwd')`
        )
      ).rejects.toThrow(/file system operations are disabled/i)
    })

    it('blocks local file writes even outside the read-only query runner', async () => {
      await expect(
        connection.run(`COPY records TO '/tmp/auxiliary-duckdb-output.csv'`)
      ).rejects.toThrow(/file system operations are disabled/i)
    })

    it('blocks network reads', async () => {
      await expect(
        runReadOnlyDuckDBQuery(
          connection,
          `SELECT * FROM read_csv('https://example.com/data.csv')`
        )
      ).rejects.toThrow(
        /external access is disabled|file system operations are disabled/i
      )
    })

    it('blocks attached databases', async () => {
      await expect(
        connection.run(`ATTACH '/tmp/auxiliary-foreign.duckdb' AS foreign_db`)
      ).rejects.toThrow(/file system operations are disabled/i)
    })

    it('blocks extension installation and loading', async () => {
      await expect(connection.run('INSTALL httpfs')).rejects.toThrow(
        /external access is disabled|file system operations are disabled/i
      )

      await expect(connection.run('LOAD httpfs')).rejects.toThrow(
        /loading external extensions is disabled/i
      )
    })

    it('locks the configuration against being re-enabled by later SQL', async () => {
      await expect(
        connection.run('SET enable_external_access = true')
      ).rejects.toThrow(/configuration has been locked/i)

      const reader = await connection.runAndReadAll(
        `SELECT current_setting('enable_external_access') AS enabled`
      )

      expect(reader.getRowObjectsJson()).toEqual([{ enabled: false }])
    })

    it('does not allow a select wrapper to execute a mutating query', async () => {
      await expect(
        runReadOnlyDuckDBQuery(
          connection,
          `SELECT * FROM query('DELETE FROM records RETURNING *')`
        )
      ).rejects.toThrow(/Expected a single SELECT statement/i)
    })
  })
})
