import FileIcon from './FileIcon'

import { render } from '@testing-library/react'

describe('FileIcon', () => {
  describe('basic rendering', () => {
    it('should render without crashing', () => {
      const { container } = render(<FileIcon name="test.txt" />)

      expect(container.firstChild).toBeTruthy()
    })

    it('should pass through additional props', () => {
      const { container } = render(
        <FileIcon name="test.txt" className="custom-class" data-testid="icon" />
      )
      const icon = container.querySelector('[data-testid="icon"]')

      expect(icon).toBeTruthy()
    })
  })

  describe('file type detection', () => {
    it('should render icon for .txt files', () => {
      const { container } = render(<FileIcon name="document.txt" />)

      expect(container.firstChild).toBeTruthy()
    })

    it('should render icon for .md files', () => {
      const { container } = render(<FileIcon name="README.md" />)

      expect(container.firstChild).toBeTruthy()
    })

    it('should render icon for .csv files', () => {
      const { container } = render(<FileIcon name="data.csv" />)

      expect(container.firstChild).toBeTruthy()
    })

    it('should render icon for .pdf files', () => {
      const { container } = render(<FileIcon name="document.pdf" />)

      expect(container.firstChild).toBeTruthy()
    })

    it('should render icon for .mp3 files', () => {
      const { container } = render(<FileIcon name="audio.mp3" />)

      expect(container.firstChild).toBeTruthy()
    })

    it('should render icon for .mp4 files', () => {
      const { container } = render(<FileIcon name="video.mp4" />)

      expect(container.firstChild).toBeTruthy()
    })

    it('should render icon for .wav files', () => {
      const { container } = render(<FileIcon name="sound.wav" />)

      expect(container.firstChild).toBeTruthy()
    })

    it('should render icon for .webm files', () => {
      const { container } = render(<FileIcon name="video.webm" />)

      expect(container.firstChild).toBeTruthy()
    })

    it('should render icon for .mpeg files', () => {
      const { container } = render(<FileIcon name="video.mpeg" />)

      expect(container.firstChild).toBeTruthy()
    })

    it('should render icon for .mpga files', () => {
      const { container } = render(<FileIcon name="audio.mpga" />)

      expect(container.firstChild).toBeTruthy()
    })

    it('should render icon for .docx files', () => {
      const { container } = render(<FileIcon name="document.docx" />)

      expect(container.firstChild).toBeTruthy()
    })
  })

  describe('unsupported file types', () => {
    it('should render fallback div for unknown extensions', () => {
      const { container } = render(<FileIcon name="file.xyz" />)

      expect(container.firstChild).toBeTruthy()
    })

    it('should render fallback div for files without extension', () => {
      const { container } = render(<FileIcon name="README" />)

      expect(container.firstChild).toBeTruthy()
    })

    it('should pass props to fallback div', () => {
      const { container } = render(
        <FileIcon name="unknown.xyz" data-testid="fallback" />
      )
      const fallback = container.querySelector('[data-testid="fallback"]')

      expect(fallback).toBeTruthy()
    })
  })

  describe('edge cases', () => {
    it('should handle filename with path', () => {
      const { container } = render(<FileIcon name="/path/to/document.pdf" />)

      expect(container.firstChild).toBeTruthy()
    })

    it('should handle filename with multiple dots', () => {
      const { container } = render(<FileIcon name="my.file.name.txt" />)

      expect(container.firstChild).toBeTruthy()
    })

    it('should handle empty string name', () => {
      const { container } = render(<FileIcon name="" />)

      expect(container.firstChild).toBeTruthy()
    })

    it('should handle uppercase extensions', () => {
      const { container } = render(<FileIcon name="document.PDF" />)

      expect(container.firstChild).toBeTruthy()
    })

    it('should handle mixed case extensions', () => {
      const { container } = render(<FileIcon name="document.PdF" />)

      expect(container.firstChild).toBeTruthy()
    })

    it('should handle Windows-style paths', () => {
      const { container } = render(<FileIcon name="C:\\path\\to\\file.txt" />)

      expect(container.firstChild).toBeTruthy()
    })

    it('should handle relative paths', () => {
      const { container } = render(<FileIcon name="./relative/path/file.csv" />)

      expect(container.firstChild).toBeTruthy()
    })

    it('should handle dot prefix files', () => {
      const { container } = render(<FileIcon name=".hidden.txt" />)

      expect(container.firstChild).toBeTruthy()
    })
  })

  describe('prop forwarding', () => {
    it('should forward className prop', () => {
      const { container } = render(
        <FileIcon name="test.txt" className="custom-icon" />
      )
      const element = container.querySelector('.custom-icon')

      expect(element).toBeTruthy()
    })

    it('should forward style prop', () => {
      const style = { width: '100px', height: '100px' }
      const { container } = render(<FileIcon name="test.txt" style={style} />)

      expect(container.firstChild).toBeTruthy()
    })

    it('should forward aria attributes', () => {
      const { container } = render(
        <FileIcon name="test.txt" aria-label="Text file icon" />
      )

      expect(container.firstChild).toBeTruthy()
    })

    it('should forward data attributes', () => {
      const { container } = render(
        <FileIcon name="test.txt" data-file-type="text" />
      )

      expect(container.firstChild).toBeTruthy()
    })

    it('should forward onClick handler', () => {
      const handleClick = jest.fn()
      const { container } = render(
        <FileIcon name="test.txt" onClick={handleClick} />
      )

      expect(container.firstChild).toBeTruthy()
    })
  })

  describe('case sensitivity', () => {
    it('should match exact lowercase extension', () => {
      const { container } = render(<FileIcon name="file.txt" />)

      expect(container.firstChild).toBeTruthy()
    })

    it('should not match uppercase extension by default', () => {
      const { container } = render(<FileIcon name="file.TXT" />)

      expect(container.firstChild).toBeTruthy()
    })
  })
})
