'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { errorToErrorResponse } from '@/lib/error'
import { throwUnprocessableEntity } from '@/lib/response'
import toast from '@/lib/toast'

import { useApp } from '@/layouts/App'

import Portal from '@/components/Portal'

import useCodeAction from '@/hooks/useCodeAction'
import useRouter from '@/hooks/useRouter'

import manifest from './app.manifest'
import { APP_NAME } from './const'
import { appendContext, ask, startNoteStream } from './server'

import {
  ArrowsPointingOutIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline'

import clsx from 'clsx'

// The route base for this app. Note streams live at `${APP_PATH}/<id>`. We use
// the manifest start path rather than APP_NAME because APP_NAME is the internal
// slug ('record'), not the URL segment ('95ca8b4c').
const APP_PATH = manifest.start

export function AudioVisualizer({
  analyserRef,

  isRecording,

  className,

  children,

  ...props
}) {
  const containerRef = useRef(null)

  const [barCount, setBarCount] = useState(50)

  const [audioData, setAudioData] = useState(Array(200).fill(0))

  const animationFrameRef = useRef(null)

  useEffect(() => {
    const updateBarCount = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth
        const count = Math.floor(width / 4)

        setBarCount(Math.max(10, count))
      }
    }

    updateBarCount()

    const resizeObserver = new window.ResizeObserver(updateBarCount)

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => resizeObserver.disconnect()
  }, [])

  useEffect(() => {
    if (!isRecording || !analyserRef?.current) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }

      return
    }

    const bufferLength = analyserRef.current.frequencyBinCount

    const dataArray = new Uint8Array(bufferLength)

    const updateWaveform = () => {
      if (!analyserRef.current) {
        return
      }

      analyserRef.current.getByteFrequencyData(dataArray)

      const speechFrequencies = Array.from(dataArray.slice(0, 20))

      const avgMagnitude =
        speechFrequencies.reduce((sum, val) => sum + val, 0) /
        speechFrequencies.length

      setAudioData((prev) => {
        const newData = [...prev.slice(1), avgMagnitude]

        return newData
      })

      animationFrameRef.current = requestAnimationFrame(updateWaveform)
    }

    updateWaveform()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isRecording, analyserRef])

  const bars = Array.from({ length: barCount }, (_, i) => {
    const idx = audioData.length - barCount + i

    return idx >= 0 ? audioData[idx] : 0
  })

  return (
    <div
      {...props}
      ref={containerRef}
      className={clsx(
        'flex-1 flex items-center gap-[1px] overflow-hidden h-4',
        className
      )}
    >
      {bars.map((value, index) => (
        <div
          key={index}
          className={clsx('shrink-0', 'w-[3px]', 'rounded', {
            'bg-red-500': isRecording,
            'bg-gray-400': !isRecording,
          })}
          style={{
            height: `${Math.max(10, (value / 255) * 100)}%`,
          }}
        />
      ))}
      {children}
    </div>
  )
}

export function AudioBar({
  isRecording,

  elapsedTime,

  analyserRef,

  onToggle,

  className,

  children,

  ...props
}) {
  const { toggleInfobar } = useApp()

  return (
    <div
      {...props}
      className={clsx(
        'flex flex-row gap-4 items-center',
        'w-full',
        'p-2 pl-4',
        'auto-bg-gray-100',
        'rounded-full',
        className
      )}
    >
      <AudioVisualizer
        className="cursor-pointer"
        analyserRef={analyserRef}
        isRecording={isRecording}
        onClick={() => {
          toggleInfobar('33%')
        }}
      />
      <div className="auto-text-gray-700 min-w-[48px] text-center">
        {elapsedTime}
      </div>
      {children}
      <button
        className={clsx(
          'flex flex-row justify-center items-center h-8',
          'text-white px-4 rounded-full text-sm font-semibold transition-colors',
          {
            'bg-red-500': isRecording,
            'bg-green-500': !isRecording,
          }
        )}
        type="button"
        onClick={onToggle}
      >
        <span>{isRecording ? 'Stop' : 'Record'}</span>
      </button>
    </div>
  )
}

