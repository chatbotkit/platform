/* eslint-disable @typescript-eslint/no-require-imports */
import TokenAutoTextarea from './TokenAutoTextarea'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@/hooks/useDebounce', () => ({
  __esModule: true,
  default: jest.fn((value) => value),
}))

jest.mock('@/hooks/useTokenCount', () => ({
  __esModule: true,
  default: jest.fn(() => 0),
}))

jest.mock('@/components/AdvancedAutoTextarea', () => {
  const React = jest.requireActual('react')

  return {
    __esModule: true,
    default: React.forwardRef(function MockAdvancedAutoTextarea(
      { children, wrapperClassName, autoTextareaAs, ...props },
      ref
    ) {
      return (
        <div
          className={wrapperClassName}
          data-auto-textarea-as={!!autoTextareaAs}
        >
          <textarea ref={ref} data-testid="token-textarea" {...props} />
          <div data-testid="extra">{children}</div>
        </div>
      )
    }),
  }
})

describe('TokenAutoTextarea', () => {
  const useTokenCount = require('@/hooks/useTokenCount').default
  const useDebounce = require('@/hooks/useDebounce').default

  beforeEach(() => {
    jest.clearAllMocks()
    useDebounce.mockImplementation((value) => value)
    useTokenCount.mockReturnValue(0)
  })

  it('renders token counter when hideZero is false', () => {
    render(<TokenAutoTextarea hideZero={false} />)

    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('Number of tokens used')).toBeInTheDocument()
  })

  it('hides token counter when hideZero is true and length is zero', () => {
    render(<TokenAutoTextarea hideZero />)

    expect(screen.queryByText('Number of tokens used')).not.toBeInTheDocument()
  })

  it('shows token counter when token length is positive even with hideZero', () => {
    useTokenCount.mockReturnValue(42)

    render(<TokenAutoTextarea hideZero />)

    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('invokes onLengthChange when length updates', () => {
    const onLengthChange = jest.fn()
    const { rerender } = render(
      <TokenAutoTextarea onLengthChange={onLengthChange} />
    )

    expect(onLengthChange).toHaveBeenCalledWith(0)

    useTokenCount.mockReturnValue(7)
    rerender(
      <TokenAutoTextarea onLengthChange={onLengthChange} value="hello" />
    )

    expect(onLengthChange).toHaveBeenLastCalledWith(7)
  })

  it('applies warning and error token classes based on maxTokens', () => {
    const { rerender } = render(<TokenAutoTextarea maxTokens={10} />)

    useTokenCount.mockReturnValue(8)
    rerender(<TokenAutoTextarea maxTokens={10} value="warn" />)
    expect(screen.getByText('8').closest('span')).toHaveClass('bg-orange-200')

    useTokenCount.mockReturnValue(11)
    rerender(<TokenAutoTextarea maxTokens={10} value="error" />)
    expect(screen.getByText('11').closest('span')).toHaveClass('bg-red-200')
  })

  it('passes children to extra area when present', () => {
    render(
      <TokenAutoTextarea hideZero>
        <button type="button">Action</button>
      </TokenAutoTextarea>
    )

    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
  })
})
