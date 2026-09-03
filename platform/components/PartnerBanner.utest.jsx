import PartnerBanner from './PartnerBanner'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

describe('PartnerBanner', () => {
  it('renders partner logo image when logo is provided', () => {
    render(
      <PartnerBanner
        partner={{ name: 'Acme', logo: 'https://example.com/logo.png' }}
      />
    )

    const image = screen.getByRole('img', { name: 'Acme' })

    expect(image).toHaveAttribute('src', 'https://example.com/logo.png')
    expect(image).toHaveClass('h-[1em]')
    expect(image).toHaveClass('dark:invert')
  })

  it('renders partner name text fallback when logo is not provided', () => {
    render(<PartnerBanner partner={{ name: 'Acme' }} />)

    const fallback = screen.getByText('Acme')

    expect(fallback.tagName).toBe('SPAN')
    expect(fallback).toHaveClass('font-semibold')
    expect(screen.queryByRole('img', { name: 'Acme' })).not.toBeInTheDocument()
  })

  it('forwards className and extra props to root wrapper', () => {
    const { container } = render(
      <PartnerBanner
        partner={{ name: 'Acme' }}
        className="custom-class"
        data-testid="banner"
      />
    )

    const wrapper = container.querySelector('[data-testid="banner"]')

    expect(wrapper).toHaveClass('custom-class')
    expect(wrapper).toHaveAttribute('data-testid', 'banner')
  })
})
