import { useEffect } from 'react'

import prisma from '@/prisma/client'

import fetch from '@/lib/fetch'
import { RECALL_BOT_OUTPUT_SPEAKER_ID } from '@/lib/recall.constants'
import { getRecallMeetingSession } from '@/lib/recall.session'

import useAvatarTransport from '@/hooks/useAvatarTransport'
import useConversationManager from '@/hooks/useConversationManager'
import useEventChannel from '@/hooks/useEventChannel'

import {
  getServerSideProps,
  useAvatar,
  useBackground,
  useLeave,
  useMeetingAgent,
  useMeetingController,
  useMessage,
  useRecallFrameSession,
  useRecallMeetingMode,
  useRecallRealtimeEvents,
  useRecording,
  useScreenshare,
  useSound,
} from './camera'

import { act, renderHook } from '@testing-library/react'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    recallIntegration: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/fetch', () => jest.fn())

jest.mock('@/lib/recall.session', () => ({
  getRecallMeetingSession: jest.fn(),
}))

jest.mock('@/hooks/useConversationManager', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/hooks/useAvatarTransport', () => jest.fn())

function createDeferred() {
  let resolve
  let reject

  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return {
    promise,
    reject,
    resolve,
  }
}

function useTestRecallMeetingMode({ botName = 'Avatar' } = {}) {
  const meetingEvents = useEventChannel()
  const meetingMode = useRecallMeetingMode({ botName, meetingEvents })

  return {
    meetingEvents,
    meetingMode,
  }
}

function useTestRecallRealtimeEvents({ relayUrl }) {
  const meetingEvents = useEventChannel()

  useRecallRealtimeEvents({
    meetingEvents,
    relayUrl,
  })

  return {
    meetingEvents,
  }
}

function useTestMeetingController({ disabled = false, onEvent }) {
  const meetingEvents = useEventChannel()

  useMeetingController({
    disabled,
    meetingEvents,
  })

  useEffect(() => meetingEvents.subscribe(onEvent), [meetingEvents, onEvent])

  return {
    meetingEvents,
  }
}

function useTestRecallFrameSession({
  abort = jest.fn(),
  sessionCreateUrl = '/api/session/create',
  sessionId = 'session_123',
  setConversationId = jest.fn(),
  setToken = jest.fn(),
  onEvent = jest.fn(),
} = {}) {
  const meetingEvents = useEventChannel()

  useRecallFrameSession({
    abort,
    meetingEvents,
    sessionCreateUrl,
    sessionId,
    setConversationId,
    setToken,
  })

  useEffect(() => meetingEvents.subscribe(onEvent), [meetingEvents, onEvent])

  return {
    abort,
    meetingEvents,
    onEvent,
    setConversationId,
    setToken,
  }
}

function useTestMeetingAgent({
  functions = [],
  initialPrompt = '',
  meetingEvents,
} = {}) {
  const channel = useEventChannel()

  const agent = useMeetingAgent({
    functions,
    initialPrompt,
    meetingEvents: meetingEvents || channel,
  })

  return {
    agent,
    meetingEvents: meetingEvents || channel,
  }
}

function useTestAvatar({ disabled = false, meetingMode = 'unknown' } = {}) {
  const meetingEvents = useEventChannel()
  const avatar = useAvatar({
    disabled,
    meetingEvents,
    meetingMode,
  })

  return {
    avatar,
    meetingEvents,
  }
}

function useTestScreenshare({
  disabled = false,
  recallIntegrationId = 'recall-1',
  sessionId = 'session-1',
} = {}) {
  return useScreenshare({
    disabled,
    recallIntegrationId,
    sessionId,
  })
}

function useTestRecording({
  disabled = false,
  recallIntegrationId = 'recall-1',
  sessionId = 'session-1',
} = {}) {
  return useRecording({
    disabled,
    recallIntegrationId,
    sessionId,
  })
}

describe('getServerSideProps', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should load camera props from the Recall session', async () => {
    getRecallMeetingSession.mockResolvedValue({
      botName: 'Avatar',
      id: 'session-1',
      recallIntegrationId: 'recall-1',
      userId: 'user-1',
      pageRelayUrl: 'wss://relay.test/channel?side=page&events=1',
      text: 'Introduce yourself to the room',
    })

    prisma.recallIntegration.findUnique.mockResolvedValue({
      id: 'recall-1',
      apiKey: 'recall-api-key',
      botId: 'bot-1',
      userId: 'user-1',
    })

    await expect(
      getServerSideProps({
        query: {
          recallIntegrationId: 'recall-1',
          relayUrl: 'wss://ignored.test/channel',
          sessionId: 'session-1',
          text: 'Ignored query text',
        },
      })
    ).resolves.toEqual({
      props: {
        botName: 'Avatar',
        integration: {
          id: 'recall-1',
        },
        relayUrl: 'wss://relay.test/channel?side=page&events=1',
        sessionId: 'session-1',
        text: 'Introduce yourself to the room',
      },
    })

    expect(getRecallMeetingSession).toHaveBeenCalledWith('session-1')
  })

  it('should return not found when the session does not match the integration', async () => {
    getRecallMeetingSession.mockResolvedValue({
      id: 'session-1',
      pageRelayUrl: 'wss://relay.test/channel?side=page&events=1',
      recallIntegrationId: 'recall-2',
      userId: 'user-1',
    })

    prisma.recallIntegration.findUnique.mockResolvedValue({
      id: 'recall-1',
      apiKey: 'recall-api-key',
      botId: 'bot-1',
      userId: 'user-1',
    })

    await expect(
      getServerSideProps({
        query: {
          recallIntegrationId: 'recall-1',
          sessionId: 'session-1',
        },
      })
    ).resolves.toEqual({
      notFound: true,
    })
  })
})

function useTestMeetingLeave({
  disabled = false,
  recallIntegrationId = 'recall-1',
  sessionId = 'session-1',
} = {}) {
  return useLeave({
    disabled,
    recallIntegrationId,
    sessionId,
  })
}

function useTestChatMessage({
  disabled = false,
  recallIntegrationId = 'recall-1',
  sessionId = 'session-1',
} = {}) {
  return useMessage({
    disabled,
    recallIntegrationId,
    sessionId,
  })
}

function useTestSound({ disabled = false } = {}) {
  return useSound({
    disabled,
  })
}

function mockConversationManager(overrides = {}) {
  const conversationManager = {
    abort: jest.fn(),
    conversationId: '',
    initiateMessage: jest.fn(),
    setConversationId: jest.fn(),
    setFunctions: jest.fn(),
    setToken: jest.fn(),
    token: '',
    ...overrides,
  }

  useConversationManager.mockReturnValue(conversationManager)

  return conversationManager
}

function mockAvatarTransport(overrides = {}) {
  const avatarTransport = {
    sendInterrupt: jest.fn(),
    sendMicControl: jest.fn(),
    sendUserMessage: jest.fn(() => true),
    ...overrides,
  }

  useAvatarTransport.mockReturnValue(avatarTransport)

  return avatarTransport
}

function recallParticipant(participant = {}) {
  return {
    id: 1,
    name: 'Alice',
    is_host: false,
    platform: 'zoom',
    extra_data: {},
    email: null,
    ...participant,
  }
}

function recallTimestamp() {
  return {
    absolute: '2026-05-19T00:00:00Z',
    relative: 1,
  }
}

function recallArtifact(id) {
  return {
    id,
    metadata: {},
  }
}

function recallRealtimeData(data, artifactName) {
  return {
    data,
    realtime_endpoint: recallArtifact('realtime-endpoint-1'),
    [artifactName]: recallArtifact(`${artifactName}-1`),
    recording: recallArtifact('recording-1'),
    bot: recallArtifact('bot-1'),
  }
}

function recallRealtimePayload(data) {
  return {
    data: {
      data,
    },
  }
}

