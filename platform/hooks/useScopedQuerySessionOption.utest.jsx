import { renderHook } from '@testing-library/react'

import useScopedQuerySessionOption from './useScopedQuerySessionOption'

const mockUseQuerySessionOption = jest.fn()

jest.mock('@/hooks/useQuerySessionOption', () => ({
  __esModule: true,
  default: (...args) => mockUseQuerySessionOption(...args),
}))

describe('useScopedQuerySessionOption', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseQuerySessionOption.mockReturnValue('dashboard')
    window.name = ''
  })

  it('should use the existing window name as scope', () => {
    window.name = 'cbk-frame:existing'

    renderHook(() => useScopedQuerySessionOption('_embed'))

    expect(mockUseQuerySessionOption).toHaveBeenCalledWith('_embed', {
      storageKey: 'session-options:cbk-frame:existing:_embed',
    })
  })

  it('should create and assign a random window name when missing', () => {
    const randomUUID = jest.fn(() => 'scope-123')

    Object.defineProperty(window, 'crypto', {
      configurable: true,
      value: { randomUUID },
    })

    renderHook(() => useScopedQuerySessionOption('_embed'))

    expect(window.name).toBe('cbk-frame:scope-123')
    expect(mockUseQuerySessionOption).toHaveBeenCalledWith('_embed', {
      storageKey: 'session-options:cbk-frame:scope-123:_embed',
    })
  })
})
