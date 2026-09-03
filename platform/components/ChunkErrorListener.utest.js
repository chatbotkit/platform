import {
  consumeStaleDeployment,
  isChunkLoadError,
  markStaleDeployment,
  recoverFromChunkError,
} from '@/lib/stale'

import ChunkErrorListener from './ChunkErrorListener'

import { render } from '@testing-library/react'

jest.mock('@/lib/stale', () => ({
  consumeStaleDeployment: jest.fn(),
  isChunkLoadError: jest.fn(),
  markStaleDeployment: jest.fn(),
  recoverFromChunkError: jest.fn(),
}))

describe('ChunkErrorListener', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('registers and unregisters global listeners', () => {
    const windowAdd = jest.spyOn(window, 'addEventListener')
    const windowRemove = jest.spyOn(window, 'removeEventListener')
    const documentAdd = jest.spyOn(document, 'addEventListener')
    const documentRemove = jest.spyOn(document, 'removeEventListener')

    const { unmount } = render(<ChunkErrorListener />)

    expect(windowAdd).toHaveBeenCalledWith(
      'unhandledrejection',
      expect.any(Function)
    )
    expect(windowAdd).toHaveBeenCalledWith('error', expect.any(Function))
    expect(documentAdd).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function)
    )

    unmount()

    expect(windowRemove).toHaveBeenCalledWith(
      'unhandledrejection',
      expect.any(Function)
    )
    expect(windowRemove).toHaveBeenCalledWith('error', expect.any(Function))
    expect(documentRemove).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function)
    )

    windowAdd.mockRestore()
    windowRemove.mockRestore()
    documentAdd.mockRestore()
    documentRemove.mockRestore()
  })

  it('marks stale deployment for chunk unhandled rejection and prevents default', () => {
    const handlers = {}

    const windowAdd = jest
      .spyOn(window, 'addEventListener')
      .mockImplementation((type, handler) => {
        handlers[type] = handler
      })
    const documentAdd = jest
      .spyOn(document, 'addEventListener')
      .mockImplementation((type, handler) => {
        handlers[type] = handler
      })

    isChunkLoadError.mockReturnValue(true)

    render(<ChunkErrorListener />)

    const event = {
      reason: new Error('chunk failed'),
      preventDefault: jest.fn(),
    }

    handlers.unhandledrejection(event)

    expect(isChunkLoadError).toHaveBeenCalledWith(event.reason)
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(markStaleDeployment).toHaveBeenCalledTimes(1)

    windowAdd.mockRestore()
    documentAdd.mockRestore()
  })

  it('recovers on hidden visibility when stale deployment was marked', () => {
    const handlers = {}

    const windowAdd = jest
      .spyOn(window, 'addEventListener')
      .mockImplementation((type, handler) => {
        handlers[type] = handler
      })
    const documentAdd = jest
      .spyOn(document, 'addEventListener')
      .mockImplementation((type, handler) => {
        handlers[type] = handler
      })

    consumeStaleDeployment.mockReturnValue(true)
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    })

    render(<ChunkErrorListener />)

    handlers.visibilitychange()

    expect(consumeStaleDeployment).toHaveBeenCalledTimes(1)
    expect(recoverFromChunkError).toHaveBeenCalledTimes(1)

    windowAdd.mockRestore()
    documentAdd.mockRestore()
  })
})