function participantEvent(type, participant) {
  const payload = {
    participant: recallParticipant(participant),
    timestamp: recallTimestamp(),
    data: null,
  }

  return {
    type: 'recall-participant',
    envelope: {
      message: {
        data: recallRealtimeData(payload, 'participant_events'),
      },
      type,
    },
    payload,
  }
}

function transcriptEvent(participant) {
  const payload = {
    participant: recallParticipant(participant),
    words: [
      {
        text: 'hello',
        start_timestamp: { relative: 0 },
        end_timestamp: { relative: 1 },
      },
    ],
  }

  return {
    type: 'recall-transcript',
    envelope: {
      message: {
        data: recallRealtimeData(payload, 'transcript'),
      },
      type: 'transcript.data',
    },
    payload,
  }
}

function seedEvent(participants) {
  return {
    type: 'meeting-seed',
    meeting: {
      participants,
    },
  }
}

function recallTranscriptEvent({
  participant = recallParticipant(),
  text = 'Hello there',
  type = 'transcript.data',
} = {}) {
  const payload = {
    participant: recallParticipant(participant),
    timestamp: recallTimestamp(),
    words: text.split(' ').map((word, index) => ({
      text: word,
      start_timestamp: {
        relative: index,
      },
      end_timestamp: {
        relative: index + 1,
      },
    })),
  }

  return {
    type: 'recall-transcript',
    envelope: {
      message: {
        data: recallRealtimeData(payload, 'transcript'),
      },
      type,
    },
    payload,
  }
}

function recallChatMessageEvent({
  participant = recallParticipant(),
  text = 'Hello from chat',
} = {}) {
  const payload = {
    participant: recallParticipant(participant),
    timestamp: recallTimestamp(),
    data: {
      text,
      to: 'everyone',
    },
  }

  return {
    type: 'recall-message',
    envelope: {
      message: {
        data: recallRealtimeData(payload, 'participant_events'),
      },
      text,
      type: 'participant_events.chat_message',
    },
    payload,
  }
}

describe('useBackground', () => {
  it('should return no functions or render output when disabled', () => {
    const { result } = renderHook(() => useBackground({ disabled: true }))

    expect(result.current.functions).toEqual([])
    expect(result.current.render).toBeNull()
  })

  it('should set a meeting background color', async () => {
    const { result } = renderHook(() => useBackground())

    const setMeetingBackground = result.current.functions.find(
      (fn) => fn.name === 'setMeetingBackground'
    )

    let response

    await act(async () => {
      response = await setMeetingBackground.handler({
        color: '  #123456  ',
      })
    })

    expect(response).toEqual({
      changed: true,
      type: 'color',
    })
    expect(result.current.render.type).toBe('div')
    expect(result.current.render.props.className).toBe(
      'fixed inset-0 h-full w-full'
    )
    expect(result.current.render.props.style).toMatchObject({
      backgroundColor: '#123456',
    })
    expect(result.current.render.props.children).toEqual([null, null])
  })

  it('should set a meeting background image before color when both are provided', async () => {
    const { result } = renderHook(() => useBackground())

    const setMeetingBackground = result.current.functions.find(
      (fn) => fn.name === 'setMeetingBackground'
    )

    let response

    await act(async () => {
      response = await setMeetingBackground.handler({
        color: '#123456',
        url: '  https://example.com/background.png  ',
      })
    })

    expect(response).toEqual({
      changed: true,
      type: 'image',
    })
    expect(result.current.render.type).toBe('div')
    expect(result.current.render.props.className).toBe(
      'fixed inset-0 h-full w-full'
    )
    expect(result.current.render.props.style).toMatchObject({
      backgroundColor: '#000000',
    })

    const [image] = result.current.render.props.children

    expect(image.type).toBe('img')
    expect(image.props).toMatchObject({
      alt: '',
      className: 'h-full w-full object-cover',
      src: 'https://example.com/background.png',
    })
  })

  it('should set a meeting background video for common video URL extensions', async () => {
    const { result } = renderHook(() => useBackground())

    const setMeetingBackground = result.current.functions.find(
      (fn) => fn.name === 'setMeetingBackground'
    )

    let response

    await act(async () => {
      response = await setMeetingBackground.handler({
        url: '  https://example.com/background.mp4  ',
      })
    })

    expect(response).toEqual({
      changed: true,
      type: 'video',
    })
    expect(result.current.render.type).toBe('div')
    expect(result.current.render.props.className).toBe(
      'fixed inset-0 h-full w-full'
    )
    expect(result.current.render.props.style).toMatchObject({
      backgroundColor: '#000000',
    })

    const [, video] = result.current.render.props.children

    expect(video.type).toBe('video')
    expect(video.props).toMatchObject({
      autoPlay: true,
      className: 'h-full w-full object-cover',
      loop: true,
      muted: true,
      playsInline: true,
      src: 'https://example.com/background.mp4',
    })
  })

  it('should set a meeting background video for video URLs with query strings', async () => {
    const { result } = renderHook(() => useBackground())

    const setMeetingBackground = result.current.functions.find(
      (fn) => fn.name === 'setMeetingBackground'
    )

    let response

    await act(async () => {
      response = await setMeetingBackground.handler({
        url: 'https://example.com/background.webm?token=123#section',
      })
    })

    expect(response).toEqual({
      changed: true,
      type: 'video',
    })
    expect(result.current.render.type).toBe('div')

    const [, video] = result.current.render.props.children

    expect(video.type).toBe('video')
    expect(video.props.src).toBe(
      'https://example.com/background.webm?token=123#section'
    )
  })

  it('should not change the background without a URL or color', async () => {
    const { result } = renderHook(() => useBackground())

    const setMeetingBackground = result.current.functions.find(
      (fn) => fn.name === 'setMeetingBackground'
    )

    let response

    await act(async () => {
      response = await setMeetingBackground.handler({
        color: '   ',
        url: '   ',
      })
    })

    expect(response).toEqual({
      changed: false,
    })
    expect(result.current.render.type).toBe('div')
    expect(result.current.render.props.className).toBe(
      'fixed inset-0 h-full w-full'
    )
    expect(result.current.render.props.style).toMatchObject({
      backgroundColor: '#000000',
    })
    expect(result.current.render.props.children).toEqual([null, null])
  })
})

describe('useScreenshare', () => {
  beforeEach(() => {
    fetch.mockReset()
  })

  it('should return no functions when disabled', () => {
    const { result } = renderHook(() => useTestScreenshare({ disabled: true }))

    expect(result.current.functions).toEqual([])
  })

  it('should expose screenshare start and stop functions', () => {
    const { result } = renderHook(() => useTestScreenshare())

    expect(result.current.functions.map((fn) => fn.name)).toEqual([
      'startScreenshare',
      'stopScreenshare',
    ])
  })

  it('should start screenshare with the target URL', async () => {
    fetch.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))

    const { result } = renderHook(() => useTestScreenshare())

    const startScreenshare = result.current.functions.find(
      (fn) => fn.name === 'startScreenshare'
    )

    let response

    await act(async () => {
      response = await startScreenshare.handler({
        url: '  https://slides.example.com/deck  ',
      })
    })

    expect(response).toEqual({
      started: true,
    })
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/integration/recall/recall-1/session/session-1/screenshare/start',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: 'https://slides.example.com/deck',
        }),
      }
    )
  })

  it('should not start screenshare without a target URL', async () => {
    const { result } = renderHook(() => useTestScreenshare())

    const startScreenshare = result.current.functions.find(
      (fn) => fn.name === 'startScreenshare'
    )

    let response

    await act(async () => {
      response = await startScreenshare.handler({
        url: '   ',
      })
    })

    expect(response).toEqual({
      started: false,
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('should stop screenshare', async () => {
    fetch.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))

    const { result } = renderHook(() => useTestScreenshare())

    const stopScreenshare = result.current.functions.find(
      (fn) => fn.name === 'stopScreenshare'
    )

    let response

    await act(async () => {
      response = await stopScreenshare.handler()
    })

    expect(response).toEqual({
      stopped: true,
    })
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/integration/recall/recall-1/session/session-1/screenshare/stop',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }
    )
  })
})

