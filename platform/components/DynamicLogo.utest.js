import DynamicLogo from './DynamicLogo'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@/components/DynamicIcon', () => {
  return function MockDynamicIcon(props) {
    return <div data-testid="dynamic-logo-icon" {...props} />
  }
})

describe('DynamicLogo', () => {
  it('renders DynamicIcon with forwarded props', () => {
    render(<DynamicLogo logo="@duckduckgo/chatbotkit.com" aria-label="logo" />)

    const icon = screen.getByTestId('dynamic-logo-icon')

    expect(icon).toBeInTheDocument()
    expect(icon).toHaveAttribute('logo', '@duckduckgo/chatbotkit.com')
    expect(icon).toHaveAttribute('aria-label', 'logo')
  })
})
