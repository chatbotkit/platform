/**
 * @jest-environment node
 */
import { mockDeep } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { setContextFrontendHost } from '@/lib/context.store'
import { captureException } from '@/lib/error'
import { setupFrontendHostContext } from '@/lib/integration.context'
import { getPortalFrontendHost } from '@/lib/portal.slug'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/context.store', () => ({
  setContextFrontendHost: jest.fn(),
}))

jest.mock('@/lib/error', () => ({
  captureException: jest.fn(),
}))

jest.mock('@/lib/portal.slug', () => ({
  getPortalFrontendHost: jest.fn(),
}))

describe('integration.context', () => {
  const userId = 'user-123'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('setupFrontendHostContext', () => {
    it('sets frontend host from first portal for context-based link rewriting', async () => {
      const mockPortal = {
        id: 'portal-123',
        slug: 'test-portal',
      }

      const mockFrontendHost = 'test-portal.chatbotkit.agency'

      prisma.portal.findFirst.mockResolvedValue(mockPortal)
      getPortalFrontendHost.mockResolvedValue(mockFrontendHost)

      await setupFrontendHostContext({ id: userId })

      expect(prisma.portal.findFirst).toHaveBeenCalledWith({
        where: {
          userId,
        },
        select: {
          id: true,
          slug: true,
          userId: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      })

      expect(getPortalFrontendHost).toHaveBeenCalledWith(mockPortal)
      expect(setContextFrontendHost).toHaveBeenCalledWith(mockFrontendHost)
    })

    it('handles custom domain pattern for acme.dev portals', async () => {
      const mockPortal = {
        id: 'portal-123',
        slug: 'company-acme-dev',
      }

      const mockFrontendHost = 'company.acme.dev'

      prisma.portal.findFirst.mockResolvedValue(mockPortal)
      getPortalFrontendHost.mockResolvedValue(mockFrontendHost)

      await setupFrontendHostContext({ id: userId })

      expect(getPortalFrontendHost).toHaveBeenCalledWith(mockPortal)
      expect(setContextFrontendHost).toHaveBeenCalledWith(mockFrontendHost)
    })

    it('continues without frontend host when no portal is found', async () => {
      prisma.portal.findFirst.mockResolvedValue(null)

      await setupFrontendHostContext({ id: userId })

      expect(prisma.portal.findFirst).toHaveBeenCalled()
      expect(getPortalFrontendHost).not.toHaveBeenCalled()
      expect(setContextFrontendHost).not.toHaveBeenCalled()
    })

    it('continues without frontend host when portal lookup fails', async () => {
      const error = new Error('Database error')

      prisma.portal.findFirst.mockRejectedValue(error)

      await setupFrontendHostContext({ id: userId })

      expect(prisma.portal.findFirst).toHaveBeenCalled()
      expect(captureException).toHaveBeenCalledWith(error)
      expect(setContextFrontendHost).not.toHaveBeenCalled()
    })

    it('continues without frontend host when getPortalFrontendHost fails', async () => {
      const mockPortal = {
        id: 'portal-123',
        slug: 'test-portal',
      }

      const error = new Error('Portal frontend host error')

      prisma.portal.findFirst.mockResolvedValue(mockPortal)
      getPortalFrontendHost.mockRejectedValue(error)

      await setupFrontendHostContext({ id: userId })

      expect(prisma.portal.findFirst).toHaveBeenCalled()
      expect(getPortalFrontendHost).toHaveBeenCalledWith(mockPortal)
      expect(captureException).toHaveBeenCalledWith(error)
      expect(setContextFrontendHost).not.toHaveBeenCalled()
    })
  })
})
