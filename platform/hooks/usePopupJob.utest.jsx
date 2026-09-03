import usePopupJob from './usePopupJob'

import { act, renderHook } from '@testing-library/react'

const mockOpenPopup = jest.fn()
const mockClosePopup = jest.fn()
const mockSetProps = jest.fn()

jest.mock('@/hooks/usePopup', () => {
  return () => ({
    popup: <div data-testid="popup" />,
    openPopup: mockOpenPopup,
    closePopup: mockClosePopup,
    setProps: mockSetProps,
  })
})

describe('usePopupJob', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should open popup, report progress, and close when job completes', async () => {
    const { result } = renderHook(() => usePopupJob())

    const job = jest.fn(async ({ setProgress, isCancelled, signal }) => {
      expect(isCancelled()).toBe(false)
      expect(signal).toBeInstanceOf(AbortSignal)

      setProgress({ completed: 1 })
    })

    await act(async () => {
      await result.current.runJob(job, {
        title: 'Uploading Files',
        progressDescription: 'Uploading...',
        total: 2,
      })
    })

    expect(job).toHaveBeenCalledTimes(1)
    expect(mockOpenPopup).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        title: 'Uploading Files',
        closePopupOnClickOutside: false,
      })
    )

    expect(mockSetProps).toHaveBeenCalledWith({
      progressDescription: 'Uploading...',
      completed: 0,
      total: 2,
    })

    expect(mockSetProps).toHaveBeenCalledWith(expect.any(Function))
    expect(mockClosePopup).toHaveBeenCalledTimes(1)
  })

  it('should abort and keep popup open when cancelled via onClose', async () => {
    const { result } = renderHook(() => usePopupJob())

    const job = jest.fn(
      ({ signal }) =>
        new Promise((resolve) => {
          signal.addEventListener('abort', () => resolve())
        })
    )

    let runPromise

    await act(async () => {
      runPromise = result.current.runJob(job, {
        title: 'Uploading Files',
        total: 10,
      })
      await Promise.resolve()
    })

    const options = mockOpenPopup.mock.calls[0][1]

    await act(async () => {
      options.onClose()
      await runPromise
    })

    expect(job).toHaveBeenCalledTimes(1)
    expect(mockClosePopup).not.toHaveBeenCalled()
  })
})
