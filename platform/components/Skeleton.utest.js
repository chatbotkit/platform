import Skeleton from './Skeleton'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

describe('Skeleton', () => {
  describe('rendering', () => {
    it('should render a div with skeleton classes', () => {
      const { container } = render(<Skeleton />)

      const element = container.firstChild

      expect(element).toBeInTheDocument()
      expect(element.tagName).toBe('DIV')
      expect(element).toHaveClass('skeleton')
      expect(element).toHaveClass('bg-gray-100')
      expect(element).toHaveClass('dark:bg-gray-900')
      expect(element).toHaveClass('animate-pulse')
    })

    it('should accept and apply custom className', () => {
      const { container } = render(<Skeleton className="custom-skeleton" />)

      const element = container.firstChild

      expect(element).toHaveClass(
        'skeleton',
        'animate-pulse',
        'custom-skeleton'
      )
    })

    it('should forward additional props to div element', () => {
      const { container } = render(
        <Skeleton data-testid="test-skeleton" style={{ width: '100px' }} />
      )

      const element = container.firstChild

      expect(element).toHaveAttribute('data-testid', 'test-skeleton')
      expect(element).toHaveStyle({ width: '100px' })
    })

    it('should render children content', () => {
      const { getByText } = render(
        <Skeleton>
          <span>Loading...</span>
        </Skeleton>
      )

      expect(getByText('Loading...')).toBeInTheDocument()
    })

    it('should merge multiple className values', () => {
      const { container } = render(<Skeleton className="h-4 w-full rounded" />)

      const element = container.firstChild

      expect(element).toHaveClass(
        'skeleton',
        'animate-pulse',
        'h-4',
        'w-full',
        'rounded'
      )
    })
  })
})