export function TranscriptionViewer({
  transcripts,

  className,

  children,

  ...props
}) {
  const { toggleInfobar } = useApp()

  const last =
    transcripts.length > 0 ? transcripts[transcripts.length - 1] : null

  return (
    <>
      {last?.text ? (
        <div
          {...props}
          className={clsx(
            'group relative',
            'bg-white/90 dark:bg-black/90',
            'rounded-xl',
            'p-5',
            'border auto-border-gray-200',
            'shadow-sm',
            'cursor-pointer',
            'transition-all duration-200',
            'hover:shadow-md hover:auto-border-gray-300 hover:ring-2 hover:ring-blue-500/20',
            className
          )}
          onClick={() => {
            toggleInfobar('33%')
          }}
        >
          <ExpandHint label="Live transcript" />
          <div className="auto-text-gray-800 break-words line-clamp-4">
            {last.text}
          </div>
          {children}
        </div>
      ) : null}
    </>
  )
}

/**
 * A header affordance that makes the surrounding card read as a clickable panel
 * which expands into the side bar. The "expand" cue strengthens on hover.
 */
function ExpandHint({ label }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <span className="text-[11px] font-medium uppercase tracking-wide auto-text-gray-400">
        {label}
      </span>
      <span className="inline-flex items-center gap-1 text-xs auto-text-gray-400 transition-colors group-hover:text-blue-500">
        <ArrowsPointingOutIcon className="w-3.5 h-3.5" />
        View all
      </span>
    </div>
  )
}

export function TranscriptionBar({
  transcripts,

  asks = [],

  className,

  children,

  ...props
}) {
  return (
    <Portal query="#app-infobar-content-top">
      <div
        {...props}
        className={clsx('p-5 prose dark:prose-invert prose-xs', className)}
      >
        {asks.length ? (
          <>
            <h3>Questions</h3>
            {asks.map((item, index) => (
              <div key={index} className="not-prose mb-3">
                <div className="text-xs font-medium auto-text-gray-500">
                  {item.question}
                </div>
                <div className="text-sm auto-text-gray-800 whitespace-pre-wrap">
                  {item.text}
                </div>
              </div>
            ))}
            <h3>Transcript</h3>
          </>
        ) : null}
        {transcripts.map((transcript, index) => (
          <div key={index}>
            <div className="tag mr-2">
              {transcript.timestamp
                ? new Date(transcript.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })
                : ''}
            </div>
            <p>{transcript.text}</p>
          </div>
        ))}
      </div>
      {children}
    </Portal>
  )
}

export function AnswerViewer({ answer, className, children, ...props }) {
  const { toggleInfobar } = useApp()

  if (!answer) {
    return null
  }

  return (
    <div
      {...props}
      className={clsx(
        'group relative',
        'bg-white/90 dark:bg-black/90',
        'rounded-xl',
        'p-5',
        'border auto-border-gray-200',
        'shadow-sm',
        'cursor-pointer',
        'space-y-2',
        'transition-all duration-200',
        'hover:shadow-md hover:auto-border-gray-300 hover:ring-2 hover:ring-blue-500/20',
        className
      )}
      onClick={() => {
        toggleInfobar('33%')
      }}
    >
      <ExpandHint label="Answer" />
      <div className="text-xs font-medium auto-text-gray-500 line-clamp-1">
        {answer.question}
      </div>
      <div className="auto-text-gray-800 break-words whitespace-pre-wrap line-clamp-6">
        {answer.pending ? 'Thinking…' : answer.text || 'No answer.'}
      </div>
      {children}
    </div>
  )
}

