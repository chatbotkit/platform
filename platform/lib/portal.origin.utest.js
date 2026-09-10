import { getPortalFrontendHost, getPortalFrontendURL } from '@/lib/portal.slug'
import { getPortalGlobalConfig } from '@/lib/portal.config'

jest.mock('@/config/apexes', () => ({ portalApex: 'portal.example' }))
jest.mock('@/config/site', () => ({
  siteUrl: 'http://console.example:3000',
  siteHost: 'console.example:3000',
  siteHostname: 'console.example',
}))
jest.mock('@/lib/portal.config', () => ({
  getPortalGlobalConfig: jest.fn(async () => null),
}))

describe('portal origins', () => {
  it('inherits the site scheme and port for deployment-issued portals', async () => {
    const portal = { slug: 'acme', userId: 'owner' }

    await expect(getPortalFrontendHost(portal)).resolves.toBe('acme.portal.example:3000')
    await expect(getPortalFrontendURL(portal)).resolves.toBe('http://acme.portal.example:3000')
  })

  it('does not copy the site port onto a partner custom domain', async () => {
    getPortalGlobalConfig.mockResolvedValue({ domain: 'customer.example' })

    const portal = { slug: 'acme-customer-example', userId: 'owner' }

    await expect(getPortalFrontendHost(portal)).resolves.toBe('acme.customer.example')
    await expect(getPortalFrontendURL(portal)).resolves.toBe('https://acme.customer.example')
  })
})