describe('useRecording', () => {
  beforeEach(() => {
    fetch.mockReset()
  })

  it('should return no functions when disabled', () => {
    const { result } = renderHook(() => useTestRecording({ disabled: true }))

    expect(result.current.functions).toEqual([])
  })

  it('should expose recording pause and resume functions', () => {
    const { result } = renderHook(() => useTestRecording())

    expect(result.current.functions.map((fn) => fn.name)).toEqual([
      'pauseRecording',
      'resumeRecording',
    ])
  })

  it('should pause recording', async () => {
    fetch.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))

    const { result } = renderHook(() => useTestRecording())

    const pauseRecording = result.current.functions.find(
      (fn) => fn.name === 'pauseRecording'
    )

    let response

    await act(async () => {
      response = await pauseRecording.handler()
    })

    expect(response).toEqual({
      paused: true,
    })
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/integration/recall/recall-1/session/session-1/recording/pause',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }
    )
  })

  it('should resume recording', async () => {
    fetch.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))

    const { result } = renderHook(() => useTestRecording())

    const resumeRecording = result.current.functions.find(
      (fn) => fn.name === 'resumeRecording'
    )

    let response

    await act(async () => {
      response = await resumeRecording.handler()
    })

    expect(response).toEqual({
      resumed: true,
    })
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/integration/recall/recall-1/session/session-1/recording/resume',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }
    )
  })
})

describe('useLeave', () => {
  beforeEach(() => {
    fetch.mockReset()
  })

  it('should return no functions when disabled', () => {
    const { result } = renderHook(() => useTestMeetingLeave({ disabled: true }))

    expect(result.current.functions).toEqual([])
  })

  it('should leave the meeting', async () => {
    fetch.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))

    const { result } = renderHook(() => useTestMeetingLeave())

    const leaveMeeting = result.current.functions.find(
      (fn) => fn.name === 'leaveMeeting'
    )

    let response

    await act(async () => {
      response = await leaveMeeting.handler()
    })

    expect(response).toEqual({
      left: true,
    })
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/integration/recall/recall-1/session/session-1/leave',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }
    )
  })
})

