import { renderToStaticMarkup as render } from 'react-dom/server'

import TrialStart from './TrialStart'

describe('TrialStart', () => {
  it('should render with number of tokens', async () => {
    const html = await render(<TrialStart numberOfTokens={1500} />)

    expect(html).toContain('Dear customer,')
    expect(html).toContain(
      'We are excited to inform you that your trial period for ChatBotKit has started'
    )
    expect(html).toContain('You have 5 days to complete the trial')
    expect(html).toContain('1500')
    expect(html).toContain('number of tokens which you can use')
    expect(html).toContain('See your account limits')
  })

  it('should handle zero tokens', async () => {
    const html = await render(<TrialStart numberOfTokens={0} />)

    expect(html).toContain('>0<')
    expect(html).toContain('number of tokens which you can use')
    expect(html).toContain('Dear customer,')
    expect(html).toContain('See your account limits')
  })

  it('should handle large number of tokens', async () => {
    const html = await render(<TrialStart numberOfTokens={1000000} />)

    expect(html).toContain('1000000')
    expect(html).toContain('number of tokens which you can use')
  })

  it('should render without numberOfTokens prop', async () => {
    const html = await render(<TrialStart />)

    expect(html).toContain('Dear customer,')
    expect(html).toContain(
      'We are excited to inform you that your trial period for ChatBotKit has started'
    )
    expect(html).toContain('pricing page')
    expect(html).toContain('See your account limits')
  })

  it('should handle string number of tokens', async () => {
    const html = await render(<TrialStart numberOfTokens="2500" />)

    expect(html).toContain('2500')
    expect(html).toContain('number of tokens which you can use')
  })

  it('should have correct static properties', () => {
    expect(TrialStart.subject).toBe('Your ChatBotKit Trial')
    expect(TrialStart.PreviewProps).toBeDefined()
    expect(TrialStart.PreviewProps).toHaveProperty('numberOfTokens')
    expect(TrialStart.PreviewProps.numberOfTokens).toBe(1000)
  })

  it('should render all required links with correct hrefs', async () => {
    const html = await render(<TrialStart numberOfTokens={1000} />)

    expect(html).toContain('/pricing')
    expect(html).toContain('/usage')
  })

  it('should have proper trial period information', async () => {
    const html = await render(<TrialStart numberOfTokens={1000} />)

    expect(html).toContain('You have 5 days to complete the trial')
    expect(html).toContain('explore all the features we offer')
    expect(html).toContain(
      'You will receive all allocated tokens after the trial period end'
    )
  })

  it('should have support contact information', async () => {
    const html = await render(<TrialStart numberOfTokens={1000} />)

    expect(html).toContain('If you have any questions or concerns')
    expect(html).toContain('please do not hesitate to contact our support team')
  })

  it('should handle negative number of tokens gracefully', async () => {
    const html = await render(<TrialStart numberOfTokens={-100} />)

    expect(html).toContain('-100')
    expect(html).toContain('Dear customer,')
  })
})
