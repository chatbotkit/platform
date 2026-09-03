import provider, { sendEmailAction, sendEmailNotification } from './index'

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
  })

  afterEach(() => {
    // eslint-disable-next-line no-console
    console.log = original
  })

  it('satisfies the provider contract', () => {
    expect(typeof provider.sendEmailNotification).toBe('function')
    expect(typeof provider.sendEmailAction).toBe('function')
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
})
