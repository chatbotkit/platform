import prisma from '@/prisma/client'

import { getAppSlugByHostname } from '@/lib/app.helpers'
import { setupHeadersContext } from '@/lib/context.setup'
import { executeInContext } from '@/lib/context.store'

import {
  createSpaceSiteHandler,
  getAppMountBaseHref,
  resolveSpaceSiteConfig,
} from './lib'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: { portal: { findUnique: jest.fn().mockResolvedValue(null) } },
}))

jest.mock('@/config/apexes', () => ({
  ...jest.requireActual('@/config/apexes'),
  appApex: 'apps.static-test.localhost',
  portalApex: 'portals.static-test.localhost',
}))

jest.mock('@/config/hosts', () => ({
  ...jest.requireActual('@/config/hosts'),
  hostsConfig: {
    custom: {
      match: [
        'static.apps.static-test.localhost:4300',
        'acme.portals.static-test.localhost:4300',
      ],
      site: 'public.static-test.localhost:4300',
      api: 'public.static-test.localhost:4300',
      static: 'public.static-test.localhost:4300',
      widgets: 'public.static-test.localhost:4300',
    },
    portal: {
      match: ['upstream.portals.static-test.localhost:4300'],
      site: 'public.portals.static-test.localhost:4300',
      api: 'public.static-test.localhost:4300',
      static: 'public.static-test.localhost:4300',
      widgets: 'public.static-test.localhost:4300',
    },
  },
}))

describe('static app host mappings', () => {
  beforeEach(() => jest.clearAllMocks())

  it('keeps relative resources at the root of a mapped static app host', async () => {
    expect(getAppSlugByHostname('static.apps.static-test.localhost')).toBe(
      'static'
    )

    await executeInContext(async () => {
      setupHeadersContext(
        new Headers({ host: 'static.apps.static-test.localhost:4300' })
      )

      const request = new Request(
        'http://static.apps.static-test.localhost:4300/apps/static/about/'
      )

      expect(getAppMountBaseHref(request, { params: { path: ['about'] } })).toBe(
        '/about/'
      )
    })
  })

  it('does not redirect missing documents back into the mapped static app', async () => {
    const handler = createSpaceSiteHandler({ getBaseHref: getAppMountBaseHref })
    const response = await handler(
      new Request(
        'http://static.apps.static-test.localhost:4300/apps/static/missing',
        {
          headers: {
            host: 'static.apps.static-test.localhost:4300',
            accept: 'text/html',
          },
        }
      ),
      { params: { path: ['missing'] } }
    )

    expect(response.status).toBe(404)
    expect(await response.text()).toBe('')
  })

  it('looks up the routed portal when its mapped frontend has a custom name', async () => {
    await executeInContext(async () => {
      setupHeadersContext(
        new Headers({ host: 'acme.portals.static-test.localhost:4300' })
      )

      await resolveSpaceSiteConfig()

      expect(prisma.portal.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug: 'acme' } })
      )
    })
  })

  it('keeps a recognized frontend portal ahead of the routing portal', async () => {
    await executeInContext(async () => {
      setupHeadersContext(
        new Headers({ host: 'upstream.portals.static-test.localhost:4300' })
      )

      await resolveSpaceSiteConfig()

      expect(prisma.portal.findUnique).toHaveBeenCalledTimes(1)
      expect(prisma.portal.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug: 'public' } })
      )
    })
  })

  it('does not look up a portal for an unrelated site host', async () => {
    await executeInContext(async () => {
      setupHeadersContext(
        new Headers({ host: 'console.static-test.localhost:4300' })
      )

      await resolveSpaceSiteConfig()

      expect(prisma.portal.findUnique).not.toHaveBeenCalled()
    })
  })
})
