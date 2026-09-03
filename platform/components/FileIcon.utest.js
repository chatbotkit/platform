import FileIcon from './FileIcon'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

describe('FileIcon', () => {
  describe('basic functionality', () => {
    it('should render an icon component', () => {
      const { container } = render(<FileIcon name="document.md" />)

      expect(container.firstChild).toBeInTheDocument()
    })

    it('should handle different file extensions', () => {
      const extensions = [
        '.md',
        '.txt',
        '.csv',
        '.pdf',
        '.mp3',
        '.wav',
        '.mp4',
        '.webm',
      ]

      extensions.forEach((ext) => {
        const { container } = render(<FileIcon name={`file${ext}`} />)

        expect(container.firstChild).toBeInTheDocument()
      })
    })
  })

  describe('edge cases', () => {
    it('should render SVG icon for unknown file extensions', () => {
      const { container } = render(<FileIcon name="unknown.xyz" />)

      expect(container.firstChild).toBeInstanceOf(SVGSVGElement)
      expect(container.querySelector('text').textContent).toBe('XYZ')
    })

    it('should render SVG icon for files without extension', () => {
      const { container } = render(<FileIcon name="noextension" />)

      expect(container.firstChild).toBeInstanceOf(SVGSVGElement)
      expect(container.querySelector('text').textContent).toBe('?')
    })

    it('should handle file paths with directories', () => {
      const { container } = render(<FileIcon name="/path/to/document.pdf" />)

      expect(container.firstChild).toBeInTheDocument()
      expect(container.querySelector('text').textContent).toBe('PDF')
    })

    it('should handle empty string name', () => {
      const { container } = render(<FileIcon name="" />)

      expect(container.firstChild).toBeInTheDocument()
      expect(container.querySelector('text').textContent).toBe('?')
    })
  })

  describe('props forwarding', () => {
    it('should forward className prop', () => {
      const { container } = render(
        <FileIcon name="document.md" className="custom-class" />
      )

      expect(container.firstChild).toHaveClass('custom-class')
    })

    it('should forward data attributes', () => {
      const { container } = render(
        <FileIcon name="document.txt" data-testid="file-icon" />
      )

      expect(container.firstChild).toHaveAttribute('data-testid', 'file-icon')
    })
  })
})
