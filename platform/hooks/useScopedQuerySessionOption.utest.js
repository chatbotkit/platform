/* eslint-disable @typescript-eslint/no-require-imports */
import useScopedQuerySessionOption from './useScopedQuerySessionOption'

import { renderHook } from '@testing-library/react'

jest.mock('@/hooks/useQuerySessionOption', () => jest.fn())

describe('useScopedQuerySessionOption', () => {
  const useQuerySessionOption = require('@/hooks/useQuerySessionOption')

  beforeEach(() => {
    jest.clearAllMocks()
    useQuerySessionOption.mockReturnValue('value-from-base-hook')
  })

  it('sets a generated window scope and delegates with scoped storage key', () => {
    delete window.name

    const uuidSpy = jest
      .spyOn(global.crypto, 'randomUUID')
      .mockReturnValue('scope-uuid')

    const { result } = renderHook(() => useScopedQuerySessionOption('mode'))

    expect(result.current).toBe('value-from-base-hook')
    expect(window.name).toBe('cbk-frame:scope-uuid')
    expect(useQuerySessionOption).toHaveBeenCalledWith('mode', {
      storageKey: 'session-options:cbk-frame:scope-uuid:mode',
    })

    uuidSpy.mockRestore()
  })

  it('reuses existing window.name when present', () => {
    window.name = 'existing-scope'

    const { result } = renderHook(() => useScopedQuerySessionOption('theme'))

    expect(result.current).toBe('value-from-base-hook')
    expect(useQuerySessionOption).toHaveBeenCalledWith('theme', {
      storageKey: 'session-options:existing-scope:theme',
    })
  })

  it('falls back to Math.random when crypto.randomUUID is unavailable', () => {
    delete window.name

    const originalRandomUUID = global.crypto.randomUUID
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.123456789)

    Object.defineProperty(global.crypto, 'randomUUID', {
      value: undefined,
      configurable: true,
    })

    renderHook(() => useScopedQuerySessionOption('panel'))

    expect(useQuerySessionOption).toHaveBeenCalledWith('panel', {
      storageKey: expect.stringMatching(/^session-options:cbk-frame:.*:panel$/),
    })

    Object.defineProperty(global.crypto, 'randomUUID', {
      value: originalRandomUUID,
      configurable: true,
    })
    randomSpy.mockRestore()
  })
})
