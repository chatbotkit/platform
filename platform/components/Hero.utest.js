import Hero from './Hero'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@/lib/array', () => ({
  splitHalf: jest.fn((items) => [items.slice(0, 1), items.slice(1)]),
}))

jest.mock('@/components/Component', () => ({
  __esModule: true,
  default: ({ as: As = 'div', children, ...props }) => (
    <As {...props}>{children}</As>
  ),
}))

jest.mock('@/components/DynamicIcon', () => ({
  __esModule: true,
  default: ({ icon, alt, ...props }) => (
    <img data-testid="dynamic-icon" data-icon={icon} alt={alt} {...props} />
  ),
}))

describe('Hero', () => {
  it('renders the supplied title and description without rewriting them', () => {
    render(<Hero title="Welcome" description="The platform is ready" />)

    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeInTheDocument()
    expect(screen.getByText('The platform is ready')).toBeInTheDocument()
  })

  it('renders split title and highlights second part', () => {
    render(<Hero splitTitle="Hello World" />)

    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('World')).toBeInTheDocument()
    expect(document.querySelector('.heading-highlight')).toHaveTextContent(
      'World'
    )
  })

  it('handles compact mode correctly', () => {
    const { rerender } = render(<Hero title="Compact" compact={false} />)

    expect(document.querySelector('.text-center')).toBeInTheDocument()

    rerender(<Hero title="Compact" compact={true} />)
    expect(document.querySelector('.text-left')).toBeInTheDocument()
  })

  it('renders icon, string image, children, and extra content', () => {
    render(
      <Hero
        title="Assets"
        icon="@logo/slack.com"
        image="https://example.com/image.png"
        extra={<div data-testid="extra">Extra</div>}
      >
        <button type="button">Action</button>
      </Hero>
    )

    expect(screen.getByTestId('dynamic-icon')).toHaveAttribute(
      'data-icon',
      '@logo/slack.com'
    )
    expect(screen.getByAltText('image')).toHaveAttribute(
      'src',
      'https://example.com/image.png'
    )
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
    expect(screen.getByTestId('extra')).toHaveTextContent('Extra')
  })
})
