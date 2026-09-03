import { type Column, GenericDriver } from './driver'

interface TestRow {
  id?: number
  name?: string
  email?: string
  status?: string
  active?: boolean
  created_at?: string
}

/**
 * Concrete implementation of GenericDriver for testing purposes
 */
class TestDriver extends GenericDriver<TestRow> {
  #columns: Column[] = []
  #selectResults: Record<string, unknown>[] = []
  #insertResult: Record<string, unknown> = {}
  #updateCalls: Array<{ selectResult: unknown; parameters: unknown }> = []
  #deleteCalls: unknown[] = []

  setColumns(columns: Column[]) {
    this.#columns = columns
  }

  setSelectResults(results: Record<string, unknown>[]) {
    this.#selectResults = results
  }

  setInsertResult(result: Record<string, unknown>) {
    this.#insertResult = result
  }

  getUpdateCalls() {
    return this.#updateCalls
  }

  getDeleteCalls() {
    return this.#deleteCalls
  }

  async describeColumns(): Promise<Column[]> {
    return this.#columns
  }

  async doSelect(columns: string[]) {
    return this.#selectResults.map((row) => ({
      row: columns.reduce((acc, col) => {
        acc[col] = row[col]

        return acc
      }, {} as Record<string, unknown>),
    }))
  }

  async doInsert() {
    return this.#insertResult
  }

  async doUpdate(selectResult: unknown, parameters: unknown) {
    this.#updateCalls.push({ selectResult, parameters })
  }

  async doDelete(selectResult: unknown) {
    this.#deleteCalls.push(selectResult)
  }
}

