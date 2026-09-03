jest.mock('@/prisma/client', () => ({
  user: {
    findUnique: jest.fn(),
  },
}))

jest.mock('@/lib/auth.signin', () => ({
  getSigninRedirect: jest.fn(() => ({
    destination: '/signin?callbackUrl=/welcome',
    permanent: false,
  })),
}))

jest.mock('@/lib/session.get', () => ({
  getSoftSession: jest.fn(),
}))

import prisma from '@/prisma/client'
import { getSoftSession } from '@/lib/session.get'
import { getServerSideProps } from '@/pages/welcome'

describe('welcome page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('redirects to signin when there is no session', async () => {
    getSoftSession.mockResolvedValue(null)

    const result = await getServerSideProps({
      req: {},
      res: {},
      query: {},
    })

    expect(result).toEqual({
      redirect: {
        destination: '/signin?callbackUrl=/welcome',
        permanent: false,
      },
    })
  })

  it('sends incomplete-profile users to onboarding regardless of host', async () => {
    getSoftSession.mockResolvedValue({
      user: {
        id: 'user_123',
      },
    })
    prisma.user.findUnique.mockResolvedValue({
      organization: null,
      role: null,
      industry: null,
      channel: null,
    })

    const result = await getServerSideProps({
      req: {},
      res: {},
      query: {},
    })

    expect(result).toEqual({
      redirect: {
        destination: '/new?template=onboarding',
        permanent: false,
      },
    })
  })

  it('redirects complete-profile users to overview', async () => {
    getSoftSession.mockResolvedValue({
      user: {
        id: 'user_123',
      },
    })
    prisma.user.findUnique.mockResolvedValue({
      organization: 'Acme',
      role: 'Founder',
      industry: 'Software',
      channel: 'website',
    })

    const result = await getServerSideProps({
      req: {},
      res: {},
      query: {},
    })

    expect(result).toEqual({
      redirect: {
        destination: '/overview',
        permanent: false,
      },
    })
  })

  it('forces onboarding with force=true even when the profile is complete', async () => {
    getSoftSession.mockResolvedValue({
      user: {
        id: 'user_123',
      },
    })
    prisma.user.findUnique.mockResolvedValue({
      organization: 'Acme',
      role: 'Founder',
      industry: 'Software',
      channel: 'website',
    })

    const result = await getServerSideProps({
      req: {},
      res: {},
      query: {
        force: 'true',
      },
    })

    expect(result).toEqual({
      redirect: {
        destination: '/new?template=onboarding',
        permanent: false,
      },
    })
  })
})
