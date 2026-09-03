import CategoryGrid, { CategoryContent, CategoryItem } from './CategoryGrid'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

describe('CategoryGrid', () => {
  describe('CategoryContent', () => {
    it('should render children', () => {
      render(
        <CategoryContent>
          <div>Test Content</div>
        </CategoryContent>
      )

      expect(screen.getByText('Test Content')).toBeInTheDocument()
    })

    it('should apply default classes', () => {
      const { container } = render(
        <CategoryContent>
          <div>Content</div>
        </CategoryContent>
      )

      const element = container.firstChild

      expect(element).toHaveClass('category-content')
      expect(element).toHaveClass('grid')
      expect(element).toHaveClass('col-span-2')
      expect(element).toHaveClass('sm:grid-cols-3')
      expect(element).toHaveClass('gap-4')
      expect(element).toHaveClass('text-base')
    })

    it('should merge custom className', () => {
      const { container } = render(
        <CategoryContent className="custom-class">
          <div>Content</div>
        </CategoryContent>
      )

      const element = container.firstChild

      expect(element).toHaveClass('category-content')
      expect(element).toHaveClass('custom-class')
    })

    it('should pass through additional props', () => {
      render(
        <CategoryContent data-testid="test-content" aria-label="test">
          <div>Content</div>
        </CategoryContent>
      )

      const element = screen.getByTestId('test-content')

      expect(element).toHaveAttribute('aria-label', 'test')
    })
  })

  describe('CategoryItem', () => {
    it('should render children', () => {
      render(
        <CategoryItem>
          <div>Test Item</div>
        </CategoryItem>
      )

      expect(screen.getByText('Test Item')).toBeInTheDocument()
    })

    it('should render title when provided', () => {
      render(
        <CategoryItem title="Category Title">
          <div>Content</div>
        </CategoryItem>
      )

      expect(screen.getByText('Category Title')).toBeInTheDocument()
    })

    it('should not render title when not provided', () => {
      const { container } = render(
        <CategoryItem>
          <div>Content</div>
        </CategoryItem>
      )

      const titleElement = container.querySelector('.category-item-title')

      expect(titleElement).not.toBeInTheDocument()
    })

    it('should apply default classes', () => {
      const { container } = render(
        <CategoryItem>
          <div>Content</div>
        </CategoryItem>
      )

      const element = container.firstChild

      expect(element).toHaveClass('category-item')
      expect(element).toHaveClass('grid')
      expect(element).toHaveClass('gap-6')
      expect(element).toHaveClass('pt-6')
      expect(element).toHaveClass('pb-12')
    })

    it('should apply sm:grid-cols-3 when title is provided', () => {
      const { container } = render(
        <CategoryItem title="Title">
          <div>Content</div>
        </CategoryItem>
      )

      const element = container.firstChild

      expect(element).toHaveClass('sm:grid-cols-3')
      expect(element).not.toHaveClass('sm:grid-cols-2')
    })

    it('should apply sm:grid-cols-2 when title is not provided', () => {
      const { container } = render(
        <CategoryItem>
          <div>Content</div>
        </CategoryItem>
      )

      const element = container.firstChild

      expect(element).toHaveClass('sm:grid-cols-2')
      expect(element).not.toHaveClass('sm:grid-cols-3')
    })

    it('should render title with correct styling', () => {
      const { container } = render(
        <CategoryItem title="Test Title">
          <div>Content</div>
        </CategoryItem>
      )

      const titleElement = container.querySelector('.category-item-title')

      expect(titleElement).toHaveClass('col-span-1')
      expect(titleElement).toHaveClass('text-xl')
      expect(titleElement).toHaveClass('font-bold')
      expect(titleElement).toHaveClass('text-gray-900')
      expect(titleElement).toHaveClass('dark:text-gray-100')
    })

    it('should render CategoryContent for children', () => {
      const { container } = render(
        <CategoryItem>
          <div>Content</div>
        </CategoryItem>
      )

      const contentElement = container.querySelector('.category-item-content')

      expect(contentElement).toBeInTheDocument()
      expect(contentElement).toHaveClass('category-content')
    })

    it('should merge custom className', () => {
      const { container } = render(
        <CategoryItem className="custom-item">
          <div>Content</div>
        </CategoryItem>
      )

      const element = container.firstChild

      expect(element).toHaveClass('category-item')
      expect(element).toHaveClass('custom-item')
    })

    it('should pass through additional props', () => {
      render(
        <CategoryItem data-testid="test-item">
          <div>Content</div>
        </CategoryItem>
      )

      expect(screen.getByTestId('test-item')).toBeInTheDocument()
    })
  })

  describe('CategoryGrid', () => {
    it('should render children', () => {
      render(
        <CategoryGrid>
          <div>Grid Content</div>
        </CategoryGrid>
      )

      expect(screen.getByText('Grid Content')).toBeInTheDocument()
    })

    it('should apply default classes', () => {
      const { container } = render(
        <CategoryGrid>
          <div>Content</div>
        </CategoryGrid>
      )

      const element = container.firstChild

      expect(element).toHaveClass('category-grid')
      expect(element).toHaveClass('flex')
      expect(element).toHaveClass('flex-col')
      expect(element).toHaveClass('gap-4')
    })

    it('should apply border styles for subsequent items', () => {
      const { container } = render(
        <CategoryGrid>
          <div>Content</div>
        </CategoryGrid>
      )

      const element = container.firstChild

      expect(element.className).toContain('border-t')
      expect(element.className).toContain('border-gray-100')
      expect(element.className).toContain('dark')
      expect(element.className).toContain('border-gray-900')
    })

    it('should merge custom className', () => {
      const { container } = render(
        <CategoryGrid className="custom-grid">
          <div>Content</div>
        </CategoryGrid>
      )

      const element = container.firstChild

      expect(element).toHaveClass('category-grid')
      expect(element).toHaveClass('custom-grid')
    })

    it('should pass through additional props', () => {
      render(
        <CategoryGrid data-testid="test-grid">
          <div>Content</div>
        </CategoryGrid>
      )

      expect(screen.getByTestId('test-grid')).toBeInTheDocument()
    })

    it('should render multiple children', () => {
      render(
        <CategoryGrid>
          <div>First</div>
          <div>Second</div>
          <div>Third</div>
        </CategoryGrid>
      )

      expect(screen.getByText('First')).toBeInTheDocument()
      expect(screen.getByText('Second')).toBeInTheDocument()
      expect(screen.getByText('Third')).toBeInTheDocument()
    })
  })

  describe('compound component pattern', () => {
    it('should have Item property', () => {
      expect(CategoryGrid.Item).toBe(CategoryItem)
    })

    it('should have Content property', () => {
      expect(CategoryGrid.Content).toBe(CategoryContent)
    })

    it('should work with compound component syntax', () => {
      render(
        <CategoryGrid>
          <CategoryGrid.Item title="Section 1">
            <div>Content 1</div>
          </CategoryGrid.Item>
          <CategoryGrid.Item title="Section 2">
            <div>Content 2</div>
          </CategoryGrid.Item>
        </CategoryGrid>
      )

      expect(screen.getByText('Section 1')).toBeInTheDocument()
      expect(screen.getByText('Section 2')).toBeInTheDocument()
      expect(screen.getByText('Content 1')).toBeInTheDocument()
      expect(screen.getByText('Content 2')).toBeInTheDocument()
    })
  })

  describe('integration scenarios', () => {
    it('should render complete grid structure', () => {
      const { container } = render(
        <CategoryGrid>
          <CategoryItem title="Features">
            <div>Feature 1</div>
            <div>Feature 2</div>
            <div>Feature 3</div>
          </CategoryItem>
          <CategoryItem title="Benefits">
            <div>Benefit 1</div>
            <div>Benefit 2</div>
          </CategoryItem>
        </CategoryGrid>
      )

      expect(screen.getByText('Features')).toBeInTheDocument()
      expect(screen.getByText('Benefits')).toBeInTheDocument()
      expect(screen.getByText('Feature 1')).toBeInTheDocument()
      expect(screen.getByText('Benefit 2')).toBeInTheDocument()

      const grid = container.querySelector('.category-grid')
      const items = container.querySelectorAll('.category-item')

      expect(grid).toBeInTheDocument()
      expect(items).toHaveLength(2)
    })

    it('should handle items without titles', () => {
      render(
        <CategoryGrid>
          <CategoryItem>
            <div>No title item</div>
          </CategoryItem>
        </CategoryGrid>
      )

      expect(screen.getByText('No title item')).toBeInTheDocument()
      expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    })

    it('should handle empty CategoryItem', () => {
      const { container } = render(
        <CategoryGrid>
          <CategoryItem title="Empty" />
        </CategoryGrid>
      )

      expect(screen.getByText('Empty')).toBeInTheDocument()

      const content = container.querySelector('.category-item-content')

      expect(content).toBeInTheDocument()
      expect(content.children).toHaveLength(0)
    })
  })

  describe('edge cases', () => {
    it('should handle empty string title', () => {
      const { container } = render(
        <CategoryItem title="">
          <div>Content</div>
        </CategoryItem>
      )

      const element = container.firstChild

      expect(element).toHaveClass('sm:grid-cols-2')
    })

    it('should handle null children', () => {
      render(
        <CategoryGrid>
          {null}
          <div>Visible</div>
        </CategoryGrid>
      )

      expect(screen.getByText('Visible')).toBeInTheDocument()
    })

    it('should handle undefined children', () => {
      render(
        <CategoryGrid>
          {undefined}
          <div>Visible</div>
        </CategoryGrid>
      )

      expect(screen.getByText('Visible')).toBeInTheDocument()
    })
  })
})
