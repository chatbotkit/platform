import { getInstallCode } from '@/pages/integrations/widget/[widgetIntegrationId]/index'

jest.mock('@/prisma/client', () => ({}))
jest.mock('@/lib/session.get', () => ({ getSoftSession: jest.fn() }))
jest.mock('@/config/site', () => ({
  siteUrl: 'http://console.example',
  siteHost: 'console.example',
  siteHostname: 'console.example',
  staticUrl: 'http://assets.example:8080',
  staticHost: 'assets.example:8080',
  staticHostname: 'assets.example',
  apiUrl: 'http://console.example',
  apiHost: 'console.example',
}))

describe('widget install origin', () => {
  it('preserves the configured static scheme and port', () => {
    const container = document.createElement('div')

    container.innerHTML = getInstallCode({ id: 'demo' }, 'assets.example:8080')

    const script = container.querySelector('script')

    expect(script.src).toBe('http://assets.example:8080/integrations/widget/v2.js')
    expect(script.dataset.widget).toBe('demo')
  })
})
