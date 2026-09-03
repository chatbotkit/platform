/* eslint-disable @typescript-eslint/no-require-imports */
import { getContextRequestIpAddress } from '@/lib/context.store'
import { logAuditNow as logAudit } from '@/lib/log'
import { getSafeSessionStore } from '@/lib/session.context'

import { createAuditHandler } from './audit'

jest.mock('@/lib/log', () => ({
  logAuditNow: jest.fn(async () => undefined),
}))

jest.mock('@/lib/session.context', () => ({
  getSafeSessionStore: jest.fn(),
}))

jest.mock('@/lib/context.store', () => ({
  getContextRequestIpAddress: jest.fn(),
}))

// @note run deferred work inline in tests so assertions see the effect;
// mirror real defer() by swallowing rejections (real impl routes them to
// captureError) so callers never see an audit failure
jest.mock('@/lib/defer', () => ({
  defer: jest.fn(async (fn) => {
    const promise = typeof fn === 'function' ? fn() : fn

    await promise.catch(() => {})
  }),
}))

jest.mock('@/lib/debug', () => {
  const debug = jest.fn(() => ({ log: jest.fn() }))

  debug.assert = jest.fn()

  return {
    __esModule: true,
    default: debug,
    assert: jest.fn(),
  }
})

function makeQuery(resolvedValue) {
  return jest.fn(async () => resolvedValue)
}