export function AskBar({
  value,

  onChange,

  onSubmit,

  disabled,

  pending,

  className,

  ...props
}) {
  return (
    <form
      {...props}
      className={clsx(
        'flex flex-row gap-2 items-center',
        'w-full',
        'p-2 pl-4',
        'auto-bg-gray-100',
        'rounded-full',
        className
      )}
      onSubmit={onSubmit}
    >
      <input
        className={clsx(
          'flex-1 bg-transparent border-0 focus:ring-0 focus:outline-none',
          'auto-text-gray-800 placeholder:auto-text-gray-400 text-sm'
        )}
        type="text"
        value={value}
        placeholder="Ask about what's being said…"
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
      <button
        className={clsx(
          'flex flex-row justify-center items-center h-8 w-8',
          'rounded-full transition-colors',
          'text-white',
          {
            'bg-gray-300 cursor-not-allowed': disabled || pending,
            'bg-blue-500 hover:bg-blue-600': !disabled && !pending,
          }
        )}
        type="submit"
        disabled={disabled || pending}
        aria-label="Ask"
      >
        <PaperAirplaneIcon className="w-4 h-4" />
      </button>
    </form>
  )
}

/**
 * @param {{
 *   noteStreams?: Array<{
 *     id: string
 *     name?: string
 *     description?: string
 *     createdAt?: string | number
 *     updatedAt?: string | number
 *   }>
 *   children?: import('react').ReactNode
 * }} props
 */
