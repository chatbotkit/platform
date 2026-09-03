import DynamicImage from './DynamicImage'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@/components/DynamicIcon', () => {
  return function MockDynamicIcon(props) {
    return <div data-testid="dynamic-icon" {...props} />
  }
})

describe('DynamicImage', () => {
  it('renders DynamicIcon with forwarded props', () => {
    render(<DynamicImage icon="@logo/example.com" className="img" />)

    const icon = screen.getByTestId('dynamic-icon')

    expect(icon).toBeInTheDocument()
    expect(icon).toHaveAttribute('icon', '@logo/example.com')
    expect(icon).toHaveClass('img')
  })
})
