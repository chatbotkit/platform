import { act, renderHook } from '@testing-library/react'

import usePopupJob from './usePopupJob'

const mockOpenPopup = jest.fn()
const mockClosePopup = jest.fn()
const mockSetProps = jest.fn()

jest.mock('@/hooks/usePopup', () =>
  jest.fn(() => ({
    popup: { id: 'popup' },
    openPopup: mockOpenPopup,
    closePopup: mockClosePopup,
    setProps: mockSetProps,
  }))
)

jest.mock('@/components/ProgressBar', () => () => null)

describe('usePopupJob', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('opens popup, runs job and closes popup on success', async () => {
    const job = jest.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => usePopupJob({ title: 'Default Title' }))

    await act(async () => {
      await result.current.runJob(job, {
        title: 'Custom Title',
        total: 5,
        progressDescription: 'Working',
      })
    })

    expect(mockSetProps).toHaveBeenCalledWith({
      progressDescription: 'Working',
      completed: 0,
      total: 5,
    })
    expect(mockOpenPopup).toHaveBeenCalled()
    expect(job).toHaveBeenCalledWith(
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        isCancelled: expect.any(Function),
        setProgress: expect.any(Function),
      })
    )
    expect(mockClosePopup).toHaveBeenCalledTimes(1)
    expect(result.current.isRunning).toBe(false)
  })

  it('cancelJob aborts an in-flight job and prevents closePopup', async () => {
    let controls
    const job = jest.fn().mockImplementation(async (args) => {
      controls = args
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    const { result } = renderHook(() => usePopupJob())

    const promise = act(async () => {
      await result.current.runJob(job)
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(controls.isCancelled()).toBe(false)

    act(() => {
      result.current.cancelJob()
    })

    expect(controls.isCancelled()).toBe(true)
    await promise
    expect(mockClosePopup).not.toHaveBeenCalled()
    expect(result.current.isRunning).toBe(false)
  })

  it('ignores runJob when another job is already running', async () => {
    let release
    const firstJob = jest.fn(
      () =>
        new Promise((resolve) => {
          release = resolve
        })
    )
    const secondJob = jest.fn().mockResolvedValue(undefined)

    const { result } = renderHook(() => usePopupJob())

    const firstRun = act(async () => {
      await result.current.runJob(firstJob)
    })

    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      await result.current.runJob(secondJob)
    })

    expect(secondJob).not.toHaveBeenCalled()

    await act(async () => {
      release()
    })

    await firstRun
  })
})
