import WidgetScript from './WidgetScript'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('next/script', () => {
  return function Script(props) {
    return <script data-testid="next-script" {...props} />
  }
})

describe('WidgetScript', () => {
  it('renders widget script with expected attributes', () => {
    render(<WidgetScript />)

    const script = screen.getByTestId('next-script')

    expect(script).toBeInTheDocument()
    expect(script).toHaveAttribute('id', 'chatbotkit-widget')
    expect(script).toHaveAttribute('src', '/integrations/widget/v2.js')
    expect(script).toHaveAttribute('strategy', 'afterInteractive')
  })
})
