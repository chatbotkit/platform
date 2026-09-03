/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { notifyTeamInvitation } from '@/lib/notify'

import handler from './resend'

jest.mock('@/prisma/client', () => {
  const { mockDeep } = require('jest-mock-extended')

  return {
    __esModule: true,
    default: mockDeep(),
  }
})

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withUserSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, key) => req.query[key]),
}))

jest.mock('@/lib/response', () => ({
  ok: jest.fn((data) => ({ status: 200, body: data })),
  notFound: jest.fn(() => ({ status: 404 })),
  notAuthorized: jest.fn(() => ({ status: 403 })),
}))

jest.mock('@/lib/notify', () => ({
  notifyTeamInvitation: jest.fn(),
}))

jest.mock('@/lib/error', () => ({
  captureException: jest.fn(),
}))

jest.mock('@/lib/context.store', () => ({
  getContextFrontendHost: jest.fn(() => null),
  getContextRequestHost: jest.fn(() => null),
}))

jest.mock('@/lib/partner.helpers', () => ({
  getPartnerByHostname: jest.fn(),
  partnerToEmailBranding: jest.fn(() => ({
    logoUrl: 'https://logo.example.com',
  })),
}))

describe('POST /api/v1/team/[teamId]/membership/[teamMembershipId]/invite/resend', () => {
  const mockSession = {
    user: { id: 'user_123' },
  }

  const mockTeam = {
    id: 'team_abc',
    userId: 'user_123',
    name: 'My Team',
    description: 'A test team',
  }

  const mockTeamMembership = {
    id: 'membership_xyz',
    teamId: 'team_abc',
    email: 'invited@example.com',
  }

  beforeEach(() => {
    mockReset(prisma)
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should resend the invitation email and return membership id', async () => {
      prisma.team.findUniqueByIdentifier.mockResolvedValue(mockTeam)
      prisma.teamMembership.findFirst.mockResolvedValue(mockTeamMembership)
      notifyTeamInvitation.mockResolvedValue(undefined)

      const req = {
        query: { teamId: 'team_abc', teamMembershipId: 'membership_xyz' },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(result.body.id).toBe('membership_xyz')
    })

    it('should send the notification with team info and member email', async () => {
      prisma.team.findUniqueByIdentifier.mockResolvedValue(mockTeam)
      prisma.teamMembership.findFirst.mockResolvedValue(mockTeamMembership)
      notifyTeamInvitation.mockResolvedValue(undefined)

      const req = {
        query: { teamId: 'team_abc', teamMembershipId: 'membership_xyz' },
      }

      await handler(req, mockSession)

      expect(notifyTeamInvitation).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({ email: 'invited@example.com' }),
          teamName: 'My Team',
          teamDescription: 'A test team',
        })
      )
    })
  })

  describe('authorization', () => {
    it('should return 404 when team is not found', async () => {
      prisma.team.findUniqueByIdentifier.mockResolvedValue(null)

      const req = {
        query: { teamId: 'nonexistent', teamMembershipId: 'membership_xyz' },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
      expect(notifyTeamInvitation).not.toHaveBeenCalled()
    })

    it('should return 403 when user does not own the team', async () => {
      prisma.team.findUniqueByIdentifier.mockResolvedValue({
        ...mockTeam,
        userId: 'other_user',
      })

      const req = {
        query: { teamId: 'team_abc', teamMembershipId: 'membership_xyz' },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
      expect(notifyTeamInvitation).not.toHaveBeenCalled()
    })

    it('should return 404 when membership is not found', async () => {
      prisma.team.findUniqueByIdentifier.mockResolvedValue(mockTeam)
      prisma.teamMembership.findFirst.mockResolvedValue(null)

      const req = {
        query: { teamId: 'team_abc', teamMembershipId: 'nonexistent' },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
      expect(notifyTeamInvitation).not.toHaveBeenCalled()
    })

    it('should scope membership lookup to the team', async () => {
      prisma.team.findUniqueByIdentifier.mockResolvedValue(mockTeam)
      prisma.teamMembership.findFirst.mockResolvedValue(mockTeamMembership)
      notifyTeamInvitation.mockResolvedValue(undefined)

      const req = {
        query: { teamId: 'team_abc', teamMembershipId: 'membership_xyz' },
      }

      await handler(req, mockSession)

      expect(prisma.teamMembership.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'membership_xyz',
            teamId: 'team_abc',
          }),
        })
      )
    })
  })

  describe('error handling', () => {
    it('should still return 200 when notification fails (error is caught)', async () => {
      const { captureException } = require('@/lib/error')

      prisma.team.findUniqueByIdentifier.mockResolvedValue(mockTeam)
      prisma.teamMembership.findFirst.mockResolvedValue(mockTeamMembership)
      notifyTeamInvitation.mockRejectedValue(
        new Error('Email service unavailable')
      )

      const req = {
        query: { teamId: 'team_abc', teamMembershipId: 'membership_xyz' },
      }
      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(captureException).toHaveBeenCalledWith(expect.any(Error))
    })
  })

  describe('partner branding', () => {
    it('should use partner branding when host matches a partner', async () => {
      const { getContextFrontendHost } = require('@/lib/context.store')
      const {
        getPartnerByHostname,
        partnerToEmailBranding,
      } = require('@/lib/partner.helpers')

      getContextFrontendHost.mockReturnValue('partner.example.com')
      getPartnerByHostname.mockResolvedValue({
        name: 'Partner Inc',
        id: 'partner_1',
      })
      partnerToEmailBranding.mockReturnValue({
        logoUrl: 'https://partner.example.com/logo.png',
      })

      prisma.team.findUniqueByIdentifier.mockResolvedValue(mockTeam)
      prisma.teamMembership.findFirst.mockResolvedValue(mockTeamMembership)
      notifyTeamInvitation.mockResolvedValue(undefined)

      const req = {
        query: { teamId: 'team_abc', teamMembershipId: 'membership_xyz' },
        headers: { host: 'partner.example.com' },
      }

      await handler(req, mockSession)

      expect(notifyTeamInvitation).toHaveBeenCalledWith(
        expect.objectContaining({
          branding: expect.objectContaining({
            logoUrl: 'https://partner.example.com/logo.png',
          }),
        })
      )
    })

    it('should not include branding when no partner is found', async () => {
      const { getContextFrontendHost } = require('@/lib/context.store')
      const { getPartnerByHostname } = require('@/lib/partner.helpers')

      getContextFrontendHost.mockReturnValue('unknown.example.com')
      getPartnerByHostname.mockResolvedValue(null)

      prisma.team.findUniqueByIdentifier.mockResolvedValue(mockTeam)
      prisma.teamMembership.findFirst.mockResolvedValue(mockTeamMembership)
      notifyTeamInvitation.mockResolvedValue(undefined)

      const req = {
        query: { teamId: 'team_abc', teamMembershipId: 'membership_xyz' },
      }

      await handler(req, mockSession)

      expect(notifyTeamInvitation).toHaveBeenCalledWith(
        expect.objectContaining({ branding: undefined })
      )
    })
  })
})
