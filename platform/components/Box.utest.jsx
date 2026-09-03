import Box from './Box'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

describe('Box', () => {
  it('renders as div with base box classes', () => {
    const { container } = render(<Box />)
    const el = container.querySelector('div')

    expect(el).toBeInTheDocument()
    expect(el).toHaveClass(
      'box',
      'flex-1',
      'flex',
      'flex-col',
      'overflow-hidden'
    )
  })

  it('merges custom className', () => {
    const { container } = render(<Box className="custom-class" />)
    const el = container.querySelector('div')

    expect(el).toHaveClass('custom-class')
    expect(el).toHaveClass('box')
  })

  it('forwards arbitrary props', () => {
    const { container } = render(<Box data-testid="box-id" aria-label="box" />)
    const el = container.querySelector('div')

    expect(el).toHaveAttribute('data-testid', 'box-id')
    expect(el).toHaveAttribute('aria-label', 'box')
  })
})
