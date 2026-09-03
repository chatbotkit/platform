import { sha256 } from '@/lib/webcrypto'

import GravatarIcon from './GravatarIcon'

import '@testing-library/jest-dom'
import { render, waitFor } from '@testing-library/react'

jest.mock('@/lib/webcrypto', () => ({
  sha256: jest.fn(),
}))

describe('GravatarIcon', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    sha256.mockResolvedValue('mockedhash123')
  })

  describe('basic functionality', () => {
    it('should render image when hash is available', async () => {
      const { container } = render(<GravatarIcon email="test@example.com" />)

      await waitFor(() => {
        const img = container.querySelector('img')

        expect(img).toBeInTheDocument()
      })
    })

    it('should generate Gravatar URL with hash', async () => {
      const { container } = render(<GravatarIcon email="test@example.com" />)

      await waitFor(() => {
        const img = container.querySelector('img')

        expect(img).toHaveAttribute(
          'src',
          'https://www.gravatar.com/avatar/mockedhash123?d=mp'
        )
      })
    })

    it('should have alt="gravatar"', async () => {
      const { container } = render(<GravatarIcon email="test@example.com" />)

      await waitFor(() => {
        const img = container.querySelector('img')

        expect(img).toHaveAttribute('alt', 'gravatar')
      })
    })

    it('should not render before hash is computed', () => {
      sha256.mockReturnValue(new Promise(() => {})) // never resolves

      const { container } = render(<GravatarIcon email="test@example.com" />)

      expect(container.querySelector('img')).not.toBeInTheDocument()
    })
  })

  describe('email processing', () => {
    it('should trim email before hashing', async () => {
      render(<GravatarIcon email="  test@example.com  " />)

      await waitFor(() => {
        expect(sha256).toHaveBeenCalledWith('test@example.com')
      })
    })

    it('should lowercase email before hashing', async () => {
      render(<GravatarIcon email="Test@EXAMPLE.COM" />)

      await waitFor(() => {
        expect(sha256).toHaveBeenCalledWith('test@example.com')
      })
    })

    it('should trim and lowercase email', async () => {
      render(<GravatarIcon email="  Test@EXAMPLE.COM  " />)

      await waitFor(() => {
        expect(sha256).toHaveBeenCalledWith('test@example.com')
      })
    })

    it('should handle email with spaces in middle', async () => {
      render(<GravatarIcon email="  test user@example.com  " />)

      await waitFor(() => {
        expect(sha256).toHaveBeenCalledWith('test user@example.com')
      })
    })
  })

  describe('props spreading', () => {
    it('should accept width and height', async () => {
      const { container } = render(
        <GravatarIcon email="test@example.com" width="80" height="80" />
      )

      await waitFor(() => {
        const img = container.querySelector('img')

        expect(img).toHaveAttribute('width', '80')
        expect(img).toHaveAttribute('height', '80')
      })
    })

    it('should accept className', async () => {
      const { container } = render(
        <GravatarIcon email="test@example.com" className="avatar" />
      )

      await waitFor(() => {
        const img = container.querySelector('img')

        expect(img).toHaveClass('avatar')
      })
    })

    it('should accept style prop', async () => {
      const { container } = render(
        <GravatarIcon
          email="test@example.com"
          style={{ borderRadius: '50%' }}
        />
      )

      await waitFor(() => {
        const img = container.querySelector('img')

        expect(img).toHaveStyle({ borderRadius: '50%' })
      })
    })

    it('should accept data attributes', async () => {
      const { container } = render(
        <GravatarIcon email="test@example.com" data-testid="gravatar" />
      )

      await waitFor(() => {
        const img = container.querySelector('img')

        expect(img).toHaveAttribute('data-testid', 'gravatar')
      })
    })

    it('should accept onClick handler', async () => {
      const handleClick = jest.fn()
      const { container } = render(
        <GravatarIcon email="test@example.com" onClick={handleClick} />
      )

      await waitFor(() => {
        const img = container.querySelector('img')

        img.click()
        expect(handleClick).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('email changes', () => {
    it('should update hash when email changes', async () => {
      sha256.mockResolvedValue('hash1')

      const { rerender, container } = render(
        <GravatarIcon email="test1@example.com" />
      )

      await waitFor(() => {
        const img = container.querySelector('img')

        expect(img).toHaveAttribute(
          'src',
          'https://www.gravatar.com/avatar/hash1?d=mp'
        )
      })

      sha256.mockResolvedValue('hash2')

      rerender(<GravatarIcon email="test2@example.com" />)

      await waitFor(() => {
        const img = container.querySelector('img')

        expect(img).toHaveAttribute(
          'src',
          'https://www.gravatar.com/avatar/hash2?d=mp'
        )
      })
    })

    it('should call sha256 again on email change', async () => {
      const { rerender } = render(<GravatarIcon email="test1@example.com" />)

      await waitFor(() => {
        expect(sha256).toHaveBeenCalledWith('test1@example.com')
      })

      rerender(<GravatarIcon email="test2@example.com" />)

      await waitFor(() => {
        expect(sha256).toHaveBeenCalledWith('test2@example.com')
        expect(sha256).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('edge cases', () => {
    it('should handle empty email', async () => {
      render(<GravatarIcon email="" />)

      await waitFor(() => {
        expect(sha256).toHaveBeenCalledWith('')
      })
    })

    it('should handle empty hash result', async () => {
      sha256.mockResolvedValue('')

      const { container } = render(<GravatarIcon email="test@example.com" />)

      await waitFor(() => {
        expect(container.querySelector('img')).not.toBeInTheDocument()
      })
    })

    // @todo fix bug in GravatarIcon - sha256 rejection causes unhandled promise rejection
    it('should handle sha256 rejection', async () => {
      sha256.mockRejectedValue(new Error('Hash failed'))

      const { container } = render(<GravatarIcon email="test@example.com" />)

      await waitFor(() => {
        expect(container.querySelector('img')).not.toBeInTheDocument()
      })
    })

    it('should not throw when email is undefined', () => {
      expect(() => {
        render(<GravatarIcon email={undefined} />)
      }).not.toThrow()
      expect(sha256).not.toHaveBeenCalled()
    })

    it('should use default Gravatar image (d=mp)', async () => {
      const { container } = render(<GravatarIcon email="test@example.com" />)

      await waitFor(() => {
        const img = container.querySelector('img')

        expect(img.src).toContain('?d=mp')
      })
    })
  })
})
