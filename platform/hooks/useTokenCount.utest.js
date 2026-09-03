import useTokenCount from '@/hooks/useTokenCount'

import { renderHook } from '@testing-library/react'

Object.defineProperty(global, 'Worker', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    addEventListener: jest.fn(),
    postMessage: jest.fn(),
    terminate: jest.fn(),
  })),
})

describe('useTokenCount', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return 0 for empty text', () => {
    const { result } = renderHook(() => useTokenCount(''))

    expect(result.current).toBe(0)
  })

  it('should return 0 for null/undefined text', () => {
    const { result: result1 } = renderHook(() => useTokenCount(null))
    const { result: result2 } = renderHook(() => useTokenCount(undefined))

    expect(result1.current).toBe(0)
    expect(result2.current).toBe(0)
  })

  it('should handle worker creation failure gracefully', () => {
    global.Worker = jest.fn(() => {
      throw new Error('Worker creation failed')
    })

    const { result } = renderHook(() => useTokenCount('test text'))

    expect(result.current).toBe(0)
  })

  it('should create worker when available', () => {
    const mockWorker = {
      addEventListener: jest.fn(),
      postMessage: jest.fn(),
      terminate: jest.fn(),
    }

    global.Worker = jest.fn(() => mockWorker)

    renderHook(() => useTokenCount('test'))

    expect(global.Worker).toHaveBeenCalledWith(expect.any(URL))
    expect(mockWorker.addEventListener).toHaveBeenCalledWith(
      'message',
      expect.any(Function)
    )
  })

  it('should post message to worker when text changes', () => {
    const mockWorker = {
      addEventListener: jest.fn(),
      postMessage: jest.fn(),
      terminate: jest.fn(),
    }

    global.Worker = jest.fn(() => mockWorker)

    const { rerender } = renderHook(({ text }) => useTokenCount(text), {
      initialProps: { text: 'initial text' },
    })

    expect(mockWorker.postMessage).toHaveBeenCalledWith({
      action: 'getTextTokensLength',
      params: { text: 'initial text' },
    })

    rerender({ text: 'updated text' })

    expect(mockWorker.postMessage).toHaveBeenCalledWith({
      action: 'getTextTokensLength',
      params: { text: 'updated text' },
    })
  })

  it('should terminate worker on unmount', () => {
    const mockWorker = {
      addEventListener: jest.fn(),
      postMessage: jest.fn(),
      terminate: jest.fn(),
    }

    global.Worker = jest.fn(() => mockWorker)

    const { unmount } = renderHook(() => useTokenCount('test'))

    unmount()

    expect(mockWorker.terminate).toHaveBeenCalled()
  })
})
