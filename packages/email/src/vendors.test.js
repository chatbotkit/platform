// @note the vendor modules are exercised through the provider entry point, the
// way the platform reaches them, with the network mocked at the fetch seam
import { jest } from '@jest/globals'

const fetch = jest.fn()
const getFetchError = jest.fn(async () => new Error('vendor rejected it'))

jest.unstable_mockModule('@chatbotkit-dev/fetch', () => ({
  fetch,
  getFetchError,
}))

const { createEmailTransport, sendEmailAction, sendEmailNotification } =
  await import('./index')

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
  'SES_AWS_SESSION_TOKEN',
  'SES_AWS_ENDPOINT',
]

const notification = {
  to: 'user@example.com',
  subject: 'Sign in',
  content: { text: 'plain text', html: '<p>html</p>' },
}

function request() {
  const [url, init] = fetch.mock.calls[0]

  return { url, init, body: JSON.parse(init.body) }
}

describe('vendors', () => {
  // eslint-disable-next-line no-console
  const original = console.log

  beforeEach(() => {
    fetch.mockReset()
    fetch.mockResolvedValue({ ok: true })
    getFetchError.mockClear()

    // eslint-disable-next-line no-console
    console.log = jest.fn()

    for (const name of ENV) {
      delete process.env[name]
    }

    process.env.EMAIL_FROM = 'Login <noreply@example.com>'
  })

  afterEach(() => {
    // eslint-disable-next-line no-console
    console.log = original

    for (const name of ENV) {
      delete process.env[name]
    }
  })

  describe('resend', () => {
    beforeEach(() => {
      process.env.RESEND_API_KEY = 'resend-key'
    })

    it('posts a notification as the configured identity', async () => {
      process.env.EMAIL_REPLY_TO = 'support@example.com'

      await sendEmailNotification(notification)

      const { url, init, body } = request()

      expect(url).toBe('https://api.resend.com/emails')
      expect(init.headers.Authorization).toBe('Bearer resend-key')

      expect(body).toEqual({
        from: 'Login <noreply@example.com>',
        to: 'user@example.com',
        subject: 'Sign in',
        text: 'plain text',
        html: '<p>html</p>',
        reply_to: 'support@example.com',
      })

      // eslint-disable-next-line no-console
      expect(console.log).not.toHaveBeenCalled()
    })

    it('lets the message choose where replies go', async () => {
      process.env.EMAIL_REPLY_TO = 'support@example.com'

      await sendEmailNotification({
        ...notification,
        replyTo: 'billing@example.com',
      })

      expect(request().body.reply_to).toBe('billing@example.com')
    })

    it('threads an action against its message id', async () => {
      await sendEmailAction({
        to: 'third@example.com',
        subject: 'Re: enquiry',
        content: notification.content,
        from: 'agent@partner.example',
        name: 'Agent',
        messageId: '<abc@integration.example.com>',
      })

      const { body } = request()

      expect(body.from).toBe('Agent <agent@partner.example>')
      expect(body.headers).toEqual({
        'Message-ID': '<abc@integration.example.com>',
        'In-Reply-To': '<abc@integration.example.com>',
        References: '<abc@integration.example.com>',
      })
    })

    it('sends an action from the actions identity when the caller names none', async () => {
      process.env.EMAIL_ACTIONS_FROM = 'Agents <agents@example.com>'

      await sendEmailAction({
        to: 'third@example.com',
        subject: 'Hello',
        content: notification.content,
      })

      expect(request().body.from).toBe('Agents <agents@example.com>')
    })

    it('keeps the default display name when only the mailbox is given', async () => {
      await sendEmailAction({
        to: 'third@example.com',
        subject: 'Hello',
        content: notification.content,
        from: 'agent@partner.example',
      })

      expect(request().body.from).toBe('Login <agent@partner.example>')
    })

    it('sends a transport as the identity it was created with', async () => {
      await createEmailTransport('Acme <login@acme.example>').send({
        to: 'user@example.com',
        subject: 'Sign in',
        text: 'plain text',
        html: '<p>html</p>',
      })

      expect(request().body.from).toBe('Acme <login@acme.example>')
    })

    it('throws what the API said when it rejects the message', async () => {
      fetch.mockResolvedValue({ ok: false, status: 422 })

      await expect(sendEmailNotification(notification)).rejects.toThrow(
        'vendor rejected it'
      )

      expect(getFetchError).toHaveBeenCalledWith(expect.anything(), {
        vendor: 'resend',
        from: 'Login <noreply@example.com>',
      })
    })

    it('refuses to send without a sending identity', async () => {
      delete process.env.EMAIL_FROM

      await expect(sendEmailNotification(notification)).rejects.toThrow(
        /EMAIL_FROM/
      )

      expect(fetch).not.toHaveBeenCalled()
    })

    it('sends a transport without any sending identity configured', async () => {
      delete process.env.EMAIL_FROM

      await createEmailTransport('Acme <login@acme.example>').send({
        to: 'user@example.com',
        subject: 'Sign in',
        text: 'plain text',
        html: '<p>html</p>',
      })

      expect(request().body.from).toBe('Acme <login@acme.example>')
    })

    it('sends nothing vendor-specific for essential mail', async () => {
      await sendEmailNotification({ ...notification, essential: true })

      expect(Object.keys(request().body).sort()).toEqual([
        'from',
        'html',
        'subject',
        'text',
        'to',
      ])
    })

    it('omits reply_to and headers when there is nothing to say', async () => {
      await sendEmailNotification(notification)

      const { body } = request()

      expect(body).not.toHaveProperty('reply_to')
      expect(body).not.toHaveProperty('headers')
    })

    it('passes an action reply-to through untouched', async () => {
      process.env.EMAIL_REPLY_TO = 'support@example.com'

      await sendEmailAction({
        to: 'third@example.com',
        subject: 'Hello',
        content: notification.content,
        replyTo: 'agent@partner.example',
      })

      expect(request().body.reply_to).toBe('agent@partner.example')
    })

    it('does not give an action the notification reply-to', async () => {
      process.env.EMAIL_REPLY_TO = 'support@example.com'

      await sendEmailAction({
        to: 'third@example.com',
        subject: 'Hello',
        content: notification.content,
      })

      expect(request().body).not.toHaveProperty('reply_to')
    })

    it('throws when a transport is rejected, naming the source', async () => {
      fetch.mockResolvedValue({ ok: false, status: 403 })

      await expect(
        createEmailTransport('Acme <login@acme.example>').send({
          to: 'user@example.com',
          subject: 'Sign in',
          text: 'plain text',
          html: '<p>html</p>',
        })
      ).rejects.toThrow('vendor rejected it')

      expect(getFetchError).toHaveBeenCalledWith(expect.anything(), {
        vendor: 'resend',
        from: 'Acme <login@acme.example>',
      })
    })
  })

  describe('sendgrid', () => {
    beforeEach(() => {
      process.env.SENDGRID_API_KEY = 'sendgrid-key'
    })

    it('posts a notification in the v3 mail shape', async () => {
      await sendEmailNotification(notification)

      const { url, init, body } = request()

      expect(url).toBe('https://api.sendgrid.com/v3/mail/send')
      expect(init.headers.Authorization).toBe('Bearer sendgrid-key')

      expect(body.from).toEqual({ name: 'Login', email: 'noreply@example.com' })
      expect(body.personalizations).toEqual([
        { to: [{ email: 'user@example.com' }] },
      ])
      expect(body.content).toEqual([
        { type: 'text/plain', value: 'plain text' },
        { type: 'text/html', value: '<p>html</p>' },
      ])

      expect(body.tracking_settings).toBeUndefined()
      expect(body.mail_settings).toBeUndefined()
    })

    it('bypasses list management and tracking for essential mail', async () => {
      await sendEmailNotification({ ...notification, essential: true })

      const { body } = request()

      expect(body.mail_settings).toEqual({
        bypass_list_management: { enable: true },
      })
      expect(body.tracking_settings.click_tracking).toEqual({ enable: false })
    })

    it('treats every action as essential', async () => {
      await sendEmailAction({
        to: 'third@example.com',
        subject: 'Hello',
        content: notification.content,
        messageId: '<abc@integration.example.com>',
      })

      const { body } = request()

      expect(body.mail_settings).toEqual({
        bypass_list_management: { enable: true },
      })
      expect(body.headers['In-Reply-To']).toBe('<abc@integration.example.com>')
    })

    it('splits a caller-supplied action identity into name and mailbox', async () => {
      await sendEmailAction({
        to: 'third@example.com',
        subject: 'Hello',
        content: notification.content,
        from: 'agent@partner.example',
        name: 'Agent',
        replyTo: 'replies@partner.example',
      })

      const { body } = request()

      expect(body.from).toEqual({ name: 'Agent', email: 'agent@partner.example' })
      expect(body.reply_to).toEqual({ email: 'replies@partner.example' })
    })

    it('sends a bare mailbox without a name field', async () => {
      process.env.EMAIL_FROM = 'noreply@example.com'

      await sendEmailNotification(notification)

      expect(request().body.from).toEqual({ email: 'noreply@example.com' })
    })

    it('uses the notification reply-to by default', async () => {
      process.env.EMAIL_REPLY_TO = 'support@example.com'

      await sendEmailNotification(notification)

      expect(request().body.reply_to).toEqual({ email: 'support@example.com' })
    })

    it('sends a transport as the identity it was created with', async () => {
      await createEmailTransport('Acme <login@acme.example>').send({
        to: 'user@example.com',
        subject: 'Sign in',
        text: 'plain text',
        html: '<p>html</p>',
      })

      const { body } = request()

      expect(body.from).toEqual({ name: 'Acme', email: 'login@acme.example' })
      expect(body.mail_settings).toBeUndefined()
    })

    it('throws what the API said when it rejects the message', async () => {
      fetch.mockResolvedValue({ ok: false, status: 401 })

      await expect(sendEmailNotification(notification)).rejects.toThrow(
        'vendor rejected it'
      )

      expect(getFetchError).toHaveBeenCalledWith(expect.anything(), {
        vendor: 'sendgrid',
        from: 'Login <noreply@example.com>',
      })
    })

    it('refuses to send without a sending identity', async () => {
      delete process.env.EMAIL_FROM

      await expect(sendEmailNotification(notification)).rejects.toThrow(
        /EMAIL_FROM/
      )

      expect(fetch).not.toHaveBeenCalled()
    })
  })

  describe('ses', () => {
    beforeEach(() => {
      process.env.SES_AWS_REGION = 'eu-west-1'
      process.env.SES_AWS_ACCESS_KEY_ID = 'AKIDEXAMPLE'
      process.env.SES_AWS_SECRET_ACCESS_KEY = 'secret'
    })

    it('posts a signed SendEmail request to the regional endpoint', async () => {
      process.env.EMAIL_REPLY_TO = 'support@example.com'

      await sendEmailNotification(notification)

      const { url, init, body } = request()

      expect(url).toBe(
        'https://email.eu-west-1.amazonaws.com/v2/email/outbound-emails'
      )

      expect(init.headers['content-type']).toBe('application/json')
      expect(init.headers['x-amz-date']).toMatch(/^\d{8}T\d{6}Z$/)
      expect(init.headers.authorization).toMatch(
        /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/eu-west-1\/ses\/aws4_request, SignedHeaders=content-type;host;x-amz-date, Signature=[0-9a-f]{64}$/
      )

      expect(body).toEqual({
        FromEmailAddress: 'Login <noreply@example.com>',
        Destination: { ToAddresses: ['user@example.com'] },
        ReplyToAddresses: ['support@example.com'],
        Content: {
          Simple: {
            Subject: { Data: 'Sign in', Charset: 'UTF-8' },
            Body: {
              Text: { Data: 'plain text', Charset: 'UTF-8' },
              Html: { Data: '<p>html</p>', Charset: 'UTF-8' },
            },
          },
        },
      })
    })

    it('carries threading headers on actions', async () => {
      await sendEmailAction({
        to: 'third@example.com',
        subject: 'Hello',
        content: notification.content,
        messageId: '<abc@integration.example.com>',
      })

      expect(request().body.Content.Simple.Headers).toEqual([
        { Name: 'Message-ID', Value: '<abc@integration.example.com>' },
        { Name: 'In-Reply-To', Value: '<abc@integration.example.com>' },
        { Name: 'References', Value: '<abc@integration.example.com>' },
      ])
    })

    it('signs a session token and honours a custom endpoint', async () => {
      process.env.SES_AWS_SESSION_TOKEN = 'token'
      process.env.SES_AWS_ENDPOINT = 'http://localhost:4566/'

      await sendEmailNotification(notification)

      const { url, init } = request()

      expect(url).toBe('http://localhost:4566/v2/email/outbound-emails')
      expect(init.headers['x-amz-security-token']).toBe('token')
      expect(init.headers.authorization).toContain('x-amz-security-token')
    })

    it('refuses to send with an incomplete configuration', async () => {
      delete process.env.SES_AWS_SECRET_ACCESS_KEY

      await expect(sendEmailNotification(notification)).rejects.toThrow(
        /SES_AWS_SECRET_ACCESS_KEY is not set/
      )

      expect(fetch).not.toHaveBeenCalled()
    })

    it('omits ReplyToAddresses and Headers when there is nothing to say', async () => {
      await sendEmailNotification(notification)

      const { body } = request()

      expect(body).not.toHaveProperty('ReplyToAddresses')
      expect(body.Content.Simple).not.toHaveProperty('Headers')
    })

    it('composes a caller-supplied action identity', async () => {
      await sendEmailAction({
        to: 'third@example.com',
        subject: 'Hello',
        content: notification.content,
        from: 'agent@partner.example',
        name: 'Agent',
        replyTo: 'replies@partner.example',
      })

      const { body } = request()

      expect(body.FromEmailAddress).toBe('Agent <agent@partner.example>')
      expect(body.ReplyToAddresses).toEqual(['replies@partner.example'])
    })

    it('sends a transport as the identity it was created with', async () => {
      await createEmailTransport('Acme <login@acme.example>').send({
        to: 'user@example.com',
        subject: 'Sign in',
        text: 'plain text',
        html: '<p>html</p>',
      })

      expect(request().body.FromEmailAddress).toBe('Acme <login@acme.example>')
    })

    it('signs the exact body it sends', async () => {
      await sendEmailNotification(notification)

      const { init } = request()

      // @note the signature covers the payload hash, so the body handed to
      // fetch must be the very string that was signed - a re-serialization
      // with different key order would be rejected upstream

      expect(typeof init.body).toBe('string')
      expect(init.method).toBe('POST')
      expect(init.headers).not.toHaveProperty('host')
    })

    it('strips a trailing slash from a custom endpoint', async () => {
      process.env.SES_AWS_ENDPOINT = 'https://ses.internal.example///'

      await sendEmailNotification(notification)

      expect(request().url).toBe(
        'https://ses.internal.example/v2/email/outbound-emails'
      )
    })

    it('throws what the API said when it rejects the message', async () => {
      fetch.mockResolvedValue({ ok: false, status: 400 })

      await expect(sendEmailNotification(notification)).rejects.toThrow(
        'vendor rejected it'
      )

      expect(getFetchError).toHaveBeenCalledWith(expect.anything(), {
        vendor: 'ses',
        from: 'Login <noreply@example.com>',
      })
    })
  })

  describe('EMAIL_PROVIDER', () => {
    it('routes to the pinned vendor when several are configured', async () => {
      process.env.RESEND_API_KEY = 'resend-key'
      process.env.SENDGRID_API_KEY = 'sendgrid-key'
      process.env.EMAIL_PROVIDER = 'sendgrid'

      await sendEmailNotification(notification)

      expect(request().url).toBe('https://api.sendgrid.com/v3/mail/send')
    })

    it('prints when pinned to print despite credentials', async () => {
      process.env.RESEND_API_KEY = 'resend-key'
      process.env.EMAIL_PROVIDER = 'print'

      await sendEmailNotification(notification)

      expect(fetch).not.toHaveBeenCalled()

      // eslint-disable-next-line no-console
      expect(console.log).toHaveBeenCalledTimes(1)
    })

    it('fails a pinned vendor without its credential instead of falling back', async () => {
      process.env.RESEND_API_KEY = 'resend-key'
      process.env.EMAIL_PROVIDER = 'sendgrid'

      await expect(sendEmailNotification(notification)).rejects.toThrow(
        /SENDGRID_API_KEY/
      )

      expect(fetch).not.toHaveBeenCalled()
    })

    it('rejects an unknown pin at send time', async () => {
      process.env.EMAIL_PROVIDER = 'postmark'

      await expect(sendEmailNotification(notification)).rejects.toThrow(
        /EMAIL_PROVIDER="postmark"/
      )
    })
  })

  it('prints instead of fetching when nothing is configured', async () => {
    await sendEmailNotification(notification)

    expect(fetch).not.toHaveBeenCalled()

    // eslint-disable-next-line no-console
    expect(console.log).toHaveBeenCalledTimes(1)
  })
})
