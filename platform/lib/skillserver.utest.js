/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { getHeader } from '@/lib/header'
import { requiredUrlParam } from '@/lib/query.get'

import {
  SKILLSERVER_URL_PARAM,
  authorizeSkillserverRequest,
  findSkillserverAbility,
  renderSkillserverManual,
} from './skillserver'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/header', () => ({
  getHeader: jest.fn(),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn(),
}))

// @note keep the real Response out of this: stub the two error helpers with
// identifiable sentinels so we can assert which one the authorizer returned
// without depending on exact status codes.
jest.mock('@/lib/response', () => ({
  notFound: jest.fn(() => ({ kind: 'notFound' })),
  notAuthenticated: jest.fn(() => ({ kind: 'notAuthenticated' })),
}))

// @note ability naming/description/schema is ability.function's responsibility
// and is unit-tested there; here we stub it so these tests exercise only the
// skillserver matching and manual-rendering logic.
jest.mock('@/lib/ability.function', () => ({
  getAbilityFunctionName: jest.fn((ability) => ability.name),
  getAbilityFunctionDescription: jest.fn((ability) => ability.description),
  getAbilityFunctionParameters: jest.fn((ability) => ability.parameters),
}))

const ACCESS_TOKEN = 'secret-token-123'

function makeIntegration(overrides = {}) {
  return {
    id: 'skillserver_1',
    userId: 'user_1',
    name: 'Support Tools',
    description: '',
    accessToken: ACCESS_TOKEN,
    user: { id: 'user_1' },
    skillset: { id: 'skillset_1', name: 'Support', abilities: [] },
    ...overrides,
  }
}

