import useAvatarTransport, {
  AVATAR_MESSAGE_INTERRUPT,
  AVATAR_MESSAGE_MIC_CONTROL,
  AVATAR_MESSAGE_USER_MESSAGE,
} from './useAvatarTransport'

import { act, renderHook } from '@testing-library/react'

describe('useAvatarTransport', () => {
  it('should send mic control messages to the target window', () => {
    const postMessage = jest.fn()
    const targetWindow = () => ({ postMessage })

    const { result } = renderHook(() =>
      useAvatarTransport({
        source: 'host-frame',
        targetOrigin: 'https://avatar.example',
        targetWindow,
      })
    )

    let sent

    act(() => {
      sent = result.current.sendMicControl({ muted: true })
    })

    expect(sent).toBe(true)
    expect(postMessage).toHaveBeenCalledWith(
      {
        muted: true,
        source: 'host-frame',
        type: AVATAR_MESSAGE_MIC_CONTROL,
      },
      'https://avatar.example'
    )
  })

  it('should send interrupt messages to the target window', () => {
    const postMessage = jest.fn()
    const targetWindow = () => ({ postMessage })

    const { result } = renderHook(() =>
      useAvatarTransport({
        source: 'host-frame',
        targetWindow,
      })
    )

    act(() => {
      result.current.sendInterrupt({
        participantId: 'participant-1',
        previousParticipantId: 'participant-0',
        reason: 'meeting-turn-changed',
      })
    })

    expect(postMessage).toHaveBeenCalledWith(
      {
        participantId: 'participant-1',
        previousParticipantId: 'participant-0',
        reason: 'meeting-turn-changed',
        source: 'host-frame',
        type: AVATAR_MESSAGE_INTERRUPT,
      },
      '*'
    )
  })

  it('should send user messages with participant names', () => {
    const postMessage = jest.fn()
    const targetWindow = () => ({ postMessage })

    const { result } = renderHook(() =>
      useAvatarTransport({
        source: 'meeting-agent',
        targetWindow,
      })
    )

    act(() => {
      result.current.sendUserMessage({
        participantName: 'Ada',
        text: 'Hello',
      })
    })

    expect(postMessage).toHaveBeenCalledWith(
      {
        participant: {
          name: 'Ada',
        },
        source: 'meeting-agent',
        text: 'Hello',
        type: AVATAR_MESSAGE_USER_MESSAGE,
      },
      '*'
    )
  })

  it('should return false when sending without a target window', () => {
    const { result } = renderHook(() => useAvatarTransport())

    let sent

    act(() => {
      sent = result.current.sendMicControl({ muted: true })
    })

    expect(sent).toBe(false)
  })

  it('should return false when disabled', () => {
    const postMessage = jest.fn()
    const targetWindow = () => ({ postMessage })

    const { result } = renderHook(() =>
      useAvatarTransport({
        disabled: true,
        targetWindow,
      })
    )

    let sent

    act(() => {
      sent = result.current.sendInterrupt()
    })

    expect(sent).toBe(false)
    expect(postMessage).not.toHaveBeenCalled()
  })

  it('should handle received mic control messages', () => {
    const onMicControl = jest.fn()

    renderHook(() =>
      useAvatarTransport({
        onMicControl,
      })
    )

    const message = {
      muted: true,
      source: 'host-frame',
      type: AVATAR_MESSAGE_MIC_CONTROL,
    }

    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: message }))
    })

    expect(onMicControl).toHaveBeenCalledTimes(1)
    expect(onMicControl).toHaveBeenCalledWith(message, expect.any(MessageEvent))
  })

  it('should handle received interrupt messages', () => {
    const onInterrupt = jest.fn()

    renderHook(() =>
      useAvatarTransport({
        onInterrupt,
      })
    )

    const message = {
      participantId: 'participant-1',
      reason: 'meeting-turn-changed',
      source: 'host-frame',
      type: AVATAR_MESSAGE_INTERRUPT,
    }

    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: message }))
    })

    expect(onInterrupt).toHaveBeenCalledTimes(1)
    expect(onInterrupt).toHaveBeenCalledWith(message, expect.any(MessageEvent))
  })

  it('should handle received user messages', () => {
    const onUserMessage = jest.fn()

    renderHook(() =>
      useAvatarTransport({
        onUserMessage,
      })
    )

    const message = {
      source: 'host-frame',
      text: 'Hello',
      type: AVATAR_MESSAGE_USER_MESSAGE,
    }

    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: message }))
    })

    expect(onUserMessage).toHaveBeenCalledTimes(1)
    expect(onUserMessage).toHaveBeenCalledWith(
      message,
      expect.any(MessageEvent)
    )
  })

  it('should ignore unknown received messages', () => {
    const onInterrupt = jest.fn()
    const onMicControl = jest.fn()
    const onUserMessage = jest.fn()

    renderHook(() =>
      useAvatarTransport({
        onInterrupt,
        onMicControl,
        onUserMessage,
      })
    )

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'unknown',
          },
        })
      )
    })

    expect(onInterrupt).not.toHaveBeenCalled()
    expect(onMicControl).not.toHaveBeenCalled()
    expect(onUserMessage).not.toHaveBeenCalled()
  })

  it('should stop receiving messages after unmount', () => {
    const onMicControl = jest.fn()

    const { unmount } = renderHook(() =>
      useAvatarTransport({
        onMicControl,
      })
    )

    unmount()

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            muted: true,
            type: AVATAR_MESSAGE_MIC_CONTROL,
          },
        })
      )
    })

    expect(onMicControl).not.toHaveBeenCalled()
  })
})
