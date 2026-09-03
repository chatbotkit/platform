/**
 * @jest-environment node
 */
import { getBlueprintAndCloneableResources } from '@/lib/blueprint.resources'

import handler from './list'

jest.mock('@/lib/blueprint.resources', () => ({
  getBlueprintAndCloneableResources: jest.fn(),
}))

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, key) => req.query[key]),
}))

jest.mock('@/lib/response', () => ({
  ok: (body) => ({ status: 200, body }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

describe('GET /api/v1/blueprint/[blueprintId]/resource/list', () => {
  const session = { user: { id: 'user-1' } }
  const req = { query: { blueprintId: 'bpt-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('authorization', () => {
    it('returns 404 when blueprint does not exist', async () => {
      getBlueprintAndCloneableResources.mockResolvedValue(null)

      const result = await handler(req, session)

      expect(result).toEqual({ status: 404 })
    })

    it('returns 401 when blueprint belongs to another user', async () => {
      getBlueprintAndCloneableResources.mockResolvedValue({
        blueprint: { id: 'bpt-1', userId: 'user-2' },
        resources: { basic: {}, object: {}, oauth: {}, integration: {} },
      })

      const result = await handler(req, session)

      expect(result).toEqual({ status: 401 })
    })
  })

  describe('resource transformation', () => {
    it('returns the blueprint id and an empty resources map when no resources exist', async () => {
      getBlueprintAndCloneableResources.mockResolvedValue({
        blueprint: { id: 'bpt-1', userId: 'user-1' },
        resources: { basic: {}, object: {}, oauth: {}, integration: {} },
      })

      const result = await handler(req, session)

      expect(result.status).toBe(200)
      expect(result.body).toEqual({ id: 'bpt-1', resources: {} })
    })

    it('includes id, name, description, and meta for basic resources', async () => {
      getBlueprintAndCloneableResources.mockResolvedValue({
        blueprint: { id: 'bpt-1', userId: 'user-1' },
        resources: {
          basic: {
            bot: [
              {
                id: 'bot-1',
                name: 'My Bot',
                description: 'A test bot',
                meta: { tag: 'v1' },
                userId: 'user-1',
                createdAt: new Date(),
              },
            ],
          },
          object: {},
          oauth: {},
          integration: {},
        },
      })

      const result = await handler(req, session)

      expect(result.status).toBe(200)
      expect(result.body.resources.bot[0]).toMatchObject({
        id: 'bot-1',
        name: 'My Bot',
        description: 'A test bot',
        meta: { tag: 'v1' },
      })
    })

    it('strips non-Id fields (createdAt, updatedAt, visibility) but retains *Id relationship fields', async () => {
      // @note the handler keeps all keys ending with 'Id' from the rest spread,
      // including userId - only non-Id fields like timestamps and visibility are stripped
      getBlueprintAndCloneableResources.mockResolvedValue({
        blueprint: { id: 'bpt-1', userId: 'user-1' },
        resources: {
          basic: {
            bot: [
              {
                id: 'bot-1',
                name: 'My Bot',
                description: '',
                meta: null,
                userId: 'user-1',
                blueprintId: 'bpt-1',
                createdAt: new Date(),
                updatedAt: new Date(),
                visibility: 'private',
              },
            ],
          },
          object: {},
          oauth: {},
          integration: {},
        },
      })

      const result = await handler(req, session)

      const bot = result.body.resources.bot[0]

      // Non-Id fields are stripped from the output
      expect(bot).not.toHaveProperty('createdAt')
      expect(bot).not.toHaveProperty('updatedAt')
      expect(bot).not.toHaveProperty('visibility')

      // *Id fields are retained (including userId since it ends with 'Id')
      expect(bot).toHaveProperty('userId', 'user-1')
      expect(bot).toHaveProperty('blueprintId', 'bpt-1')
    })

    it('includes relationship *Id fields from resources', async () => {
      getBlueprintAndCloneableResources.mockResolvedValue({
        blueprint: { id: 'bpt-1', userId: 'user-1' },
        resources: {
          basic: {
            skillset: [
              {
                id: 'sks-1',
                name: 'My Skillset',
                description: '',
                meta: null,
                blueprintId: 'bpt-1',
                userId: 'user-1',
              },
            ],
          },
          object: {},
          oauth: {},
          integration: {},
        },
      })

      const result = await handler(req, session)

      const skillset = result.body.resources.skillset[0]

      expect(skillset).toHaveProperty('blueprintId', 'bpt-1')
    })

    it('appends Integration suffix to integration resource category keys', async () => {
      getBlueprintAndCloneableResources.mockResolvedValue({
        blueprint: { id: 'bpt-1', userId: 'user-1' },
        resources: {
          basic: {},
          object: {},
          oauth: {},
          integration: {
            widget: [
              {
                id: 'wgt-1',
                name: 'My Widget',
                description: '',
                meta: null,
                userId: 'user-1',
              },
            ],
            slack: [
              {
                id: 'slk-1',
                name: 'My Slack',
                description: '',
                meta: null,
                userId: 'user-1',
              },
            ],
          },
        },
      })

      const result = await handler(req, session)

      expect(result.body.resources).toHaveProperty('widgetIntegration')
      expect(result.body.resources).toHaveProperty('slackIntegration')
      expect(result.body.resources).not.toHaveProperty('widget')
      expect(result.body.resources).not.toHaveProperty('slack')
    })

    it('handles multiple resource categories and types simultaneously', async () => {
      getBlueprintAndCloneableResources.mockResolvedValue({
        blueprint: { id: 'bpt-1', userId: 'user-1' },
        resources: {
          basic: {
            bot: [{ id: 'bot-1', name: 'Bot', description: '', meta: null }],
            dataset: [
              { id: 'dts-1', name: 'Dataset', description: '', meta: null },
            ],
          },
          object: {
            space: [
              { id: 'spc-1', name: 'Space', description: '', meta: null },
            ],
          },
          oauth: {
            oAuthConnection: [
              { id: 'oac-1', name: 'OAuth', description: '', meta: null },
            ],
          },
          integration: {
            trigger: [
              { id: 'trig-1', name: 'Trigger', description: '', meta: null },
            ],
          },
        },
      })

      const result = await handler(req, session)

      expect(result.body.resources).toHaveProperty('bot')
      expect(result.body.resources).toHaveProperty('dataset')
      expect(result.body.resources).toHaveProperty('space')
      expect(result.body.resources).toHaveProperty('oAuthConnection')
      expect(result.body.resources).toHaveProperty('triggerIntegration')
    })

    it('passes the blueprintId from the request to getBlueprintAndCloneableResources', async () => {
      getBlueprintAndCloneableResources.mockResolvedValue(null)

      await handler({ query: { blueprintId: 'bpt-xyz' } }, session)

      expect(getBlueprintAndCloneableResources).toHaveBeenCalledWith('bpt-xyz')
    })
  })
})