describe('useMessage', () => {
  beforeEach(() => {
    fetch.mockReset()
  })

  it('should return no functions when disabled', () => {
    const { result } = renderHook(() => useTestChatMessage({ disabled: true }))

    expect(result.current.functions).toEqual([])
  })

  it('should send a chat message', async () => {
    fetch.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))

    const { result } = renderHook(() => useTestChatMessage())

    const sendChatMessage = result.current.functions.find(
      (fn) => fn.name === 'sendChatMessage'
    )

    let response

    await act(async () => {
      response = await sendChatMessage.handler({
        message: '  Here is the link  ',
      })
    })

    expect(response).toEqual({
      sent: true,
    })
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/integration/recall/recall-1/session/session-1/message/send',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Here is the link',
        }),
      }
    )
  })

  it('should send a chat message to a recipient', async () => {
    fetch.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))

    const { result } = renderHook(() => useTestChatMessage())

    const sendChatMessage = result.current.functions.find(
      (fn) => fn.name === 'sendChatMessage'
    )

    await act(async () => {
      await sendChatMessage.handler({
        message: 'Hello',
        to: '  participant-1  ',
      })
    })

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          message: 'Hello',
          to: 'participant-1',
        }),
      })
    )
  })

  it('should not send an empty chat message', async () => {
    const { result } = renderHook(() => useTestChatMessage())

    const sendChatMessage = result.current.functions.find(
      (fn) => fn.name === 'sendChatMessage'
    )

    let response

    await act(async () => {
      response = await sendChatMessage.handler({
        message: '   ',
      })
    })

    expect(response).toEqual({
      sent: false,
    })
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('useSound', () => {
  const OriginalAudio = global.Audio

  beforeEach(() => {
    global.Audio = jest.fn().mockImplementation((url) => ({
      pause: jest.fn(),
      play: jest.fn().mockResolvedValue(undefined),
      url,
    }))
  })

  afterEach(() => {
    global.Audio = OriginalAudio
  })

  it('should return no functions when disabled', () => {
    const { result } = renderHook(() => useTestSound({ disabled: true }))

    expect(result.current.functions).toEqual([])
  })

  it('should play a sound from a URL', async () => {
    const { result } = renderHook(() => useTestSound())

    const playSound = result.current.functions.find(
      (fn) => fn.name === 'playSound'
    )

    let response

    await act(async () => {
      response = await playSound.handler({
        url: '  https://example.com/sound.mp3  ',
      })
    })

    const audio = global.Audio.mock.results[0].value

    expect(response).toEqual({
      played: true,
    })
    expect(global.Audio).toHaveBeenCalledWith('https://example.com/sound.mp3')
    expect(audio.play).toHaveBeenCalled()
  })

  it('should pause the previous sound before playing a new sound', async () => {
    const { result } = renderHook(() => useTestSound())

    const playSound = result.current.functions.find(
      (fn) => fn.name === 'playSound'
    )

    await act(async () => {
      await playSound.handler({
        url: 'https://example.com/first.mp3',
      })
    })

    const firstAudio = global.Audio.mock.results[0].value

    await act(async () => {
      await playSound.handler({
        url: 'https://example.com/second.mp3',
      })
    })

    expect(firstAudio.pause).toHaveBeenCalled()
    expect(global.Audio).toHaveBeenLastCalledWith(
      'https://example.com/second.mp3'
    )
  })

  it('should not play a sound without a URL', async () => {
    const { result } = renderHook(() => useTestSound())

    const playSound = result.current.functions.find(
      (fn) => fn.name === 'playSound'
    )

    let response

    await act(async () => {
      response = await playSound.handler({
        url: '   ',
      })
    })

    expect(response).toEqual({
      played: false,
    })
    expect(global.Audio).not.toHaveBeenCalled()
  })

  it('should return a message when playback fails', async () => {
    global.Audio = jest.fn().mockImplementation(() => ({
      pause: jest.fn(),
      play: jest.fn().mockRejectedValue(new Error('Playback blocked')),
    }))

    const { result } = renderHook(() => useTestSound())

    const playSound = result.current.functions.find(
      (fn) => fn.name === 'playSound'
    )

    let response

    await act(async () => {
      response = await playSound.handler({
        url: 'https://example.com/sound.mp3',
      })
    })

    expect(response).toEqual({
      played: false,
      message: 'Playback blocked',
    })
  })
})

describe('useAvatar', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    useAvatarTransport.mockReset()
    mockAvatarTransport()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should return no functions or render output when disabled', () => {
    const { result } = renderHook(() => useTestAvatar({ disabled: true }))

    expect(result.current.avatar.functions).toEqual([])
    expect(result.current.avatar.render).toBeNull()
    expect(useAvatarTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        disabled: true,
      })
    )
  })

  it('should load a fullscreen avatar iframe', async () => {
    const { result } = renderHook(() => useTestAvatar())

    const loadAvatarUrl = result.current.avatar.functions.find(
      (fn) => fn.name === 'loadAvatarUrl'
    )

    let response

    await act(async () => {
      response = await loadAvatarUrl.handler({
        url: '  https://avatar.example.com/live  ',
      })
    })

    expect(response).toEqual({
      loaded: true,
    })
    expect(result.current.avatar.render.type).toBe('iframe')
    expect(result.current.avatar.render.props).toMatchObject({
      allow: 'autoplay; camera; microphone; fullscreen',
      src: 'https://avatar.example.com/live',
      title: 'Meeting Avatar (AI Agent)',
    })
    expect(useAvatarTransport).toHaveBeenLastCalledWith(
      expect.objectContaining({
        targetOrigin: 'https://avatar.example.com',
      })
    )
  })

  it('should unload a fullscreen avatar iframe', async () => {
    const { result } = renderHook(() => useTestAvatar())

    const loadAvatarUrl = result.current.avatar.functions.find(
      (fn) => fn.name === 'loadAvatarUrl'
    )
    const unloadAvatarUrl = result.current.avatar.functions.find(
      (fn) => fn.name === 'unloadAvatarUrl'
    )

    await act(async () => {
      await loadAvatarUrl.handler({
        url: 'https://avatar.example.com/live',
      })
    })

    expect(result.current.avatar.render.type).toBe('iframe')

    let response

    await act(async () => {
      response = await unloadAvatarUrl.handler()
    })

    expect(response).toEqual({
      unloaded: true,
    })
    expect(result.current.avatar.render).toBeNull()
  })

  it('should not load an avatar iframe without a URL', async () => {
    const { result } = renderHook(() => useTestAvatar())

    const loadAvatarUrl = result.current.avatar.functions.find(
      (fn) => fn.name === 'loadAvatarUrl'
    )

    let response

    await act(async () => {
      response = await loadAvatarUrl.handler({
        url: '   ',
      })
    })

    expect(response).toEqual({
      loaded: false,
    })
    expect(result.current.avatar.render).toBeNull()
  })

  it('should only expose avatar message sending in team meetings', () => {
    const { rerender, result } = renderHook(
      ({ meetingMode }) => useTestAvatar({ meetingMode }),
      {
        initialProps: {
          meetingMode: 'single',
        },
      }
    )

    expect(result.current.avatar.functions.map((fn) => fn.name)).toEqual([
      'loadAvatarUrl',
      'unloadAvatarUrl',
    ])

    rerender({
      meetingMode: 'team',
    })

    expect(result.current.avatar.functions.map((fn) => fn.name)).toEqual([
      'loadAvatarUrl',
      'unloadAvatarUrl',
      'sendAvatarMessage',
    ])
  })

  it('should send a trimmed user message to the avatar transport', async () => {
    const avatarTransport = mockAvatarTransport({
      sendUserMessage: jest.fn(() => true),
    })

    const { result } = renderHook(() =>
      useTestAvatar({
        meetingMode: 'team',
      })
    )

    const sendAvatarMessage = result.current.avatar.functions.find(
      (fn) => fn.name === 'sendAvatarMessage'
    )

    let response

    await act(async () => {
      response = await sendAvatarMessage.handler({
        participantName: '  Alice  ',
        text: '  Hello avatar  ',
      })
    })

    expect(response).toEqual({
      sent: true,
    })
    expect(avatarTransport.sendUserMessage).toHaveBeenCalledWith({
      participantName: 'Alice',
      text: 'Hello avatar',
    })
  })

  it('should not send an empty avatar message', async () => {
    const avatarTransport = mockAvatarTransport()

    const { result } = renderHook(() =>
      useTestAvatar({
        meetingMode: 'team',
      })
    )

    const sendAvatarMessage = result.current.avatar.functions.find(
      (fn) => fn.name === 'sendAvatarMessage'
    )

    let response

    await act(async () => {
      response = await sendAvatarMessage.handler({
        participantName: 'Alice',
        text: '   ',
      })
    })

    expect(response).toEqual({
      sent: false,
    })
    expect(avatarTransport.sendUserMessage).not.toHaveBeenCalled()
  })

  it('should mute avatar microphone controls in team meetings', () => {
    const avatarTransport = mockAvatarTransport()

    const { rerender } = renderHook(
      ({ meetingMode }) => useTestAvatar({ meetingMode }),
      {
        initialProps: {
          meetingMode: 'single',
        },
      }
    )

    expect(avatarTransport.sendMicControl).toHaveBeenLastCalledWith({
      muted: false,
    })

    rerender({
      meetingMode: 'team',
    })

    expect(avatarTransport.sendMicControl).toHaveBeenLastCalledWith({
      muted: true,
    })

    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(avatarTransport.sendMicControl).toHaveBeenLastCalledWith({
      muted: true,
    })
  })

  it('should interrupt the avatar when a non-bot meeting speaker changes', () => {
    const avatarTransport = mockAvatarTransport()

    const { result } = renderHook(() => useTestAvatar())

    act(() => {
      result.current.meetingEvents.emit({
        type: 'speaker-change',
        participantId: 'alice',
        previousParticipantId: 'bob',
        transcriptEventType: 'transcript.data',
        isBotSpeaker: false,
      })
    })

    expect(avatarTransport.sendInterrupt).toHaveBeenCalledWith({
      reason: 'meeting-turn-changed',
      participantId: 'alice',
      previousParticipantId: 'bob',
    })
  })

  it('should ignore bot speaker changes when interrupting the avatar', () => {
    const avatarTransport = mockAvatarTransport()

    const { result } = renderHook(() => useTestAvatar())

    act(() => {
      result.current.meetingEvents.emit({
        type: 'speaker-change',
        participantId: 'recall-bot-speaker',
        previousParticipantId: 'alice',
        transcriptEventType: 'transcript.data',
        isBotSpeaker: true,
      })
    })

    expect(avatarTransport.sendInterrupt).not.toHaveBeenCalled()
  })
})

