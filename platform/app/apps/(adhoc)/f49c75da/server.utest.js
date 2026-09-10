/**
 * @jest-environment node
 */
import { siteHost } from '@/config/site'

import { buildSlackManifestInstallUrl } from '@/lib/slack.manifest'

import { listIntegrations } from './server'

// @note the tests carry their own site fixture - a Compose-style origin with
// a port - instead of depending on whatever SITE_URL the shell exports
jest.mock('@/config/site', () => {
  const siteUrl = 'http://cbk.localhost:3000'
  const staticUrl = 'http://cbk-static.localhost:3000'
  const widgetUrl = 'http://cbk-widgets.localhost:3000'
  const apiUrl = 'http://cbk.localhost:3000'

  return {
    siteUrl,
    siteHostname: new URL(siteUrl).hostname,
    siteHost: new URL(siteUrl).host,
    staticUrl,
    staticHostname: new URL(staticUrl).hostname,
    staticHost: new URL(staticUrl).host,
    widgetUrl,
    widgetHostname: new URL(widgetUrl).hostname,
    widgetHost: new URL(widgetUrl).host,
    apiUrl,
    apiHostname: new URL(apiUrl).hostname,
    apiHost: new URL(apiUrl).host,
  }
})

jest.mock('@/lib/app.action', () => ({
  appActionHandler: (_app, _configSchema, _inputSchema, fn) => (input, context) =>
    fn({}, { user: { id: 'user_1' } }, input, context),
}))
jest.mock('@/lib/cbk.sdk', () => ({
  getSessionClient: jest.fn(async () => ({
    integration: {
      slack: {
        list: jest.fn(async () => ({
          items: [{ id: 'slack_1', name: 'Team', signingSecret: '', botToken: '' }],
        })),
      },
    },
  })),
}))
jest.mock('@/lib/slack.manifest', () => ({
  buildSlackManifestInstallUrl: jest.fn(() => 'https://api.slack.com/apps'),
}))

describe('slack integrations app listIntegrations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('builds the manifest on the origin the deployment serves', async () => {
    await listIntegrations({}, { host: 'cbk.localhost:3000' })

    // @note the manifest carries callback URLs; a hard-coded https origin
    // would send Slack to a scheme the local stack does not serve
    expect(buildSlackManifestInstallUrl).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'slack_1' }),
      'http://cbk.localhost:3000'
    )
  })

  it('falls back to the configured site origin without a request host', async () => {
    await listIntegrations({}, {})

    expect(buildSlackManifestInstallUrl).toHaveBeenCalledWith(
      expect.anything(),
      `http://${siteHost}`
    )
  })
})
