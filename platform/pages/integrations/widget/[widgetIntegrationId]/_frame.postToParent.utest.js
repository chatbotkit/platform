/**
 * @jest-environment @chatbotkit-dev/jest-jsdom
 */
import { postToParent } from './frame'

describe('postToParent', () => {
  let originalParent
  let mockPostMessage

  beforeEach(() => {
    originalParent = Object.getOwnPropertyDescriptor(window, 'parent')
    mockPostMessage = jest.fn()
  })

  afterEach(() => {
    if (originalParent) {
      Object.defineProperty(window, 'parent', originalParent)
    }
  })

  it('should post message to parent window', () => {
    Object.defineProperty(window, 'parent', {
      get: () => ({ postMessage: mockPostMessage }),
      configurable: true,
    })

    postToParent({ type: 'test', data: 'hello' })

    expect(mockPostMessage).toHaveBeenCalledWith(
      { type: 'test', data: 'hello' },
      '*'
    )
  })

  it('should handle SecurityError when accessing window.parent in cross-origin iframe on Safari/iOS', () => {
    // @note this simulates the Safari/iOS behavior where accessing window.parent
    // throws SecurityError in cross-origin iframe context with third-party
    // cookies blocked

    Object.defineProperty(window, 'parent', {
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError')
      },
      configurable: true,
    })

    // @note should not throw - this is the bug we're fixing
    expect(() => postToParent({ type: 'test' })).not.toThrow()
  })

  it('should handle null parent gracefully', () => {
    Object.defineProperty(window, 'parent', {
      get: () => null,
      configurable: true,
    })

    expect(() => postToParent({ type: 'test' })).not.toThrow()
  })

  it('should handle undefined parent gracefully', () => {
    Object.defineProperty(window, 'parent', {
      get: () => undefined,
      configurable: true,
    })

    expect(() => postToParent({ type: 'test' })).not.toThrow()
  })

  it('should handle parent without postMessage method', () => {
    Object.defineProperty(window, 'parent', {
      get: () => ({}),
      configurable: true,
    })

    expect(() => postToParent({ type: 'test' })).not.toThrow()
  })
})
