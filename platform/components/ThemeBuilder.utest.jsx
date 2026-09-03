/* eslint-disable @typescript-eslint/no-require-imports */
import ThemeBuilder from './ThemeBuilder'

import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/hooks/useControlledState', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/components/ThemeDesigner', () => {
  return function ThemeDesigner({ theme, setTheme, title, tools }) {
    return (
      <div>
        <div data-testid="theme-designer-theme">{theme}</div>
        <div data-testid="theme-designer-title">{title}</div>
        <div data-testid="theme-designer-tools">{tools ? 'yes' : 'no'}</div>
        <button type="button" onClick={() => setTheme('dark')}>
          set-dark
        </button>
      </div>
    )
  }
})

describe('ThemeBuilder', () => {
  const useControlledState = require('@/hooks/useControlledState').default

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders hidden input with controlled theme value and forwards props', () => {
    const setTheme = jest.fn()

    useControlledState.mockReturnValue(['light', setTheme])

    render(
      <ThemeBuilder
        name="themeName"
        defaultValue="light"
        defaultTitle="Default title"
        title="Chat title"
        tools
      />
    )

    const hiddenInput = screen.getByDisplayValue('light')

    expect(hiddenInput.getAttribute('type')).toBe('hidden')
    expect(hiddenInput.getAttribute('name')).toBe('themeName')
    expect(screen.getByTestId('theme-designer-theme').textContent).toContain(
      'light'
    )
    expect(screen.getByTestId('theme-designer-title').textContent).toContain(
      'Chat title'
    )
    expect(screen.getByTestId('theme-designer-tools').textContent).toContain(
      'yes'
    )
  })

  it('uses controlled state hook with default, value and setValue args', () => {
    const setValue = jest.fn()

    useControlledState.mockReturnValue(['theme-1', jest.fn()])

    render(
      <ThemeBuilder
        defaultValue="theme-default"
        value="theme-controlled"
        setValue={setValue}
      />
    )

    expect(useControlledState).toHaveBeenCalledWith(
      'theme-default',
      'theme-controlled',
      setValue
    )
  })

  it('passes setter down to ThemeDesigner and updates through callback', () => {
    const setTheme = jest.fn()

    useControlledState.mockReturnValue(['light', setTheme])

    render(<ThemeBuilder defaultValue="light" />)
    fireEvent.click(screen.getByRole('button', { name: 'set-dark' }))

    expect(setTheme).toHaveBeenCalledWith('dark')
  })
})
