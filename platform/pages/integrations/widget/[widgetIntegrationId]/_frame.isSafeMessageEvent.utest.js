import { isSafeMessageEvent } from './frame'

describe('isSafeMessageEvent', () => {
  it('should return true for same-window events', () => {
    const event = { source: window }

    expect(isSafeMessageEvent(event)).toBe(true)
  })

  it('should return true for parent window events', () => {
    const event = { source: window.parent }

    expect(isSafeMessageEvent(event)).toBe(true)
  })

  it('should return false for events from other sources', () => {
    const event = { source: {} }

    expect(isSafeMessageEvent(event)).toBe(false)
  })

  it('should handle SecurityError when accessing window.parent in cross-origin iframe', () => {
    // @note this simulates the Safari/iOS behavior where accessing window.parent
    // throws SecurityError in cross-origin iframe context

    const originalParent = Object.getOwnPropertyDescriptor(window, 'parent')

    Object.defineProperty(window, 'parent', {
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError')
      },
      configurable: true,
    })

    try {
      const event = { source: window }

      // @note this should not throw, and should return true for same-window events
      expect(() => isSafeMessageEvent(event)).not.toThrow()
      expect(isSafeMessageEvent(event)).toBe(true)
    } finally {
      // restore original
      if (originalParent) {
        Object.defineProperty(window, 'parent', originalParent)
      }
    }
  })

  it('should return false for non-window events when window.parent throws SecurityError', () => {
    const originalParent = Object.getOwnPropertyDescriptor(window, 'parent')

    Object.defineProperty(window, 'parent', {
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError')
      },
      configurable: true,
    })

    try {
      const event = { source: {} }

      // @note should not throw, and should return false for other sources
      expect(() => isSafeMessageEvent(event)).not.toThrow()
      expect(isSafeMessageEvent(event)).toBe(false)
    } finally {
      if (originalParent) {
        Object.defineProperty(window, 'parent', originalParent)
      }
    }
  })
})
