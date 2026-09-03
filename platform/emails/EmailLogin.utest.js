import { renderToStaticMarkup as render } from 'react-dom/server'

import EmailLogin from '@/emails/EmailLogin'

describe('EmailLogin', () => {
  it('should render with token-based login', async () => {
    const html = await render(<EmailLogin token="ABC123" />)

    expect(html).toContain('Dear customer,')
    expect(html).toContain(
      'You have requested to sign in to your account. Please use the code below to complete the sign-in process:'
    )
    expect(html).toContain('ABC123')
    expect(html).not.toContain('Sign In')
  })

  it('should render with partner branding', async () => {
    const partner = { id: 'acme', name: 'Acme Corp' }

    const html = await render(<EmailLogin token="ABC123" branding={partner} />)

    expect(html).toContain('Acme Corp')
    expect(html).toContain('Best regards')
  })

  it('should use ChatBotKit branding when no partner is provided', async () => {
    const html = await render(<EmailLogin token="ABC123" />)

    expect(html).toContain('ChatBotKit')
    expect(html).toContain('Best regards')
  })

  it('should have correct static properties', () => {
    expect(EmailLogin.getSubject({})).toBe('Sign in to your account')
    expect(
      EmailLogin.getSubject({ branding: { id: 'acme', name: 'Acme Corp' } })
    ).toBe('Sign in to your account')
    expect(EmailLogin.PreviewProps).toEqual({
      token: '123456',
    })
  })

  it('should render email preview text correctly', async () => {
    const html = await render(<EmailLogin token="ABC123" />)

    expect(html).toContain('Dear customer,')
  })
})
