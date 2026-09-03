import {
  notify,
  notifyExceededAccountLimits,
  notifyExceededDatabaseLimits,
  notifyExceededRateLimits,
  notifyNearlyExceededAccountLimits,
  notifyNearlyExceededDatabaseLimits,
  notifyTeamInvitation,
  notifyTrialStart,
} from '@/lib/notify'
import { fastGetUserByEmail, fastGetUserById } from '@/lib/user.get'

jest.mock('react-email', () => ({
  render: jest.fn().mockImplementation(async (element, options) => {
    if (options?.plainText) {
      return 'Mock plain text email content'
    }

    return '<html><body>Mock HTML email content</body></html>'
  }),
}))

jest.mock('@/lib/md.convert', () => ({
  toHtml: jest.fn().mockResolvedValue('<p>Mock HTML content</p>'),
  toText: jest.fn().mockResolvedValue('Mock text content'),
}))

jest.mock('@chatbotkit-dev/time', () => ({
  getShortDate: jest.fn().mockReturnValue('2025-08-11'),
  ONE_WEEK_IN_SECONDS: 604800,
  ONE_DAY_IN_SECONDS: 86400,
}))

jest.mock('@/layouts/Email', () => ({
  BrandedEmail: ({ children }) => children,
  Text: ({ children }) => children,
  Button: ({ children }) => children,
}))

jest.mock('@/lib/user.get', () => ({
  fastGetUserByEmail: jest.fn().mockResolvedValue({
    id: 'test-user-id',
    email: 'user@example.com',
    name: 'Test User',
  }),
  // @note used by user.type's partner resolver when a user has a parentId
  fastGetUserById: jest.fn(),
}))

jest.mock('@chatbotkit-dev/email', () => ({
  sendEmailNotification: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@chatbotkit-dev/partners', () => ({
  __esModule: true,
  default: {
    test: {
      id: 'test-whitelabel-partner',
      whitelabel: true,
    },
  },
}))

jest.mock('@/lib/user.identity', () => ({
  getChildUserIdentityEmail: jest.fn((userId) => `${userId}@user.internal`),
  isUserIdentityEmail: jest.fn((email) => email.endsWith('@user.internal')),
}))

jest.mock('@/lib/ratelimit', () => ({
  slidingWindow: jest.fn().mockResolvedValue({ success: true }),
}))

describe('notify', () => {
  it('does not send or render email for a database-only User identity', async () => {
    const { render } = jest.requireMock('react-email')
    const { sendEmailNotification } = jest.requireMock('@chatbotkit-dev/email')
    const transport = { send: jest.fn() }

    await notify(
      { id: 'child-user-id', email: 'child-user-id@user.internal' },
      'test',
      null,
      'Test subject',
      { skipRateCheck: true, transport }
    )

    expect(render).not.toHaveBeenCalled()
    expect(sendEmailNotification).not.toHaveBeenCalled()
    expect(transport.send).not.toHaveBeenCalled()
  })
})

describe('notifyTrialStart', () => {
  it('must correctly send trial start email', async () => {
    const user = await fastGetUserByEmail('user@example.com')

    await expect(notifyTrialStart(user)).resolves.not.toThrowError()
  })
})

describe('notifyExceededRateLimits', () => {
  it('must correctly send exceeded rate limits email', async () => {
    const user = await fastGetUserByEmail('user@example.com')

    await expect(notifyExceededRateLimits(user, [])).resolves.not.toThrowError()
  })
})

describe('notifyExceededAccountLimits', () => {
  it('must correctly send exceeded account limits email', async () => {
    const user = await fastGetUserByEmail('user@example.com')

    await expect(
      notifyExceededAccountLimits(user, [])
    ).resolves.not.toThrowError()
  })
})

describe('notifyNearlyExceededAccountLimits', () => {
  it('must correctly send nearly exceeded account limits email', async () => {
    const user = await fastGetUserByEmail('user@example.com')

    await expect(
      notifyNearlyExceededAccountLimits(user, [])
    ).resolves.not.toThrowError()
  })
})

