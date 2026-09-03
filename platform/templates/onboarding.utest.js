import { resolveBuilderExperience } from '@/lib/experience'

import { getDocumentHostname } from '@/hooks/useHostname'
import { getPartnerFromDocument } from '@/hooks/usePartner'

import template from '@/templates/onboarding'

jest.mock('@/lib/experience', () => ({
  resolveBuilderExperience: jest.fn(),
}))

jest.mock('@/hooks/useHostname', () => ({
  getDocumentHostname: jest.fn(),
}))

jest.mock('@/hooks/usePartner', () => ({
  getPartnerFromDocument: jest.fn(),
}))

const fetchMock = jest.fn()

describe('onboarding template', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    delete window.location
    window.location = { href: '', hostname: 'chatbotkit.com' }

    getDocumentHostname.mockReturnValue('chatbotkit.com')
    getPartnerFromDocument.mockReturnValue(null)
    resolveBuilderExperience.mockReturnValue(true)

    fetchMock.mockResolvedValue({ error: null })
  })

  describe('steps', () => {
    it('includes the intent step on the builder experience', () => {
      resolveBuilderExperience.mockReturnValue(true)

      expect(template.steps).toEqual([
        ':disabled',
        '/new/intent',
        '/new/goal',
        '/new/user',
        '/new/channel',
      ])
    })

    it('skips the intent step on the platform experience', () => {
      resolveBuilderExperience.mockReturnValue(false)
      getDocumentHostname.mockReturnValue('platform.example.com')

      expect(template.steps).toEqual([
        ':disabled',
        '/new/goal',
        '/new/user',
        '/new/channel',
      ])

      expect(resolveBuilderExperience).toHaveBeenCalledWith({
        partnerExperience: undefined,
        hostname: 'platform.example.com',
      })
    })

    it('resolves the experience a partner pins over the hostname', () => {
      getDocumentHostname.mockReturnValue('backend.acme.dev')
      getPartnerFromDocument.mockReturnValue({
        name: 'AgenticOS',
        experience: 'builder',
      })

      template.steps

      expect(resolveBuilderExperience).toHaveBeenCalledWith({
        partnerExperience: 'builder',
        hostname: 'backend.acme.dev',
      })
    })
  })

  describe('task', () => {
    it('saves the customer details', async () => {
      await template.task({
        values: {
          channel: 'website',
          organization: 'Acme',
          industry: 'Software',
          role: 'Founder',
          goal: 'Support',
          intent: 'website-agent',
        },
        fetch: fetchMock,
      })

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/me/update',
        expect.objectContaining({
          data: {
            channel: 'website',
            organization: 'Acme',
            industry: 'Software',
            role: 'Founder',
            goal: 'Support',
          },
        })
      )
    })

    it('continues to template creation when an intent is selected', async () => {
      const result = await template.task({
        values: {
          intent: 'website-agent',
        },
        fetch: fetchMock,
      })

      expect(typeof result.successButtonAction).toBe('function')

      result.successButtonAction()

      expect(window.location.href).toBe(
        '/new?template=widget-agent&from=onboarding'
      )
    })

    it('maps the intent to the matching template', async () => {
      const result = await template.task({
        values: {
          intent: 'ready-made-solution',
        },
        fetch: fetchMock,
      })

      result.successButtonAction()

      expect(window.location.href).toBe('/new?template=example&from=onboarding')
    })

    it('ends at the dashboard when no intent is selected', async () => {
      const result = await template.task({
        values: {
          channel: 'website',
        },
        fetch: fetchMock,
      })

      expect(result).toEqual({
        successMessage: 'Your information has been saved.',
        successButtonAction: '/overview',
        successButtonCaption: 'Continue to your dashboard',
      })
    })

    it('throws when saving the customer details fails', async () => {
      fetchMock.mockResolvedValue({ error: 'update failed' })

      await expect(
        template.task({
          values: {},
          fetch: fetchMock,
        })
      ).rejects.toThrow('update failed')
    })
  })
})
