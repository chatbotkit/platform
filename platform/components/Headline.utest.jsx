import Headline from './Headline'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

describe('Headline', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should render with title', () => {
      render(<Headline title="Test Title">Description</Headline>)

      expect(screen.getByText('Test Title')).toBeInTheDocument()
      expect(screen.getByText('Description')).toBeInTheDocument()
    })

    it('should render title as h2', () => {
      render(<Headline title="Heading">Content</Headline>)

      const heading = screen.getByText('Heading')

      expect(heading.tagName).toBe('H2')
    })

    it('should render description in paragraph', () => {
      render(<Headline title="Title">Description text</Headline>)

      const paragraph = screen.getByText('Description text')

      expect(paragraph.tagName).toBe('P')
    })
  })

  describe('id generation', () => {
    it('should generate id from title', () => {
      const { container } = render(
        <Headline title="Test Title">Content</Headline>
      )

      const div = container.firstChild

      expect(div).toHaveAttribute('id', 'test-title')
    })

    it('should handle titles with special characters', () => {
      const { container } = render(
        <Headline title="Test: Title & More!">Content</Headline>
      )

      const div = container.firstChild

      expect(div).toHaveAttribute('id', 'test-title-more-')
    })

    it('should handle titles with multiple spaces', () => {
      const { container } = render(
        <Headline title="Test   Multiple   Spaces">Content</Headline>
      )

      const div = container.firstChild

      expect(div).toHaveAttribute('id', 'test-multiple-spaces')
    })

    it('should handle uppercase titles', () => {
      const { container } = render(
        <Headline title="UPPERCASE TITLE">Content</Headline>
      )

      const div = container.firstChild

      expect(div).toHaveAttribute('id', 'uppercase-title')
    })

    it('should handle empty title', () => {
      const { container } = render(<Headline title="">Content</Headline>)

      const div = container.firstChild

      expect(div).toHaveAttribute('id', '')
    })

    it('should handle undefined title', () => {
      const { container } = render(<Headline>Content</Headline>)

      const div = container.firstChild

      expect(div).not.toHaveAttribute('id')
    })
  })

  describe('beta badge', () => {
    it('should render beta badge when beta is true', () => {
      render(
        <Headline title="Title" beta>
          Content
        </Headline>
      )

      expect(screen.getByText('BETA')).toBeInTheDocument()
    })

    it('should render custom beta text', () => {
      render(
        <Headline title="Title" beta="ALPHA">
          Content
        </Headline>
      )

      expect(screen.getByText('ALPHA')).toBeInTheDocument()
    })

    it('should not render beta badge when beta is false', () => {
      render(
        <Headline title="Title" beta={false}>
          Content
        </Headline>
      )

      expect(screen.queryByText('BETA')).not.toBeInTheDocument()
    })

    it('should not render beta badge when beta is undefined', () => {
      render(<Headline title="Title">Content</Headline>)

      expect(screen.queryByText('BETA')).not.toBeInTheDocument()
    })

    it('should render beta badge in sup element', () => {
      render(
        <Headline title="Title" beta>
          Content
        </Headline>
      )

      const sup = screen.getByText('BETA')

      expect(sup.tagName).toBe('SUP')
    })

    it('should apply beta class to sup element', () => {
      render(
        <Headline title="Title" beta>
          Content
        </Headline>
      )

      const sup = screen.getByText('BETA')

      expect(sup).toHaveClass('beta')
    })
  })

  describe('props forwarding', () => {
    it('should forward className', () => {
      const { container } = render(
        <Headline title="Title" className="custom-class">
          Content
        </Headline>
      )

      const div = container.firstChild

      expect(div).toHaveClass('custom-class')
    })

    it('should forward data attributes', () => {
      const { container } = render(
        <Headline title="Title" data-testid="headline" data-custom="value">
          Content
        </Headline>
      )

      const div = container.firstChild

      expect(div).toHaveAttribute('data-testid', 'headline')
      expect(div).toHaveAttribute('data-custom', 'value')
    })

    it('should forward style prop', () => {
      const { container } = render(
        <Headline title="Title" style={{ marginTop: '20px' }}>
          Content
        </Headline>
      )

      const div = container.firstChild

      expect(div).toHaveStyle({ marginTop: '20px' })
    })
  })

  describe('edge cases', () => {
    it('should handle empty children', () => {
      render(<Headline title="Title" />)

      expect(screen.getByText('Title')).toBeInTheDocument()
    })

    it('should handle null children', () => {
      render(<Headline title="Title">{null}</Headline>)

      expect(screen.getByText('Title')).toBeInTheDocument()
    })

    it('should handle multiple children', () => {
      render(
        <Headline title="Title">
          <span>Part 1</span>
          <span>Part 2</span>
        </Headline>
      )

      expect(screen.getByText('Part 1')).toBeInTheDocument()
      expect(screen.getByText('Part 2')).toBeInTheDocument()
    })

    it('should handle numeric children', () => {
      render(<Headline title="Title">{42}</Headline>)

      expect(screen.getByText('42')).toBeInTheDocument()
    })

    it('should handle title without toLowerCase method', () => {
      const { container } = render(<Headline title={123}>Content</Headline>)

      const div = container.firstChild

      // @note when toLowerCase is not available, optional chaining prevents error
      expect(div).toBeInTheDocument()
    })
  })

  describe('styling classes', () => {
    it('should apply correct heading classes', () => {
      render(<Headline title="Title">Content</Headline>)

      const heading = screen.getByText('Title')

      expect(heading).toHaveClass('text-lg')
      expect(heading).toHaveClass('font-medium')
      expect(heading).toHaveClass('leading-6')
      expect(heading).toHaveClass('text-gray-900')
      expect(heading).toHaveClass('dark:text-gray-100')
    })

    it('should apply correct paragraph classes', () => {
      render(<Headline title="Title">Description</Headline>)

      const paragraph = screen.getByText('Description')

      expect(paragraph).toHaveClass('mt-1')
      expect(paragraph).toHaveClass('text-sm')
      expect(paragraph).toHaveClass('text-gray-500')
      expect(paragraph).toHaveClass('dark:text-gray-500')
    })
  })
})