export function Main({ noteStreams: _noteStreams = [], children }) {
  const { setSidebarItems, state: appState } = useApp()

  const router = useRouter()

  const [codeAction] = useCodeAction()
  const [isRecording, setIsRecording] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [transcripts, setTranscripts] = useState([])

  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [answer, setAnswer] = useState(null)
  const [asks, setAsks] = useState([])

  // The list of past note streams shown in the sidebar, and the one currently
  // open. The active stream is driven by the URL (see MainConfigurator).
  const [noteStreams, setNoteStreams] = useState(_noteStreams)
  const [conversationId, setConversationId] = useState(null)

  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const micStreamRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const speechRecognitionRef = useRef(null)
  const timerIntervalRef = useRef(null)

  // The note stream is a contact-scoped conversation that accumulates the
  // transcript as context. We create it lazily on the first need (recording or
  // asking) and reuse it until a different stream is opened.
  const conversationIdRef = useRef(null)
  const startPromiseRef = useRef(null)

  // Keep the ref in sync with the state so the one-time speech recognition
  // handler and the action callbacks always see the active conversation.
  useEffect(() => {
    conversationIdRef.current = conversationId
  }, [conversationId])

  // Finalized transcript chunks waiting to be flushed to the conversation, plus
  // the debounce timer that batches them.
  const pendingContextRef = useRef([])
  const flushTimerRef = useRef(null)
  const flushContextRef = useRef(null)

  const ensureNoteStream = useCallback(async () => {
    if (conversationIdRef.current) {
      return conversationIdRef.current
    }

    if (!startPromiseRef.current) {
      startPromiseRef.current = (async () => {
        const result = await startNoteStream({})

        if (!result) {
          return throwUnprocessableEntity('Unexpected action result')
        }

        if ('error' in result) {
          throw errorToErrorResponse(result.error)
        }

        conversationIdRef.current = result.conversationId

        setConversationId(result.conversationId)
        setNoteStreams((prev) => [
          {
            id: result.conversationId,
            name: result.name,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          ...prev.filter(({ id }) => id !== result.conversationId),
        ])

        // give the new stream its own URL; the load effect skips reloading it
        // because the id already matches the active conversation
        router.replace(`${APP_PATH}/${result.conversationId}`, {
          scroll: false,
        })

        return result.conversationId
      })()
    }

    try {
      return await startPromiseRef.current
    } catch (error) {
      // reset so a later attempt can retry creating the note stream
      startPromiseRef.current = null

      throw error
    }
  }, [router])

  const flushContext = useCallback(async () => {
    const conversationId = conversationIdRef.current

    if (!conversationId) {
      return
    }

    const entries = pendingContextRef.current

    if (!entries.length) {
      return
    }

    pendingContextRef.current = []

    try {
      const result = await appendContext({ conversationId, entries })

      if (!result) {
        return throwUnprocessableEntity('Unexpected action result')
      }

      if ('error' in result) {
        throw errorToErrorResponse(result.error)
      }
    } catch {
      // requeue the entries so they are not lost on a transient failure
      pendingContextRef.current = [...entries, ...pendingContextRef.current]
    }
  }, [])

  // Keep a ref to the latest flushContext so the one-time speech recognition
  // handler always calls the current implementation.
  useEffect(() => {
    flushContextRef.current = flushContext
  }, [flushContext])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition

      if (SpeechRecognition) {
        speechRecognitionRef.current = new SpeechRecognition()
        speechRecognitionRef.current.continuous = true
        speechRecognitionRef.current.interimResults = true

        speechRecognitionRef.current.onresult = (event) => {
          const lastResultIndex = event.results.length - 1
          const lastResult = event.results[lastResultIndex]

          if (lastResult.isFinal) {
            const transcript = lastResult[0].transcript.trim()

            if (transcript) {
              const timestamp = new Date()

              setTranscripts((prev) => [
                ...prev,
                { text: transcript, timestamp },
              ])

              // buffer the chunk and schedule a batched flush into the note
              // stream so context keeps up with the conversation
              pendingContextRef.current.push({
                text: transcript,
                timestamp: timestamp.toISOString(),
              })

              if (!flushTimerRef.current) {
                flushTimerRef.current = setTimeout(() => {
                  flushTimerRef.current = null

                  void flushContextRef.current?.()
                }, 3000)
              }
            }
          }
        }
      }
    }

    return () => {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop()
        speechRecognitionRef.current = null
      }

      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current)
        flushTimerRef.current = null
      }
    }
  }, [])

  const handleAsk = useCallback(
    async (event) => {
      event?.preventDefault?.()

      const trimmed = question.trim()

      if (!trimmed || asking) {
        return
      }

      setAsking(true)
      setAnswer({ question: trimmed, text: '', pending: true })

      try {
        // make sure the latest transcript is in the conversation before asking
        await flushContext()

        const conversationId = await ensureNoteStream()

        const result = await ask({ conversationId, question: trimmed })

        if (!result) {
          return throwUnprocessableEntity('Unexpected action result')
        }

        if ('error' in result) {
          throw errorToErrorResponse(result.error)
        }

        setAnswer({ question: trimmed, text: result.text, pending: false })
        setAsks((prev) => [...prev, { question: trimmed, text: result.text }])
        setQuestion('')
      } catch (error) {
        setAnswer(null)

        toast.error(error.message)
      } finally {
        setAsking(false)
      }
    },
    [question, asking, flushContext, ensureNoteStream]
  )

  // Reset the working state for a fresh, not-yet-created note stream.
  const resetToNew = useCallback(() => {
    startPromiseRef.current = null
    pendingContextRef.current = []

    setConversationId(null)
    setTranscripts([])
    setAsks([])
    setAnswer(null)
    setQuestion('')
  }, [])

  // Load a note stream's transcript and prior questions into the working state.
  const loadStream = useCallback((stream) => {
    startPromiseRef.current = null
    pendingContextRef.current = []

    setConversationId(stream.id)
    setAnswer(null)
    setQuestion('')
    setTranscripts(
      (stream.transcripts || []).map(({ text, timestamp }) => ({
        text,
        timestamp: timestamp ? new Date(timestamp) : undefined,
      }))
    )
    setAsks(stream.asks || [])

    // make sure the stream appears in the sidebar even if it predates this list
    setNoteStreams((prev) =>
      prev.some(({ id }) => id === stream.id)
        ? prev
        : [
            {
              id: stream.id,
              name: stream.name,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
            ...prev,
          ]
    )
  }, [])

  // The active note stream is driven by the URL: MainConfigurator (rendered by
  // the page) pushes the fetched stream into the app state. An absent stream
  // means we are on the "new note stream" route.
  const appStateStream = appState?.stream

  useEffect(() => {
    // the new-stream route (no id) clears the working state
    if (!appStateStream) {
      resetToNew()

      return
    }

    // a freshly created stream navigates to its own URL with an empty
    // transcript - keep the in-progress working state instead of clobbering it
    if (appStateStream.id === conversationIdRef.current) {
      return
    }

    loadStream(appStateStream)
  }, [appStateStream, loadStream, resetToNew])

  // Publish the note streams to the app sidebar. Each links to its own URL so
  // the active stream gets the route-based selection highlight for free.
  useEffect(() => {
    setSidebarItems((items) => {
      const others = (items || []).filter(({ data }) => data?.app !== APP_NAME)

      const streamItems = noteStreams.map(({ id, name }) => ({
        title: name || 'Note stream',

        icon: '@lucide/file-text',

        href: `${APP_PATH}/${id}`,

        data: { app: APP_NAME },
      }))

      return [
        ...others,
        {
          title: 'Note Streams',
          expanded: true,
          collapsible: false,
          flat: true,
          data: { app: APP_NAME },
          items: [
            {
              title: 'New note stream',
              icon: '@lucide/plus',
              href: APP_PATH,
              data: { app: APP_NAME },
              exact: true,
            },
            ...streamItems,
          ],
        },
      ]
    })

    return () => {
      setSidebarItems((items) =>
        (items || []).filter(({ data }) => data?.app !== APP_NAME)
      )
    }
  }, [noteStreams, setSidebarItems])

  const toggleRecording = async () => {
    if (isRecording) {
      stopRecording()
    } else {
      await startRecording()
    }
  }

  const startRecording = async () => {
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      })

      micStreamRef.current = micStream

      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)()
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256

      const source = audioContextRef.current.createMediaStreamSource(micStream)

      source.connect(analyserRef.current)

      mediaRecorderRef.current = new MediaRecorder(micStream)
      mediaRecorderRef.current.start()

      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.start()
      }

      // create the note stream up front so transcript context has somewhere to
      // go as soon as the first chunk is finalized
      void ensureNoteStream().catch((error) => toast.error(error.message))

      timerIntervalRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1)
      }, 1000)

      setIsRecording(true)
    } catch (error) {
      toast.error('Could not start recording: ' + error)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop()
    }

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
    }

    // flush any transcript chunks that are still buffered
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current)
      flushTimerRef.current = null
    }

    void flushContext()

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop())
      micStreamRef.current = null
    }

    setIsRecording(false)
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0')

    const secs = (seconds % 60).toString().padStart(2, '0')

    return `${mins}:${secs}`
  }

  return (
    <>
      {/* @note renders MainConfigurator from the page, which syncs the active
          stream from the URL into the app state */}
      {children}
      {codeAction}
      <div className="w-full h-screen relative flex items-center justify-center overflow-hidden">
        <div className="relative z-10 flex w-full h-full flex-col justify-center items-center">
          <div
            className={clsx(
              'w-full max-w-lg p-2 flex flex-col gap-2 items-center',
              {
                hidden: !isRecording && transcripts.length === 0 && !answer,
              }
            )}
          >
            {answer ? (
              <AnswerViewer className="w-full" answer={answer} />
            ) : (
              <TranscriptionViewer
                className="w-full"
                transcripts={transcripts}
              />
            )}
          </div>
          <div
            className={clsx(
              'w-full max-w-lg px-2 flex flex-col gap-2',
              isRecording || transcripts.length > 0 || answer
                ? 'absolute left-1/2 -translate-x-1/2 bottom-4'
                : 'items-center'
            )}
          >
            <AudioBar
              className="w-full"
              isRecording={isRecording}
              elapsedTime={formatTime(elapsedTime)}
              analyserRef={analyserRef}
              onToggle={toggleRecording}
            />
            <AskBar
              className="w-full"
              value={question}
              onChange={setQuestion}
              onSubmit={handleAsk}
              pending={asking}
            />
          </div>
        </div>
      </div>
      <TranscriptionBar transcripts={transcripts} asks={asks} />
    </>
  )
}

/**
 * Rendered by the page for the active route. It pushes the note stream fetched
 * for the current URL into the shared app state so the persistent Main shell
 * (mounted in the layout) can load it. Renders nothing itself.
 *
 * @param {{
 *   stream:
 *     | {
 *         id: string
 *         name?: string
 *         transcripts: Array<{ text: string; timestamp?: string | number }>
 *         asks: Array<{ question: string; text: string }>
 *       }
 *     | null
 * }} props
 */
export function MainConfigurator({ stream }) {
  const { setState } = useApp()

  useEffect(() => {
    setState((state) => ({
      ...state,

      stream,
    }))
  }, [setState, stream])

  return null
}
