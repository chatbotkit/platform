import Initials from './Initials'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

describe('Initials', () => {
  it('renders initials text inside svg', () => {
    render(<Initials initials="AB" />)

    expect(screen.getByText('AB')).toBeInTheDocument()
    expect(document.querySelector('svg')).toBeInTheDocument()
  })

  it('forwards additional props to svg root', () => {
    render(
      <Initials initials="CD" data-testid="initials-svg" className="w-10" />
    )

    const svg = screen.getByTestId('initials-svg')

    expect(svg).toHaveClass('w-10')
    expect(svg).toHaveAttribute('viewBox', '0 0 100 100')
  })

  it('renders empty text when initials are empty', () => {
    render(<Initials initials="" />)

    const text = document.querySelector('text')

    expect(text).toBeInTheDocument()
    expect(text.textContent).toBe('')
  })
})
