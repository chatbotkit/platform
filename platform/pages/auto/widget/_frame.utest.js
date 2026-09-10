/**
 * @jest-environment node
 */
import { getPartnerByHostname } from '@/lib/partner.helpers'

import { getServerSideProps } from './frame'

jest.mock('@/config/widget', () => ({
  autoWidgetModel: 'gpt-4o',
  autoWidgetUserId: 'auto-user',
}))
jest.mock('@/lib/session.get', () => ({
  getSoftSession: jest.fn(async () => ({ user: { id: 'user_1' } })),
}))
jest.mock('@/lib/user.type', () => ({
  isEffectivePartnerAccount: jest.fn(async () => false),
}))
jest.mock('@/lib/partner.helpers', () => ({
  getPartnerByHostname: jest.fn(async () => null),
}))
jest.mock('@/lib/conversation.create', () => ({
  createConversation: jest.fn(async () => ({ id: 'conv_1' })),
}))
jest.mock('@/lib/bot.conversation', () => ({
  getConversationDetails: jest.fn((details) => details),
}))
jest.mock(
  '@/pages/api/v1/conversation/[conversationId]/session/create',
  () => ({ createConversationSessionToken: jest.fn(async () => 'token') })
)
jest.mock('@/pages/integrations/widget/[widgetIntegrationId]/frame', () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock('@/hooks/useIsTop', () => jest.fn(() => true))

function context(host, method = 'GET') {
  const headers = {}
  const body = []

  return {
    query: { type: 'dashboard-assistant' },
    req: { method, url: '/auto/widget/frame', query: {}, headers: { host } },
    res: {
      setHeader: jest.fn((name, value) => {
        headers[name] = value
      }),
      write: jest.fn((chunk) => body.push(chunk)),
      end: jest.fn(),
      headers,
      body,
    },
  }
}

describe('auto widget frame getServerSideProps', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('allows the embedding origin with the scheme and port the deployment serves', async () => {
    const ctx = context('cbk.localhost:3000')

    await getServerSideProps(ctx)

    expect(ctx.res.headers['Content-Security-Policy']).toBe(
      "frame-ancestors 'self' http://cbk.localhost:3000"
    )
  })

  it('brands a partner by hostname and quotes its origin as served', async () => {
    getPartnerByHostname.mockResolvedValue({ name: 'AgenticOS' })

    const { createConversation } = jest.requireMock('@/lib/conversation.create')
    const ctx = context('backend.acme.localhost:3000', 'POST')

    await getServerSideProps(ctx)

    expect(getPartnerByHostname).toHaveBeenCalledWith('backend.acme.localhost')
    expect(createConversation).toHaveBeenCalledWith(
      'auto-user',
      expect.objectContaining({
        backstory: expect.stringContaining(
          'partner origin: http://backend.acme.localhost:3000'
        ),
      })
    )
  })
})