describe('notifyTeamInvitation', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    const { render } = jest.requireMock('react-email')

    render
      .mockResolvedValueOnce('plain text version')
      .mockResolvedValueOnce('<html>html version</html>')
  })

  it('should send team invitation email with team details', async () => {
    const { sendEmailNotification } = jest.requireMock('@chatbotkit-dev/email')
    const user = {
      id: 'user123',
      email: 'test@example.com',
      name: 'Test User',
    }

    await notifyTeamInvitation({
      user,
      teamName: 'Test Team',
      teamDescription: 'A test team description',
    })

    expect(sendEmailNotification).toHaveBeenCalledWith({
      to: 'test@example.com',
      subject: 'Welcome to your team on ChatBotKit',
      content: {
        text: 'plain text version',
        html: '<html>html version</html>',
      },
      essential: true,
    })
  })

  it('should send team invitation email without description', async () => {
    const { sendEmailNotification } = jest.requireMock('@chatbotkit-dev/email')
    const user = {
      id: 'user456',
      email: 'user@example.com',
    }

    await notifyTeamInvitation({ user, teamName: 'Simple Team' })

    expect(sendEmailNotification).toHaveBeenCalledWith({
      to: 'user@example.com',
      subject: 'Welcome to your team on ChatBotKit',
      content: {
        text: 'plain text version',
        html: '<html>html version</html>',
      },
      essential: true,
    })
  })

  it('should render email template with correct props', async () => {
    const { render } = jest.requireMock('react-email')
    const user = {
      id: 'user789',
      email: 'member@example.com',
      name: 'New Member',
    }

    await notifyTeamInvitation({
      user,
      teamName: 'Amazing Team',
      teamDescription: 'An amazing team for collaboration',
    })

    expect(render).toHaveBeenCalledTimes(2)
    expect(render).toHaveBeenNthCalledWith(1, expect.anything(), {
      plainText: true,
    })
    expect(render).toHaveBeenNthCalledWith(2, expect.anything())
  })

  it('should handle null team name gracefully', async () => {
    const { sendEmailNotification } = jest.requireMock('@chatbotkit-dev/email')
    const user = {
      id: 'user999',
      email: 'test@example.com',
    }

    await notifyTeamInvitation({
      user,
      teamName: null,
      teamDescription: 'A team description',
    })

    expect(sendEmailNotification).toHaveBeenCalledWith({
      to: 'test@example.com',
      subject: 'Welcome to your team on ChatBotKit',
      content: {
        text: 'plain text version',
        html: '<html>html version</html>',
      },
      essential: true,
    })
  })

  it('should handle undefined team name and description', async () => {
    const { sendEmailNotification } = jest.requireMock('@chatbotkit-dev/email')
    const user = {
      id: 'user1000',
      email: 'test@example.com',
    }

    await notifyTeamInvitation({
      user,
      teamName: undefined,
      teamDescription: undefined,
    })

    expect(sendEmailNotification).toHaveBeenCalledWith({
      to: 'test@example.com',
      subject: 'Welcome to your team on ChatBotKit',
      content: {
        text: 'plain text version',
        html: '<html>html version</html>',
      },
      essential: true,
    })
  })

  it('should handle empty string team name', async () => {
    const { sendEmailNotification } = jest.requireMock('@chatbotkit-dev/email')
    const user = {
      id: 'user1001',
      email: 'test@example.com',
    }

    await notifyTeamInvitation({ user, teamName: '', teamDescription: '  ' })

    expect(sendEmailNotification).toHaveBeenCalledWith({
      to: 'test@example.com',
      subject: 'Welcome to your team on ChatBotKit',
      content: {
        text: 'plain text version',
        html: '<html>html version</html>',
      },
      essential: true,
    })
  })
})

// @note whitelabel partners run their own billing, so our ChatBotKit-branded
// limit emails must never reach their customers.
describe('whitelabel limit-email suppression', () => {
  const WHITELABEL_PARTNER_ID = 'test-whitelabel-partner'

  // @note every limit notification is gated on the same guard
  const limitNotifiers = [
    ['notifyExceededRateLimits', notifyExceededRateLimits],
    ['notifyExceededDatabaseLimits', notifyExceededDatabaseLimits],
    ['notifyNearlyExceededDatabaseLimits', notifyNearlyExceededDatabaseLimits],
    ['notifyExceededAccountLimits', notifyExceededAccountLimits],
    ['notifyNearlyExceededAccountLimits', notifyNearlyExceededAccountLimits],
  ]

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each(limitNotifiers)(
    '%s must NOT email a whitelabel partner account',
    async (_name, notifier) => {
      const { sendEmailNotification } = jest.requireMock(
        '@chatbotkit-dev/email'
      )

      const user = {
        id: `sub-${WHITELABEL_PARTNER_ID}`,
        email: 'customer@partner.example',
      }

      await notifier(user, [])

      expect(sendEmailNotification).not.toHaveBeenCalled()
    }
  )

  it('must NOT email a whitelabel user (resolved via parent)', async () => {
    const { sendEmailNotification } = jest.requireMock('@chatbotkit-dev/email')

    fastGetUserById.mockResolvedValue({ id: WHITELABEL_PARTNER_ID })

    const user = {
      id: 'some-user',
      email: 'customer@partner.example',
      parentId: 'partner-parent-id',
    }

    await notifyExceededAccountLimits(user, [])

    expect(fastGetUserById).toHaveBeenCalledWith('partner-parent-id')
    expect(sendEmailNotification).not.toHaveBeenCalled()
  })

  it.each(limitNotifiers)(
    '%s must still email a non-whitelabel account',
    async (name, notifier) => {
      const { sendEmailNotification } = jest.requireMock(
        '@chatbotkit-dev/email'
      )

      // @note distinct id per case so the in-memory notification dedup cache
      // does not swallow the send
      const user = {
        id: `regular-user-${name}`,
        email: 'user@example.com',
      }

      await notifier(user, [])

      expect(sendEmailNotification).toHaveBeenCalledTimes(1)
    }
  )
})
