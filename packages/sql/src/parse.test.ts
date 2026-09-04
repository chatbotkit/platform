import { parseSingle } from './parse'

describe('parseSingle', () => {
  it('should parse a show query', () => {
    const query = 'SHOW TABLES'
    const result = parseSingle(query)

    expect(result).toEqual({
      type: 'show',
      table: {
        name: 'TABLES',
      },
    })
  })

  it('should parse a describe query', () => {
    const query = 'DESCRIBE myTable' // table is a reserved word
    const result = parseSingle(query)

    expect(result).toEqual({
      type: 'describe',
      table: {
        name: 'myTable',
      },
    })
  })

  it('should parse a show query with database', () => {
    const query = 'SHOW myDatabase.myTable'
    const result = parseSingle(query)

    expect(result).toEqual({
      type: 'show',
      table: {
        database: 'myDatabase',
        name: 'myTable',
      },
    })
  })

  it('should reject show and describe with long whitespace runs in linear time', () => {
    // @note the database group used to accept whitespace, which overlapped
    // with the separator and made a failed match quadratic in the run length;
    // compare two run lengths rather than a wall-clock budget so loaded CI
    // runners do not fail the test - a quadratic match scales 16x here
    const measure = (keyword: string, length: number) => {
      const query = `${keyword}${'\t'.repeat(length)}my Table`

      let best = Infinity

      for (let i = 0; i < 3; i++) {
        const started = performance.now()

        expect(() => parseSingle(query)).toThrow()

        best = Math.min(best, performance.now() - started)
      }

      return best
    }

    for (const keyword of ['SHOW', 'DESCRIBE']) {
      const small = measure(keyword, 50000)
      const large = measure(keyword, 200000)

      expect(large).toBeLessThan(Math.max(small, 1) * 8)
    }
  })

  it('should parse a simple query with database', () => {
    const query = 'DESCRIBE myDatabase.myTable'
    const result = parseSingle(query)

    expect(result).toEqual({
      type: 'describe',
      table: {
        database: 'myDatabase',
        name: 'myTable',
      },
    })
  })

  it('should parse a simple select query', () => {
    const query = 'SELECT * FROM myTable'
    const result = parseSingle(query)

    expect(result).toEqual({
      type: 'select',
      table: {
        name: 'myTable',
      },
      columns: ['*'],
    })
  })

  it('should parse a simple select query with database', () => {
    const query = 'SELECT * FROM myDatabase.myTable'
    const result = parseSingle(query)

    expect(result).toEqual({
      type: 'select',
      table: {
        database: 'myDatabase',
        name: 'myTable',
      },
      columns: ['*'],
    })
  })

  it('should parse a simple select query with columns', () => {
    const query = 'SELECT id, name FROM myTable'
    const result = parseSingle(query)

    expect(result).toEqual({
      type: 'select',
      table: {
        name: 'myTable',
      },
      columns: ['id', 'name'],
    })
  })

  it('should parse a simple select query with limit', () => {
    const query = 'SELECT * FROM myTable LIMIT 10'
    const result = parseSingle(query)

    expect(result).toEqual({
      type: 'select',
      table: {
        name: 'myTable',
      },
      columns: ['*'],
      limit: 10,
    })
  })

  it('should parse a simple select query with offset', () => {
    const query = 'SELECT * FROM myTable LIMIT 10 OFFSET 20'
    const result = parseSingle(query)

    expect(result).toEqual({
      type: 'select',
      table: {
        name: 'myTable',
      },
      columns: ['*'],
      limit: 10,
      offset: 20,
    })
  })

  it('should parse a simple select query with order by', () => {
    const query = 'SELECT * FROM myTable ORDER BY id'
    const result = parseSingle(query)

    expect(result).toEqual({
      type: 'select',
      table: {
        name: 'myTable',
      },
      columns: ['*'],
      order: [
        {
          column: 'id',
          direction: 'asc',
        },
      ],
    })
  })

  it('should parse a simple select query with order by desc', () => {
    const query = 'SELECT * FROM myTable ORDER BY id DESC'
    const result = parseSingle(query)

    expect(result).toEqual({
      type: 'select',
      table: {
        name: 'myTable',
      },
      columns: ['*'],
      order: [
        {
          column: 'id',
          direction: 'desc',
        },
      ],
    })
  })

  it('should parse a simple select query with multiple order by', () => {
    const query = 'SELECT * FROM myTable ORDER BY id DESC, name ASC'
    const result = parseSingle(query)

    expect(result).toEqual({
      type: 'select',
      table: {
        name: 'myTable',
      },
      columns: ['*'],
      order: [
        {
          column: 'id',
          direction: 'desc',
        },
        {
          column: 'name',
          direction: 'asc',
        },
      ],
    })
  })

  it('should throw when left side is a value expression', () => {
    const query = 'SELECT * FROM myTable WHERE 1 = 1'

    expect(() => parseSingle(query)).toThrow()
  })

  it('should parse a simple select query with where', () => {
    const query = 'SELECT * FROM myTable WHERE id = 1'
    const result = parseSingle(query)

    expect(result).toEqual({
      type: 'select',
      table: {
        name: 'myTable',
      },
      columns: ['*'],
      where: {
        or: [
          {
            and: [
              {
                column: 'id',
                operator: 'EQ',
                criteria: {
                  type: 'number',
                  value: '1',
                },
              },
            ],
          },
        ],
      },
    })
  })

  it('should parse a simple select query with multiple where filters combined by and operator', () => {
    const query = 'SELECT * FROM myTable WHERE id = 1 AND name = "test"'
    const result = parseSingle(query)

    expect(result).toEqual({
      type: 'select',
      table: {
        name: 'myTable',
      },
      columns: ['*'],
      where: {
        or: [
          {
            and: [
              {
                column: 'id',
                operator: 'EQ',
                criteria: {
                  type: 'number',
                  value: '1',
                },
              },
              {
                column: 'name',
                operator: 'EQ',
                criteria: {
                  type: 'string',
                  value: 'test',
                },
              },
            ],
          },
        ],
      },
    })
  })

  it('should parse a simple select query with multiple where filters combined by or operator', () => {
    const query = 'SELECT * FROM myTable WHERE id = 1 OR name = "test"'
    const result = parseSingle(query)

    expect(result).toEqual({
      type: 'select',
      table: {
        name: 'myTable',
      },
      columns: ['*'],
      where: {
        or: [
          {
            and: [
              {
                column: 'id',
                operator: 'EQ',
                criteria: {
                  type: 'number',
                  value: '1',
                },
              },
            ],
          },
          {
            and: [
              {
                column: 'name',
                operator: 'EQ',
                criteria: {
                  type: 'string',
                  value: 'test',
                },
              },
            ],
          },
        ],
      },
    })
  })

  it('should parse a simple select query with multiple where filter combined by mixed operators', () => {
    const query =
      'SELECT * FROM myTable WHERE id = 1 OR name = "test" AND age > 18'
    const result = parseSingle(query)

    expect(result).toEqual({
      type: 'select',
      table: {
        name: 'myTable',
      },
      columns: ['*'],
      where: {
        or: [
          {
            and: [
              {
                column: 'id',
                operator: 'EQ',
                criteria: {
                  type: 'number',
                  value: '1',
                },
              },
            ],
          },
          {
            and: [
              {
                column: 'name',
                operator: 'EQ',
                criteria: {
                  type: 'string',
                  value: 'test',
                },
              },
              {
                column: 'age',
                operator: 'GT',
                criteria: {
                  type: 'number',
                  value: '18',
                },
              },
            ],
          },
        ],
      },
    })
  })

  it('should parse a simple select query with multiple where filter combined by multiple mixed operators', () => {
    const query = `SELECT * FROM myTable WHERE id = 1 OR name = "test" AND age > 18 OR age < 30`
    const result = parseSingle(query)

    expect(result).toEqual({
      type: 'select',
      table: {
        name: 'myTable',
      },
      columns: ['*'],
      where: {
        or: [
          {
            and: [
              {
                column: 'id',
                operator: 'EQ',
                criteria: {
                  type: 'number',
                  value: '1',
                },
              },
            ],
          },
          {
            and: [
              {
                column: 'name',
                operator: 'EQ',
                criteria: {
                  type: 'string',
                  value: 'test',
                },
              },
              {
                column: 'age',
                operator: 'GT',
                criteria: {
                  type: 'number',
                  value: '18',
                },
              },
            ],
          },
          {
            and: [
              {
                column: 'age',
                operator: 'LT',
                criteria: {
                  type: 'number',
                  value: '30',
                },
              },
            ],
          },
        ],
      },
    })
  })

  it('should throw with multiple conditions and filters and parentheses', () => {
    const query =
      'SELECT * FROM myTable WHERE (id = 1 OR name = "test") AND age > 18'

    expect(() => parseSingle(query)).toThrow()
  })

  it('should throw when joining tables', () => {
    const query =
      'SELECT * FROM myTable JOIN otherTable ON myTable.id = otherTable.id'

    expect(() => parseSingle(query)).toThrow()
  })

  it('should throw when using functions in where clause', () => {
    const query = 'SELECT * FROM myTable WHERE id = COUNT(*)'

    expect(() => parseSingle(query)).toThrow()
  })

  it('should throw when using table subquery', () => {
    const query = 'SELECT * FROM (SELECT * FROM myTable)'

    expect(() => parseSingle(query)).toThrow()
  })

  it('should throw when using where clause subquery', () => {
    const query = 'SELECT * FROM myTable WHERE id = (SELECT id FROM otherTable)'

    expect(() => parseSingle(query)).toThrow()
  })

  it('should throw when using subquery in select clause', () => {
    const query = 'SELECT (SELECT id FROM otherTable) FROM myTable'

    expect(() => parseSingle(query)).toThrow()
  })

  it('should parse insert statements with a trailing RETURNING clause', () => {
    const query = 'INSERT INTO myTable (name) VALUES ("Ada") RETURNING id'
    const result = parseSingle(query)

    expect(result).toEqual({
      type: 'insert',
      table: {
        name: 'myTable',
      },
      parameters: {
        name: 'Ada',
      },
    })
  })

  it('should not strip quoted values containing the word returning', () => {
    const query =
      'INSERT INTO myTable (note) VALUES ("customer returning soon") RETURNING id'
    const result = parseSingle(query)

    expect(result).toEqual({
      type: 'insert',
      table: {
        name: 'myTable',
      },
      parameters: {
        note: 'customer returning soon',
      },
    })
  })
})
