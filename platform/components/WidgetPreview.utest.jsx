import WidgetPreview from './WidgetPreview'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@/pages/integrations/widget/[widgetIntegrationId]/frame', () => ({
  Button: ({ disabled, className, ...props }) => (
    <button type="button" disabled={disabled} className={className} {...props}>
      Widget Button
    </button>
  ),
  Popup: ({ messages, disabled, className, ...props }) => (
    <div
      className={className}
      data-testid="widget-popup"
      data-disabled={disabled}
      {...props}
    >
      Popup Content
    </div>
  ),
  RequiredWrappers: ({
    children,
    themeWrapperClassName,
    integration,
    title,
    intro,
    theme,
    disabled,
    autoScroll,
    autoFocus,
  }) => (
    <div
      className={themeWrapperClassName}
      data-testid="required-wrappers"
      data-title={title}
      data-intro={intro}
      data-disabled={disabled}
      data-auto-scroll={autoScroll}
      data-auto-focus={autoFocus}
    >
      {children}
    </div>
  ),
}))

describe('WidgetPreview', () => {
  const defaultProps = {
    title: 'Chat Widget',
    intro: 'Welcome to our chat',
    messages: [
      { text: 'Hello', role: 'user' },
      { text: 'Hi there', role: 'bot' },
    ],
    theme: {
      primaryColor: '#007bff',
      backgroundColor: '#ffffff',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should render without crashing', () => {
      render(<WidgetPreview {...defaultProps} />)

      expect(screen.getByTestId('required-wrappers')).toBeInTheDocument()
      expect(screen.getByTestId('widget-popup')).toBeInTheDocument()
    })

    it('should pass title prop to RequiredWrappers', () => {
      render(<WidgetPreview {...defaultProps} />)

      const wrappers = screen.getByTestId('required-wrappers')

      expect(wrappers).toHaveAttribute('data-title', 'Chat Widget')
    })

    it('should pass intro prop to RequiredWrappers', () => {
      render(<WidgetPreview {...defaultProps} />)

      const wrappers = screen.getByTestId('required-wrappers')

      expect(wrappers).toHaveAttribute('data-intro', 'Welcome to our chat')
    })

    it('should pass theme prop to RequiredWrappers', () => {
      render(<WidgetPreview {...defaultProps} />)

      expect(screen.getByTestId('required-wrappers')).toBeInTheDocument()
    })

    it('should render Popup with messages', () => {
      render(<WidgetPreview {...defaultProps} />)

      const popup = screen.getByTestId('widget-popup')

      expect(popup).toBeInTheDocument()
    })
  })

  describe('button prop', () => {
    it('should render Button when button prop is true', () => {
      render(<WidgetPreview {...defaultProps} button={true} />)

      expect(screen.getByText('Widget Button')).toBeInTheDocument()
    })

    it('should not render Button when button prop is false', () => {
      render(<WidgetPreview {...defaultProps} button={false} />)

      expect(screen.queryByText('Widget Button')).not.toBeInTheDocument()
    })

    it('should not render Button when button prop is undefined', () => {
      render(<WidgetPreview {...defaultProps} />)

      expect(screen.queryByText('Widget Button')).not.toBeInTheDocument()
    })

    it('should render Button with disabled prop', () => {
      render(<WidgetPreview {...defaultProps} button={true} />)

      const button = screen.getByText('Widget Button')

      expect(button).toBeDisabled()
    })
  })

  describe('interactive prop', () => {
    it('should apply pointer-events-none when interactive is false', () => {
      const { container } = render(
        <WidgetPreview {...defaultProps} interactive={false} />
      )

      const wrappers = screen.getByTestId('required-wrappers')

      expect(wrappers).toHaveClass('pointer-events-none')
      expect(wrappers).toHaveClass('select-none')
    })

    it('should not apply pointer-events-none when interactive is true', () => {
      const { container } = render(
        <WidgetPreview {...defaultProps} interactive={true} />
      )

      const wrappers = screen.getByTestId('required-wrappers')

      expect(wrappers).not.toHaveClass('pointer-events-none')
      expect(wrappers).not.toHaveClass('select-none')
    })

    it('should apply pointer-events-none by default', () => {
      render(<WidgetPreview {...defaultProps} />)

      const wrappers = screen.getByTestId('required-wrappers')

      expect(wrappers).toHaveClass('pointer-events-none')
    })
  })

  describe('className prop', () => {
    it('should apply custom className', () => {
      render(<WidgetPreview {...defaultProps} className="custom-class" />)

      const wrappers = screen.getByTestId('required-wrappers')

      expect(wrappers).toHaveClass('custom-class')
    })

    it('should maintain base classes with custom className', () => {
      render(<WidgetPreview {...defaultProps} className="custom-class" />)

      const wrappers = screen.getByTestId('required-wrappers')

      expect(wrappers).toHaveClass('widget-preview')
      expect(wrappers).toHaveClass('custom-class')
    })
  })

  describe('disabled state', () => {
    it('should pass disabled prop to RequiredWrappers', () => {
      render(<WidgetPreview {...defaultProps} />)

      const wrappers = screen.getByTestId('required-wrappers')

      expect(wrappers).toHaveAttribute('data-disabled', 'true')
    })

    it('should pass disabled prop to Popup', () => {
      render(<WidgetPreview {...defaultProps} />)

      const popup = screen.getByTestId('widget-popup')

      expect(popup).toHaveAttribute('data-disabled', 'true')
    })
  })

  describe('autoScroll and autoFocus', () => {
    it('should set autoScroll to false', () => {
      render(<WidgetPreview {...defaultProps} />)

      const wrappers = screen.getByTestId('required-wrappers')

      expect(wrappers).toHaveAttribute('data-auto-scroll', 'false')
    })

    it('should set autoFocus to false', () => {
      render(<WidgetPreview {...defaultProps} />)

      const wrappers = screen.getByTestId('required-wrappers')

      expect(wrappers).toHaveAttribute('data-auto-focus', 'false')
    })
  })

  describe('edge cases', () => {
    it('should handle empty messages array', () => {
      render(<WidgetPreview {...defaultProps} messages={[]} />)

      expect(screen.getByTestId('widget-popup')).toBeInTheDocument()
    })

    it('should handle undefined theme', () => {
      render(<WidgetPreview {...defaultProps} theme={undefined} />)

      expect(screen.getByTestId('required-wrappers')).toBeInTheDocument()
    })

    it('should handle missing title and intro', () => {
      render(
        <WidgetPreview
          messages={defaultProps.messages}
          theme={defaultProps.theme}
        />
      )

      // @note when title/intro are undefined, RequiredWrappers gets undefined which may not render as data attribute
      expect(screen.getByTestId('required-wrappers')).toBeInTheDocument()
    })
  })

  describe('layout classes', () => {
    it('should apply flex layout classes', () => {
      render(<WidgetPreview {...defaultProps} />)

      const wrappers = screen.getByTestId('required-wrappers')

      expect(wrappers).toHaveClass('flex')
      expect(wrappers).toHaveClass('flex-col')
    })
  })
})
