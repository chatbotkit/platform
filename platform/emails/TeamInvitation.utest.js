import { renderToStaticMarkup as render } from 'react-dom/server'

import TeamInvitation from '@/emails/TeamInvitation'

describe('TeamInvitation Email Template', () => {
  it('should render with team name and description', async () => {
    const props = {
      teamName: 'Test Team',
      teamDescription: 'A test team for unit testing',
    }

    const html = await render(<TeamInvitation {...props} />)

    expect(html).toContain('Test Team')
    expect(html).toContain('A test team for unit testing')
    expect(html).toContain('You&#x27;ve been added to the team')
    expect(html).toContain('View Dashboard')
  })

  it('should render without team description', async () => {
    const props = {
      teamName: 'Simple Team',
    }

    const html = await render(<TeamInvitation {...props} />)

    expect(html).toContain('Simple Team')
    expect(html).not.toContain('About this team:')
    expect(html).toContain('Welcome')
  })

  it('should have correct subject', () => {
    expect(TeamInvitation.getSubject({})).toBe(
      'Welcome to your team on ChatBotKit'
    )
  })

  it('should use partner name in subject when partner is provided', () => {
    expect(
      TeamInvitation.getSubject({ branding: { id: 'acme', name: 'AcmeCorp' } })
    ).toBe('Welcome to your team on AcmeCorp')
  })

  it('should have preview props for development', () => {
    expect(TeamInvitation.PreviewProps).toEqual({
      teamName: 'Example Team',
      teamDescription: 'A sample team for demonstrating AI collaboration',
    })
  })

  describe('partner branding', () => {
    it('should use partner name in body text when partner is provided', async () => {
      const html = await render(
        <TeamInvitation
          teamName="Test Team"
          branding={{ id: 'acme', name: 'AcmeCorp' }}
        />
      )

      // AcmeCorp brand name should appear throughout the body
      expect(html).toContain('AcmeCorp')
    })

    it('should use partner name in welcome and sign-off lines', async () => {
      const html = await render(
        <TeamInvitation
          teamName="Test Team"
          branding={{ id: 'acme', name: 'AcmeCorp' }}
        />
      )

      // React inserts <!-- --> comment nodes between text and JSX expressions
      expect(html).toMatch(/thank you for choosing.*AcmeCorp/)
      expect(html).toMatch(/The.*AcmeCorp.*Team/)
    })

    it('should use partner domain in dashboard button href when domain is set', async () => {
      const html = await render(
        <TeamInvitation
          teamName="Test Team"
          branding={{
            id: 'acme',
            name: 'AcmeCorp',
            baseUrl: 'https://acme.example.com',
          }}
        />
      )

      expect(html).toContain('https://acme.example.com/overview')
    })

    it('should fall back to siteUrl when branding has no baseUrl', async () => {
      const html = await render(
        <TeamInvitation
          teamName="Test Team"
          branding={{ id: 'acme', name: 'AcmeCorp' }}
        />
      )

      expect(html).toContain('/overview')
      expect(html).not.toContain('chatbotkit.partners')
    })

    it('should use partner name in no-team-name body path', async () => {
      const html = await render(
        <TeamInvitation branding={{ id: 'acme', name: 'AcmeCorp' }} />
      )

      expect(html).toContain('added to a team on AcmeCorp')
    })

    it('should fall back to ChatBotKit brand when no partner is provided', async () => {
      const html = await render(<TeamInvitation teamName="Test Team" />)

      expect(html).toContain('ChatBotKit')
      expect(html).not.toContain('chatbotkit.partners')
    })
  })
})