describe('GenericDriver', () => {
  let driver: TestDriver

  beforeEach(() => {
    driver = new TestDriver()
  })

  describe('validateColumns', () => {
    it('should return supported columns when all columns are valid', async () => {
      driver.setColumns([
        { name: 'id', type: 'number' },
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string' },
      ])

      const result = await driver.validateColumns(
        { name: 'users' },
        ['id', 'name'],
        {}
      )

      expect(result).toHaveLength(3)
      expect(result.map((c) => c.name)).toEqual(['id', 'name', 'email'])
    })

    it('should throw error for unsupported columns in SELECT', async () => {
      driver.setColumns([
        { name: 'id', type: 'number' },
        { name: 'name', type: 'string' },
      ])

      await expect(
        driver.validateColumns({ name: 'users' }, ['id', 'invalid_column'], {})
      ).rejects.toThrow(
        'The following columns do not exist in table users: invalid_column'
      )
    })

    it('should throw error for unsupported columns in parameters (WHERE clause)', async () => {
      driver.setColumns([
        { name: 'id', type: 'number' },
        { name: 'name', type: 'string' },
      ])

      await expect(
        driver.validateColumns({ name: 'users' }, ['id'], {
          invalid_param: 'value',
        })
      ).rejects.toThrow(
        'The column invalid_param does not exist in table users'
      )
    })

    it('should handle case-insensitive column matching', async () => {
      driver.setColumns([
        { name: 'ID', type: 'number' },
        { name: 'Name', type: 'string' },
      ])

      const result = await driver.validateColumns(
        { name: 'users' },
        ['id', 'name'],
        { ID: '123' }
      )

      expect(result).toHaveLength(2)
    })

    it('should filter out wildcard (*) from column validation', async () => {
      driver.setColumns([{ name: 'id', type: 'number' }])

      const result = await driver.validateColumns({ name: 'users' }, ['*'], {})

      expect(result).toHaveLength(1)
    })

    it('should skip validation when no supported columns defined', async () => {
      driver.setColumns([])

      const result = await driver.validateColumns(
        { name: 'users' },
        ['any', 'columns'],
        { any_param: 'value' }
      )

      expect(result).toHaveLength(0)
    })

    it('should handle table with database prefix', async () => {
      driver.setColumns([{ name: 'id', type: 'number' }])

      await expect(
        driver.validateColumns(
          { database: 'crm', name: 'contacts' },
          ['invalid'],
          {}
        )
      ).rejects.toThrow('do not exist in table crm.contacts')
    })
  })

  describe('describe', () => {
    it('should return column definitions', async () => {
      const columns: Column[] = [
        { name: 'id', type: 'number' },
        { name: 'name', type: 'string' },
      ]

      driver.setColumns(columns)

      const result = await driver.describe({
        type: 'describe',
        table: { name: 'users' },
      })

      expect(result).toEqual(columns)
    })
  })

  describe('select', () => {
    it('should return rows with requested columns', async () => {
      driver.setColumns([
        { name: 'id', type: 'number' },
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string' },
      ])

      driver.setSelectResults([
        { id: 1, name: 'John', email: 'john@example.com' },
        { id: 2, name: 'Jane', email: 'jane@example.com' },
      ])

      const result = await driver.select({
        type: 'select',
        columns: ['id', 'name'],
        table: { name: 'users' },
      })

      expect(result).toHaveLength(2)
      expect(result[0].row).toEqual({ id: 1, name: 'John' })
      expect(result[1].row).toEqual({ id: 2, name: 'Jane' })
    })

    it('should expand * to all columns', async () => {
      driver.setColumns([
        { name: 'id', type: 'number' },
        { name: 'name', type: 'string' },
      ])

      driver.setSelectResults([{ id: 1, name: 'John' }])

      const result = await driver.select({
        type: 'select',
        columns: ['*'],
        table: { name: 'users' },
      })

      expect(result[0].row).toEqual({ id: 1, name: 'John' })
    })

    it('should validate WHERE clause columns', async () => {
      driver.setColumns([{ name: 'id', type: 'number' }])

      await expect(
        driver.select({
          type: 'select',
          columns: ['id'],
          table: { name: 'users' },
          where: {
            or: [
              {
                and: [
                  {
                    column: 'invalid',
                    operator: 'EQ',
                    criteria: { type: 'string', value: '1' },
                  },
                ],
              },
            ],
          },
        })
      ).rejects.toThrow('The column invalid does not exist')
    })
  })

  describe('insert', () => {
    it('should validate and insert parameters', async () => {
      driver.setColumns([
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string' },
      ])

      driver.setInsertResult({ id: 123 })

      const result = await driver.insert({
        type: 'insert',
        table: { name: 'users' },
        parameters: { name: 'John', email: 'john@example.com' },
      })

      expect(result).toEqual({ id: 123 })
    })

    it('should throw error for invalid insert columns', async () => {
      driver.setColumns([{ name: 'name', type: 'string' }])

      await expect(
        driver.insert({
          type: 'insert',
          table: { name: 'users' },
          parameters: { invalid_column: 'value' },
        })
      ).rejects.toThrow('invalid_column')
    })
  })

  describe('update', () => {
    it('should update matching rows', async () => {
      driver.setColumns([
        { name: 'id', type: 'number' },
        { name: 'status', type: 'string' },
      ])

      driver.setSelectResults([{ id: 1 }, { id: 2 }])

      const result = await driver.update({
        type: 'update',
        table: { name: 'users' },
        parameters: { status: 'active' },
        where: {
          or: [
            {
              and: [
                {
                  column: 'id',
                  operator: 'IN',
                  criteria: { type: 'string', value: '1,2' },
                },
              ],
            },
          ],
        },
      })

      expect(result).toEqual({ updated: 2 })
      expect(driver.getUpdateCalls()).toHaveLength(2)
    })

    it('should return updated: 0 when no rows match', async () => {
      driver.setColumns([{ name: 'id', type: 'number' }])
      driver.setSelectResults([])

      const result = await driver.update({
        type: 'update',
        table: { name: 'users' },
        parameters: { id: 999 },
        where: { or: [] },
      })

      expect(result).toEqual({ updated: 0 })
    })

    it('should throw error when trying to update more than 10 rows', async () => {
      driver.setColumns([{ name: 'id', type: 'number' }])

      driver.setSelectResults(
        Array.from({ length: 11 }, (_, i) => ({ id: i + 1 }))
      )

      await expect(
        driver.update({
          type: 'update',
          table: { name: 'users' },
          parameters: { id: 1 },
          where: { or: [] },
        })
      ).rejects.toThrow('Cannot update more than 10 rows at a time')
    })

    it('should validate update parameters', async () => {
      driver.setColumns([{ name: 'name', type: 'string' }])

      await expect(
        driver.update({
          type: 'update',
          table: { name: 'users' },
          parameters: { invalid_column: 'value' },
          where: { or: [] },
        })
      ).rejects.toThrow('invalid_column')
    })
  })

  describe('delete', () => {
    it('should delete matching rows', async () => {
      driver.setColumns([{ name: 'id', type: 'number' }])

      driver.setSelectResults([{ id: 1 }, { id: 2 }, { id: 3 }])

      const result = await driver.delete({
        type: 'delete',
        table: { name: 'users' },
        where: {
          or: [
            {
              and: [
                {
                  column: 'id',
                  operator: 'LT',
                  criteria: { type: 'number', value: '4' },
                },
              ],
            },
          ],
        },
      })

      expect(result).toEqual({ deleted: 3 })
      expect(driver.getDeleteCalls()).toHaveLength(3)
    })

    it('should return deleted: 0 when no rows match', async () => {
      driver.setColumns([{ name: 'id', type: 'number' }])
      driver.setSelectResults([])

      const result = await driver.delete({
        type: 'delete',
        table: { name: 'users' },
        where: { or: [] },
      })

      expect(result).toEqual({ deleted: 0 })
    })

    it('should throw error when trying to delete more than 10 rows', async () => {
      driver.setColumns([{ name: 'id', type: 'number' }])

      driver.setSelectResults(
        Array.from({ length: 11 }, (_, i) => ({ id: i + 1 }))
      )

      await expect(
        driver.delete({
          type: 'delete',
          table: { name: 'users' },
          where: { or: [] },
        })
      ).rejects.toThrow('Cannot delete more than 10 rows at a time')
    })
  })

  describe('Column type definitions', () => {
    it('should support string, number, and boolean column types', async () => {
      driver.setColumns([
        { name: 'id', type: 'number' },
        { name: 'name', type: 'string' },
        { name: 'active', type: 'boolean' },
      ])

      const result = await driver.describe({
        type: 'describe',
        table: { name: 'test' },
      })

      expect(result).toEqual([
        { name: 'id', type: 'number' },
        { name: 'name', type: 'string' },
        { name: 'active', type: 'boolean' },
      ])
    })

    it('should support columns with options', async () => {
      driver.setColumns([
        { name: 'status', type: 'string', options: ['active', 'inactive'] },
      ])

      const result = (await driver.describe({
        type: 'describe',
        table: { name: 'test' },
      })) as Column[]

      expect(result[0].options).toEqual(['active', 'inactive'])
    })

    it('should support readOnly columns', async () => {
      driver.setColumns([
        { name: 'created_at', type: 'string', readOnly: true },
      ])

      const result = (await driver.describe({
        type: 'describe',
        table: { name: 'test' },
      })) as Column[]

      expect(result[0].readOnly).toBe(true)
    })
  })
})
