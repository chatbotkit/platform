import ManualLink, { getManualHref } from './ManualLink'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@/components/Link', () => {
  return function Link({ children, href, ...props }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  }
})

describe('ManualLink', () => {
  it('should link a slug to the technical manuals site', () => {
    render(<ManualLink slug="node-sdk">Node SDK</ManualLink>)

    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      'https://docs.cbk.ai/node-sdk'
    )
  })

  it('should open technical manuals in a new tab by default', () => {
    render(<ManualLink slug="spec/v1">API specification</ManualLink>)

    expect(screen.getByRole('link')).toHaveAttribute('target', '_blank')
  })

  it('should normalize leading slashes and preserve fragments', () => {
    expect(getManualHref('/spec/v1#authentication')).toBe(
      'https://docs.cbk.ai/spec/v1#authentication'
    )
  })

  it('should forward link props and classes', () => {
    render(
      <ManualLink
        slug="go-sdk"
        className="default-link"
        aria-label="Go SDK manual"
      >
        Go SDK
      </ManualLink>
    )

    const link = screen.getByRole('link')

    expect(link).toHaveClass('manual-link', 'default-link')
    expect(link).toHaveAttribute('aria-label', 'Go SDK manual')
  })
})
