import { extractRouteSchemas } from './parser.ts'

const SPEC = {
  openapi: '3.0.0',
  info: {
    title: 'Test API',
    version: '1.0.0',
  },
  paths: {
    '/bot/list': {
      get: {
        operationId: 'listBots',
        parameters: [
          {
            name: 'order',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['asc', 'desc'],
            },
          },
        ],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                        },
                        required: ['id'],
                      },
                    },
                    cursor: { type: 'string' },
                  },
                  required: ['items', 'cursor'],
                },
              },
              'application/jsonl': {
                schema: {
                  oneOf: [
                    {
                      type: 'object',
                      properties: {
                        type: {
                          type: 'string',
                          enum: ['item'],
                        },
                        data: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                          },
                          required: ['id'],
                        },
                      },
                      required: ['type', 'data'],
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
  },
}

describe('extractRouteSchemas', () => {
  it('extracts params, JSON response, and JSONL stream item schemas', () => {
    const schemas = extractRouteSchemas(SPEC)
    const names = schemas.map((schema) => schema.name)

    expect(names).toContain('BotListParams')
    expect(names).toContain('BotListResponse')
    expect(names).toContain('BotListStreamItem')
  })
})