describe('useMeetingAgent', () => {
  beforeEach(() => {
    useConversationManager.mockReset()
    mockConversationManager()
  })

  it('should configure the conversation manager for streaming with functions', () => {
    const functions = [
      {
        name: 'testFunction',
      },
    ]

    renderHook(() =>
      useTestMeetingAgent({
        functions,
      })
    )

    expect(useConversationManager).toHaveBeenCalledWith({
      stream: true,
      functions,
    })
  })

  it('should sync function changes into the conversation manager', async () => {
    const setFunctions = jest.fn()

    mockConversationManager({
      setFunctions,
    })

    const initialFunctions = [
      {
        name: 'loadAvatarUrl',
      },
    ]

    const teamFunctions = [
      {
        name: 'loadAvatarUrl',
      },
      {
        name: 'sendAvatarMessage',
      },
    ]

    const { rerender } = renderHook(
      ({ functions }) =>
        useTestMeetingAgent({
          functions,
        }),
      {
        initialProps: {
          functions: initialFunctions,
        },
      }
    )

    await act(async () => {})

    expect(setFunctions).toHaveBeenLastCalledWith(initialFunctions)

    rerender({
      functions: teamFunctions,
    })

    await act(async () => {})

    expect(setFunctions).toHaveBeenLastCalledWith(teamFunctions)
  })

  it('should return conversation control handlers', () => {
    const conversationManager = mockConversationManager({
      abort: jest.fn(),
      setConversationId: jest.fn(),
      setToken: jest.fn(),
    })

    const { result } = renderHook(() => useTestMeetingAgent())

    expect(result.current.agent).toEqual({
      abort: conversationManager.abort,
      setConversationId: conversationManager.setConversationId,
      setToken: conversationManager.setToken,
    })
  })

  it('should send the initial prompt once when credentials are available', async () => {
    const initiateMessage = jest.fn()

    mockConversationManager({
      conversationId: 'conversation_123',
      initiateMessage,
      token: 'token_123',
    })

    const { rerender } = renderHook(
      ({ initialPrompt }) =>
        useTestMeetingAgent({
          initialPrompt,
        }),
      {
        initialProps: {
          initialPrompt: 'Start the meeting.',
        },
      }
    )

    await act(async () => {})

    expect(initiateMessage).toHaveBeenCalledTimes(1)
    expect(initiateMessage).toHaveBeenCalledWith({
      textToUse: 'Start the meeting.',
    })

    rerender({
      initialPrompt: 'Updated prompt.',
    })

    await act(async () => {})

    expect(initiateMessage).toHaveBeenCalledTimes(1)
  })

  it('should not send the initial prompt without conversation credentials', async () => {
    const initiateMessage = jest.fn()

    mockConversationManager({
      conversationId: '',
      initiateMessage,
      token: 'token_123',
    })

    renderHook(() =>
      useTestMeetingAgent({
        initialPrompt: 'Start the meeting.',
      })
    )

    await act(async () => {})

    expect(initiateMessage).not.toHaveBeenCalled()
  })

  it('should send meeting turns from participants to the conversation', async () => {
    const initiateMessage = jest.fn()

    mockConversationManager({
      conversationId: 'conversation_123',
      initiateMessage,
      token: 'token_123',
    })

    const { result } = renderHook(() => useTestMeetingAgent())

    await act(async () => {
      result.current.meetingEvents.emit({
        type: 'meeting-turn',
        source: 'voice',
        participant: {
          id: 'alice',
          name: 'Alice',
        },
        text: 'Can we review the launch plan?',
      })
    })

    expect(initiateMessage).toHaveBeenCalledWith({
      textToUse:
        'A meeting participant (Alice) just said the following in a multi-person meeting:\n\nCan we review the launch plan?',
    })
  })

  it('should label bot meeting turns before sending them to the conversation', async () => {
    const initiateMessage = jest.fn()

    mockConversationManager({
      conversationId: 'conversation_123',
      initiateMessage,
      token: 'token_123',
    })

    const { result } = renderHook(() => useTestMeetingAgent())

    await act(async () => {
      result.current.meetingEvents.emit({
        type: 'meeting-turn',
        source: 'voice',
        participant: {
          id: 'agent',
          isBot: true,
          name: 'Meeting Agent',
        },
        text: 'I found the answer.',
      })
    })

    expect(initiateMessage).toHaveBeenCalledWith({
      textToUse:
        'An AI agent (Meeting Agent) just said the following in a multi-person meeting:\n\nI found the answer.',
    })
  })

  it('should label chat meeting turns before sending them to the conversation', async () => {
    const initiateMessage = jest.fn()

    mockConversationManager({
      conversationId: 'conversation_123',
      initiateMessage,
      token: 'token_123',
    })

    const { result } = renderHook(() => useTestMeetingAgent())

    await act(async () => {
      result.current.meetingEvents.emit({
        type: 'meeting-turn',
        source: 'chat',
        participant: {
          id: 'alice',
          name: 'Alice',
        },
        text: 'Link is in chat.',
      })
    })

    expect(initiateMessage).toHaveBeenCalledWith({
      textToUse:
        'A meeting participant (Alice) just sent the following chat message in a multi-person meeting:\n\nLink is in chat.',
    })
  })

  it('should skip meeting turns without credentials or text', async () => {
    const initiateMessage = jest.fn()

    mockConversationManager({
      conversationId: 'conversation_123',
      initiateMessage,
      token: '',
    })

    const { result } = renderHook(() => useTestMeetingAgent())

    await act(async () => {
      result.current.meetingEvents.emit({
        type: 'meeting-turn',
        source: 'voice',
        participant: {
          id: 'alice',
          name: 'Alice',
        },
        text: 'Hello',
      })

      result.current.meetingEvents.emit({
        type: 'meeting-turn',
        source: 'voice',
        participant: {
          id: 'alice',
          name: 'Alice',
        },
        text: '',
      })
    })

    expect(initiateMessage).not.toHaveBeenCalled()
  })
})

describe('useRecallMeetingMode', () => {
  const botParticipant = {
    id: String(RECALL_BOT_OUTPUT_SPEAKER_ID),
    name: 'Avatar',
  }

  it('should start in single mode with the meeting bot present', () => {
    const { result } = renderHook(() => useTestRecallMeetingMode())

    expect(result.current.meetingMode).toEqual({
      mode: 'single',
      participantCount: 1,
      participants: [botParticipant],
    })
  })

  it('should treat agent plus one participant in the meeting as a single meeting', () => {
    const { result } = renderHook(() => useTestRecallMeetingMode())

    act(() => {
      result.current.meetingEvents.emit(
        seedEvent([
          { id: RECALL_BOT_OUTPUT_SPEAKER_ID, isBot: true, name: 'Avatar' },
          { id: 'alice', name: 'Alice' },
        ])
      )
    })

    expect(result.current.meetingMode).toEqual({
      mode: 'single',
      participantCount: 2,
      participants: [
        botParticipant,
        { id: 'alice', name: 'Alice' },
      ],
    })
  })

  it('should treat more than two participants in the meeting as a team meeting', () => {
    const { result } = renderHook(() => useTestRecallMeetingMode())

    act(() => {
      result.current.meetingEvents.emit(
        seedEvent([
          { id: RECALL_BOT_OUTPUT_SPEAKER_ID, isBot: true, name: 'Avatar' },
          { id: 'alice', name: 'Alice' },
          { id: 'bob', name: 'Bob' },
        ])
      )
    })

    expect(result.current.meetingMode.mode).toBe('team')
    expect(result.current.meetingMode.participantCount).toBe(3)
  })

  it('should remove participants who leave when computing meeting mode', () => {
    const { result } = renderHook(() => useTestRecallMeetingMode())

    act(() => {
      result.current.meetingEvents.emit(
        seedEvent([
          { id: RECALL_BOT_OUTPUT_SPEAKER_ID, isBot: true, name: 'Avatar' },
          { id: 2, name: 'Alice' },
          { id: 3, name: 'Bob' },
        ])
      )
      result.current.meetingEvents.emit(
        participantEvent('participant_events.leave', {
          id: 3,
          name: 'Bob',
        })
      )
    })

    expect(result.current.meetingMode).toEqual({
      mode: 'single',
      participantCount: 2,
      participants: [
        botParticipant,
        { id: '2', name: 'Alice' },
      ],
    })
  })

  it('should update mode when participants join and leave', () => {
    const { result } = renderHook(() => useTestRecallMeetingMode())

    act(() => {
      result.current.meetingEvents.emit(
        participantEvent('participant_events.join', {
          id: 2,
          name: 'Alice',
        })
      )
      result.current.meetingEvents.emit(
        participantEvent('participant_events.join', {
          id: 3,
          name: 'Bob',
        })
      )
    })

    expect(result.current.meetingMode.mode).toBe('team')
    expect(result.current.meetingMode.participantCount).toBe(3)

    act(() => {
      result.current.meetingEvents.emit(
        participantEvent('participant_events.leave', {
          id: 3,
          name: 'Bob',
        })
      )
    })

    expect(result.current.meetingMode.mode).toBe('single')
    expect(result.current.meetingMode.participantCount).toBe(2)
  })

  it('should track participants from the typed realtime data payload', () => {
    const { result } = renderHook(() => useTestRecallMeetingMode())

    act(() => {
      result.current.meetingEvents.emit(
        participantEvent('participant_events.join', {
          id: 1,
          name: 'Alice',
        })
      )
    })

    expect(result.current.meetingMode).toEqual({
      mode: 'single',
      participantCount: 2,
      participants: [botParticipant, { id: '1', name: 'Alice' }],
    })
  })

  it('should remove participants that leave the meeting', () => {
    const { result } = renderHook(() => useTestRecallMeetingMode())

    act(() => {
      result.current.meetingEvents.emit(
        seedEvent([
          { id: RECALL_BOT_OUTPUT_SPEAKER_ID, isBot: true, name: 'Avatar' },
          { id: 2, name: 'Alice' },
          { id: 3, name: 'Bob' },
        ])
      )
    })

    expect(result.current.meetingMode.mode).toBe('team')

    act(() => {
      result.current.meetingEvents.emit(
        participantEvent('participant_events.leave', {
          id: 3,
          name: 'Bob',
        })
      )
    })

    expect(result.current.meetingMode).toEqual({
      mode: 'single',
      participantCount: 2,
      participants: [
        botParticipant,
        { id: '2', name: 'Alice' },
      ],
    })
  })

  it('should track participants in the meeting discovered from transcript events', () => {
    const { result } = renderHook(() => useTestRecallMeetingMode())

    act(() => {
      result.current.meetingEvents.emit(
        transcriptEvent({
          id: RECALL_BOT_OUTPUT_SPEAKER_ID,
          name: 'Avatar',
        })
      )
      result.current.meetingEvents.emit(
        transcriptEvent({
          id: 2,
          name: 'Alice A.',
        })
      )
      result.current.meetingEvents.emit(
        transcriptEvent({
          id: 3,
          name: 'Bob B.',
        })
      )
    })

    expect(result.current.meetingMode).toEqual({
      mode: 'team',
      participantCount: 3,
      participants: [
        botParticipant,
        { id: '2', name: 'Alice A.' },
        { id: '3', name: 'Bob B.' },
      ],
    })
  })

  it('should track participants in the meeting discovered from chat events', () => {
    const { result } = renderHook(() => useTestRecallMeetingMode())

    act(() => {
      result.current.meetingEvents.emit(
        recallChatMessageEvent({
          participant: {
            id: 1,
            name: 'Alice',
          },
          text: 'I am already here.',
        })
      )
      result.current.meetingEvents.emit(
        recallChatMessageEvent({
          participant: {
            id: 2,
            name: 'Bob',
          },
          text: 'Same here.',
        })
      )
    })

    expect(result.current.meetingMode).toEqual({
      mode: 'team',
      participantCount: 3,
      participants: [
        botParticipant,
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Bob' },
      ],
    })
  })

  it('should ignore participant events without participant ids', () => {
    const { result } = renderHook(() => useTestRecallMeetingMode())

    act(() => {
      const payload = {
        participant: {
          name: '',
        },
      }

      result.current.meetingEvents.emit({
        type: 'recall-participant',
        envelope: {
          message: {
            data: {
              data: payload,
            },
          },
          type: 'participant_events.join',
        },
        payload,
      })
    })

    expect(result.current.meetingMode).toEqual({
      mode: 'single',
      participantCount: 1,
      participants: [botParticipant],
    })
  })
})

