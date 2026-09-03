import useAvatarInputAudioStream from './useAvatarInputAudioStream'

import { act, renderHook } from '@testing-library/react'

describe('useAvatarInputAudioStream', () => {
  const originalTop = window.top

  beforeEach(() => {
    jest.clearAllMocks()

    Object.defineProperty(window, 'top', {
      configurable: true,
      value: window,
    })

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        enumerateDevices: jest.fn().mockResolvedValue([]),
        getUserMedia: jest.fn(),
      },
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'top', {
      configurable: true,
      value: originalTop,
    })
  })

  it('returns audio input count and no stream by default', async () => {
    navigator.mediaDevices.enumerateDevices.mockResolvedValue([
      { kind: 'audioinput' },
      { kind: 'audioinput' },
      { kind: 'videoinput' },
    ])

    const { result } = renderHook(() => useAvatarInputAudioStream())

    let resolved

    await act(async () => {
      resolved = await result.current.resolveInputAudioStream()
    })

    expect(resolved).toEqual({
      audioInputCount: 2,
      isEmbedded: false,
      stream: undefined,
    })
    expect(result.current.inputAudioStreamRef.current).toBeNull()
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled()
  })

  it('requests current page stream when enabled', async () => {
    const stream = { getTracks: jest.fn(() => []) }

    navigator.mediaDevices.enumerateDevices.mockResolvedValue([
      { kind: 'audioinput' },
    ])
    navigator.mediaDevices.getUserMedia.mockResolvedValue(stream)

    const { result } = renderHook(() =>
      useAvatarInputAudioStream({
        constraints: { echoCancellation: true },
        requestCurrentPageStream: true,
      })
    )

    let resolved

    await act(async () => {
      resolved = await result.current.resolveInputAudioStream()
    })

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: { echoCancellation: true },
    })
    expect(resolved.stream).toBe(stream)
    expect(result.current.inputAudioStreamRef.current).toBe(stream)
  })

  it('uses top window mediaDevices when embedded and no local audio input exists', async () => {
    const stream = { getTracks: jest.fn(() => []) }
    const topGetUserMedia = jest.fn().mockResolvedValue(stream)

    Object.defineProperty(window, 'top', {
      configurable: true,
      value: {
        navigator: {
          mediaDevices: {
            getUserMedia: topGetUserMedia,
          },
        },
      },
    })

    navigator.mediaDevices.enumerateDevices.mockResolvedValue([
      { kind: 'videoinput' },
    ])

    const { result } = renderHook(() => useAvatarInputAudioStream())

    let resolved

    await act(async () => {
      resolved = await result.current.resolveInputAudioStream()
    })

    expect(resolved.isEmbedded).toBe(true)
    expect(topGetUserMedia).toHaveBeenCalledWith({ audio: true })
    expect(resolved.stream).toBe(stream)
  })

  it('falls back to empty device list when enumerateDevices rejects', async () => {
    navigator.mediaDevices.enumerateDevices.mockRejectedValue(
      new Error('unavailable')
    )

    const { result } = renderHook(() =>
      useAvatarInputAudioStream({ requestCurrentPageStream: true })
    )

    await act(async () => {
      await result.current.resolveInputAudioStream()
    })

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: true,
    })
  })

  it('releases stream tracks and clears ref', async () => {
    const trackA = { stop: jest.fn() }
    const trackB = { stop: jest.fn() }
    const stream = {
      getTracks: jest.fn(() => [trackA, trackB]),
    }

    navigator.mediaDevices.enumerateDevices.mockResolvedValue([
      { kind: 'audioinput' },
    ])
    navigator.mediaDevices.getUserMedia.mockResolvedValue(stream)

    const { result } = renderHook(() =>
      useAvatarInputAudioStream({ requestCurrentPageStream: true })
    )

    await act(async () => {
      await result.current.resolveInputAudioStream()
    })

    expect(result.current.inputAudioStreamRef.current).toBe(stream)

    act(() => {
      result.current.releaseInputAudioStream()
    })

    expect(trackA.stop).toHaveBeenCalledTimes(1)
    expect(trackB.stop).toHaveBeenCalledTimes(1)
    expect(result.current.inputAudioStreamRef.current).toBeNull()
  })
})
