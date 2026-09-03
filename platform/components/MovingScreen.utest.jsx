import MovingScreen from './MovingScreen'

import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

jest.mock(
  './Link',
  () =>
    function Link({ href, children, ...props }) {
      return (
        <a href={href} {...props}>
          {children}
        </a>
      )
    }
)

describe('MovingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders highlighted title and description', () => {
    render(
      <MovingScreen title={['Build', 'Agents']} description="Ship faster">
        <div>Expose</div>
      </MovingScreen>
    )

    expect(
      screen.getByRole('heading', { name: 'Build Agents' })
    ).toBeInTheDocument()
    expect(screen.getByText('Agents')).toHaveClass('heading-highlight')
    expect(screen.getByText('Ship faster')).toBeInTheDocument()
  })

  it('renders link, actions, and content when provided', () => {
    render(
      <MovingScreen
        title="Title"
        href="/docs"
        hrefCaption="Read docs"
        actions={<button type="button">Extra action</button>}
        content={<div>Custom content</div>}
      >
        <div>Expose</div>
      </MovingScreen>
    )

    expect(screen.getByRole('link', { name: 'Read docs' })).toHaveAttribute(
      'href',
      '/docs'
    )
    expect(
      screen.getByRole('button', { name: 'Extra action' })
    ).toBeInTheDocument()
    expect(screen.getByText('Custom content')).toBeInTheDocument()
    expect(screen.getByText('Expose')).toBeInTheDocument()
  })

  it('applies debug classes and style variables', () => {
    const { container } = render(
      <MovingScreen
        title="Title"
        debug
        movingScreenContainerMinHeight="700px"
        movingScreenScrollHeight="200vh"
      >
        <div>Expose</div>
      </MovingScreen>
    )

    const root = container.querySelector('.moving-screen')

    expect(root).toHaveClass('bg-red-500')
    expect(
      root.style.getPropertyValue('--moving-screen-container-min-height')
    ).toBe('700px')
    expect(root.style.getPropertyValue('--moving-screen-scroll-height')).toBe(
      '200vh'
    )
  })

  it('starts fully visible when scrollReveal is disabled', () => {
    const { container } = render(
      <MovingScreen title="Title" scrollReveal={false}>
        <div>Expose</div>
      </MovingScreen>
    )

    const hero = container.querySelector('.moving-screen-hero')

    expect(hero.style.opacity).toBe('1')
  })

  it('reveals hero on small screens after effect runs', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 500,
    })

    const { container } = render(
      <MovingScreen title="Title" scrollReveal>
        <div>Expose</div>
      </MovingScreen>
    )

    fireEvent.scroll(window)

    await waitFor(() => {
      const hero = container.querySelector('.moving-screen-hero')

      expect(hero.style.opacity).toBe('1')
    })
  })
})
