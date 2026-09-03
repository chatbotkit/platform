import useSignin from './useSignin'

import '@testing-library/jest-dom'
import { act, renderHook } from '@testing-library/react'

const mockSignIn = jest.fn()

jest.mock('next-auth/react', () => ({
  signIn: (...args) => mockSignIn(...args),
}))

jest.mock('@/config/cookie', () => ({
  RUNAS_TEAMID_COOKIE_NAME: 'chatbotkit.runas-teamid',
  RUNAS_TEAMNAME_COOKIE_NAME: 'chatbotkit.runas-teamname',
  RUNAS_USERID_COOKIE_NAME: 'chatbotkit.runas-userid',
  RUNAS_USERNAME_COOKIE_NAME: 'chatbotkit.runas-username',
}))

let cookieWrites = []

function defineCookieProperty(options = {}) {
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get: options.get ?? (() => ''),
    set: options.set ?? ((value) => cookieWrites.push(value)),
  })
}

describe('useSignin', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    cookieWrites = []
    defineCookieProperty()
  })

  it('should return signin function', () => {
    const { result } = renderHook(() => useSignin())

    expect(result.current.signin).toBeDefined()
    expect(typeof result.current.signin).toBe('function')
  })

  it('should clear all switch cookies before signing in', async () => {
    const { result } = renderHook(() => useSignin())

    await act(async () => {
      await result.current.signin('google')
    })

    expect(cookieWrites).toHaveLength(4)
    expect(
      cookieWrites.some((c) => c.includes('chatbotkit.runas-teamid'))
    ).toBe(true)
    expect(
      cookieWrites.some((c) => c.includes('chatbotkit.runas-teamname'))
    ).toBe(true)
    expect(
      cookieWrites.some((c) => c.includes('chatbotkit.runas-userid'))
    ).toBe(true)
    expect(
      cookieWrites.some((c) => c.includes('chatbotkit.runas-username'))
    ).toBe(true)
    expect(cookieWrites.every((c) => c.includes('1970'))).toBe(true)
  })

  it('should call signIn with provider and options', async () => {
    const { result } = renderHook(() => useSignin())

    await act(async () => {
      await result.current.signin('github', { callbackUrl: '/dashboard' })
    })

    expect(mockSignIn).toHaveBeenCalledWith(
      'github',
      { callbackUrl: '/dashboard' },
      undefined
    )
  })

  it('should call signIn with provider, options, and parameters', async () => {
    const { result } = renderHook(() => useSignin())

    await act(async () => {
      await result.current.signin(
        'email',
        { redirect: false },
        { login_hint: 'user@example.com' }
      )
    })

    expect(mockSignIn).toHaveBeenCalledWith(
      'email',
      { redirect: false },
      { login_hint: 'user@example.com' }
    )
  })

  it('should clear cookies before calling signIn', async () => {
    const callOrder = []

    defineCookieProperty({
      set: () => {
        if (!callOrder.includes('cookies')) {
          callOrder.push('cookies')
        }
      },
    })

    mockSignIn.mockImplementation(() => {
      callOrder.push('signIn')
    })

    const { result } = renderHook(() => useSignin())

    await act(async () => {
      await result.current.signin('google')
    })

    expect(callOrder).toEqual(['cookies', 'signIn'])
  })
})
