/**
 * @jest-environment node
 */
import { graphql } from 'graphql'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    portal: {
      findMany: jest.fn(async () => [
        {
          id: 'portal_1',
          slug: 'acme',
          name: 'Acme',
          description: null,
          blueprintId: null,
          config: {},
          meta: {},
          userId: 'user_1',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        },
      ]),
    },
  },
}))

jest.mock('@/lib/portal.config', () => ({
  getPortalGlobalConfig: jest.fn(async () => null),
}))
jest.mock('@/config/apexes', () => ({ portalApex: 'cbk.localhost' }))
jest.mock('@/config/site', () => ({
  siteUrl: 'http://cbk.localhost:3000',
  siteHost: 'cbk.localhost:3000',
  siteHostname: 'cbk.localhost',
  apiUrl: 'http://cbk.localhost:3000',
  apiHost: 'cbk.localhost:3000',
}))

import { schema } from '@/graphql/v1/schema'

const context = { session: { user: { id: 'user_1' } }, caller: null }

describe('Portal.url', () => {
  it('is the origin the portal is served on, scheme and port included', async () => {
    const result = await graphql({
      schema,
      source: `
        query {
          portals(first: 1) {
            edges {
              node {
                slug
                url
              }
            }
          }
        }
      `,
      contextValue: context,
    })

    expect(result.errors).toBeUndefined()
    // @note a hard-coded https would advertise an origin the local stack
    // does not serve
    expect(result.data.portals.edges[0].node).toEqual({
      slug: 'acme',
      url: 'http://acme.cbk.localhost:3000',
    })
  })
})
