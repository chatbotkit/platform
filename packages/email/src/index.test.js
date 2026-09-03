import provider, {
  assertConfigured,
  createEmailTransport,
  detectVendor,
  formatIntegrationInbox,
  formatIntegrationMessageId,
  parseInboundEmail,
  sendEmailAction,
  sendEmailNotification,
} from './index'

const ENV = [
  'EMAIL_PROVIDER',
  'EMAIL_FROM',
  'EMAIL_ACTIONS_FROM',
  'EMAIL_REPLY_TO',
  'RESEND_API_KEY',
  'SENDGRID_API_KEY',
  'SES_AWS_REGION',
  'SES_AWS_ACCESS_KEY_ID',
  'SES_AWS_SECRET_ACCESS_KEY',
  'SITE_URL',
]

describe('community email provider', () => {
  let logged

  // eslint-disable-next-line no-console
  const original = console.log

  beforeEach(() => {
    logged = []

    // eslint-disable-next-line no-console
    console.log = (...args) => {
      logged.push(args.map(String).join(' '))
    }

    for (const name of ENV) {
      delete process.env[name]
    }
  })

  afterEach(() => {
    // eslint-disable-next-line no-console
    console.log = original

    for (const name of ENV) {
      delete process.env[name]
    }
  })

  it('satisfies the provider contract', () => {
    expect(typeof provider.sendEmailNotification).toBe('function')
    expect(typeof provider.sendEmailAction).toBe('function')
    expect(typeof provider.createEmailTransport).toBe('function')
    expect(typeof provider.assertConfigured).toBe('function')
  })

  it('reports a notification without delivering it', async () => {
    await sendEmailNotification({
      to: 'user@example.com',
      subject: 'Your trial has started',
      content: { text: 'hello', html: '<p>hello</p>' },
    })

    expect(logged).toHaveLength(1)
    expect(logged[0]).toContain('[email:notification]')
    expect(logged[0]).toContain('user@example.com')
  })

  it('reports an action without delivering it', async () => {
    await sendEmailAction({
      to: 'third@example.com',
      subject: 'Re: your enquiry',
      content: { text: 'hello', html: '<p>hello</p>' },
      from: 'agent@example.com',
    })

    expect(logged).toHaveLength(1)
    expect(logged[0]).toContain('[email:action]')
  })

  it('logs the text body framed as mail, which is the only delivery there is', async () => {
    await sendEmailNotification({
      to: 'user@example.com',
      subject: 'Sign in',
      content: {
        text: 'your code:\n123456',
        html: '<a>123456</a>',
      },
    })

    expect(logged.join('\n')).toContain('│ your code:')
    expect(logged.join('\n')).toContain('│ 123456')
    expect(logged.join('\n')).toContain('┌')
    expect(logged.join('\n')).toContain('└')
  })

  it('reports a transport send as the identity it was created with', async () => {
    await createEmailTransport('Acme <login@acme.example>').send({
      to: 'user@example.com',
      subject: 'Sign in',
      text: 'hello',
      html: '<p>hello</p>',
    })

    expect(logged).toHaveLength(1)
    expect(logged[0]).toContain(
      '[email:transport from=Acme <login@acme.example>]'
    )
    expect(logged[0]).toContain('to=user@example.com')
  })

  it('creates a transport without touching the environment', () => {
    process.env.EMAIL_PROVIDER = 'postmark'

    // @note a configuration catalogue constructs transports at import, so
    // even a broken vendor pin must not surface until send

    expect(() => createEmailTransport('Acme <login@acme.example>')).not.toThrow()
  })

  it('never logs the html part', async () => {
    await sendEmailNotification({
      to: 'user@example.com',
      subject: 'Sign in',
      content: { text: 'plain', html: '<p class="only-in-html">plain</p>' },
    })

    expect(logged.join('\n')).not.toContain('only-in-html')
  })

  describe('integration inboxes', () => {
    it('derives the inbox domain from SITE_URL', () => {
      process.env.SITE_URL = 'https://app.example.com/some/path'

      expect(formatIntegrationInbox('abc123')).toBe(
        'abc123@integration.app.example.com'
      )
    })

    it('falls back to localhost without a usable SITE_URL', () => {
      expect(formatIntegrationInbox('abc123')).toBe(
        'abc123@integration.localhost'
      )

      process.env.SITE_URL = 'not a url'

      expect(formatIntegrationInbox('abc123')).toBe(
        'abc123@integration.localhost'
      )
    })

    it('mints a distinct RFC 5322 message id on the same domain', () => {
      process.env.SITE_URL = 'https://app.example.com'

      const first = formatIntegrationMessageId('abc123')
      const second = formatIntegrationMessageId('abc123')

      expect(first).toMatch(/^<[0-9a-f-]{36}@integration\.app\.example\.com>$/)
      expect(second).not.toBe(first)
    })

    it('declines inbound mail and says so', async () => {
      const form = new FormData()

      form.set('from', 'someone@example.com')
      form.set('to', 'abc123@integration.localhost')
      form.set('subject', 'Hello')

      await expect(parseInboundEmail(form)).resolves.toBeNull()

      expect(logged).toHaveLength(1)
      expect(logged[0]).toContain('[email:inbound]')
    })
  })

  describe('detectVendor', () => {
    it('prints when no credentials are present', () => {
      expect(detectVendor()).toBe('print')
    })

    it('picks Resend from its key', () => {
      process.env.RESEND_API_KEY = 'x'

      expect(detectVendor()).toBe('resend')
    })

    it('picks SendGrid from its key', () => {
      process.env.SENDGRID_API_KEY = 'x'

      expect(detectVendor()).toBe('sendgrid')
    })

    it('picks SES from its access key id', () => {
      process.env.SES_AWS_ACCESS_KEY_ID = 'x'

      expect(detectVendor()).toBe('ses')
    })

    it('prefers vendors in a fixed order when several are configured', () => {
      process.env.SES_AWS_ACCESS_KEY_ID = 'x'
      process.env.SENDGRID_API_KEY = 'x'
      process.env.RESEND_API_KEY = 'x'

      expect(detectVendor()).toBe('resend')
    })

    it('lets EMAIL_PROVIDER pin one', () => {
      process.env.RESEND_API_KEY = 'x'
      process.env.SENDGRID_API_KEY = 'x'
      process.env.EMAIL_PROVIDER = 'sendgrid'

      expect(detectVendor()).toBe('sendgrid')

      process.env.EMAIL_PROVIDER = 'print'

      expect(detectVendor()).toBe('print')
    })

    it('rejects an EMAIL_PROVIDER it does not know', () => {
      process.env.EMAIL_PROVIDER = 'postmark'

      expect(() => detectVendor()).toThrow(/EMAIL_PROVIDER="postmark"/)
    })
  })

  describe('assertConfigured', () => {
    it('resolves with nothing configured', async () => {
      await expect(assertConfigured()).resolves.toBeUndefined()
    })

    it('needs a sending identity once a vendor is detected', async () => {
      process.env.RESEND_API_KEY = 'x'

      await expect(assertConfigured()).rejects.toThrow(/EMAIL_FROM/)
    })

    it('resolves with a vendor and an identity', async () => {
      process.env.RESEND_API_KEY = 'x'
      process.env.EMAIL_FROM = 'Login <noreply@example.com>'

      await expect(assertConfigured()).resolves.toBeUndefined()
    })

    it('names every SES variable that is missing', async () => {
      process.env.SES_AWS_ACCESS_KEY_ID = 'x'
      process.env.EMAIL_FROM = 'noreply@example.com'

      await expect(assertConfigured()).rejects.toThrow(
        /SES_AWS_REGION, SES_AWS_SECRET_ACCESS_KEY are not set/
      )
    })

    it('resolves with SendGrid and an identity', async () => {
      process.env.SENDGRID_API_KEY = 'x'
      process.env.EMAIL_FROM = 'noreply@example.com'

      await expect(assertConfigured()).resolves.toBeUndefined()
    })

    it('resolves with a complete SES configuration', async () => {
      process.env.SES_AWS_REGION = 'eu-west-1'
      process.env.SES_AWS_ACCESS_KEY_ID = 'x'
      process.env.SES_AWS_SECRET_ACCESS_KEY = 'y'
      process.env.EMAIL_FROM = 'noreply@example.com'

      await expect(assertConfigured()).resolves.toBeUndefined()
    })

    it('checks the credential before the identity', async () => {
      process.env.SES_AWS_ACCESS_KEY_ID = 'x'

      await expect(assertConfigured()).rejects.toThrow(/SES_AWS_REGION/)
    })

    it('rejects an unknown EMAIL_PROVIDER', async () => {
      process.env.EMAIL_PROVIDER = 'postmark'

      await expect(assertConfigured()).rejects.toThrow(/EMAIL_PROVIDER/)
    })

    it('needs nothing when pinned to print, whatever else is set', async () => {
      process.env.EMAIL_PROVIDER = 'print'
      process.env.SES_AWS_ACCESS_KEY_ID = 'x'

      await expect(assertConfigured()).resolves.toBeUndefined()
    })

    it('fails a pinned vendor whose credentials are absent', async () => {
      process.env.EMAIL_PROVIDER = 'sendgrid'
      process.env.EMAIL_FROM = 'noreply@example.com'

      await expect(assertConfigured()).rejects.toThrow(/SENDGRID_API_KEY/)
    })
  })
})
