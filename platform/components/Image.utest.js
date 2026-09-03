import Image from './Image'

import '@testing-library/jest-dom'
import { fireEvent, render } from '@testing-library/react'

jest.mock('next/image', () => {
  return function NextImage({ src, onError, alt, ...props }) {
    return (
      <img
        {...props}
        src={src}
        alt={alt}
        onError={(e) => {
          if (onError) {
            onError(e)
          }
        }}
      />
    )
  }
})

const DEFAULT_ERROR_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADTED8xAAAAJElEQVR4nO3BMQEAAADCoPVPbQ8HFAAAAAAAAAAAAAAAAAAAAAAAAMDhAAGGGwNTAAAAAElFTkSuQmCC'

describe('Image', () => {
  describe('basic rendering', () => {
    it('should render image with src', () => {
      const { container } = render(
        <Image src="https://example.com/image.png" alt="Test" />
      )

      const img = container.querySelector('img')

      expect(img).toBeInTheDocument()
      expect(img).toHaveAttribute('src', 'https://example.com/image.png')
      expect(img).toHaveAttribute('alt', 'Test')
    })

    it('should pass through additional props', () => {
      const { container } = render(
        <Image
          src="https://example.com/image.png"
          alt="Test"
          width={100}
          height={100}
          className="custom-class"
        />
      )

      const img = container.querySelector('img')

      expect(img).toHaveAttribute('width', '100')
      expect(img).toHaveAttribute('height', '100')
      expect(img).toHaveClass('custom-class')
    })
  })

  describe('error handling', () => {
    it('should switch to error data URL on image error', () => {
      const { container } = render(
        <Image src="https://example.com/broken.png" alt="Test" />
      )

      const img = container.querySelector('img')

      expect(img).toHaveAttribute('src', 'https://example.com/broken.png')

      fireEvent.error(img)

      expect(img).toHaveAttribute('src', DEFAULT_ERROR_DATA_URL)
    })

    it('should use custom errorDataURL', () => {
      const customErrorURL = 'data:image/png;base64,custom'
      const { container } = render(
        <Image
          src="https://example.com/broken.png"
          alt="Test"
          errorDataURL={customErrorURL}
        />
      )

      const img = container.querySelector('img')

      fireEvent.error(img)

      expect(img).toHaveAttribute('src', customErrorURL)
    })

    it('should not add onError when errorDataURL is null', () => {
      const { container } = render(
        <Image
          src="https://example.com/broken.png"
          alt="Test"
          errorDataURL={null}
        />
      )

      const img = container.querySelector('img')

      expect(() => {
        fireEvent.error(img)
      }).not.toThrow()
    })

    it('should not add onError when errorDataURL is undefined', () => {
      const { container } = render(
        <Image
          src="https://example.com/broken.png"
          alt="Test"
          errorDataURL={undefined}
        />
      )

      const img = container.querySelector('img')

      expect(() => {
        fireEvent.error(img)
      }).not.toThrow()
    })

    it('should not add onError when errorDataURL is empty string', () => {
      const { container } = render(
        <Image
          src="https://example.com/broken.png"
          alt="Test"
          errorDataURL=""
        />
      )

      const img = container.querySelector('img')

      expect(() => {
        fireEvent.error(img)
      }).not.toThrow()
    })
  })

  describe('src updates', () => {
    it('should not update src when prop changes', () => {
      const { container, rerender } = render(
        <Image src="https://example.com/image1.png" alt="Test" />
      )

      const img = container.querySelector('img')

      expect(img).toHaveAttribute('src', 'https://example.com/image1.png')

      rerender(<Image src="https://example.com/image2.png" alt="Test" />)

      // @note component uses useState with initial value only, doesn't update on prop change
      expect(img).toHaveAttribute('src', 'https://example.com/image1.png')
    })

    it('should keep error data URL even after rerender', () => {
      const { container, rerender } = render(
        <Image src="https://example.com/broken.png" alt="Test" />
      )

      const img = container.querySelector('img')

      fireEvent.error(img)

      expect(img).toHaveAttribute('src', DEFAULT_ERROR_DATA_URL)

      rerender(<Image src="https://example.com/broken.png" alt="Test" />)

      expect(img).toHaveAttribute('src', DEFAULT_ERROR_DATA_URL)
    })
  })

  describe('edge cases', () => {
    it('should handle multiple error events', () => {
      const { container } = render(
        <Image src="https://example.com/broken.png" alt="Test" />
      )

      const img = container.querySelector('img')

      fireEvent.error(img)
      expect(img).toHaveAttribute('src', DEFAULT_ERROR_DATA_URL)

      fireEvent.error(img)
      expect(img).toHaveAttribute('src', DEFAULT_ERROR_DATA_URL)
    })

    it('should handle empty src', () => {
      const { container } = render(<Image src="" alt="Test" />)

      const img = container.querySelector('img')

      expect(img).not.toHaveAttribute('src')
    })

    it('should handle data URL as src', () => {
      const dataURL = 'data:image/png;base64,abc123'
      const { container } = render(<Image src={dataURL} alt="Test" />)

      const img = container.querySelector('img')

      expect(img).toHaveAttribute('src', dataURL)
    })
  })

  describe('stability', () => {
    it('should maintain onError handler with same errorDataURL', () => {
      const { container, rerender } = render(
        <Image
          src="https://example.com/image.png"
          alt="Test"
          errorDataURL={DEFAULT_ERROR_DATA_URL}
        />
      )

      rerender(
        <Image
          src="https://example.com/image.png"
          alt="Test"
          errorDataURL={DEFAULT_ERROR_DATA_URL}
        />
      )

      const img = container.querySelector('img')

      fireEvent.error(img)

      expect(img).toHaveAttribute('src', DEFAULT_ERROR_DATA_URL)
    })

    it('should update onError handler when errorDataURL changes', () => {
      const customError = 'data:image/png;base64,custom'
      const { container, rerender } = render(
        <Image
          src="https://example.com/image.png"
          alt="Test"
          errorDataURL={DEFAULT_ERROR_DATA_URL}
        />
      )

      rerender(
        <Image
          src="https://example.com/image.png"
          alt="Test"
          errorDataURL={customError}
        />
      )

      const img = container.querySelector('img')

      fireEvent.error(img)

      expect(img).toHaveAttribute('src', customError)
    })
  })
})
