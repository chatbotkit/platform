/* eslint-disable @typescript-eslint/no-require-imports */
import handler from '@/pages/api/auxiliary/skillset/ability/matillion/sql'

jest.mock('@/lib/auxiliary.sql', () => {
  return jest.fn((schema, tables, getDriver) => {
    // @note return a function that creates the driver and calls its methods
    return async function mockHandler(parameters, headers) {
      const { parseSingle } = require('@chatbotkit-dev/sql/parse')

      const parsedSQL = parseSingle(parameters.sql)

      // @note handle SHOW TABLES before trying to get driver
      if (parsedSQL.type === 'show') {
        return {
          sql: parameters.sql,
          result: tables.map((t) => ({
            DATABASE_NAME: t.database,
            TABLE_NAME: t.name,
            FULL_NAME: `${t.database}.${t.name}`,
          })),
        }
      }

      const driver = await getDriver(parsedSQL.table, parameters, headers)

      switch (parsedSQL.type) {
        case 'describe':
          return {
            sql: parameters.sql,
            result: await driver.describeColumns(),
          }

        case 'select':
          return {
            sql: parameters.sql,
            result: await driver.doSelect(parsedSQL.columns, parsedSQL.where),
          }

        case 'insert':
          return {
            sql: parameters.sql,
            result: await driver.doInsert(parsedSQL.parameters),
          }

        case 'update': {
          const rows = await driver.doSelect(['id'], parsedSQL.where)

          for (const row of rows) {
            await driver.doUpdate(row, parsedSQL.parameters)
          }

          return { sql: parameters.sql, result: { updated: rows.length } }
        }

        case 'delete': {
          const rows = await driver.doSelect(['id'], parsedSQL.where)

          for (const row of rows) {
            await driver.doDelete(row)
          }

          return { sql: parameters.sql, result: { deleted: rows.length } }
        }
      }
    }
  })
})

jest.mock('@/lib/call', () => {
  const mockCall = jest.fn()

  mockCall.getCallError = jest.fn((response) =>
    Promise.resolve(new Error(`API Error: ${response.status}`))
  )

  return {
    __esModule: true,
    default: mockCall,
    getCallError: mockCall.getCallError,
  }
})

jest.mock('@/lib/response', () => ({
  throwNotAuthenticated: jest.fn(() => {
    throw new Error('Not authenticated')
  }),
}))

const mockCall = require('@/lib/call').default

