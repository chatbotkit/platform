import Pullout from './Pullout'

import '@testing-library/jest-dom'
import { act, fireEvent, render, screen } from '@testing-library/react'

describe('Pullout', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers()
    })

    jest.useRealTimers()
  })

  it('animates the handle through its first-appearance hint phases', () => {
    render(<Pullout>Content</Pullout>)

    const handle = screen.getByRole('button', { name: 'Toggle pullout' })

    expect(handle).toHaveAttribute('data-hint-phase', 'hidden')

    act(() => {
      jest.advanceTimersByTime(100)
    })

    expect(handle).toHaveAttribute('data-hint-phase', 'revealed')

    act(() => {
      jest.advanceTimersByTime(200)
    })

    expect(handle).toHaveAttribute('data-hint-phase', 'expanded')

    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(handle).toHaveAttribute('data-hint-phase', 'settled')

    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(handle).toHaveAttribute('data-hint-phase', 'idle')
  })

  it('keeps the handle idle when the hint animation is disabled', () => {
    render(<Pullout enableHandleHintAnimation={false}>Content</Pullout>)

    const handle = screen.getByRole('button', { name: 'Toggle pullout' })

    expect(handle).toHaveAttribute('data-hint-phase', 'idle')

    act(() => {
      jest.advanceTimersByTime(2000)
    })

    expect(handle).toHaveAttribute('data-hint-phase', 'idle')
  })

  it('publishes the handle bar height as --pullout-inset-bottom while mounted', () => {
    const offsetHeight = jest
      .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
      .mockReturnValue(32)

    try {
      const { unmount } = render(<Pullout>Content</Pullout>)

      expect(
        document.documentElement.style.getPropertyValue(
          '--pullout-inset-bottom'
        )
      ).toBe('32px')

      unmount()

      expect(
        document.documentElement.style.getPropertyValue(
          '--pullout-inset-bottom'
        )
      ).toBe('')
    } finally {
      offsetHeight.mockRestore()
    }
  })

  it('renders a resize handle only when open and resize is enabled', () => {
    render(<Pullout enableResize={true}>Content</Pullout>)

    expect(
      screen.queryByRole('separator', { name: 'Resize pullout' })
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Toggle pullout' }))

    expect(
      screen.getByRole('separator', { name: 'Resize pullout' })
    ).toBeInTheDocument()
  })
})
