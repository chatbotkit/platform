/* eslint-disable @typescript-eslint/no-require-imports */
import TooltipButton from './TooltipButton'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

// Mock GlobalRootPortal to render children directly
jest.mock('@/components/GlobalRoot', () => ({
  GlobalRootPortal: ({ children }) => (
    <div data-testid="portal">{children}</div>
  ),
}))

// Mock floating-ui hooks
jest.mock('@floating-ui/react', () => ({
  ...jest.requireActual('@floating-ui/react'),
  useFloating: jest.fn(() => ({
    refs: {
      setReference: jest.fn(),
      setFloating: jest.fn(),
    },
    floatingStyles: {},
    context: {},
  })),
  useHover: jest.fn(() => ({})),
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

describe('TooltipButton', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic rendering', () => {
    it('should render button with caption', () => {
      render(<TooltipButton caption="Click me" />)
      expect(screen.getByRole('button')).toHaveTextContent('Click me')
    })

    it('should render button with children as caption', () => {
      render(<TooltipButton>Button Text</TooltipButton>)
      expect(screen.getByRole('button')).toHaveTextContent('Button Text')
    })

    it('should render with custom className', () => {
      render(<TooltipButton caption="Test" className="custom-class" />)
      expect(screen.getByRole('button')).toHaveClass('custom-class')
    })

    it('should not render when no caption or children provided', () => {
      const { container } = render(<TooltipButton />)

      expect(container.firstChild).toBeNull()
    })
  })

  describe('tooltip content', () => {
    it('should render tooltip when caption and tooltip provided', () => {
      const { useTransitionStyles } = require('@floating-ui/react')

      useTransitionStyles.mockReturnValue({
        isMounted: true,
        styles: {},
      })

      render(<TooltipButton caption="Button" tooltip="Tooltip text" />)

      expect(screen.getByText('Tooltip text')).toBeInTheDocument()
    })

    it('should use children as tooltip when only caption provided', () => {
      const { useTransitionStyles } = require('@floating-ui/react')

      useTransitionStyles.mockReturnValue({
        isMounted: true,
        styles: {},
      })

      render(<TooltipButton caption="Click">Tooltip content</TooltipButton>)

      expect(screen.getByText('Tooltip content')).toBeInTheDocument()
    })

    it('should use children as caption when only tooltip provided', () => {
      const { useTransitionStyles } = require('@floating-ui/react')

      useTransitionStyles.mockReturnValue({
        isMounted: true,
        styles: {},
      })

      render(<TooltipButton tooltip="Tooltip">Caption</TooltipButton>)

      expect(screen.getByRole('button')).toHaveTextContent('Caption')
      expect(screen.getByText('Tooltip')).toBeInTheDocument()
    })

    it('should not render tooltip when isMounted is false', () => {
      const { useTransitionStyles } = require('@floating-ui/react')

      useTransitionStyles.mockReturnValue({
        isMounted: false,
        styles: {},
      })

      render(<TooltipButton caption="Button" tooltip="Tooltip" />)

      expect(screen.queryByText('Tooltip')).not.toBeInTheDocument()
    })

    it('should apply tooltipClassName to tooltip content', () => {
      const { useTransitionStyles } = require('@floating-ui/react')

      useTransitionStyles.mockReturnValue({
        isMounted: true,
        styles: {},
      })

      render(
        <TooltipButton
          caption="Button"
          tooltip="Tooltip"
          tooltipClassName="custom-tooltip"
        />
      )

      const tooltip = screen.getByText('Tooltip').closest('.tooltip-content')

      expect(tooltip).toHaveClass('tooltip-content')
      expect(tooltip).toHaveClass('custom-tooltip')
    })
  })

  describe('polymorphic component', () => {
    it('should render as button by default', () => {
      render(<TooltipButton caption="Test" />)
      expect(screen.getByRole('button').tagName).toBe('BUTTON')
    })

    it('should render as custom element when as prop provided', () => {
      render(<TooltipButton as="div" caption="Test" />)

      const element = screen.getByText('Test')

      expect(element.tagName).toBe('DIV')
    })
  })

  describe('disabled state', () => {
    it('should disable button when disabled prop is true', () => {
      render(<TooltipButton caption="Test" disabled />)
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('should pass disabled state to hover interaction', () => {
      const { useHover } = require('@floating-ui/react')

      render(<TooltipButton caption="Test" disabled />)

      expect(useHover).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ enabled: false })
      )
    })

    it('should pass disabled state to dismiss interaction', () => {
      const { useDismiss } = require('@floating-ui/react')

      render(<TooltipButton caption="Test" disabled />)

      expect(useDismiss).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ enabled: false })
      )
    })
  })

  describe('floating UI configuration', () => {
    it('should pass placement to useFloating', () => {
      const { useFloating } = require('@floating-ui/react')

      render(<TooltipButton caption="Test" placement="top" />)

      expect(useFloating).toHaveBeenCalledWith(
        expect.objectContaining({ placement: 'top' })
      )
    })

    it('should pass strategy to useFloating', () => {
      const { useFloating } = require('@floating-ui/react')

      render(<TooltipButton caption="Test" strategy="fixed" />)

      expect(useFloating).toHaveBeenCalledWith(
        expect.objectContaining({ strategy: 'fixed' })
      )
    })

    it('should configure autoPlacement with allowedPlacements', () => {
      const { autoPlacement } = require('@floating-ui/react')
      const allowedPlacements = ['top', 'bottom']

      render(
        <TooltipButton caption="Test" allowedPlacements={allowedPlacements} />
      )

      expect(autoPlacement).toHaveBeenCalledWith({ allowedPlacements })
    })

    it('should configure offset with custom value', () => {
      const { offset } = require('@floating-ui/react')

      render(<TooltipButton caption="Test" offset={20} />)

      expect(offset).toHaveBeenCalledWith(20)
    })

    it('should use default offset of 10', () => {
      const { offset } = require('@floating-ui/react')

      render(<TooltipButton caption="Test" />)

      expect(offset).toHaveBeenCalledWith(10)
    })
  })

  describe('hover configuration', () => {
    it('should pass delay to useHover', () => {
      const { useHover } = require('@floating-ui/react')

      render(<TooltipButton caption="Test" delay={500} />)

      expect(useHover).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ delay: 500 })
      )
    })

    it('should pass restMs to useHover', () => {
      const { useHover } = require('@floating-ui/react')

      render(<TooltipButton caption="Test" restMs={200} />)

      expect(useHover).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ restMs: 200 })
      )
    })

    it('should disable move in hover config', () => {
      const { useHover } = require('@floating-ui/react')

      render(<TooltipButton caption="Test" />)

      expect(useHover).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ move: false })
      )
    })
  })

  describe('dismiss configuration', () => {
    it('should enable escapeKey in dismiss config', () => {
      const { useDismiss } = require('@floating-ui/react')

      render(<TooltipButton caption="Test" />)

      expect(useDismiss).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ escapeKey: true })
      )
    })

    it('should enable outsidePress in dismiss config', () => {
      const { useDismiss } = require('@floating-ui/react')

      render(<TooltipButton caption="Test" />)

      expect(useDismiss).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ outsidePress: true })
      )
    })

    it('should enable referencePress in dismiss config', () => {
      const { useDismiss } = require('@floating-ui/react')

      render(<TooltipButton caption="Test" />)

      expect(useDismiss).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ referencePress: true })
      )
    })
  })

  describe('transition styles', () => {
    it('should use scale transition when transitionStyles is "scale"', () => {
      const { useTransitionStyles } = require('@floating-ui/react')

      render(<TooltipButton caption="Test" transitionStyles="scale" />)

      expect(useTransitionStyles).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          initial: { transform: 'scale(0)' },
          open: { transform: 'scale(1)' },
          close: { transform: 'scale(0)' },
        })
      )
    })

    it('should use function result when transitionStyles is function', () => {
      const { useTransitionStyles } = require('@floating-ui/react')
      const customStyles = {
        initial: { opacity: 0 },
        open: { opacity: 1 },
      }
      const transitionFn = jest.fn(() => customStyles)

      render(<TooltipButton caption="Test" transitionStyles={transitionFn} />)

      expect(transitionFn).toHaveBeenCalled()
      expect(useTransitionStyles).toHaveBeenCalledWith(
        expect.anything(),
        customStyles
      )
    })

    it('should use provided object when transitionStyles is object', () => {
      const { useTransitionStyles } = require('@floating-ui/react')
      const customStyles = { initial: { opacity: 0 } }

      render(<TooltipButton caption="Test" transitionStyles={customStyles} />)

      expect(useTransitionStyles).toHaveBeenCalledWith(
        expect.anything(),
        customStyles
      )
    })
  })

  describe('onUnmount callback', () => {
    it('should call onUnmount when tooltip unmounts', () => {
      const { useTransitionStyles } = require('@floating-ui/react')
      const onUnmount = jest.fn()

      // Start with mounted
      useTransitionStyles.mockReturnValue({
        isMounted: true,
        styles: {},
      })

      const { rerender } = render(
        <TooltipButton caption="Test" tooltip="Tooltip" onUnmount={onUnmount} />
      )

      expect(onUnmount).not.toHaveBeenCalled()

      // Simulate unmount
      useTransitionStyles.mockReturnValue({
        isMounted: false,
        styles: {},
      })

      rerender(
        <TooltipButton caption="Test" tooltip="Tooltip" onUnmount={onUnmount} />
      )

      expect(onUnmount).toHaveBeenCalledTimes(1)
    })

    it('should not call onUnmount when isMounted stays true', () => {
      const { useTransitionStyles } = require('@floating-ui/react')
      const onUnmount = jest.fn()

      useTransitionStyles.mockReturnValue({
        isMounted: true,
        styles: {},
      })

      const { rerender } = render(
        <TooltipButton caption="Test" tooltip="Tooltip" onUnmount={onUnmount} />
      )

      rerender(
        <TooltipButton caption="Test" tooltip="Tooltip" onUnmount={onUnmount} />
      )

      expect(onUnmount).not.toHaveBeenCalled()
    })
  })

  describe('props forwarding', () => {
    it('should forward additional props to button', () => {
      render(
        <TooltipButton
          caption="Test"
          data-testid="custom-button"
          aria-label="Custom label"
        />
      )

      const button = screen.getByTestId('custom-button')

      expect(button).toHaveAttribute('aria-label', 'Custom label')
    })

    it('should set type to button', () => {
      render(<TooltipButton caption="Test" />)
      expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
    })

    it('should preserve onClick when interaction props are applied', () => {
      const { useInteractions } = require('@floating-ui/react')

      useInteractions.mockReturnValue({
        getReferenceProps: (userProps = {}) => ({
          ...userProps,
          onMouseEnter: jest.fn(),
        }),
        getFloatingProps: () => ({}),
      })

      const onClick = jest.fn()

      render(<TooltipButton caption="Test" onClick={onClick} />)

      fireEvent.click(screen.getByRole('button'))

      expect(onClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('memo export', () => {
    it('should export memoized version', () => {
      expect(TooltipButton.Memo).toBeDefined()
    })
  })
})
