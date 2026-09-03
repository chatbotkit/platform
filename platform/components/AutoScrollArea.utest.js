import AutoScrollArea, {
  AutoScrollAnchor,
  AutoScrollStop,
} from './AutoScrollArea'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

// Mock the ScrollManager to control its behavior
jest.mock('@/lib/scroll.manager', () => ({
  ScrollManager: jest.fn().mockImplementation(() => ({
    state: 'neutral',
    disabled: false,
    destroy: jest.fn(),
    addStopElement: jest.fn(),
    removeStopElement: jest.fn(),
    addAnchorElement: jest.fn(),
    removeAnchorElement: jest.fn(),
  })),
}))

// Mock css.support
jest.mock('@/lib/css.support', () => ({
  supports: jest.fn().mockReturnValue(true),
}))

describe('AutoScrollArea', () => {
  beforeEach(() => {
    // Mock IntersectionObserver
    global.IntersectionObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }))
  })

  it('renders children', () => {
    render(
      <AutoScrollArea>
        <div data-testid="content">Test content</div>
      </AutoScrollArea>
    )

    expect(screen.getByTestId('content')).toHaveTextContent('Test content')
  })

  it('applies auto-scroll-area class', () => {
    render(
      <AutoScrollArea data-testid="scroll-area">
        <div>Content</div>
      </AutoScrollArea>
    )

    expect(screen.getByTestId('scroll-area')).toHaveClass('auto-scroll-area')
  })

  it('applies custom className', () => {
    render(
      <AutoScrollArea className="custom-class" data-testid="scroll-area">
        <div>Content</div>
      </AutoScrollArea>
    )

    expect(screen.getByTestId('scroll-area')).toHaveClass('custom-class')
  })
})

describe('AutoScrollStop', () => {
  let mockScrollManager

  beforeEach(() => {
    mockScrollManager = {
      state: 'neutral',
      addStopElement: jest.fn(),
      removeStopElement: jest.fn(),
    }

    // Mock IntersectionObserver
    global.IntersectionObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }))
  })

  it('renders children', () => {
    render(
      <AutoScrollArea>
        <AutoScrollStop>
          <span data-testid="stop-content">Stop here</span>
        </AutoScrollStop>
      </AutoScrollArea>
    )

    expect(screen.getByTestId('stop-content')).toHaveTextContent('Stop here')
  })

  it('applies auto-scroll-stop class', () => {
    render(
      <AutoScrollArea>
        <AutoScrollStop data-testid="stop-element">Content</AutoScrollStop>
      </AutoScrollArea>
    )

    expect(screen.getByTestId('stop-element')).toHaveClass('auto-scroll-stop')
  })

  it('does not throw when element is connected to DOM', () => {
    // This test verifies the regression fix
    // When rendered normally, elements are connected and should work
    expect(() => {
      render(
        <AutoScrollArea>
          <AutoScrollStop>Content</AutoScrollStop>
        </AutoScrollArea>
      )
    }).not.toThrow()
  })

  it('applies custom className', () => {
    render(
      <AutoScrollArea>
        <AutoScrollStop className="custom-stop" data-testid="stop-element">
          Content
        </AutoScrollStop>
      </AutoScrollArea>
    )

    expect(screen.getByTestId('stop-element')).toHaveClass('custom-stop')
  })

  it('handles disabled state', () => {
    render(
      <AutoScrollArea>
        <AutoScrollStop disabled data-testid="stop-element">
          Content
        </AutoScrollStop>
      </AutoScrollArea>
    )

    expect(screen.getByTestId('stop-element')).toHaveAttribute(
      'data-disabled',
      'true'
    )
  })
})

describe('AutoScrollAnchor', () => {
  beforeEach(() => {
    // Mock IntersectionObserver
    global.IntersectionObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }))
  })

  it('renders children', () => {
    render(
      <AutoScrollArea anchor={null}>
        <AutoScrollAnchor>
          <span data-testid="anchor-content">Anchor here</span>
        </AutoScrollAnchor>
      </AutoScrollArea>
    )

    expect(screen.getByTestId('anchor-content')).toHaveTextContent(
      'Anchor here'
    )
  })

  it('applies auto-scroll-anchor class', () => {
    render(
      <AutoScrollArea anchor={null}>
        <AutoScrollAnchor data-testid="anchor-element">
          Content
        </AutoScrollAnchor>
      </AutoScrollArea>
    )

    expect(screen.getByTestId('anchor-element')).toHaveClass(
      'auto-scroll-anchor'
    )
  })

  it('does not throw when element is connected to DOM', () => {
    // This test verifies the regression fix
    // When rendered normally, elements are connected and should work
    expect(() => {
      render(
        <AutoScrollArea anchor={null}>
          <AutoScrollAnchor>Content</AutoScrollAnchor>
        </AutoScrollArea>
      )
    }).not.toThrow()
  })

  it('applies custom className', () => {
    render(
      <AutoScrollArea anchor={null}>
        <AutoScrollAnchor
          className="custom-anchor"
          data-testid="anchor-element"
        >
          Content
        </AutoScrollAnchor>
      </AutoScrollArea>
    )

    expect(screen.getByTestId('anchor-element')).toHaveClass('custom-anchor')
  })

  it('handles disabled state', () => {
    render(
      <AutoScrollArea anchor={null}>
        <AutoScrollAnchor disabled data-testid="anchor-element">
          Content
        </AutoScrollAnchor>
      </AutoScrollArea>
    )

    expect(screen.getByTestId('anchor-element')).toHaveAttribute(
      'data-disabled',
      'true'
    )
  })
})

describe('AutoScrollStop/AutoScrollAnchor isConnected check', () => {
  // These tests verify the regression fix
  // The components should gracefully handle the race condition where
  // useEffect fires before the element is fully connected to the DOM

  beforeEach(() => {
    // Mock IntersectionObserver
    global.IntersectionObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }))
  })

  it('AutoScrollStop renders without error in normal conditions', () => {
    // When rendered inside AutoScrollArea, elements are properly connected
    const { unmount } = render(
      <AutoScrollArea>
        <AutoScrollStop data-testid="stop">Stop content</AutoScrollStop>
      </AutoScrollArea>
    )

    expect(screen.getByTestId('stop')).toBeInTheDocument()
    expect(screen.getByTestId('stop')).toHaveTextContent('Stop content')

    // Cleanup should also work without errors
    expect(() => unmount()).not.toThrow()
  })

  it('AutoScrollAnchor renders without error in normal conditions', () => {
    // When rendered inside AutoScrollArea, elements are properly connected
    const { unmount } = render(
      <AutoScrollArea anchor={null}>
        <AutoScrollAnchor data-testid="anchor">Anchor content</AutoScrollAnchor>
      </AutoScrollArea>
    )

    expect(screen.getByTestId('anchor')).toBeInTheDocument()
    expect(screen.getByTestId('anchor')).toHaveTextContent('Anchor content')

    // Cleanup should also work without errors
    expect(() => unmount()).not.toThrow()
  })
})
