import prisma from '@/prisma/client'

import { setupHeadersContext } from '@/lib/context.setup'
import { executeInContext } from '@/lib/context.store'
import { resolveSpaceSiteConfigByHost } from '@/lib/space.site.serve'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: { spaceSite: { findUnique: jest.fn() } },
}))

jest.mock('@/config/apexes', () => ({
  ...jest.requireActual('@/config/apexes'),
  spaceApex: 'spaces.mapping.localhost',
}))

jest.mock('@/config/hosts', () => ({
  ...jest.requireActual('@/config/hosts'),
  hostsConfig: {
    custom: {
      match: ['acme.spaces.mapping.localhost:4300'],
      site: 'console.mapping.localhost:4300',
      api: 'console.mapping.localhost:4300',
      static: 'console.mapping.localhost:4300',
      widgets: 'console.mapping.localhost:4300',
    },
    frontend: {
      match: ['upstream.spaces.mapping.localhost:4300'],
      site: 'public.spaces.mapping.localhost:4300',
      api: 'console.mapping.localhost:4300',
      static: 'console.mapping.localhost:4300',
      widgets: 'console.mapping.localhost:4300',
    },
  },
}))

describe('space site lookup with host mappings', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    prisma.spaceSite.findUnique.mockResolvedValue({
      spaceId: 'space-mapped',
      prefix: 'public',
      index: 'index.html',
      notFound: '404.html',
    })
  })

  it.each([
    ['acme.spaces.mapping.localhost:4300', 'acme'],
    ['upstream.spaces.mapping.localhost:4300', 'public'],
  ])('resolves %s using the recognized site identity', async (host, slug) => {
    await executeInContext(async () => {
      setupHeadersContext(new Headers({ host }))

      expect(await resolveSpaceSiteConfigByHost()).toEqual({
        spaceId: 'space-mapped',
        prefix: 'public',
        index: 'index.html',
        notFound: '404.html',
      })
      expect(prisma.spaceSite.findUnique).toHaveBeenCalledTimes(1)
      expect(prisma.spaceSite.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug } })
      )
    })
  })

  it('keeps unknown hosts out of the space lookup', async () => {
    await executeInContext(async () => {
      setupHeadersContext(new Headers({ host: 'unrelated.localhost:4300' }))

      expect(await resolveSpaceSiteConfigByHost()).toEqual({})
      expect(prisma.spaceSite.findUnique).not.toHaveBeenCalled()
    })
  })
})
