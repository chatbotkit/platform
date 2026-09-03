import {
  actionFrom,
  defaultReplyTo,
  formatAddress,
  notificationFrom,
  parseAddress,
  threadingHeaders,
} from './identity'

const ENV = ['EMAIL_FROM', 'EMAIL_ACTIONS_FROM', 'EMAIL_REPLY_TO']

describe('parseAddress', () => {
  it('splits a display name from the mailbox', () => {
    expect(parseAddress('Login <noreply@example.com>')).toEqual({
      name: 'Login',
      email: 'noreply@example.com',
    })
  })

  it('handles a quoted display name', () => {
    expect(parseAddress('"Acme, Inc." <hello@acme.example>')).toEqual({
      name: 'Acme, Inc.',
      email: 'hello@acme.example',
    })
  })

  it('handles a bare mailbox', () => {
    expect(parseAddress('noreply@example.com')).toEqual({
      email: 'noreply@example.com',
    })
  })

  it('handles an angle-bracketed mailbox with no name', () => {
    expect(parseAddress('<noreply@example.com>')).toEqual({
      email: 'noreply@example.com',
    })
  })

  it('trims surrounding whitespace', () => {
    expect(parseAddress('  Login  <noreply@example.com>  ')).toEqual({
      name: 'Login',
      email: 'noreply@example.com',
    })

    expect(parseAddress('  noreply@example.com ')).toEqual({
      email: 'noreply@example.com',
    })
  })
})

describe('formatAddress', () => {
  it('round-trips through parseAddress', () => {
    for (const source of [
      'Login <noreply@example.com>',
      'noreply@example.com',
    ]) {
      expect(formatAddress(parseAddress(source))).toBe(source)
    }
  })

  it('omits the brackets without a name', () => {
    expect(formatAddress({ email: 'a@b.c' })).toBe('a@b.c')
  })
})

describe('threadingHeaders', () => {
  it('sets all three threading headers to the id', () => {
    expect(threadingHeaders('<id@example.com>')).toEqual({
      'Message-ID': '<id@example.com>',
      'In-Reply-To': '<id@example.com>',
      References: '<id@example.com>',
    })
  })
})

describe('sending identity', () => {
  beforeEach(() => {
    for (const name of ENV) {
      delete process.env[name]
    }
  })

  afterEach(() => {
    for (const name of ENV) {
      delete process.env[name]
    }
  })

  it('reads EMAIL_FROM', () => {
    process.env.EMAIL_FROM = 'Login <noreply@example.com>'

    expect(notificationFrom()).toBe('Login <noreply@example.com>')
  })

  it('throws without EMAIL_FROM, saying what to set', () => {
    expect(() => notificationFrom()).toThrow(/EMAIL_FROM is not set/)
  })

  it('treats an empty EMAIL_FROM as unset', () => {
    process.env.EMAIL_FROM = ''

    expect(() => notificationFrom()).toThrow(/EMAIL_FROM/)
  })

  it('falls back from EMAIL_ACTIONS_FROM to EMAIL_FROM', () => {
    process.env.EMAIL_FROM = 'noreply@example.com'

    expect(actionFrom()).toBe('noreply@example.com')

    process.env.EMAIL_ACTIONS_FROM = 'agents@example.com'

    expect(actionFrom()).toBe('agents@example.com')
  })

  it('does not accept EMAIL_ACTIONS_FROM as the notification identity', () => {
    process.env.EMAIL_ACTIONS_FROM = 'agents@example.com'

    expect(() => notificationFrom()).toThrow(/EMAIL_FROM/)
  })

  it('has no reply-to unless EMAIL_REPLY_TO is set', () => {
    expect(defaultReplyTo()).toBeUndefined()

    process.env.EMAIL_REPLY_TO = ''

    expect(defaultReplyTo()).toBeUndefined()

    process.env.EMAIL_REPLY_TO = 'support@example.com'

    expect(defaultReplyTo()).toBe('support@example.com')
  })
})
