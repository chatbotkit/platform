import Box from './Box'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

describe('Box', () => {
  describe('rendering', () => {
    it('should render a div with default classes', () => {
      const { container } = render(<Box />)

      const element = container.firstChild

      expect(element).toBeInTheDocument()
      expect(element.tagName).toBe('DIV')
      expect(element).toHaveClass(
        'box',
        'flex-1',
        'flex',
        'flex-col',
        'overflow-hidden'
      )
    })

    it('should accept and apply custom className', () => {
      const { container } = render(<Box className="custom-class" />)

      const element = container.firstChild

      expect(element).toHaveClass(
        'box',
        'flex-1',
        'flex',
        'flex-col',
        'overflow-hidden',
        'custom-class'
      )
    })

    it('should forward additional props to div element', () => {
      const { container } = render(<Box data-testid="test-box" id="my-box" />)

      const element = container.firstChild

      expect(element).toHaveAttribute('data-testid', 'test-box')
      expect(element).toHaveAttribute('id', 'my-box')
    })

    it('should render children content', () => {
      const { container, getByText } = render(
        <Box>
          <span>Test Content</span>
        </Box>
      )

      expect(getByText('Test Content')).toBeInTheDocument()
      expect(container.firstChild).toContainElement(getByText('Test Content'))
    })

    it('should handle multiple className values correctly', () => {
      const { container } = render(<Box className="class-a class-b class-c" />)

      const element = container.firstChild

      expect(element).toHaveClass('box', 'class-a', 'class-b', 'class-c')
    })
  })
})
