import { useEffect, useState } from 'react'

import Console, { useConsoleDebugFunctions, useConsoleTrace } from './Console'

import '@testing-library/jest-dom'
import { act, render } from '@testing-library/react'

const mockSessionStorage = {}
const mockUseFirst = jest.fn((fn) => fn())

jest.mock('@/lib/browserstorage', () => ({
  getSessionStorage: () => mockSessionStorage,
}))

jest.mock(
  '@/hooks/useFirst',
  () =>
    (...args) =>
      mockUseFirst(...args)
)

jest.mock('uuid', () => ({
  v5: jest.fn(() => 'fixed-id'),
}))

function DebugHarness({ functions }) {
  useConsoleDebugFunctions(functions)

  return null
}

function TraceHarness({ onTrace, tick, refresh = false }) {
  const trace = useConsoleTrace()
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (refresh && version === 0) {
      setVersion(1)
    }
  }, [refresh, version])

  useEffect(() => {
    onTrace(trace)
  }, [onTrace, tick, trace, version])

  return null
}

describe('Console', () => {
  let consoleSpy

  beforeEach(() => {
    jest.clearAllMocks()
    Object.keys(mockSessionStorage).forEach(
      (key) => delete mockSessionStorage[key]
    )
    window.localStorage.clear()
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

    delete window.enableChatBotKitDebugFunctions
    delete window.disableChatBotKitDebugFunctions
    delete window.enableChatBotKitTrace
    delete window.disableChatBotKitTrace
    delete window.testFn
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it('prints message once when document is already loaded', () => {
    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      configurable: true,
    })

    const message = '  hello world\n\n'

    const { unmount } = render(<Console message={message} />)

    expect(consoleSpy).toHaveBeenCalledTimes(1)
    expect(mockSessionStorage['console-printed-fixed-id']).toBe(true)

    render(<Console message={message} />)

    expect(consoleSpy).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new Event('beforeunload'))

    expect(mockSessionStorage['console-printed-fixed-id']).toBeUndefined()

    unmount()
  })

  it('prints message after load event when document is not ready', () => {
    Object.defineProperty(document, 'readyState', {
      value: 'loading',
      configurable: true,
    })

    render(<Console message="queued" />)

    expect(consoleSpy).not.toHaveBeenCalled()

    window.dispatchEvent(new Event('load'))

    expect(consoleSpy).toHaveBeenCalledTimes(1)
  })

  it('registers debug helpers and exposes function calls when debug is enabled', () => {
    window.localStorage.setItem('chatbotkit.debug', 'true')

    const testFn = jest.fn((value) => `done:${value}`)

    render(
      <DebugHarness
        functions={{
          testFn: {
            description: 'test description',
            fn: testFn,
          },
        }}
      />
    )

    expect(typeof window.enableChatBotKitDebugFunctions).toBe('function')
    expect(typeof window.disableChatBotKitDebugFunctions).toBe('function')
    expect(typeof window.enableChatBotKitTrace).toBe('function')
    expect(typeof window.disableChatBotKitTrace).toBe('function')
    expect(typeof window.testFn).toBe('function')

    const result = window.testFn('abc')

    expect(result).toBe('done:abc')
    expect(testFn).toHaveBeenCalledWith('abc')
  })

  it('toggles debug and trace localStorage flags via helpers', () => {
    render(<DebugHarness functions={{}} />)

    window.enableChatBotKitDebugFunctions()
    window.enableChatBotKitTrace()

    expect(window.localStorage.getItem('chatbotkit.debug')).toBe('true')
    expect(window.localStorage.getItem('chatbotkit.trace')).toBe('true')

    window.disableChatBotKitDebugFunctions()
    window.disableChatBotKitTrace()

    expect(window.localStorage.getItem('chatbotkit.debug')).toBeNull()
    expect(window.localStorage.getItem('chatbotkit.trace')).toBeNull()
  })

  it('returns dummy trace by default and active trace when enabled after rerender', () => {
    const onTrace = jest.fn()

    const { unmount } = render(<TraceHarness onTrace={onTrace} tick={0} />)

    const firstTrace = onTrace.mock.calls[0][0]

    expect(firstTrace.log).toBe(useConsoleTrace.dummyTrace.log)

    window.localStorage.setItem('chatbotkit.trace', 'true')

    unmount()
    render(<TraceHarness onTrace={onTrace} tick={1} refresh />)

    const secondTrace = onTrace.mock.calls[onTrace.mock.calls.length - 1][0]

    act(() => {
      secondTrace.log('trace-event')
    })

    expect(consoleSpy).toHaveBeenCalledWith(
      '%c* trace',
      'color: #4f46e5',
      'trace-event'
    )
  })
})