describe('createAuditHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    getSafeSessionStore.mockReturnValue({ user: { id: 'session-user' } })
    getContextRequestIpAddress.mockReturnValue(undefined)
  })

  describe('opt-in behaviour', () => {
    it('passes through when model is not in the config', async () => {
      const handler = createAuditHandler({})
      const query = makeQuery({ id: 'x', userId: 'u' })

      const result = await handler({
        model: 'DiscordIntegration',
        operation: 'delete',
        args: { where: { id: 'x' } },
        query,
      })

      expect(query).toHaveBeenCalledWith({ where: { id: 'x' } })
      expect(logAudit).not.toHaveBeenCalled()
      expect(result).toEqual({ id: 'x', userId: 'u' })
    })

    it('passes through when operation is not configured for the model', async () => {
      const handler = createAuditHandler({
        DiscordIntegration: { delete: { name: 'Deleted' } },
      })
      const query = makeQuery({ id: 'x', userId: 'u' })

      await handler({
        model: 'DiscordIntegration',
        operation: 'findUnique',
        args: {},
        query,
      })

      expect(query).toHaveBeenCalled()
      expect(logAudit).not.toHaveBeenCalled()
    })

    it('never audits the AuditLog model even if misconfigured', async () => {
      const handler = createAuditHandler({
        // Cast via any - AuditLog isn't a valid key at the TS level, but this
        // protects us if the type ever drifts.
        AuditLog: { delete: { name: 'should never happen' } },
      })
      const query = makeQuery({ id: 'a', userId: 'u' })

      await handler({
        model: 'AuditLog',
        operation: 'delete',
        args: {},
        query,
      })

      expect(logAudit).not.toHaveBeenCalled()
    })
  })

  describe('delete auditing', () => {
    it('records old values and a default name when none is configured', async () => {
      const handler = createAuditHandler({
        DiscordIntegration: { delete: {} },
      })
      const result = {
        id: 'di-1',
        userId: 'u-1',
        name: 'Discord',
        description: 'Team chat',
        meta: { tier: 'internal' },
        botId: 'b-1',
        accessToken: 'secret',
      }
      const query = makeQuery(result)

      await handler({
        model: 'DiscordIntegration',
        operation: 'delete',
        args: { where: { id: 'di-1' } },
        query,
      })

      expect(logAudit).toHaveBeenCalledTimes(1)
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          user: { id: 'session-user' },
          action: 'DELETE',
          name: 'DiscordIntegration Deleted',
          description: undefined,
          oldValues: {
            name: 'Discord',
            description: 'Team chat',
            meta: { tier: 'internal' },
          },
          newValues: undefined,
          relations: {},
          meta: { ipAddress: undefined },
        })
      )
    })

    it('uses a string name and description literal', async () => {
      const handler = createAuditHandler({
        DiscordIntegration: {
          delete: {
            name: 'Discord Integration Deleted',
            description: 'gone',
          },
        },
      })

      await handler({
        model: 'DiscordIntegration',
        operation: 'delete',
        args: {},
        query: makeQuery({ id: 'di-1', userId: 'u' }),
      })

      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Discord Integration Deleted',
          description: 'gone',
        })
      )
    })

    it('uses function-based name, description, and relations', async () => {
      const handler = createAuditHandler({
        DiscordIntegration: {
          delete: {
            name: (r) => `Deleted ${r.id}`,
            description: (r) => `Discord ${r.id} removed`,
            relations: (r) => ({ botId: r.botId }),
          },
        },
      })

      await handler({
        model: 'DiscordIntegration',
        operation: 'delete',
        args: {},
        query: makeQuery({ id: 'di-1', userId: 'u', botId: 'b-1' }),
      })

      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Deleted di-1',
          description: 'Discord di-1 removed',
          relations: { botId: 'b-1' },
        })
      )
    })
  })

  describe('create auditing', () => {
    it('records new values (not old) and default name', async () => {
      const handler = createAuditHandler({ Bot: { create: {} } })
      const result = {
        id: 'b-1',
        userId: 'u-1',
        name: 'Support',
        description: 'Support bot',
        model: 'internal-model',
      }

      await handler({
        model: 'Bot',
        operation: 'create',
        args: { data: { name: 'x' } },
        query: makeQuery(result),
      })

      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE',
          name: 'Bot Created',
          oldValues: undefined,
          newValues: {
            name: 'Support',
            description: 'Support bot',
          },
        })
      )
    })
  })

  describe('update auditing', () => {
    it('records both old and new values (both are the post-update row)', async () => {
      const handler = createAuditHandler({ Bot: { update: {} } })
      const result = {
        id: 'b-1',
        userId: 'u-1',
        name: 'renamed',
        backstory: 'internal instructions',
      }

      await handler({
        model: 'Bot',
        operation: 'update',
        args: {},
        query: makeQuery(result),
      })

      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE',
          name: 'Bot Updated',
          oldValues: { name: 'renamed' },
          newValues: { name: 'renamed' },
        })
      )
    })

    it('allows model-level fields to extend the default audit snapshot', async () => {
      const handler = createAuditHandler({
        Bot: {
          fields: ['visibility'],
          update: {},
        },
      })

      await handler({
        model: 'Bot',
        operation: 'update',
        args: {},
        query: makeQuery({
          id: 'b-1',
          userId: 'u-1',
          name: 'renamed',
          visibility: 'private',
          backstory: 'internal instructions',
        }),
      })

      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          oldValues: {
            name: 'renamed',
            visibility: 'private',
          },
          newValues: {
            name: 'renamed',
            visibility: 'private',
          },
        })
      )
    })

    it('allows operation-level fields to extend the default audit snapshot', async () => {
      const handler = createAuditHandler({
        Token: {
          update: {
            fields: ['expiresAt'],
          },
        },
      })

      const expiresAt = new Date('2026-01-01T00:00:00.000Z')

      await handler({
        model: 'Token',
        operation: 'update',
        args: {},
        query: makeQuery({
          id: 't-1',
          userId: 'u-1',
          name: 'API Token',
          expiresAt,
          value: 'secret-token-value',
        }),
      })

      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          oldValues: {
            name: 'API Token',
            expiresAt,
          },
          newValues: {
            name: 'API Token',
            expiresAt,
          },
        })
      )
    })

    it('maps upsert to the UPDATE action', async () => {
      const handler = createAuditHandler({ Bot: { upsert: {} } })

      await handler({
        model: 'Bot',
        operation: 'upsert',
        args: {},
        query: makeQuery({ id: 'b-1', userId: 'u' }),
      })

      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE' })
      )
    })
  })

  describe('meta fields', () => {
    it('captures the request ip address from context', async () => {
      getContextRequestIpAddress.mockReturnValue('203.0.113.42')

      const handler = createAuditHandler({
        DiscordIntegration: { delete: {} },
      })

      await handler({
        model: 'DiscordIntegration',
        operation: 'delete',
        args: {},
        query: makeQuery({ id: 'di-1', userId: 'u' }),
      })

      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: { ipAddress: '203.0.113.42' },
        })
      )
    })
  })

  describe('user resolution', () => {
    it('uses session user id when present', async () => {
      getSafeSessionStore.mockReturnValue({ user: { id: 'from-session' } })

      const handler = createAuditHandler({
        DiscordIntegration: { delete: {} },
      })

      await handler({
        model: 'DiscordIntegration',
        operation: 'delete',
        args: {},
        query: makeQuery({ id: 'di-1', userId: 'from-record' }),
      })

      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ user: { id: 'from-session' } })
      )
    })

    it('falls back to result.userId when there is no session', async () => {
      getSafeSessionStore.mockReturnValue({})

      const handler = createAuditHandler({
        DiscordIntegration: { delete: {} },
      })

      await handler({
        model: 'DiscordIntegration',
        operation: 'delete',
        args: {},
        query: makeQuery({ id: 'di-1', userId: 'from-record' }),
      })

      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ user: { id: 'from-record' } })
      )
    })

    it('skips audit silently when neither session nor result userId exist', async () => {
      getSafeSessionStore.mockReturnValue({})

      const handler = createAuditHandler({
        DiscordIntegration: { delete: {} },
      })

      const result = await handler({
        model: 'DiscordIntegration',
        operation: 'delete',
        args: {},
        query: makeQuery({ id: 'di-1' }),
      })

      expect(logAudit).not.toHaveBeenCalled()
      expect(result).toEqual({ id: 'di-1' })
    })
  })

  describe('result propagation', () => {
    it('returns the underlying query result when audit runs', async () => {
      const handler = createAuditHandler({
        DiscordIntegration: { delete: {} },
      })
      const result = { id: 'di-1', userId: 'u' }

      const returned = await handler({
        model: 'DiscordIntegration',
        operation: 'delete',
        args: {},
        query: makeQuery(result),
      })

      expect(returned).toBe(result)
    })

    it('returns the underlying query result when audit is skipped', async () => {
      const handler = createAuditHandler({})
      const result = { id: 'x' }

      const returned = await handler({
        model: 'DiscordIntegration',
        operation: 'delete',
        args: {},
        query: makeQuery(result),
      })

      expect(returned).toBe(result)
    })

    it('does not throw when logAudit rejects - write must not be affected', async () => {
      logAudit.mockRejectedValueOnce(new Error('audit down'))

      const handler = createAuditHandler({
        DiscordIntegration: { delete: {} },
      })
      const result = { id: 'di-1', userId: 'u' }

      const returned = await handler({
        model: 'DiscordIntegration',
        operation: 'delete',
        args: {},
        query: makeQuery(result),
      })

      expect(returned).toBe(result)
    })
  })
})