describe('Matillion SQL Handler', () => {
  const mockHeaders = new Headers()

  mockHeaders.set('x-access-token', 'Bearer test-token')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Projects table', () => {
    describe('SELECT statements', () => {
      it('should serialize SELECT * to projects list API', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [
                {
                  id: 'proj-1',
                  name: 'Test Project',
                  description: 'A test project',
                  warehouse: 'SNOWFLAKE',
                },
              ],
            }),
        })

        await handler({ sql: 'SELECT * FROM matillion.projects' }, mockHeaders)

        expect(mockCall).toHaveBeenCalledWith(
          expect.stringContaining(
            'https://eu1.api.matillion.com/dpc/v1/projects'
          ),
          expect.objectContaining({
            headers: { Authorization: 'Bearer test-token' },
          })
        )
      })

      it('should serialize SELECT with WHERE id to filter project', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [
                {
                  id: 'proj-123',
                  name: 'Specific Project',
                  warehouse: 'SNOWFLAKE',
                },
              ],
            }),
        })

        const result = await handler(
          {
            sql: "SELECT * FROM matillion.projects WHERE id = 'proj-123'",
          },
          mockHeaders
        )

        expect(mockCall).toHaveBeenCalledWith(
          expect.stringContaining(
            'https://eu1.api.matillion.com/dpc/v1/projects'
          ),
          expect.any(Object)
        )

        // @note should filter results by id
        expect(result.result).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              row: expect.objectContaining({ id: 'proj-123' }),
            }),
          ])
        )
      })
    })

    describe('INSERT statements', () => {
      it('should serialize INSERT to projects POST API', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'new-proj-1' }),
        })

        await handler(
          {
            sql: "INSERT INTO matillion.projects (name, warehouse, agentDeploymentType) VALUES ('New Project', 'SNOWFLAKE', 'HYBRID')",
          },
          mockHeaders
        )

        const callArgs = mockCall.mock.calls[0]

        expect(callArgs[0]).toBe(
          'https://eu1.api.matillion.com/dpc/v1/projects'
        )
        expect(callArgs[1].method).toBe('POST')

        const body = JSON.parse(callArgs[1].body)

        expect(body).toEqual({
          name: 'New Project',
          warehouse: 'SNOWFLAKE',
          agentDeploymentType: 'HYBRID',
        })
      })
    })

    describe('DELETE statements', () => {
      it('should serialize DELETE to projects DELETE API', async () => {
        // @note first call is SELECT to find rows
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [{ id: 'proj-del' }],
            }),
        })

        // @note second call is DELETE
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        })

        await handler(
          {
            sql: "DELETE FROM matillion.projects WHERE id = 'proj-del'",
          },
          mockHeaders
        )

        const deleteCall = mockCall.mock.calls[1]

        expect(deleteCall[0]).toBe(
          'https://eu1.api.matillion.com/dpc/v1/projects/proj-del'
        )
        expect(deleteCall[1].method).toBe('DELETE')
      })
    })
  })

  describe('Pipelines table', () => {
    describe('SELECT statements', () => {
      it('should serialize SELECT * with projectId to pipelines list API', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [
                { name: 'Pipeline 1', publishedTime: '2024-01-01T00:00:00Z' },
              ],
            }),
        })

        await handler(
          {
            sql: "SELECT * FROM matillion.pipelines WHERE projectId = 'proj-123'",
          },
          mockHeaders
        )

        expect(mockCall).toHaveBeenCalledWith(
          expect.stringContaining(
            'https://eu1.api.matillion.com/dpc/v1/projects/proj-123/published-pipelines'
          ),
          expect.objectContaining({
            headers: { Authorization: 'Bearer test-token' },
          })
        )
      })

      it('should throw error when projectId is missing', async () => {
        await expect(
          handler({ sql: 'SELECT * FROM matillion.pipelines' }, mockHeaders)
        ).rejects.toThrow('projectId is required')
      })
    })
  })

  describe('Pipeline executions table', () => {
    describe('SELECT statements', () => {
      it('should serialize SELECT * to pipeline-executions list API', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [
                {
                  pipelineExecutionId: 'exec-1',
                  pipelineName: 'Test Pipeline',
                  status: 'SUCCESS',
                },
              ],
            }),
        })

        await handler(
          { sql: 'SELECT * FROM matillion.pipeline_executions' },
          mockHeaders
        )

        expect(mockCall).toHaveBeenCalledWith(
          expect.stringContaining(
            'https://eu1.api.matillion.com/dpc/v1/pipeline-executions'
          ),
          expect.objectContaining({
            headers: { Authorization: 'Bearer test-token' },
          })
        )
      })

      it('should filter by projectId when specified', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [],
            }),
        })

        await handler(
          {
            sql: "SELECT * FROM matillion.pipeline_executions WHERE projectId = 'proj-456'",
          },
          mockHeaders
        )

        expect(mockCall).toHaveBeenCalledWith(
          expect.stringMatching(/projectId=proj-456/),
          expect.any(Object)
        )
      })
    })

    describe('INSERT statements', () => {
      it('should serialize INSERT to execute pipeline API', async () => {
        mockCall.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ pipelineExecutionId: 'exec-new' }),
        })

        await handler(
          {
            sql: "INSERT INTO matillion.pipeline_executions (projectId, pipelineName, environmentName) VALUES ('proj-123', 'My Pipeline', 'Production')",
          },
          mockHeaders
        )

        const callArgs = mockCall.mock.calls[0]

        expect(callArgs[0]).toBe(
          'https://eu1.api.matillion.com/dpc/v1/projects/proj-123/pipeline-executions'
        )
        expect(callArgs[1].method).toBe('POST')

        const body = JSON.parse(callArgs[1].body)

        expect(body).toEqual({
          pipelineName: 'My Pipeline',
          environmentName: 'Production',
        })
      })

      it('should throw error when required fields are missing', async () => {
        await expect(
          handler(
            {
              sql: "INSERT INTO matillion.pipeline_executions (pipelineName) VALUES ('My Pipeline')",
            },
            mockHeaders
          )
        ).rejects.toThrow('projectId is required')
      })
    })
  })

  describe('DESCRIBE statements', () => {
    it('should return static column definitions for projects', async () => {
      const result = await handler(
        { sql: 'DESCRIBE matillion.projects' },
        mockHeaders
      )

      expect(result.result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'id', type: 'string' }),
          expect.objectContaining({ name: 'name', type: 'string' }),
          expect.objectContaining({ name: 'warehouse', type: 'string' }),
        ])
      )
    })

    it('should return static column definitions for pipelines', async () => {
      const result = await handler(
        { sql: 'DESCRIBE matillion.pipelines' },
        mockHeaders
      )

      expect(result.result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'name', type: 'string' }),
          expect.objectContaining({ name: 'projectId', type: 'string' }),
          expect.objectContaining({ name: 'environmentName', type: 'string' }),
        ])
      )
    })

    it('should return static column definitions for pipeline_executions', async () => {
      const result = await handler(
        { sql: 'DESCRIBE matillion.pipeline_executions' },
        mockHeaders
      )

      expect(result.result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'pipelineExecutionId',
            type: 'string',
          }),
          expect.objectContaining({ name: 'pipelineName', type: 'string' }),
          expect.objectContaining({ name: 'status', type: 'string' }),
        ])
      )
    })
  })

  describe('SHOW statements', () => {
    it('should return list of available tables', async () => {
      const result = await handler({ sql: 'SHOW TABLES' }, mockHeaders)

      expect(result.result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            DATABASE_NAME: 'matillion',
            TABLE_NAME: 'projects',
          }),
          expect.objectContaining({
            DATABASE_NAME: 'matillion',
            TABLE_NAME: 'pipelines',
          }),
          expect.objectContaining({
            DATABASE_NAME: 'matillion',
            TABLE_NAME: 'pipeline_executions',
          }),
        ])
      )
    })
  })

  describe('Authentication', () => {
    it('should throw error when no token provided', async () => {
      const emptyHeaders = new Headers()

      await expect(
        handler({ sql: 'SELECT * FROM matillion.projects' }, emptyHeaders)
      ).rejects.toThrow('Not authenticated')
    })
  })

  describe('Error handling', () => {
    it('should throw error for unsupported table', async () => {
      await expect(
        handler({ sql: 'SELECT * FROM matillion.unknown' }, mockHeaders)
      ).rejects.toThrow()
    })
  })
})
