/* eslint-disable @typescript-eslint/no-require-imports */
import PopButton from './PopButton'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/components/GlobalRoot', () => ({
  GlobalRootPortal: ({ children }) => (
    <div data-testid="portal">{children}</div>
  ),
}))

jest.mock('@floating-ui/react', () => ({
  ...jest.requireActual('@floating-ui/react'),
  useFloating: jest.fn(() => ({
    refs: {
      setReference: jest.fn(),
      setFloating: jest.fn(),
    },
    floatingStyles: {},
    context: {},
    x: 10,
    y: 20,
  })),
  useClick: jest.fn(() => ({})),
  useDismiss: jest.fn(() => ({})),
  useInteractions: jest.fn(() => ({
    getReferenceProps: (userProps = {}) => userProps,
    getFloatingProps: (userProps = {}) => userProps,
  })),
  useTransitionStyles: jest.fn(() => ({
    isMounted: true,
    styles: {},
  })),
  autoPlacement: jest.fn(),
  offset: jest.fn(),
}))

describe('PopButton', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('forwards additional props to the trigger element', () => {
    render(
      <PopButton
        caption="Open"
        data-testid="pop-trigger"
        aria-label="Open menu"
        className="custom-class"
      >
        <div>Menu</div>
      </PopButton>
    )

    const trigger = screen.getByTestId('pop-trigger')

    expect(trigger).toHaveAttribute('aria-label', 'Open menu')
    expect(trigger).toHaveClass('custom-class')
    expect(trigger).toHaveAttribute('type', 'button')
  })

  it('preserves onClick when interaction props are applied', () => {
    const { useInteractions } = require('@floating-ui/react')

    useInteractions.mockReturnValue({
      getReferenceProps: (userProps = {}) => ({
        ...userProps,
        onMouseDown: jest.fn(),
      }),
      getFloatingProps: (userProps = {}) => userProps,
    })

    const onClick = jest.fn()

    render(
      <PopButton caption="Open" onClick={onClick}>
        <div>Menu</div>
      </PopButton>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('disables the trigger when disabled is true', () => {
    render(
      <PopButton caption="Open" disabled>
        <div>Menu</div>
      </PopButton>
    )

    expect(screen.getByRole('button', { name: 'Open' })).toBeDisabled()
  })
})
