import { renderToStaticMarkup } from 'react-dom/server'

import { getSecretTooltipPreface, getTooltip } from './designer'

describe('getSecretTooltipPreface', () => {
  it('returns platform copy for platform secrets', () => {
    expect(getSecretTooltipPreface('platform/slack')).toContain(
      'platform-managed secret'
    )
  })

  it('returns MCP copy for MCP secrets', () => {
    expect(getSecretTooltipPreface('notion[mcp]')).toContain('MCP integrations')
  })

  it('returns null for other secrets', () => {
    expect(getSecretTooltipPreface('custom-secret')).toBeNull()
  })

  it('only includes preface text for secret tooltips', () => {
    const secretTooltip = renderToStaticMarkup(
      getTooltip({
        type: 'secret',
        id: 'platform/slack',
        title: 'Slack',
        description: 'Slack secret',
      })
    )

    const nonSecretTooltip = renderToStaticMarkup(
      getTooltip({
        type: 'ability',
        id: 'platform/slack',
        title: 'Slack',
        description: 'Slack ability',
      })
    )

    expect(secretTooltip).toContain('platform-managed secret')
    expect(nonSecretTooltip).not.toContain('platform-managed secret')
  })
})
