import Page from '@/pages/support'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

const mockUseWidgetInstance = jest.fn()

jest.mock('@chatbotkit/react/hooks/useWidgetInstance', () => ({
  __esModule: true,
  default: (...args) => mockUseWidgetInstance(...args),
}))

jest.mock('@/hooks/usePartner', () => ({
  __esModule: true,
  default: () => ({ whitelabel: true }),
}))

describe('Support page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('omits widget support when the widget is unavailable', () => {
    mockUseWidgetInstance.mockReturnValue(null)

    render(<Page />)

    expect(screen.queryByText('Widget agent')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Launch support widget' })
    ).not.toBeInTheDocument()
  })

  it('launches widget support when the widget is ready', () => {
    const widgetInstance = { open: false }

    mockUseWidgetInstance.mockReturnValue(widgetInstance)

    render(<Page />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Launch support widget' })
    )

    expect(widgetInstance.open).toBe(true)
  })
})
