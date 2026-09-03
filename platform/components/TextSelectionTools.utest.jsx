/* eslint-disable @typescript-eslint/no-require-imports */
import TextSelectionTools from './TextSelectionTools'

import '@testing-library/jest-dom'
import { act, render, screen } from '@testing-library/react'

jest.mock('@/hooks/useTextSelection', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/components/GlobalRoot', () => ({
  __esModule: true,
  GlobalRootPortal: ({ children }) => (
    <div data-testid="portal">{children}</div>
  ),
}))

const useTextSelection = require('@/hooks/useTextSelection').default

describe('TextSelectionTools', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    Object.defineProperty(window, 'innerHeight', {
      value: 800,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(window, 'innerWidth', {
      value: 1200,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('does not render when selection is collapsed', () => {
    useTextSelection.mockReturnValue({
      clientRect: { top: 10, bottom: 20, left: 10, right: 60, width: 50 },
      textContent: 'hello',
      isCollapsed: true,
    })

    render(<TextSelectionTools>tools</TextSelectionTools>)

    expect(screen.queryByTestId('portal')).not.toBeInTheDocument()
  })

  it('renders immediately when selection is valid and delay is 0', () => {
    useTextSelection.mockReturnValue({
      clientRect: { top: 100, bottom: 120, left: 20, right: 120, width: 100 },
      textContent: 'selected text',
      isCollapsed: false,
    })

    render(<TextSelectionTools>tools</TextSelectionTools>)

    expect(screen.getByTestId('portal')).toHaveTextContent('tools')
  })

  it('renders after delay when delay is provided', () => {
    useTextSelection.mockReturnValue({
      clientRect: { top: 100, bottom: 120, left: 20, right: 120, width: 100 },
      textContent: 'selected text',
      isCollapsed: false,
    })

    render(<TextSelectionTools delay={200}>tools</TextSelectionTools>)

    expect(screen.queryByTestId('portal')).not.toBeInTheDocument()

    act(() => {
      jest.advanceTimersByTime(200)
    })

    expect(screen.getByTestId('portal')).toHaveTextContent('tools')
  })

  it('calls onTextSelectionChange with normalized selection payload', () => {
    const onTextSelectionChange = jest.fn()
    const clientRect = {
      top: 200,
      bottom: 240,
      left: 80,
      right: 180,
      width: 100,
    }

    useTextSelection.mockReturnValue({
      clientRect,
      textContent: 'payload',
      isCollapsed: false,
    })

    render(
      <TextSelectionTools onTextSelectionChange={onTextSelectionChange}>
        tools
      </TextSelectionTools>
    )

    expect(onTextSelectionChange).toHaveBeenCalledWith({
      rect: clientRect,
      text: 'payload',
      isCollapsed: false,
    })
  })

  it('passes computed style and selection data to render-prop children', () => {
    const child = jest.fn(() => <div data-testid="child">child</div>)

    useTextSelection.mockReturnValue({
      clientRect: { top: 300, bottom: 340, left: 100, right: 220, width: 120 },
      textContent: 'abc',
      isCollapsed: false,
    })

    render(
      <TextSelectionTools position="right" placement="top" offset={12}>
        {child}
      </TextSelectionTools>
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(child).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'abc',
        rect: expect.objectContaining({ top: 300, bottom: 340 }),
        style: expect.objectContaining({
          position: 'fixed',
          right: 980,
          bottom: 512,
        }),
      })
    )
  })
})
