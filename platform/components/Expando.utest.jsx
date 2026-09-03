/* eslint-disable @typescript-eslint/no-require-imports */
import Expando from './Expando'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock(
  '@/components/Collapsible',
  () =>
    function Collapsible({ children, className }) {
      return <div className={className}>{children}</div>
    }
)

jest.mock('@/hooks/useControlledState', () => {
  return jest.fn((defaultValue, value, setValue) => {
    if (value !== undefined) {
      return [value, setValue]
    }

    const [state, setState] = require('react').useState(defaultValue)

    return [state, setState]
  })
})

describe('Expando', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic rendering', () => {
    it('should render with title', () => {
      render(<Expando title="Test Title">Content</Expando>)
      expect(screen.getByText('Test Title')).toBeInTheDocument()
    })

    it('should render children', () => {
      render(<Expando title="Test Title">Test Content</Expando>)
      expect(screen.getByText('Test Content')).toBeInTheDocument()
    })

    it('should be closed by default', () => {
      const { container } = render(
        <Expando title="Test Title">Content</Expando>
      )
      const collapsible = container.querySelector('.\\!opacity-0')

      expect(collapsible).toBeInTheDocument()
    })

    it('should render chevron icon', () => {
      const { container } = render(
        <Expando title="Test Title">Content</Expando>
      )
      const chevron = container.querySelector('svg')

      expect(chevron).toBeInTheDocument()
    })
  })

  describe('defaultOpen prop', () => {
    it('should open when defaultOpen is true', () => {
      const { container } = render(
        <Expando title="Test Title" defaultOpen={true}>
          Content
        </Expando>
      )
      const collapsible = container.querySelector('.\\!opacity-0')

      expect(collapsible).not.toBeInTheDocument()
    })

    it('should be closed when defaultOpen is false', () => {
      const { container } = render(
        <Expando title="Test Title" defaultOpen={false}>
          Content
        </Expando>
      )
      const collapsible = container.querySelector('.\\!opacity-0')

      expect(collapsible).toBeInTheDocument()
    })
  })

  describe('click interaction', () => {
    it('should toggle open state when title is clicked', () => {
      const { container } = render(
        <Expando title="Test Title">Content</Expando>
      )

      const title = screen.getByText('Test Title')

      // Initially closed
      let collapsible = container.querySelector('.\\!opacity-0')

      expect(collapsible).toBeInTheDocument()

      // Click to open
      fireEvent.click(title)
      collapsible = container.querySelector('.\\!opacity-0')
      expect(collapsible).not.toBeInTheDocument()

      // Click to close
      fireEvent.click(title)
      collapsible = container.querySelector('.\\!opacity-0')
      expect(collapsible).toBeInTheDocument()
    })

    it('should rotate chevron when opened', () => {
      const { container } = render(
        <Expando title="Test Title">Content</Expando>
      )
      const title = screen.getByText('Test Title')
      const chevron = container.querySelector('svg')

      // Initially not rotated
      expect(chevron).not.toHaveClass('rotate-90')

      // Click to open
      fireEvent.click(title)
      expect(chevron).toHaveClass('rotate-90')
    })
  })

  describe('controlled state', () => {
    it('should use controlled open state', () => {
      const setOpen = jest.fn()
      const { container } = render(
        <Expando title="Test Title" open={true} setOpen={setOpen}>
          Content
        </Expando>
      )

      // Should be open
      const collapsible = container.querySelector('.\\!opacity-0')

      expect(collapsible).not.toBeInTheDocument()

      // Click should call setOpen
      const title = screen.getByText('Test Title')

      fireEvent.click(title)
      expect(setOpen).toHaveBeenCalledWith(false)
    })

    it('should call setOpen with opposite value', () => {
      const setOpen = jest.fn()

      render(
        <Expando title="Test Title" open={false} setOpen={setOpen}>
          Content
        </Expando>
      )

      const title = screen.getByText('Test Title')

      fireEvent.click(title)
      expect(setOpen).toHaveBeenCalledWith(true)
    })
  })

  describe('beforeTitle and afterTitle', () => {
    it('should render beforeTitle element', () => {
      render(
        <Expando
          title="Test Title"
          beforeTitle={<span data-testid="before">Before</span>}
        >
          Content
        </Expando>
      )
      expect(screen.getByTestId('before')).toBeInTheDocument()
    })

    it('should render afterTitle element', () => {
      render(
        <Expando
          title="Test Title"
          afterTitle={<span data-testid="after">After</span>}
        >
          Content
        </Expando>
      )
      expect(screen.getByTestId('after')).toBeInTheDocument()
    })

    it('should render both beforeTitle and afterTitle', () => {
      render(
        <Expando
          title="Test Title"
          beforeTitle={<span data-testid="before">Before</span>}
          afterTitle={<span data-testid="after">After</span>}
        >
          Content
        </Expando>
      )
      expect(screen.getByTestId('before')).toBeInTheDocument()
      expect(screen.getByTestId('after')).toBeInTheDocument()
    })
  })

  describe('styling and layout', () => {
    it('should apply default expando class', () => {
      const { container } = render(
        <Expando title="Test Title">Content</Expando>
      )

      expect(container.firstChild).toHaveClass('expando', 'w-full')
    })

    it('should accept custom className', () => {
      const { container } = render(
        <Expando title="Test Title" className="custom-class">
          Content
        </Expando>
      )

      expect(container.firstChild).toHaveClass('custom-class')
    })

    it('should accept custom titleClassName', () => {
      const { container } = render(
        <Expando title="Test Title" titleClassName="custom-title-class">
          Content
        </Expando>
      )
      const titleElement = screen.getByText('Test Title').parentElement

      expect(titleElement).toHaveClass('custom-title-class')
    })

    it('should have cursor-pointer on title', () => {
      const { container } = render(
        <Expando title="Test Title">Content</Expando>
      )
      const titleElement = screen.getByText('Test Title').parentElement

      expect(titleElement).toHaveClass('cursor-pointer')
    })

    it('should have select-none on title container', () => {
      const { container } = render(
        <Expando title="Test Title">Content</Expando>
      )
      const titleContainer = container.querySelector('.expando-title')

      expect(titleContainer).toHaveClass('select-none')
    })
  })

  describe('content structure', () => {
    it('should render expando-inner wrapper', () => {
      const { container } = render(
        <Expando title="Test Title" defaultOpen={true}>
          Content
        </Expando>
      )
      const inner = container.querySelector('.expando-inner')

      expect(inner).toBeInTheDocument()
    })

    it('should render expando-children wrapper', () => {
      const { container } = render(
        <Expando title="Test Title" defaultOpen={true}>
          Content
        </Expando>
      )
      const children = container.querySelector('.expando-children')

      expect(children).toBeInTheDocument()
    })

    it('should apply border styling to inner', () => {
      const { container } = render(
        <Expando title="Test Title" defaultOpen={true}>
          Content
        </Expando>
      )
      const inner = container.querySelector('.expando-inner')

      expect(inner).toHaveClass('border-l-2')
    })
  })

  describe('accessibility', () => {
    it('should be keyboard accessible via click handler', () => {
      const { container } = render(
        <Expando title="Test Title">Content</Expando>
      )
      const title = screen.getByText('Test Title')

      // Simulate click (keyboard Enter would trigger onClick)
      fireEvent.click(title)

      const collapsible = container.querySelector('.\\!opacity-0')

      expect(collapsible).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('should handle empty title', () => {
      render(<Expando title="">Content</Expando>)
      expect(screen.getByText('Content')).toBeInTheDocument()
    })

    it('should handle empty children', () => {
      render(<Expando title="Test Title" />)
      expect(screen.getByText('Test Title')).toBeInTheDocument()
    })

    it('should pass through additional props', () => {
      const { container } = render(
        <Expando title="Test Title" data-testid="custom-prop">
          Content
        </Expando>
      )

      expect(container.firstChild).toHaveAttribute('data-testid', 'custom-prop')
    })
  })

  describe('transition effects', () => {
    it('should have transition classes on collapsible', () => {
      const { container } = render(
        <Expando title="Test Title">Content</Expando>
      )
      const collapsible = container.querySelector('.transition-all')

      expect(collapsible).toHaveClass('duration-300')
    })

    it('should have transition classes on chevron', () => {
      const { container } = render(
        <Expando title="Test Title">Content</Expando>
      )
      const chevron = container.querySelector('svg')

      expect(chevron).toHaveClass('transition-all', 'duration-300')
    })
  })
})