describe('useRecallRealtimeEvents', () => {
  let originalWebSocket
  let sockets

  class MockWebSocket {
    static CONNECTING = 0
    static OPEN = 1

    constructor(url) {
      this.url = url
      this.readyState = MockWebSocket.CONNECTING
      this.close = jest.fn(() => {
        this.readyState = 3
      })

      sockets.push(this)
    }
  }

  beforeEach(() => {
    jest.useFakeTimers()

    sockets = []
    originalWebSocket = global.WebSocket
    global.WebSocket = MockWebSocket
  })

  afterEach(() => {
    global.WebSocket = originalWebSocket

    jest.useRealTimers()
  })

  it('should connect to the relay URL', () => {
    renderHook(() =>
      useTestRecallRealtimeEvents({
        relayUrl: 'wss://relay.test/channel',
      })
    )

    act(() => {
      jest.runOnlyPendingTimers()
    })

    expect(sockets).toHaveLength(1)
    expect(sockets[0].url).toBe('wss://relay.test/channel')
  })

  it('should emit recall participant events from participant relay messages', () => {
    const receivedEvents = []

    const { result } = renderHook(() =>
      useTestRecallRealtimeEvents({
        relayUrl: 'wss://relay.test/channel',
      })
    )

    result.current.meetingEvents.subscribe((event) => {
      receivedEvents.push(event)
    })

    act(() => {
      jest.runOnlyPendingTimers()

      sockets[0].onmessage({
        data: JSON.stringify({
          event: 'participant_events.join',
          data: recallRealtimeData(
            {
              participant: recallParticipant({
                id: 1,
                name: 'Alice',
              }),
              timestamp: recallTimestamp(),
              data: null,
            },
            'participant_events'
          ),
        }),
      })
    })

    expect(receivedEvents).toHaveLength(1)
    expect(receivedEvents[0]).toMatchObject({
      type: 'recall-participant',
      envelope: {
        type: 'participant_events.join',
      },
      payload: {
        participant: expect.objectContaining({
          id: 1,
          name: 'Alice',
        }),
      },
    })
  })

  it('should emit recall transcript events with joined transcript text', () => {
    const receivedEvents = []

    const { result } = renderHook(() =>
      useTestRecallRealtimeEvents({
        relayUrl: 'wss://relay.test/channel',
      })
    )

    result.current.meetingEvents.subscribe((event) => {
      receivedEvents.push(event)
    })

    act(() => {
      jest.runOnlyPendingTimers()

      sockets[0].onmessage({
        data: JSON.stringify({
          event: 'transcript.data',
          data: recallRealtimeData(
            {
              participant: recallParticipant({
                id: 1,
                name: 'Alice',
              }),
              words: [
                {
                  text: 'Hello',
                  start_timestamp: { relative: 0 },
                  end_timestamp: { relative: 1 },
                },
                {
                  text: 'world',
                  start_timestamp: { relative: 1 },
                  end_timestamp: { relative: 2 },
                },
              ],
            },
            'transcript'
          ),
        }),
      })
    })

    expect(receivedEvents).toHaveLength(1)
    expect(receivedEvents[0]).toMatchObject({
      type: 'recall-transcript',
      envelope: {
        type: 'transcript.data',
      },
      payload: {
        words: [{ text: 'Hello' }, { text: 'world' }],
      },
    })
  })

  it('should read transcript text from typed realtime data payloads', () => {
    const receivedEvents = []

    const { result } = renderHook(() =>
      useTestRecallRealtimeEvents({
        relayUrl: 'wss://relay.test/channel',
      })
    )

    result.current.meetingEvents.subscribe((event) => {
      receivedEvents.push(event)
    })

    act(() => {
      jest.runOnlyPendingTimers()

      sockets[0].onmessage({
        data: JSON.stringify({
          event: 'transcript.data',
          ...recallRealtimePayload({
            participant: recallParticipant({
              id: 1,
              name: 'Alice',
            }),
            words: [
              {
                text: 'Typed',
                start_timestamp: { relative: 0 },
                end_timestamp: { relative: 1 },
              },
              {
                text: 'payload',
                start_timestamp: { relative: 1 },
                end_timestamp: { relative: 2 },
              },
            ],
          }),
        }),
      })
    })

    expect(receivedEvents).toHaveLength(1)
    expect(receivedEvents[0]).toMatchObject({
      type: 'recall-transcript',
      envelope: {
        type: 'transcript.data',
      },
      payload: {
        words: [{ text: 'Typed' }, { text: 'payload' }],
      },
    })
  })

  it('should emit recall message events with chat text', () => {
    const receivedEvents = []

    const { result } = renderHook(() =>
      useTestRecallRealtimeEvents({
        relayUrl: 'wss://relay.test/channel',
      })
    )

    result.current.meetingEvents.subscribe((event) => {
      receivedEvents.push(event)
    })

    act(() => {
      jest.runOnlyPendingTimers()

      sockets[0].onmessage({
        data: JSON.stringify({
          event: 'participant_events.chat_message',
          data: recallRealtimeData(
            {
              participant: recallParticipant({
                id: 1,
                name: 'Alice',
              }),
              timestamp: recallTimestamp(),
              data: {
                text: 'Link is in chat',
                to: 'everyone',
              },
            },
            'participant_events'
          ),
        }),
      })
    })

    expect(receivedEvents).toHaveLength(1)
    expect(receivedEvents[0]).toMatchObject({
      type: 'recall-message',
      envelope: {
        type: 'participant_events.chat_message',
      },
      payload: {
        data: {
          text: 'Link is in chat',
        },
      },
    })
  })

  it('should not emit meeting events for relay or malformed messages', () => {
    const receivedEvents = []

    const { result } = renderHook(() =>
      useTestRecallRealtimeEvents({
        relayUrl: 'wss://relay.test/channel',
      })
    )

    result.current.meetingEvents.subscribe((event) => {
      receivedEvents.push(event)
    })

    act(() => {
      jest.runOnlyPendingTimers()

      sockets[0].onmessage({
        data: JSON.stringify({
          event: 'relay.ping',
        }),
      })

      sockets[0].onmessage({
        data: 'not-json',
      })
    })

    expect(receivedEvents).toEqual([])
  })

  it('should close an open websocket on unmount', () => {
    const { unmount } = renderHook(() =>
      useTestRecallRealtimeEvents({
        relayUrl: 'wss://relay.test/channel',
      })
    )

    act(() => {
      jest.runOnlyPendingTimers()
    })

    sockets[0].readyState = MockWebSocket.OPEN

    unmount()

    expect(sockets[0].close).toHaveBeenCalledTimes(1)
  })
})

