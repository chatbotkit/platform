import AdvancedAutoTextarea from './AdvancedAutoTextarea'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/components/AutoTextarea', () => {
  const React = jest.requireActual('react')

  return {
    __esModule: true,
    default: React.forwardRef(function AutoTextarea(props, ref) {
      return <textarea {...props} ref={ref} />
    }),
  }
})

describe('AdvancedAutoTextarea', () => {
  describe('basic functionality', () => {
    it('should render with default props', () => {
      render(<AdvancedAutoTextarea placeholder="Enter text" />)
      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
    })

    it('should render without children', () => {
      render(<AdvancedAutoTextarea placeholder="Test" />)

      const extraDiv = document.querySelector('.absolute')

      expect(extraDiv).not.toBeInTheDocument()
    })

    it('should render with children', () => {
      render(
        <AdvancedAutoTextarea placeholder="Test">
          <button type="button">Submit</button>
        </AdvancedAutoTextarea>
      )

      const extraDiv = document.querySelector('.absolute')

      expect(extraDiv).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument()
    })
  })

  describe('className handling', () => {
    it('should apply custom className to textarea', () => {
      render(
        <AdvancedAutoTextarea className="custom-class" placeholder="Test" />
      )

      const textarea = screen.getByPlaceholderText('Test')

      expect(textarea).toHaveClass('custom-class')
    })

    it('should apply wrapperClassName to wrapper div', () => {
      render(
        <AdvancedAutoTextarea
          wrapperClassName="wrapper-class"
          placeholder="Test"
        />
      )

      const wrapper = document.querySelector('.wrapper-class')

      expect(wrapper).toBeInTheDocument()
    })

    it('should render wrapper and textarea full-width by default', () => {
      render(<AdvancedAutoTextarea placeholder="Test" />)

      const textarea = screen.getByPlaceholderText('Test')

      expect(textarea).toHaveClass('w-full')
      expect(textarea.parentElement).toHaveClass('w-full')
    })

    it('should add extra padding classes when children present', () => {
      render(
        <AdvancedAutoTextarea placeholder="Test">
          <button type="button">Action</button>
        </AdvancedAutoTextarea>
      )

      const textarea = screen.getByPlaceholderText('Test')

      expect(textarea).toHaveClass('!pb-10')
      expect(textarea).toHaveClass('!scroll-pb-10')
    })

    it('should not add extra padding classes without children', () => {
      render(<AdvancedAutoTextarea placeholder="Test" />)

      const textarea = screen.getByPlaceholderText('Test')

      expect(textarea).not.toHaveClass('!pb-10')
      expect(textarea).not.toHaveClass('!scroll-pb-10')
    })
  })

  describe('forwarded ref', () => {
    it('should forward ref to textarea', () => {
      const ref = { current: null }

      render(<AdvancedAutoTextarea ref={ref} placeholder="Test" />)
      expect(ref.current).toBeTruthy()
      expect(ref.current.tagName).toBe('TEXTAREA')
    })
  })

  describe('custom autoTextareaAs prop', () => {
    it('should render custom component when autoTextareaAs provided', () => {
      const CustomTextarea = ({ placeholder, ...props }) => (
        <textarea {...props} placeholder={placeholder} data-custom="true" />
      )

      render(
        <AdvancedAutoTextarea
          autoTextareaAs={CustomTextarea}
          placeholder="Custom"
        />
      )

      const textarea = screen.getByPlaceholderText('Custom')

      expect(textarea).toHaveAttribute('data-custom', 'true')
    })
  })

  describe('event handling', () => {
    it('should handle onChange events', () => {
      const handleChange = jest.fn()

      render(
        <AdvancedAutoTextarea onChange={handleChange} placeholder="Test" />
      )

      const textarea = screen.getByPlaceholderText('Test')

      fireEvent.change(textarea, { target: { value: 'new value' } })
      expect(handleChange).toHaveBeenCalled()
    })

    it('should handle child button clicks', () => {
      const handleClick = jest.fn()

      render(
        <AdvancedAutoTextarea placeholder="Test">
          <button type="button" onClick={handleClick}>
            Click me
          </button>
        </AdvancedAutoTextarea>
      )

      const button = screen.getByRole('button', { name: 'Click me' })

      fireEvent.click(button)
      expect(handleClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('props spreading', () => {
    it('should pass through additional props to textarea', () => {
      render(
        <AdvancedAutoTextarea
          placeholder="Test"
          data-testid="custom-textarea"
          maxLength={100}
        />
      )

      const textarea = screen.getByPlaceholderText('Test')

      expect(textarea).toHaveAttribute('data-testid', 'custom-textarea')
      expect(textarea).toHaveAttribute('maxLength', '100')
    })
  })
})
