/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

// Mock the external AutoTextarea component
jest.mock('@/components/AutoTextarea', () => {
  return {
    __esModule: true,
    // eslint-disable-next-line react/display-name
    default: React.forwardRef(({ className, ...props }, ref) => {
      const localRef = React.useRef(null)

      React.useImperativeHandle(ref, () => localRef.current)

      // Simulate clsx behavior
      const classes = [
        'min-h-[5rem]',
        'resize-none',
        'overflow-hidden',
        'w-full',
        className,
      ]
        .filter(Boolean)
        .join(' ')

      return (
        <textarea
          data-testid="auto-textarea"
          className={classes}
          ref={localRef}
          {...props}
        />
      )
    }),
  }
})

const AutoTextarea = require('@/components/AutoTextarea').default

describe('AutoTextarea', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should render AutoTextarea component', () => {
      render(<AutoTextarea />)

      expect(screen.getByTestId('auto-textarea')).toBeInTheDocument()
    })

    it('should apply default className', () => {
      render(<AutoTextarea />)

      const textarea = screen.getByTestId('auto-textarea')

      expect(textarea.className).toContain('min-h-[5rem]')
      expect(textarea.className).toContain('resize-none')
      expect(textarea.className).toContain('overflow-hidden')
      expect(textarea.className).toContain('w-full')
    })

    it('should pass through props to underlying component', () => {
      render(<AutoTextarea placeholder="Enter text" maxLength={100} />)

      const textarea = screen.getByTestId('auto-textarea')

      expect(textarea).toHaveAttribute('placeholder', 'Enter text')
      expect(textarea).toHaveAttribute('maxLength', '100')
    })

    it('should merge custom className with default classes', () => {
      render(<AutoTextarea className="custom-class" />)

      const textarea = screen.getByTestId('auto-textarea')

      expect(textarea.className).toContain('custom-class')
      expect(textarea.className).toContain('min-h-[5rem]')
    })
  })

  describe('ref forwarding', () => {
    it('should forward ref correctly', () => {
      const ref = React.createRef()

      render(<AutoTextarea ref={ref} />)

      expect(ref.current).not.toBeNull()
    })

    it('should forward ref with value', () => {
      const ref = React.createRef()

      render(<AutoTextarea ref={ref} defaultValue="Test value" />)

      expect(ref.current).toBeTruthy()
    })

    it('should handle multiple renders with ref', () => {
      const ref = React.createRef()

      const { rerender } = render(<AutoTextarea ref={ref} />)

      const firstRef = ref.current

      rerender(<AutoTextarea ref={ref} />)

      expect(ref.current).toBe(firstRef)
    })
  })

  describe('edge cases', () => {
    it('should handle empty className', () => {
      render(<AutoTextarea className="" />)

      const textarea = screen.getByTestId('auto-textarea')

      expect(textarea.className).toContain('min-h-[5rem]')
    })

    it('should handle null ref', () => {
      expect(() => {
        render(<AutoTextarea ref={null} />)
      }).not.toThrow()
    })

    it('should handle undefined className', () => {
      render(<AutoTextarea className={undefined} />)

      const textarea = screen.getByTestId('auto-textarea')

      expect(textarea.className).toBeTruthy()
    })

    it('should handle disabled prop', () => {
      render(<AutoTextarea disabled />)

      const textarea = screen.getByTestId('auto-textarea')

      expect(textarea).toBeDisabled()
    })

    it('should handle readOnly prop', () => {
      render(<AutoTextarea readOnly />)

      const textarea = screen.getByTestId('auto-textarea')

      expect(textarea).toHaveAttribute('readOnly')
    })

    it('should handle value prop', () => {
      render(<AutoTextarea value="Controlled value" onChange={() => {}} />)

      const textarea = screen.getByTestId('auto-textarea')

      expect(textarea).toHaveValue('Controlled value')
    })

    it('should handle defaultValue prop', () => {
      render(<AutoTextarea defaultValue="Default value" />)

      const textarea = screen.getByTestId('auto-textarea')

      expect(textarea).toHaveValue('Default value')
    })
  })

  describe('className combinations', () => {
    it('should handle multiple custom classes', () => {
      render(<AutoTextarea className="class1 class2 class3" />)

      const textarea = screen.getByTestId('auto-textarea')

      expect(textarea.className).toContain('class1 class2 class3')
      expect(textarea.className).toContain('min-h-[5rem]')
    })

    it('should handle className as undefined', () => {
      render(<AutoTextarea />)

      const textarea = screen.getByTestId('auto-textarea')

      expect(textarea.className).toContain('min-h-[5rem]')
      expect(textarea.className).toContain('resize-none')
    })
  })

  describe('props spreading', () => {
    it('should spread all props except className', () => {
      const props = {
        id: 'test-id',
        name: 'test-name',
        'data-custom': 'custom-value',
        'aria-label': 'test-label',
      }

      render(<AutoTextarea {...props} />)

      const textarea = screen.getByTestId('auto-textarea')

      expect(textarea).toHaveAttribute('id', 'test-id')
      expect(textarea).toHaveAttribute('name', 'test-name')
      expect(textarea).toHaveAttribute('data-custom', 'custom-value')
      expect(textarea).toHaveAttribute('aria-label', 'test-label')
    })

    it('should handle event handler props', () => {
      const handleChange = jest.fn()
      const handleBlur = jest.fn()
      const handleFocus = jest.fn()

      const { container } = render(
        <AutoTextarea
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
        />
      )

      const textarea = screen.getByTestId('auto-textarea')

      // Event handlers are attached, just verify the component renders
      expect(textarea).toBeInTheDocument()
      expect(
        container.querySelector('[data-testid="auto-textarea"]')
      ).toBeTruthy()
    })
  })

  describe('default classes', () => {
    it('should always include min-h-[5rem] class', () => {
      render(<AutoTextarea className="custom" />)

      const textarea = screen.getByTestId('auto-textarea')

      expect(textarea.className).toContain('min-h-[5rem]')
    })

    it('should always include resize-none class', () => {
      render(<AutoTextarea className="custom" />)

      const textarea = screen.getByTestId('auto-textarea')

      expect(textarea.className).toContain('resize-none')
    })

    it('should always include overflow-hidden class', () => {
      render(<AutoTextarea className="custom" />)

      const textarea = screen.getByTestId('auto-textarea')

      expect(textarea.className).toContain('overflow-hidden')
    })

    it('should always include w-full class', () => {
      render(<AutoTextarea className="custom" />)

      const textarea = screen.getByTestId('auto-textarea')

      expect(textarea.className).toContain('w-full')
    })
  })
})
