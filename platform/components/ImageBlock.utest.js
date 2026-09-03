/* eslint-disable @typescript-eslint/no-require-imports */
import ImageBlock from './ImageBlock'

import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

// Mock the save utility
jest.mock('@/lib/save', () => ({
  saveUrl: jest.fn(),
}))

describe('ImageBlock', () => {
  const mockSrc = 'https://example.com/image.jpg'
  const mockAlt = 'Test image'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should render with default props', () => {
      render(<ImageBlock src={mockSrc} alt={mockAlt} />)

      const img = screen.getByRole('img')

      expect(img).toBeInTheDocument()
      expect(img).toHaveAttribute('src', mockSrc)
      expect(img).toHaveAttribute('alt', mockAlt)
    })

    it('should apply custom className', () => {
      const { container } = render(
        <ImageBlock src={mockSrc} alt={mockAlt} className="custom-class" />
      )
      const span = container.querySelector('span')

      expect(span).toHaveClass('custom-class')
    })

    it('should pass through additional props to wrapper span', () => {
      const { container } = render(
        <ImageBlock src={mockSrc} alt={mockAlt} data-testid="image-wrapper" />
      )
      const span = container.querySelector('span[data-testid="image-wrapper"]')

      expect(span).toBeInTheDocument()
    })
  })

  describe('loading state', () => {
    it('should start with blur effect before image loads', () => {
      const { container } = render(<ImageBlock src={mockSrc} alt={mockAlt} />)
      const span = container.querySelector('span')

      expect(span).toHaveClass('opacity-0')
      expect(span).toHaveClass('blur-sm')
    })

    it('should remove blur effect after image loads', async () => {
      const { container } = render(<ImageBlock src={mockSrc} alt={mockAlt} />)
      const img = screen.getByRole('img')

      fireEvent.load(img)

      await waitFor(() => {
        const span = container.querySelector('span')

        expect(span).toHaveClass('opacity-100')
        expect(span).toHaveClass('blur-none')
      })
    })

    it('should have transition classes for smooth loading', () => {
      const { container } = render(<ImageBlock src={mockSrc} alt={mockAlt} />)
      const span = container.querySelector('span')

      expect(span).toHaveClass('transition-all')
      expect(span).toHaveClass('duration-300')
    })
  })

  describe('download functionality', () => {
    it('should render download button', () => {
      const { container } = render(<ImageBlock src={mockSrc} alt={mockAlt} />)
      const downloadIcon = container.querySelector('svg')

      expect(downloadIcon).toBeInTheDocument()
    })

    it('should call saveUrl with correct arguments when download is clicked', async () => {
      const { saveUrl } = require('@/lib/save')
      const { container } = render(<ImageBlock src={mockSrc} alt={mockAlt} />)

      const downloadIcon = container.querySelector('svg')

      fireEvent.click(downloadIcon)

      expect(saveUrl).toHaveBeenCalledWith(mockSrc, { name: mockAlt })
      expect(saveUrl).toHaveBeenCalledTimes(1)
    })

    it('should have hover styles on download button', () => {
      const { container } = render(<ImageBlock src={mockSrc} alt={mockAlt} />)
      const downloadIcon = container.querySelector('svg')

      expect(downloadIcon).toHaveClass('cursor-pointer')
      expect(downloadIcon).toHaveClass('hover:text-gray-100')
    })
  })

  describe('edge cases', () => {
    it('should handle missing alt text', () => {
      render(<ImageBlock src={mockSrc} alt="" />)

      const img = screen.getByRole('img')

      expect(img).toHaveAttribute('alt', '')
    })

    it('should handle data URLs as src', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgo='

      render(<ImageBlock src={dataUrl} alt={mockAlt} />)

      const img = screen.getByRole('img')

      expect(img).toHaveAttribute('src', dataUrl)
    })

    it('should handle very long alt text', () => {
      const longAlt = 'A'.repeat(500)

      render(<ImageBlock src={mockSrc} alt={longAlt} />)

      const img = screen.getByRole('img')

      expect(img).toHaveAttribute('alt', longAlt)
    })
  })

  describe('accessibility', () => {
    it('should use span instead of div for inline context', () => {
      const { container } = render(<ImageBlock src={mockSrc} alt={mockAlt} />)
      const wrapper = container.firstChild

      expect(wrapper.tagName).toBe('SPAN')
    })

    it('should have descriptive alt text', () => {
      render(<ImageBlock src={mockSrc} alt="Descriptive image text" />)
      expect(screen.getByAltText('Descriptive image text')).toBeInTheDocument()
    })

    it('should position download button absolutely', () => {
      const { container } = render(<ImageBlock src={mockSrc} alt={mockAlt} />)
      const buttonContainer = container.querySelector('span.absolute')

      expect(buttonContainer).toBeInTheDocument()
      expect(buttonContainer).toHaveClass('top-2')
      expect(buttonContainer).toHaveClass('right-2')
    })
  })
})