describe('skillserver', () => {
  beforeEach(() => {
    mockReset(prisma)
    jest.clearAllMocks()

    requiredUrlParam.mockReturnValue('skillserver_1')
    getHeader.mockReturnValue(undefined)
  })

  describe('authorizeSkillserverRequest', () => {
    it('loads the integration by its URL id', async () => {
      const integration = makeIntegration()

      prisma.skillserverIntegration.findUnique.mockResolvedValue(integration)
      getHeader.mockReturnValue(`Bearer ${ACCESS_TOKEN}`)

      const req = {}

      await authorizeSkillserverRequest(req)

      expect(requiredUrlParam).toHaveBeenCalledWith(req, SKILLSERVER_URL_PARAM)
      expect(prisma.skillserverIntegration.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'skillserver_1' } })
      )
    })

    it('returns notFound when the integration does not exist', async () => {
      prisma.skillserverIntegration.findUnique.mockResolvedValue(null)

      const result = await authorizeSkillserverRequest({})

      expect(result.ok).toBe(false)
      expect(result.response).toEqual({ kind: 'notFound' })
    })

    it('returns notAuthenticated when no bearer token is provided', async () => {
      prisma.skillserverIntegration.findUnique.mockResolvedValue(
        makeIntegration()
      )
      getHeader.mockReturnValue(undefined)

      const result = await authorizeSkillserverRequest({})

      expect(result.ok).toBe(false)
      expect(result.response).toEqual({ kind: 'notAuthenticated' })
    })

    it('returns notAuthenticated when the token does not match', async () => {
      prisma.skillserverIntegration.findUnique.mockResolvedValue(
        makeIntegration()
      )
      getHeader.mockReturnValue('Bearer wrong-token')

      const result = await authorizeSkillserverRequest({})

      expect(result.ok).toBe(false)
      expect(result.response).toEqual({ kind: 'notAuthenticated' })
    })

    it('returns notAuthenticated when the bearer value is blank', async () => {
      prisma.skillserverIntegration.findUnique.mockResolvedValue(
        makeIntegration()
      )
      getHeader.mockReturnValue('Bearer    ')

      const result = await authorizeSkillserverRequest({})

      expect(result.ok).toBe(false)
      expect(result.response).toEqual({ kind: 'notAuthenticated' })
    })

    it('authorizes when the token matches (case-insensitive prefix)', async () => {
      const integration = makeIntegration()

      prisma.skillserverIntegration.findUnique.mockResolvedValue(integration)
      getHeader.mockReturnValue(`bearer ${ACCESS_TOKEN}`)

      const result = await authorizeSkillserverRequest({})

      expect(result.ok).toBe(true)
      expect(result.integration).toBe(integration)
    })
  })

  describe('findSkillserverAbility', () => {
    it('returns the ability whose function name matches', () => {
      const ability = { id: 'a1', name: 'search_docs' }

      const integration = makeIntegration({
        skillset: {
          id: 's1',
          name: 'S',
          abilities: [{ id: 'a0', name: 'other' }, ability],
        },
      })

      expect(findSkillserverAbility(integration, 'search_docs')).toBe(ability)
    })

    it('returns null when there is no match', () => {
      const integration = makeIntegration({
        skillset: {
          id: 's1',
          name: 'S',
          abilities: [{ id: 'a0', name: 'other' }],
        },
      })

      expect(findSkillserverAbility(integration, 'missing')).toBeNull()
    })

    it('returns null when there is no skillset', () => {
      const integration = makeIntegration({ skillset: null })

      expect(findSkillserverAbility(integration, 'anything')).toBeNull()
    })

    it('does not resolve a disabled ability', () => {
      const integration = makeIntegration({
        skillset: {
          id: 's1',
          name: 'S',
          abilities: [{ id: 'a1', name: 'search_docs', state: 'disabled' }],
        },
      })

      expect(findSkillserverAbility(integration, 'search_docs')).toBeNull()
    })

    it('does not resolve any ability when the skillset is disabled', () => {
      const integration = makeIntegration({
        skillset: {
          id: 's1',
          name: 'S',
          state: 'disabled',
          abilities: [{ id: 'a1', name: 'search_docs', state: 'enabled' }],
        },
      })

      expect(findSkillserverAbility(integration, 'search_docs')).toBeNull()
    })
  })

  describe('renderSkillserverManual', () => {
    const baseUrl =
      'https://api.test/v1/integration/skillserver/skillserver_1'

    it('documents auth, the invoke endpoint, and each ability with its fields', () => {
      const integration = makeIntegration({
        name: 'Support Tools',
        description: 'Helps with support.',
        skillset: {
          id: 's1',
          name: 'Support',
          abilities: [
            {
              id: 'a1',
              name: 'search_docs',
              description: 'Search the docs.',
              parameters: {
                properties: {
                  query: { type: 'string', description: 'The query' },
                  limit: { type: 'number' },
                },
                required: ['query'],
              },
            },
          ],
        },
      })

      const manual = renderSkillserverManual(integration, { baseUrl })

      expect(manual).toContain('# Support Tools')
      expect(manual).toContain('Helps with support.')
      expect(manual).toContain('Authorization: Bearer <accessToken>')
      expect(manual).toContain(`POST ${baseUrl}`)
      expect(manual).toContain('The input is flexible')
      expect(manual).toContain('## Abilities (1)')
      expect(manual).toContain('### search_docs')
      expect(manual).toContain('Search the docs.')
      expect(manual).toContain('- query (string) (required) - The query')
      expect(manual).toContain('- limit (number)')
    })

    it('renders a placeholder when an ability has no input fields', () => {
      const integration = makeIntegration({
        skillset: {
          id: 's1',
          name: 'S',
          abilities: [
            { id: 'a1', name: 'ping', description: 'Ping.', parameters: {} },
          ],
        },
      })

      const manual = renderSkillserverManual(integration, { baseUrl })

      expect(manual).toContain('(no input fields)')
    })

    it('handles a skillset with no abilities', () => {
      const integration = makeIntegration({
        skillset: { id: 's1', name: 'S', abilities: [] },
      })

      const manual = renderSkillserverManual(integration, { baseUrl })

      expect(manual).toContain('## Abilities (0)')
      expect(manual).toContain(
        'No abilities are available in the linked skillset.'
      )
    })

    it('falls back to the skillset name, then a default title', () => {
      const withSkillsetName = makeIntegration({
        name: '',
        skillset: { id: 's1', name: 'My Skillset', abilities: [] },
      })

      expect(renderSkillserverManual(withSkillsetName, { baseUrl })).toContain(
        '# My Skillset'
      )

      const withNothing = makeIntegration({ name: '', skillset: null })

      expect(renderSkillserverManual(withNothing, { baseUrl })).toContain(
        '# Skill Server'
      )
    })

    it('omits disabled abilities from the manual and the count', () => {
      const integration = makeIntegration({
        skillset: {
          id: 's1',
          name: 'S',
          abilities: [
            { id: 'a1', name: 'live', description: 'Live.', parameters: {} },
            {
              id: 'a2',
              name: 'off',
              description: 'Off.',
              parameters: {},
              state: 'disabled',
            },
          ],
        },
      })

      const manual = renderSkillserverManual(integration, { baseUrl })

      expect(manual).toContain('## Abilities (1)')
      expect(manual).toContain('### live')
      expect(manual).not.toContain('### off')
    })

    it('exposes no abilities when the skillset is disabled', () => {
      const integration = makeIntegration({
        skillset: {
          id: 's1',
          name: 'S',
          state: 'disabled',
          abilities: [
            { id: 'a1', name: 'live', description: 'Live.', parameters: {} },
          ],
        },
      })

      const manual = renderSkillserverManual(integration, { baseUrl })

      expect(manual).toContain('## Abilities (0)')
      expect(manual).toContain(
        'No abilities are available in the linked skillset.'
      )
    })
  })
})
