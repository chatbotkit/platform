import Toggle from './Toggle'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

describe('Toggle', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders unchecked by default and exposes off hidden input when name is set', () => {
    const { container } = render(<Toggle caption="Feature" name="feature" />)

    const switchButton = screen.getByRole('switch')
    const hiddenInput = container.querySelector(
      'input[type="checkbox"][name="feature"]'
    )

    expect(switchButton).toHaveAttribute('aria-checked', 'false')
    expect(hiddenInput).toBeInTheDocument()
    expect(hiddenInput).toHaveAttribute('value', 'off')
    expect(screen.getByText('Feature')).toBeInTheDocument()
  })

  it('toggles in uncontrolled mode when switch is clicked', () => {
    const { container } = render(<Toggle caption="Feature" name="feature" />)

    const switchButton = screen.getByRole('switch')

    fireEvent.click(switchButton)

    const hiddenInput = container.querySelector(
      'input[type="checkbox"][name="feature"]'
    )

    expect(switchButton).toHaveAttribute('aria-checked', 'true')
    expect(hiddenInput).toBeInTheDocument()
    expect(hiddenInput).toHaveAttribute('value', 'on')
  })

  it('toggles from children click in uncontrolled mode', () => {
    render(
      <Toggle caption="Feature">
        <span>Toggle label</span>
      </Toggle>
    )

    const switchButton = screen.getByRole('switch')

    fireEvent.click(screen.getByText('Toggle label'))
    expect(switchButton).toHaveAttribute('aria-checked', 'true')
  })

  it('acts as controlled when checked and setChecked are provided', () => {
    const setChecked = jest.fn()

    render(
      <Toggle caption="Controlled" checked={false} setChecked={setChecked}>
        <span>Controlled toggle</span>
      </Toggle>
    )

    fireEvent.click(screen.getByRole('switch'))
    fireEvent.click(screen.getByText('Controlled toggle'))

    expect(setChecked).toHaveBeenNthCalledWith(1, true)
    expect(setChecked).toHaveBeenNthCalledWith(2, true)
  })

  it('prevents interaction when disabled', () => {
    const setChecked = jest.fn()

    render(
      <Toggle
        caption="Disabled"
        checked={false}
        setChecked={setChecked}
        disabled
      />
    )

    const switchButton = screen.getByRole('switch')

    fireEvent.click(switchButton)

    expect(setChecked).not.toHaveBeenCalled()
    expect(switchButton).toHaveAttribute('aria-checked', 'false')
  })
})
