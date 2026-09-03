/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './import'

let mockCuidIndex = 0

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    blueprint: {
      findUniqueByIdentifier: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    bot: {
      findMany: jest.fn(),
    },
    skillset: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, key) => req.query[key]),
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: jest.requireActual('@/lib/joi.schema').default,
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/cuid', () => ({
  cuid: jest.fn(() => {
    mockCuidIndex += 1

    return `generated-cuid-${mockCuidIndex}`
  }),
}))

describe('/api/v1/blueprint/[blueprintId]/resource/import', () => {
  const mockSession = {
    user: {
      id: 'user-1',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockCuidIndex = 0

    prisma.bot.findMany.mockResolvedValue([])
    prisma.skillset.findMany.mockResolvedValue([])
  })

  it('returns 404 when blueprint does not exist', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue(null)

    const response = await handler(
      { query: { blueprintId: 'bp-missing' } },
      mockSession,
      {
        resources: {
          bot: [],
        },
      }
    )

    expect(response.status).toBe(404)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('returns 403 when blueprint belongs to another user', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue({
      id: 'bp-1',
      userId: 'another-user',
    })

    const response = await handler(
      { query: { blueprintId: 'bp-1' } },
      mockSession,
      {
        resources: {
          bot: [],
        },
      }
    )

    expect(response.status).toBe(403)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('returns structured 400 for unsupported category', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue({
      id: 'bp-1',
      userId: 'user-1',
    })

    const response = await handler(
      { query: { blueprintId: 'bp-1' } },
      mockSession,
      {
        resources: {
          unknownCategory: [{ id: 'x1', name: 'x' }],
        },
      }
    )

    expect(response.status).toBe(400)

    const body = await response.json()

    expect(body.code).toBe('BAD_REQUEST')
    expect(body.details.issues[0]).toEqual(
      expect.objectContaining({
        category: 'unknownCategory',
        error: 'unsupported_resource_category',
      })
    )
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('imports resources atomically and resolves intra-payload references', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue({
      id: 'bp-1',
      userId: 'user-1',
    })

    const tx = {
      dataset: {
        create: jest.fn().mockResolvedValue({
          id: 'dst-new',
          name: 'Dataset',
          description: 'D',
        }),
      },
      bot: {
        create: jest.fn().mockResolvedValue({
          id: 'bot-new',
          name: 'Bot',
          description: 'B',
        }),
      },
    }

    prisma.$transaction.mockImplementation(async (fn) => await fn(tx))

    const response = await handler(
      { query: { blueprintId: 'bp-1' } },
      mockSession,
      {
        resources: {
          dataset: [
            {
              id: 'dst-old',
              name: 'Dataset',
              description: 'D',
            },
          ],
          bot: [
            {
              id: 'bot-old',
              name: 'Bot',
              description: 'B',
              datasetId: 'dst-old',
            },
          ],
        },
      }
    )

    expect(response.status).toBe(200)
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)

    expect(tx.dataset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          blueprintId: 'bp-1',
          userId: 'user-1',
        }),
      })
    )

    expect(tx.bot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          blueprintId: 'bp-1',
          userId: 'user-1',
          datasetId: 'dst-new',
        }),
      })
    )

    const body = await response.json()

    expect(body).toEqual(
      expect.objectContaining({
        id: 'bp-1',
        resources: expect.objectContaining({
          dataset: [{ id: 'dst-new', name: 'Dataset', description: 'D' }],
          bot: [{ id: 'bot-new', name: 'Bot', description: 'B' }],
        }),
      })
    )
  })

  it('replaces caller-provided ids with platform-generated ids', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue({
      id: 'bp-1',
      userId: 'user-1',
    })

    const tx = {
      dataset: {
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: data.id,
          name: data.name,
          description: data.description,
        })),
      },
      bot: {
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: data.id,
          name: data.name,
          description: data.description,
        })),
      },
    }

    prisma.$transaction.mockImplementation(async (fn) => await fn(tx))

    const response = await handler(
      { query: { blueprintId: 'bp-1' } },
      mockSession,
      {
        resources: {
          dataset: [
            {
              id: 'dst-caller-id',
              name: 'Dataset',
              description: 'D',
            },
          ],
          bot: [
            {
              id: 'bot-caller-id',
              name: 'Bot',
              description: 'B',
              datasetId: 'dst-caller-id',
            },
          ],
        },
      }
    )

    expect(response.status).toBe(200)

    expect(tx.dataset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: 'generated-cuid-1',
        }),
      })
    )

    expect(tx.bot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: 'generated-cuid-2',
          datasetId: 'generated-cuid-1',
        }),
      })
    )
  })

  it('rejects duplicate temporary ids before any resource is written', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue({
      id: 'bp-1',
      userId: 'user-1',
    })

    const response = await handler(
      { query: { blueprintId: 'bp-1' } },
      mockSession,
      {
        resources: {
          bot: [
            {
              id: 'static-resource-id',
              name: 'Bot A',
              description: '',
            },
            {
              id: 'static-resource-id',
              name: 'Bot B',
              description: '',
            },
          ],
        },
      }
    )

    expect(response.status).toBe(400)

    const body = await response.json()

    expect(body.details.issues).toEqual([
      {
        id: 'static-resource-id',
        error: 'duplicate_resource_id',
      },
    ])
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('does not write caller-provided managed ownership fields on create', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue({
      id: 'bp-1',
      userId: 'user-1',
    })

    const tx = {
      bot: {
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: data.id,
          name: data.name,
          description: data.description,
        })),
      },
    }

    prisma.$transaction.mockImplementation(async (fn) => await fn(tx))

    const response = await handler(
      { query: { blueprintId: 'bp-1' } },
      mockSession,
      {
        resources: {
          bot: [
            {
              id: 'attacker-selected-id',
              userId: 'attacker-user',
              blueprintId: 'attacker-blueprint',
              lockId: 'attacker-lock',
              name: 'Bot',
              description: '',
            },
          ],
        },
      }
    )

    expect(response.status).toBe(200)

    const createData = tx.bot.create.mock.calls[0][0].data

    expect(createData).toEqual(
      expect.objectContaining({
        id: 'generated-cuid-1',
        userId: 'user-1',
        blueprintId: 'bp-1',
      })
    )
    expect(createData).not.toHaveProperty('lockId')
    expect(createData).not.toEqual(
      expect.objectContaining({
        id: 'attacker-selected-id',
        userId: 'attacker-user',
        blueprintId: 'attacker-blueprint',
      })
    )
  })

  it('imports avatar, recall, and anam integrations with resolved bot references', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue({
      id: 'bp-1',
      userId: 'user-1',
    })

    const tx = {
      bot: {
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: data.id,
          name: data.name,
          description: data.description,
        })),
      },
      avatarIntegration: {
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: data.id,
          name: data.name,
          description: data.description,
        })),
      },
      recallIntegration: {
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: data.id,
          name: data.name,
          description: data.description,
        })),
      },
      anamIntegration: {
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: data.id,
          name: data.name,
          description: data.description,
        })),
      },
    }

    prisma.$transaction.mockImplementation(async (fn) => await fn(tx))

    const response = await handler(
      { query: { blueprintId: 'bp-1' } },
      mockSession,
      {
        resources: {
          bot: [
            {
              id: 'bot-old',
              name: 'Bot',
              description: 'B',
            },
          ],
          avatarIntegration: [
            {
              id: 'avatar-old',
              name: 'Avatar',
              description: 'A',
              botId: 'bot-old',
            },
          ],
          recallIntegration: [
            {
              id: 'recall-old',
              name: 'Recall',
              description: 'R',
              botId: 'bot-old',
              apiKey: 'recall-api-key',
            },
          ],
          anamIntegration: [
            {
              id: 'anam-old',
              name: 'Anam',
              description: 'N',
              botId: 'bot-old',
              apiKey: 'anam-api-key',
              personaId: 'persona-1',
            },
          ],
        },
      }
    )

    expect(response.status).toBe(200)

    for (const create of [
      tx.avatarIntegration.create,
      tx.recallIntegration.create,
      tx.anamIntegration.create,
    ]) {
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            blueprintId: 'bp-1',
            userId: 'user-1',
            botId: 'generated-cuid-1',
          }),
        })
      )
    }

    expect(tx.recallIntegration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          apiKey: 'recall-api-key',
        }),
      })
    )

    expect(tx.anamIntegration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          apiKey: 'anam-api-key',
          personaId: 'persona-1',
        }),
      })
    )
  })

  it('returns structured 400 when resources contain cyclic dependencies', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue({
      id: 'bp-1',
      userId: 'user-1',
    })

    const response = await handler(
      { query: { blueprintId: 'bp-1' } },
      mockSession,
      {
        resources: {
          dataset: [
            {
              id: 'dst-old',
              name: 'Dataset',
              botId: 'bot-old',
            },
          ],
          bot: [
            {
              id: 'bot-old',
              name: 'Bot',
              datasetId: 'dst-old',
            },
          ],
        },
      }
    )

    expect(response.status).toBe(400)
    expect(prisma.$transaction).not.toHaveBeenCalled()

    const body = await response.json()

    expect(body).toEqual(
      expect.objectContaining({
        code: 'BAD_REQUEST',
        message: 'Resource graph contains cyclic dependencies',
        details: {
          issues: [
            {
              error: 'cyclic_dependency',
              cycle: ['dst-old', 'bot-old', 'dst-old'],
            },
          ],
        },
      })
    )
  })

  it('returns 400 when transaction fails', async () => {
    prisma.blueprint.findUniqueByIdentifier.mockResolvedValue({
      id: 'bp-1',
      userId: 'user-1',
    })

    const tx = {
      dataset: {
        create: jest.fn().mockRejectedValue(new Error('insert failed')),
      },
    }

    prisma.$transaction.mockImplementation(async (fn) => await fn(tx))

    const response = await handler(
      { query: { blueprintId: 'bp-1' } },
      mockSession,
      {
        resources: {
          dataset: [
            {
              id: 'dst-old',
              name: 'Dataset',
            },
          ],
        },
      }
    )

    expect(response.status).toBe(400)
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)

    const body = await response.json()

    expect(body.code).toBe('BAD_REQUEST')
    expect(body.message).toMatch(/failed to import blueprint resources/i)
  })

  describe('reconcile by alias', () => {
    beforeEach(() => {
      prisma.blueprint.findUniqueByIdentifier.mockResolvedValue({
        id: 'bp-1',
        userId: 'user-1',
      })
    })

    it('updates an existing resource matched by alias instead of creating', async () => {
      const tx = {
        bot: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ id: 'bot-existing', alias: 'sdr-bot' }]),
          update: jest.fn().mockResolvedValue({
            id: 'bot-existing',
            name: 'SDR Bot',
            description: 'updated',
          }),
          create: jest.fn(),
        },
      }

      prisma.$transaction.mockImplementation(async (fn) => await fn(tx))

      const response = await handler(
        { query: { blueprintId: 'bp-1' } },
        mockSession,
        {
          resources: {
            bot: [
              {
                id: 'local-bot',
                alias: 'sdr-bot',
                name: 'SDR Bot',
                description: 'updated',
              },
            ],
          },
        }
      )

      expect(response.status).toBe(200)

      expect(tx.bot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', alias: { in: ['sdr-bot'] } },
        })
      )

      expect(tx.bot.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bot-existing' },
          data: expect.objectContaining({ description: 'updated' }),
        })
      )

      expect(tx.bot.create).not.toHaveBeenCalled()

      const body = await response.json()

      expect(body.resources.bot).toEqual([
        { id: 'bot-existing', name: 'SDR Bot', description: 'updated' },
      ])
    })

    it('does not write caller-provided managed ownership fields on update', async () => {
      const tx = {
        bot: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'bot-existing',
              blueprintId: 'bp-1',
              alias: 'sdr-bot',
              name: 'SDR Bot',
              description: 'old',
            },
          ]),
          update: jest.fn().mockResolvedValue({
            id: 'bot-existing',
            name: 'SDR Bot',
            description: 'updated',
          }),
          create: jest.fn(),
        },
      }

      prisma.$transaction.mockImplementation(async (fn) => await fn(tx))

      const response = await handler(
        { query: { blueprintId: 'bp-1' } },
        mockSession,
        {
          resources: {
            bot: [
              {
                id: 'local-bot',
                alias: 'sdr-bot',
                userId: 'attacker-user',
                blueprintId: 'attacker-blueprint',
                lockId: 'attacker-lock',
                name: 'SDR Bot',
                description: 'updated',
              },
            ],
          },
        }
      )

      expect(response.status).toBe(200)

      const updateData = tx.bot.update.mock.calls[0][0].data

      expect(updateData).toEqual(
        expect.objectContaining({
          blueprintId: 'bp-1',
          description: 'updated',
        })
      )
      expect(updateData).not.toHaveProperty('id')
      expect(updateData).not.toHaveProperty('userId')
      expect(updateData).not.toHaveProperty('lockId')
      expect(updateData.blueprintId).not.toBe('attacker-blueprint')
      expect(tx.bot.create).not.toHaveBeenCalled()
    })

    it('creates a resource when its alias has no existing match', async () => {
      const tx = {
        bot: {
          findMany: jest.fn().mockResolvedValue([]),
          update: jest.fn(),
          create: jest.fn().mockResolvedValue({
            id: 'bot-new',
            name: 'SDR Bot',
            description: '',
          }),
        },
      }

      prisma.$transaction.mockImplementation(async (fn) => await fn(tx))

      const response = await handler(
        { query: { blueprintId: 'bp-1' } },
        mockSession,
        {
          resources: {
            bot: [
              {
                id: 'local-bot',
                alias: 'sdr-bot',
                name: 'SDR Bot',
                description: '',
              },
            ],
          },
        }
      )

      expect(response.status).toBe(200)
      expect(tx.bot.create).toHaveBeenCalledTimes(1)
      expect(tx.bot.update).not.toHaveBeenCalled()
    })

    it('creates an aliased resource with a generated id when no alias match exists', async () => {
      const tx = {
        bot: {
          findMany: jest.fn().mockResolvedValue([]),
          update: jest.fn(),
          create: jest.fn().mockImplementation(async ({ data }) => ({
            id: data.id,
            name: data.name,
            description: data.description,
          })),
        },
      }

      prisma.$transaction.mockImplementation(async (fn) => await fn(tx))

      const response = await handler(
        { query: { blueprintId: 'bp-1' } },
        mockSession,
        {
          resources: {
            bot: [
              {
                id: 'caller-selected-bot-id',
                alias: 'sdr-bot',
                name: 'SDR Bot',
                description: '',
              },
            ],
          },
        }
      )

      expect(response.status).toBe(200)

      expect(tx.bot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id: 'generated-cuid-1',
            alias: 'sdr-bot',
            blueprintId: 'bp-1',
            userId: 'user-1',
          }),
        })
      )
      expect(tx.bot.create.mock.calls[0][0].data.id).not.toBe(
        'caller-selected-bot-id'
      )
      expect(tx.bot.update).not.toHaveBeenCalled()

      const body = await response.json()

      expect(body.resources.bot).toEqual([
        { id: 'generated-cuid-1', name: 'SDR Bot', description: '' },
      ])
    })

    it('uses alias rather than caller id as the update key', async () => {
      const tx = {
        bot: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'bot-existing',
              blueprintId: 'bp-1',
              alias: 'sdr-bot',
              name: 'SDR Bot',
              description: 'old',
            },
          ]),
          update: jest.fn().mockResolvedValue({
            id: 'bot-existing',
            name: 'SDR Bot',
            description: 'updated',
          }),
          create: jest.fn(),
        },
      }

      prisma.$transaction.mockImplementation(async (fn) => await fn(tx))

      const response = await handler(
        { query: { blueprintId: 'bp-1' } },
        mockSession,
        {
          resources: {
            bot: [
              {
                id: 'caller-selected-bot-id',
                alias: 'sdr-bot',
                name: 'SDR Bot',
                description: 'updated',
              },
            ],
          },
        }
      )

      expect(response.status).toBe(200)

      expect(tx.bot.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bot-existing' },
          data: expect.objectContaining({
            alias: 'sdr-bot',
            description: 'updated',
          }),
        })
      )
      expect(tx.bot.update.mock.calls[0][0].data).not.toHaveProperty('id')
      expect(tx.bot.create).not.toHaveBeenCalled()

      const body = await response.json()

      expect(body.resources.bot).toEqual([
        { id: 'bot-existing', name: 'SDR Bot', description: 'updated' },
      ])
    })

    it('preserves unmanaged credential fields when updating', async () => {
      const tx = {
        secret: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ id: 'sec-existing', alias: 'apollo' }]),
          update: jest.fn().mockResolvedValue({
            id: 'sec-existing',
            name: 'Apollo',
            description: '',
          }),
          create: jest.fn(),
        },
      }

      prisma.$transaction.mockImplementation(async (fn) => await fn(tx))

      const response = await handler(
        { query: { blueprintId: 'bp-1' } },
        mockSession,
        {
          resources: {
            secret: [
              {
                id: 'local-sec',
                alias: 'apollo',
                name: 'Apollo',
                kind: 'shared',
                type: 'plain',
                value: 'should-not-overwrite',
                config: {
                  clientId: 'client-id',
                  clientSecret: 'should-not-overwrite',
                  password: 'should-not-overwrite',
                },
              },
            ],
          },
        }
      )

      expect(response.status).toBe(200)
      expect(tx.secret.update).toHaveBeenCalledTimes(1)

      const updateData = tx.secret.update.mock.calls[0][0].data

      expect(updateData).not.toHaveProperty('value')
      expect(updateData).not.toHaveProperty('config')
      expect(updateData.name).toBe('Apollo')
    })

    it('ignores unmanaged mcpserver oauth references before update validation', async () => {
      const tx = {
        mcpserverIntegration: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'mcp-existing',
              blueprintId: 'bp-1',
              alias: 'mcp',
            },
          ]),
          update: jest.fn().mockResolvedValue({
            id: 'mcp-existing',
            name: 'MCP',
            description: '',
          }),
          create: jest.fn(),
        },
        oAuthConnection: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      }

      prisma.$transaction.mockImplementation(async (fn) => await fn(tx))

      const response = await handler(
        { query: { blueprintId: 'bp-1' } },
        mockSession,
        {
          resources: {
            mcpserverIntegration: [
              {
                id: 'local-mcp',
                alias: 'mcp',
                name: 'MCP',
                description: '',
                oAuthConnectionId: 'stale-or-cross-account-oauth',
              },
            ],
          },
        }
      )

      expect(response.status).toBe(200)
      expect(tx.oAuthConnection.findUnique).not.toHaveBeenCalled()

      const updateData = tx.mcpserverIntegration.update.mock.calls[0][0].data

      expect(updateData).not.toHaveProperty('oAuthConnectionId')
      expect(updateData.name).toBe('MCP')
    })

    it('skips the update when the managed data is unchanged', async () => {
      const tx = {
        secret: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'sec-existing',
              blueprintId: 'bp-1',
              alias: 'apollo',
              name: 'Apollo',
              description: 'Apollo API key',
              kind: 'shared',
              type: 'plain',
              visibility: 'private',
              value: 'existing-secret-is-kept',
            },
          ]),
          update: jest.fn(),
          create: jest.fn(),
        },
      }

      prisma.$transaction.mockImplementation(async (fn) => await fn(tx))

      const response = await handler(
        { query: { blueprintId: 'bp-1' } },
        mockSession,
        {
          resources: {
            secret: [
              {
                id: 'local-sec',
                alias: 'apollo',
                name: 'Apollo',
                description: 'Apollo API key',
                kind: 'shared',
                type: 'plain',
                visibility: 'private',
              },
            ],
          },
        }
      )

      expect(response.status).toBe(200)

      // @note the stored record already equals the managed payload, so the
      // reconcile performs no write - this is what keeps an unchanged re-import
      // inside the transaction budget instead of doing N updates every load

      expect(tx.secret.update).not.toHaveBeenCalled()
      expect(tx.secret.create).not.toHaveBeenCalled()

      const body = await response.json()

      expect(body.resources.secret).toEqual([
        { id: 'sec-existing', name: 'Apollo', description: 'Apollo API key' },
      ])
    })

    it('re-homes an orphaned resource matched by alias instead of recreating it', async () => {
      // @note deleting a blueprint sets its resources' blueprintId to null
      // (onDelete: SetNull) but keeps their (userId, alias). Matching by user
      // finds the orphan, so the reconcile updates + re-homes it rather than
      // creating a duplicate that fails the userId_alias unique constraint -
      // even though every managed field is unchanged (blueprintId differs).
      const tx = {
        skillset: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'sk-orphan',
              blueprintId: null,
              alias: 'sdr-skillset',
              name: 'SDR Skillset',
              description: 'updated',
            },
          ]),
          update: jest.fn().mockResolvedValue({
            id: 'sk-orphan',
            name: 'SDR Skillset',
            description: 'updated',
          }),
          create: jest.fn(),
        },
      }

      prisma.$transaction.mockImplementation(async (fn) => await fn(tx))

      const response = await handler(
        { query: { blueprintId: 'bp-1' } },
        mockSession,
        {
          resources: {
            skillset: [
              {
                id: 'local-sk',
                alias: 'sdr-skillset',
                name: 'SDR Skillset',
                description: 'updated',
              },
            ],
          },
        }
      )

      expect(response.status).toBe(200)

      expect(tx.skillset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', alias: { in: ['sdr-skillset'] } },
        })
      )

      // re-homed: the update targets the orphan and stamps the current blueprint
      expect(tx.skillset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sk-orphan' },
          data: expect.objectContaining({ blueprintId: 'bp-1' }),
        })
      )

      expect(tx.skillset.create).not.toHaveBeenCalled()
    })

    it('re-homes an active resource from an unaliased blueprint into an aliased blueprint', async () => {
      prisma.blueprint.findUniqueByIdentifier.mockResolvedValue({
        id: 'bp-new',
        userId: 'user-1',
        alias: 'sdr',
      })

      const tx = {
        blueprint: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'bp-old',
              alias: null,
            },
          ]),
        },
        skillset: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'sk-existing',
              blueprintId: 'bp-old',
              alias: 'sdr-skillset',
              name: 'SDR Skillset',
              description: 'old',
            },
          ]),
          update: jest.fn().mockResolvedValue({
            id: 'sk-existing',
            name: 'SDR Skillset',
            description: 'updated',
          }),
          create: jest.fn(),
        },
      }

      prisma.$transaction.mockImplementation(async (fn) => await fn(tx))

      const response = await handler(
        { query: { blueprintId: '@sdr' } },
        mockSession,
        {
          resources: {
            skillset: [
              {
                id: 'local-sk',
                alias: 'sdr-skillset',
                name: 'SDR Skillset',
                description: 'updated',
              },
            ],
          },
        }
      )

      expect(response.status).toBe(200)

      expect(tx.skillset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sk-existing' },
          data: expect.objectContaining({ blueprintId: 'bp-new' }),
        })
      )
      expect(tx.skillset.create).not.toHaveBeenCalled()

      const body = await response.json()

      expect(body.id).toBe('bp-new')
      expect(body.resources.skillset).toEqual([
        { id: 'sk-existing', name: 'SDR Skillset', description: 'updated' },
      ])
    })

    it('does not re-home an active resource from another blueprint', async () => {
      const tx = {
        skillset: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'sk-other-blueprint',
              blueprintId: 'bp-other',
              alias: 'sdr-skillset',
              name: 'SDR Skillset',
              description: 'from another blueprint',
            },
          ]),
          update: jest.fn(),
          create: jest.fn(),
        },
      }

      prisma.$transaction.mockImplementation(async (fn) => await fn(tx))

      const response = await handler(
        { query: { blueprintId: 'bp-1' } },
        mockSession,
        {
          resources: {
            skillset: [
              {
                id: 'local-sk',
                alias: 'sdr-skillset',
                name: 'SDR Skillset',
                description: 'updated',
              },
            ],
          },
        }
      )

      expect(response.status).toBe(400)
      expect(tx.skillset.update).not.toHaveBeenCalled()
      expect(tx.skillset.create).not.toHaveBeenCalled()

      const body = await response.json()

      expect(body.details.issues[0]).toEqual(
        expect.objectContaining({
          error: 'resource_alias_in_active_blueprint',
          existingBlueprintId: 'bp-other',
          targetBlueprintId: 'bp-1',
        })
      )
    })

    it('resolves references to the matched id of an existing resource', async () => {
      const tx = {
        skillset: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ id: 'sk-existing', alias: 'sk' }]),
          update: jest.fn().mockResolvedValue({
            id: 'sk-existing',
            name: 'SK',
            description: '',
          }),
          create: jest.fn(),
        },
        bot: {
          findMany: jest.fn().mockResolvedValue([]),
          update: jest.fn(),
          create: jest.fn().mockResolvedValue({
            id: 'bot-new',
            name: 'Bot',
            description: '',
          }),
        },
      }

      prisma.$transaction.mockImplementation(async (fn) => await fn(tx))

      const response = await handler(
        { query: { blueprintId: 'bp-1' } },
        mockSession,
        {
          resources: {
            skillset: [
              { id: 'local-sk', alias: 'sk', name: 'SK', description: '' },
            ],
            bot: [
              {
                id: 'local-bot',
                alias: 'b',
                name: 'Bot',
                description: '',
                skillsetId: 'local-sk',
              },
            ],
          },
        }
      )

      expect(response.status).toBe(200)

      // the matched skillset is updated, and the new bot points at its real id
      expect(tx.skillset.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'sk-existing' } })
      )

      expect(tx.bot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ skillsetId: 'sk-existing' }),
        })
      )
    })

    it('rejects external resource references the caller cannot use', async () => {
      const tx = {
        dataset: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'dataset-other-user',
            userId: 'user-2',
            visibility: 'private',
          }),
        },
        bot: {
          create: jest.fn(),
        },
      }

      prisma.$transaction.mockImplementation(async (fn) => await fn(tx))

      const response = await handler(
        { query: { blueprintId: 'bp-1' } },
        mockSession,
        {
          resources: {
            bot: [
              {
                id: 'local-bot',
                name: 'Bot',
                description: '',
                datasetId: 'dataset-other-user',
              },
            ],
          },
        }
      )

      expect(response.status).toBe(400)
      expect(tx.bot.create).not.toHaveBeenCalled()

      const body = await response.json()

      expect(body.details.issues[0]).toEqual(
        expect.objectContaining({
          nodeId: 'local-bot',
          category: 'bot',
          field: 'datasetId',
          value: 'dataset-other-user',
          error: 'external_reference_not_authorized',
        })
      )
    })
  })

  describe('deep reference resolution', () => {
    it('resolves a token reference embedded inside a string field', async () => {
      prisma.blueprint.findUniqueByIdentifier.mockResolvedValue({
        id: 'bp-1',
        userId: 'user-1',
      })

      const tx = {
        skillset: {
          findMany: jest.fn().mockResolvedValue([]),
          create: jest
            .fn()
            .mockResolvedValue({ id: 'sk-real', name: 'SK', description: '' }),
        },
        secret: {
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn().mockResolvedValue({
            id: 'secret-real',
            name: 'Apollo',
            description: '',
          }),
        },
        ability: {
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn().mockResolvedValue({
            id: 'ab-real',
            name: 'Ability',
            description: '',
          }),
        },
      }

      prisma.$transaction.mockImplementation(async (fn) => await fn(tx))

      const response = await handler(
        { query: { blueprintId: 'bp-1' } },
        mockSession,
        {
          resources: {
            skillset: [{ id: '#skillset:::sk', name: 'SK', description: '' }],
            secret: [
              {
                id: '#secret:::si',
                name: 'Apollo',
                kind: 'shared',
                type: 'plain',
              },
            ],
            ability: [
              {
                id: '#ability:::ab',
                name: 'Ability',
                // structured reference (resolved by the typed pass)
                skillsetId: '#skillset:::sk',
                // embedded reference inside a string (resolved by the deep pass)
                instruction: 'use the secret #secret:::si to authenticate',
              },
            ],
          },
        }
      )

      expect(response.status).toBe(200)

      const abilityData = tx.ability.create.mock.calls[0][0].data

      // structured *Id reference resolved
      expect(abilityData.skillsetId).toBe('sk-real')

      // embedded token reference resolved (and the token is gone)
      expect(abilityData.instruction).toBe(
        'use the secret secret-real to authenticate'
      )
      expect(abilityData.instruction).not.toContain('#secret:::si')
    })
  })

  describe('generated required fields', () => {
    it('mints a secret when creating a trigger integration', async () => {
      prisma.blueprint.findUniqueByIdentifier.mockResolvedValue({
        id: 'bp-1',
        userId: 'user-1',
      })

      const tx = {
        triggerIntegration: {
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn().mockResolvedValue({
            id: 'trig-1',
            name: 'Heartbeat',
            description: '',
          }),
        },
      }

      prisma.$transaction.mockImplementation(async (fn) => await fn(tx))

      const response = await handler(
        { query: { blueprintId: 'bp-1' } },
        mockSession,
        {
          resources: {
            triggerIntegration: [
              {
                id: 'local',
                name: 'Heartbeat',
                authenticate: true,
                schedule: '0 9 * * *',
                timezone: 'UTC',
              },
            ],
          },
        }
      )

      expect(response.status).toBe(200)

      const data = tx.triggerIntegration.create.mock.calls[0][0].data

      // the template never carries `secret` - import must generate it
      expect(typeof data.secret).toBe('string')
      expect(data.secret.length).toBeGreaterThan(0)
    })
  })

  describe('ensure', () => {
    const reconcileTx = () => ({
      bot: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
        create: jest
          .fn()
          .mockResolvedValue({ id: 'bot-new', name: 'B', description: '' }),
      },
    })

    it('creates the blueprint when an @alias does not resolve', async () => {
      prisma.blueprint.findUniqueByIdentifier.mockResolvedValue(null)
      prisma.blueprint.create.mockResolvedValue({
        id: 'bp-new',
        userId: 'user-1',
      })
      prisma.$transaction.mockImplementation(
        async (fn) => await fn(reconcileTx())
      )

      const response = await handler(
        { query: { blueprintId: '@sdr' } },
        mockSession,
        {
          ensure: true,
          resources: {
            bot: [{ id: 'local', alias: 'b', name: 'B', description: '' }],
          },
        }
      )

      expect(response.status).toBe(200)
      expect(prisma.blueprint.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { userId: 'user-1', alias: 'sdr' },
        })
      )

      const body = await response.json()

      expect(body.id).toBe('bp-new')
    })

    it('reuses an active blueprint discovered from resource aliases before creating a new one', async () => {
      prisma.blueprint.findUniqueByIdentifier.mockResolvedValue(null)
      prisma.blueprint.findUnique.mockResolvedValue({
        id: 'bp-existing',
        userId: 'user-1',
        alias: null,
      })
      prisma.blueprint.create.mockResolvedValue({
        id: 'bp-new',
        userId: 'user-1',
      })
      prisma.skillset.findMany.mockResolvedValue([
        {
          id: 'sk-existing',
          alias: 'sdr-skillset',
          blueprintId: 'bp-existing',
        },
      ])

      const tx = {
        skillset: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'sk-existing',
              blueprintId: 'bp-existing',
              alias: 'sdr-skillset',
              name: 'SDR Skillset',
              description: 'existing',
            },
          ]),
          update: jest.fn().mockResolvedValue({
            id: 'sk-existing',
            name: 'SDR Skillset',
            description: 'updated',
          }),
          create: jest.fn(),
        },
      }

      prisma.$transaction.mockImplementation(async (fn) => await fn(tx))

      const response = await handler(
        { query: { blueprintId: '@sdr' } },
        mockSession,
        {
          ensure: true,
          resources: {
            skillset: [
              {
                id: 'local-sk',
                alias: 'sdr-skillset',
                name: 'SDR Skillset',
                description: 'updated',
              },
            ],
          },
        }
      )

      expect(response.status).toBe(200)
      expect(prisma.blueprint.create).not.toHaveBeenCalled()
      expect(tx.skillset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sk-existing' },
          data: expect.objectContaining({ blueprintId: 'bp-existing' }),
        })
      )
      expect(tx.skillset.create).not.toHaveBeenCalled()

      const body = await response.json()

      expect(body.id).toBe('bp-existing')
    })

    it('reconciles into the existing blueprint without creating', async () => {
      prisma.blueprint.findUniqueByIdentifier.mockResolvedValue({
        id: 'bp-1',
        userId: 'user-1',
      })
      prisma.$transaction.mockImplementation(
        async (fn) => await fn(reconcileTx())
      )

      const response = await handler(
        { query: { blueprintId: '@sdr' } },
        mockSession,
        {
          ensure: true,
          resources: {
            bot: [{ id: 'local', name: 'B', description: '' }],
          },
        }
      )

      expect(response.status).toBe(200)
      expect(prisma.blueprint.create).not.toHaveBeenCalled()
    })

    it('404s on an unresolved @alias when ensure is omitted', async () => {
      prisma.blueprint.findUniqueByIdentifier.mockResolvedValue(null)

      const response = await handler(
        { query: { blueprintId: '@sdr' } },
        mockSession,
        {
          resources: { bot: [] },
        }
      )

      expect(response.status).toBe(404)
      expect(prisma.blueprint.create).not.toHaveBeenCalled()
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('404s for a raw id that does not resolve even with ensure', async () => {
      prisma.blueprint.findUniqueByIdentifier.mockResolvedValue(null)

      const response = await handler(
        { query: { blueprintId: 'bp-raw-id' } },
        mockSession,
        {
          ensure: true,
          resources: { bot: [] },
        }
      )

      expect(response.status).toBe(404)
      expect(prisma.blueprint.create).not.toHaveBeenCalled()
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })
  })
})