describe('useMeetingController', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should emit a speaker change and meeting turn for transcript data', () => {
    const receivedEvents = []
    const onEvent = jest.fn((event) => {
      receivedEvents.push(event)
    })

    const { result } = renderHook(() => useTestMeetingController({ onEvent }))

    act(() => {
      result.current.meetingEvents.emit(
        recallTranscriptEvent({
          participant: {
            id: 1,
            name: 'Alice',
          },
          text: 'Hello there',
        })
      )
    })

    expect(receivedEvents).toContainEqual(
      expect.objectContaining({
        isBotSpeaker: false,
        participantId: '1',
        previousParticipantId: '',
        transcriptEventType: 'transcript.data',
        type: 'speaker-change',
      })
    )

    act(() => {
      jest.advanceTimersByTime(1200)
    })

    expect(receivedEvents).toContainEqual(
      expect.objectContaining({
        text: 'Hello there',
        type: 'meeting-turn',
        participant: expect.objectContaining({
          id: '1',
          name: 'Alice',
        }),
      })
    )
  })

  it('should emit transcript turns from the typed realtime data payload', () => {
    const receivedEvents = []
    const onEvent = jest.fn((event) => {
      receivedEvents.push(event)
    })

    const { result } = renderHook(() => useTestMeetingController({ onEvent }))

    act(() => {
      result.current.meetingEvents.emit(
        recallTranscriptEvent({
          participant: {
            id: 1,
            name: 'Alice',
          },
          text: 'Hello again',
        })
      )

      jest.advanceTimersByTime(1200)
    })

    expect(receivedEvents).toContainEqual(
      expect.objectContaining({
        source: 'voice',
        text: 'Hello again',
        type: 'meeting-turn',
        participant: expect.objectContaining({
          id: '1',
          name: 'Alice',
        }),
      })
    )
  })

  it('should not emit meeting turns for partial transcript data', () => {
    const receivedEvents = []
    const onEvent = jest.fn((event) => {
      receivedEvents.push(event)
    })

    const { result } = renderHook(() => useTestMeetingController({ onEvent }))

    act(() => {
      result.current.meetingEvents.emit(
        recallTranscriptEvent({
          participant: {
            id: 1,
            name: 'Alice',
          },
          text: 'Thinking',
          type: 'transcript.partial_data',
        })
      )

      jest.advanceTimersByTime(1200)
    })

    expect(receivedEvents).toContainEqual(
      expect.objectContaining({
        participantId: '1',
        type: 'speaker-change',
      })
    )
    expect(receivedEvents).not.toContainEqual(
      expect.objectContaining({
        type: 'meeting-turn',
      })
    )
  })

  it('should merge consecutive transcript data into one meeting turn', () => {
    const receivedEvents = []
    const onEvent = jest.fn((event) => {
      receivedEvents.push(event)
    })

    const { result } = renderHook(() => useTestMeetingController({ onEvent }))

    act(() => {
      result.current.meetingEvents.emit(
        recallTranscriptEvent({
          participant: {
            id: 1,
            name: 'Alice',
          },
          text: 'Hello',
        })
      )

      result.current.meetingEvents.emit(
        recallTranscriptEvent({
          participant: {
            id: 1,
            name: 'Alice',
          },
          text: 'again',
        })
      )

      jest.advanceTimersByTime(1200)
    })

    expect(receivedEvents).toContainEqual(
      expect.objectContaining({
        text: 'Hello again',
        source: 'voice',
        type: 'meeting-turn',
      })
    )
  })

  it('should emit chat messages as immediate meeting turns', () => {
    const receivedEvents = []
    const onEvent = jest.fn((event) => {
      receivedEvents.push(event)
    })

    const { result } = renderHook(() => useTestMeetingController({ onEvent }))

    act(() => {
      result.current.meetingEvents.emit(
        recallChatMessageEvent({
          participant: {
            id: 1,
            name: 'Alice',
          },
          text: 'Please see the doc I shared.',
        })
      )
    })

    expect(receivedEvents).toContainEqual(
      expect.objectContaining({
        source: 'chat',
        text: 'Please see the doc I shared.',
        type: 'meeting-turn',
        participant: expect.objectContaining({
          id: '1',
          name: 'Alice',
        }),
      })
    )
  })

  it('should read chat text from Recall chat message payloads', () => {
    const receivedEvents = []
    const onEvent = jest.fn((event) => {
      receivedEvents.push(event)
    })

    const { result } = renderHook(() => useTestMeetingController({ onEvent }))

    act(() => {
      result.current.meetingEvents.emit(
        recallChatMessageEvent({
          participant: {
            id: 1,
            name: 'Alice',
          },
          text: 'Nested chat text.',
        })
      )
    })

    expect(receivedEvents).toContainEqual(
      expect.objectContaining({
        source: 'chat',
        text: 'Nested chat text.',
        type: 'meeting-turn',
        participant: expect.objectContaining({
          id: '1',
          name: 'Alice',
        }),
      })
    )
  })

  it('should read chat turns from the typed realtime data payload', () => {
    const receivedEvents = []
    const onEvent = jest.fn((event) => {
      receivedEvents.push(event)
    })

    const { result } = renderHook(() => useTestMeetingController({ onEvent }))

    act(() => {
      result.current.meetingEvents.emit(
        recallChatMessageEvent({
          participant: {
            id: 1,
            name: 'Alice',
          },
          text: 'Typed chat text.',
        })
      )
    })

    expect(receivedEvents).toContainEqual(
      expect.objectContaining({
        source: 'chat',
        text: 'Typed chat text.',
        type: 'meeting-turn',
        participant: expect.objectContaining({
          id: '1',
          name: 'Alice',
        }),
      })
    )
  })

  it('should wait for buffered speech before emitting chat message turns', () => {
    const receivedEvents = []
    const onEvent = jest.fn((event) => {
      receivedEvents.push(event)
    })

    const { result } = renderHook(() => useTestMeetingController({ onEvent }))

    act(() => {
      result.current.meetingEvents.emit(
        recallTranscriptEvent({
          participant: {
            id: 1,
            name: 'Alice',
          },
          text: 'I am still talking',
        })
      )

      result.current.meetingEvents.emit(
        recallChatMessageEvent({
          participant: {
            id: 2,
            name: 'Bob',
          },
          text: 'Side note from chat.',
        })
      )

      jest.advanceTimersByTime(1199)
    })

    expect(receivedEvents).not.toContainEqual(
      expect.objectContaining({
        source: 'chat',
        type: 'meeting-turn',
      })
    )

    act(() => {
      jest.advanceTimersByTime(1)
    })

    const meetingTurns = receivedEvents.filter(
      (event) => event.type === 'meeting-turn'
    )

    expect(meetingTurns).toEqual([
      expect.objectContaining({
        source: 'voice',
        text: 'I am still talking',
      }),
      expect.objectContaining({
        source: 'chat',
        text: 'Side note from chat.',
      }),
    ])
  })

  it('should normalize Recall bot speaker transcript events', () => {
    const receivedEvents = []
    const onEvent = jest.fn((event) => {
      receivedEvents.push(event)
    })

    const { result } = renderHook(() => useTestMeetingController({ onEvent }))

    act(() => {
      result.current.meetingEvents.emit(
        recallTranscriptEvent({
          participant: {
            id: RECALL_BOT_OUTPUT_SPEAKER_ID,
            name: 'Recall output',
          },
          text: 'Agent speaking',
        })
      )

      jest.advanceTimersByTime(1200)
    })

    expect(receivedEvents).toContainEqual(
      expect.objectContaining({
        isBotSpeaker: true,
        participantId: `recall-bot-speaker-${RECALL_BOT_OUTPUT_SPEAKER_ID}`,
        type: 'speaker-change',
      })
    )
    expect(receivedEvents).toContainEqual(
      expect.objectContaining({
        participant: expect.objectContaining({
          id: `recall-bot-speaker-${RECALL_BOT_OUTPUT_SPEAKER_ID}`,
          isBot: true,
          name: 'Recall output',
        }),
        text: 'Agent speaking',
        type: 'meeting-turn',
      })
    )
  })

  it('should not emit derived events when disabled', () => {
    const receivedEvents = []
    const onEvent = jest.fn((event) => {
      receivedEvents.push(event)
    })

    const { result } = renderHook(() =>
      useTestMeetingController({ disabled: true, onEvent })
    )

    act(() => {
      result.current.meetingEvents.emit(
        recallTranscriptEvent({
          text: 'Hello',
        })
      )

      jest.advanceTimersByTime(1200)
    })

    expect(receivedEvents).toEqual([
      expect.objectContaining({
        type: 'recall-transcript',
      }),
    ])
  })
})

describe('useRecallFrameSession', () => {
  beforeEach(() => {
    fetch.mockReset()
  })

  it('should create a Recall frame session and seed the meeting', async () => {
    const meeting = {
      participants: [
        { id: 'agent', name: 'Avatar' },
        { id: 'alice', name: 'Alice' },
        { id: 123, name: 'Numeric Participant' },
        { id: null, name: 'Invalid Participant' },
      ],
    }

    fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        conversationId: 'conversation_123',
        meeting,
        token: 'token_123',
      }),
    })

    const onEvent = jest.fn()
    const setConversationId = jest.fn()
    const setToken = jest.fn()

    renderHook(() =>
      useTestRecallFrameSession({
        onEvent,
        sessionCreateUrl: '/api/session/create',
        sessionId: 'session_123',
        setConversationId,
        setToken,
      })
    )

    await act(async () => {})

    expect(fetch).toHaveBeenCalledWith('/api/session/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: 'session_123',
      }),
    })
    expect(onEvent).toHaveBeenCalledWith({
      type: 'meeting-seed',
      meeting: {
        participants: [
          { id: 'agent', name: 'Avatar' },
          { id: 'alice', name: 'Alice' },
          { id: '123', name: 'Numeric Participant' },
        ],
      },
    })
    expect(setConversationId).toHaveBeenCalledWith('conversation_123')
    expect(setToken).toHaveBeenCalledWith('token_123')
  })

  it('should skip session creation when sessionId is missing', async () => {
    const onEvent = jest.fn()
    const setConversationId = jest.fn()
    const setToken = jest.fn()

    renderHook(() =>
      useTestRecallFrameSession({
        onEvent,
        sessionId: '',
        setConversationId,
        setToken,
      })
    )

    await act(async () => {})

    expect(fetch).not.toHaveBeenCalled()
    expect(onEvent).not.toHaveBeenCalled()
    expect(setConversationId).not.toHaveBeenCalled()
    expect(setToken).not.toHaveBeenCalled()
  })

  it('should discard session creation results after unmount', async () => {
    const response = createDeferred()

    fetch.mockResolvedValue({
      ok: true,
      json: jest.fn(() => response.promise),
    })

    const onEvent = jest.fn()
    const setConversationId = jest.fn()
    const setToken = jest.fn()

    const { unmount } = renderHook(() =>
      useTestRecallFrameSession({
        onEvent,
        setConversationId,
        setToken,
      })
    )

    await act(async () => {})

    unmount()

    await act(async () => {
      response.resolve({
        conversationId: 'conversation_123',
        meeting: { participants: [] },
        token: 'token_123',
      })
    })

    expect(onEvent).not.toHaveBeenCalled()
    expect(setConversationId).not.toHaveBeenCalled()
    expect(setToken).not.toHaveBeenCalled()
  })

  it('should not recreate the session when rerendered with the same session key', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        conversationId: 'conversation_123',
        meeting: { participants: [] },
        token: 'token_123',
      }),
    })

    const abort = jest.fn()
    const onEvent = jest.fn()
    const setConversationId = jest.fn()
    const setToken = jest.fn()

    const props = {
      abort,
      onEvent,
      sessionCreateUrl: '/api/session/create',
      sessionId: 'session_123',
      setConversationId,
      setToken,
    }

    const { rerender } = renderHook(
      (hookProps) => useTestRecallFrameSession(hookProps),
      {
        initialProps: props,
      }
    )

    await act(async () => {})

    rerender(props)

    await act(async () => {})

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('should create a new session when the sessionId changes', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          conversationId: 'conversation_123',
          meeting: { participants: [] },
          token: 'token_123',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          conversationId: 'conversation_456',
          meeting: { participants: [] },
          token: 'token_456',
        }),
      })

    const abort = jest.fn()
    const onEvent = jest.fn()
    const setConversationId = jest.fn()
    const setToken = jest.fn()

    const { rerender } = renderHook(
      (hookProps) => useTestRecallFrameSession(hookProps),
      {
        initialProps: {
          abort,
          onEvent,
          sessionCreateUrl: '/api/session/create',
          sessionId: 'session_123',
          setConversationId,
          setToken,
        },
      }
    )

    await act(async () => {})

    rerender({
      abort,
      onEvent,
      sessionCreateUrl: '/api/session/create',
      sessionId: 'session_456',
      setConversationId,
      setToken,
    })

    await act(async () => {})

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      '/api/session/create',
      expect.objectContaining({
        body: JSON.stringify({
          sessionId: 'session_456',
        }),
      })
    )
    expect(setConversationId).toHaveBeenLastCalledWith('conversation_456')
    expect(setToken).toHaveBeenLastCalledWith('token_456')
  })

  it('should abort the meeting conversation on unmount', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        conversationId: 'conversation_123',
        meeting: { participants: [] },
        token: 'token_123',
      }),
    })

    const abort = jest.fn()

    const { unmount } = renderHook(() =>
      useTestRecallFrameSession({
        abort,
      })
    )

    await act(async () => {})

    unmount()

    expect(abort).toHaveBeenCalledWith({
      reason: 'Recall frame unmounted',
    })
  })

  it('should not seed or set credentials when session creation fails', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: jest.fn().mockResolvedValue({
        message: 'Session failed',
      }),
    })

    const onEvent = jest.fn()
    const setConversationId = jest.fn()
    const setToken = jest.fn()

    renderHook(() =>
      useTestRecallFrameSession({
        onEvent,
        setConversationId,
        setToken,
      })
    )

    await act(async () => {})

    expect(onEvent).not.toHaveBeenCalled()
    expect(setConversationId).not.toHaveBeenCalled()
    expect(setToken).not.toHaveBeenCalled()
  })
})
