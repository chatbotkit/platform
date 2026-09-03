import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import prisma from '@/prisma/client'
import { Visibility } from '@/prisma/enums'

import { canUseAvatarIntegration } from '@/lib/avatar.access'
import { validateAvatarSession } from '@/lib/avatar.session'
import fetch from '@/lib/fetch'
import {
  BrowserRealtimeMicrophoneInput,
  RealtimeClient,
} from '@/lib/realtime.client'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import useAvatarInputAudioStream from '@/hooks/useAvatarInputAudioStream'
import useAvatarTransport from '@/hooks/useAvatarTransport'

// --- Hooks ---

export function useAvatarRealtimeSession({ integrationId, session }) {
  const sessionCreateRef = useRef(null)

  const getWebsocket = useCallback(async () => {
    const sessionCreateUrl = `/api/v1/integration/avatar/${integrationId}/session/create`

    const sessionCreateKey = session
      ? `${sessionCreateUrl}#signed-session`
      : sessionCreateUrl

    if (sessionCreateRef.current?.url !== sessionCreateKey) {
      sessionCreateRef.current = null
    }

    if (!sessionCreateRef.current) {
      const promise = session
        ? Promise.resolve(session)
        : fetch(sessionCreateUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify({}),
          }).then(async (response) => {
            const data = await response.json()

            if (!response.ok) {
              throw new Error(
                data?.message || 'Failed to create Avatar session'
              )
            }

            return data
          })

      sessionCreateRef.current = {
        url: sessionCreateKey,
        promise: promise,
      }

      promise.catch(() => {
        if (sessionCreateRef.current?.promise === promise) {
          sessionCreateRef.current = null
        }
      })
    }

    const realtime = await sessionCreateRef.current.promise

    return realtime?.websocket || null
  }, [integrationId, session])

  return {
    getWebsocket,
  }
}

// --- Surface ---

export function AvatarSurface({ integration, session }) {
  const [speaking, setSpeaking] = useState(false)
  const [mouthLevel, setMouthLevel] = useState(0.15)

  const inputAudioConstraints = useMemo(
    () => ({
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
    }),
    []
  )

  const realtimeClientRef = useRef(null)
  const realtimeSocketRef = useRef(null)
  const microphoneInputRef = useRef(null)
  const requestedMicMutedRef = useRef(false)

  const { getWebsocket } = useAvatarRealtimeSession({
    integrationId: integration.id,
    session,
  })

  const {
    inputAudioStreamRef,
    resolveInputAudioStream,
    releaseInputAudioStream,
  } = useAvatarInputAudioStream({
    constraints: inputAudioConstraints,
    requestCurrentPageStream: true,
  })

  function stopSpeaking() {
    setSpeaking(false)
    setMouthLevel(0.15)
  }

  const applyMicMuted = useCallback(
    (muted) => {
      requestedMicMutedRef.current = muted

      for (const track of inputAudioStreamRef.current?.getAudioTracks?.() ||
        []) {
        track.enabled = !muted
      }
    },
    [inputAudioStreamRef]
  )

  useAvatarTransport({
    onMicControl: (message) => {
      applyMicMuted(message.muted === true)
    },
    onInterrupt: () => {
      realtimeClientRef.current?.abort()
      stopSpeaking()
    },
    onUserMessage: (message) => {
      const text = typeof message.text === 'string' ? message.text.trim() : ''

      setMouthLevel(0.08)

      if (text && realtimeClientRef.current?.readyState === WebSocket.OPEN) {
        realtimeClientRef.current.complete(text, {
          modality: 'audio',
        })
      }
    },
  })

  useEffect(() => {
    let canceled = false
    let audioContext
    let analyser
    let animationFrame = 0
    let timeDomainData

    async function start() {
      try {
        const websocket = await getWebsocket()

        if (canceled || !websocket) {
          return
        }

        const socket = new WebSocket(websocket)
        const client = new RealtimeClient(socket)
        const sources = new Set()

        let playAt = 0

        audioContext = new AudioContext()
        analyser = audioContext.createAnalyser()
        analyser.fftSize = 2048
        analyser.smoothingTimeConstant = 0.35
        timeDomainData = new Float32Array(analyser.fftSize)
        analyser.connect(audioContext.destination)

        realtimeSocketRef.current = socket
        realtimeClientRef.current = client

        const monitorOutput = () => {
          if (!analyser) {
            return
          }

          analyser.getFloatTimeDomainData(timeDomainData)

          let sum = 0

          for (let index = 0; index < timeDomainData.length; index += 1) {
            const sample = timeDomainData[index]

            sum += sample * sample
          }

          const rms = Math.sqrt(sum / timeDomainData.length)
          const active = rms > 0.015

          setSpeaking(active)
          setMouthLevel(active ? Math.min(1, 0.15 + rms * 18) : 0.15)

          animationFrame = window.requestAnimationFrame(monitorOutput)
        }

        animationFrame = window.requestAnimationFrame(monitorOutput)

        function resetOutput() {
          for (const source of sources) {
            try {
              source.stop()
            } catch {
              // pass
            }

            source.disconnect()
          }

          sources.clear()
          playAt = audioContext.currentTime
          stopSpeaking()
        }

        socket.addEventListener('open', async () => {
          client.attachAudioOutput({
            async write({ data, format }) {
              if (audioContext.state === 'suspended') {
                await audioContext.resume()
              }

              const binary = atob(data)
              const bytes = new Uint8Array(binary.length)

              for (let index = 0; index < binary.length; index += 1) {
                bytes[index] = binary.charCodeAt(index)
              }

              const samples = new Int16Array(bytes.buffer)
              const buffer = audioContext.createBuffer(
                format.channels || 1,
                samples.length,
                format.sampleRate
              )
              const channel = buffer.getChannelData(0)

              for (let index = 0; index < samples.length; index += 1) {
                channel[index] = samples[index] / 0x8000
              }

              const source = audioContext.createBufferSource()

              source.buffer = buffer
              source.connect(analyser)
              sources.add(source)

              source.addEventListener('ended', () => {
                sources.delete(source)
                source.disconnect()

                if (
                  sources.size === 0 &&
                  playAt <= audioContext.currentTime + 0.02
                ) {
                  stopSpeaking()
                }
              })

              const startAt = Math.max(audioContext.currentTime + 0.02, playAt)

              source.start(startAt)
              playAt = startAt + buffer.duration
            },
            reset() {
              resetOutput()
            },
            dispose() {
              resetOutput()
            },
          })

          try {
            const { stream } = await resolveInputAudioStream()

            if (!stream) {
              throw new Error('Avatar input audio stream unavailable')
            }

            applyMicMuted(requestedMicMutedRef.current)

            const microphoneInput = new BrowserRealtimeMicrophoneInput({
              stream,
            })

            microphoneInputRef.current = microphoneInput

            await client.attachMic(microphoneInput)
          } catch {
            // pass
          }
        })

        client.onEvent((message) => {
          if (message.type === 'completeBegin') {
            resetOutput()
          }
        })

        socket.addEventListener('close', () => {
          if (realtimeClientRef.current === client) {
            realtimeClientRef.current = null
          }

          if (realtimeSocketRef.current === socket) {
            realtimeSocketRef.current = null
          }

          resetOutput()
        })
      } catch {
        stopSpeaking()
      }
    }

    start()

    return () => {
      canceled = true

      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame)
      }

      realtimeClientRef.current?.dispose()
      realtimeClientRef.current = null
      realtimeSocketRef.current = null
      microphoneInputRef.current = null
      releaseInputAudioStream()

      audioContext?.close().catch(() => {})
    }
  }, [
    applyMicMuted,
    getWebsocket,
    integration.id,
    resolveInputAudioStream,
    releaseInputAudioStream,
  ])

  return (
    <>
      <style jsx global>{`
        html,
        body,
        #__next {
          width: 100%;
          height: 100%;
          margin: 0;
          overflow: hidden;
          background: #000000;
        }
      `}</style>
      <main
        className={[
          'avatar-frame',
          speaking ? 'avatar-frame-speaking' : '',
        ].join(' ')}
      >
        <section className="avatar">
          <div className="brow brow-left">
            <svg viewBox="0 0 120 56" aria-hidden="true">
              <path d="M10 42 Q60 14 110 42" />
            </svg>
          </div>
          <div className="brow brow-right">
            <svg viewBox="0 0 120 56" aria-hidden="true">
              <path d="M10 42 Q60 14 110 42" />
            </svg>
          </div>
          <div className="eye eye-left" />
          <div className="eye eye-right" />
          <div
            className="mouth"
            style={{
              transform: `translateX(-50%) scaleY(${mouthLevel})`,
            }}
          />
        </section>
      </main>
      <style jsx>{`
        .avatar-frame {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100vw;
          height: 100vh;
          padding: 0;
          overflow: hidden;
          background: #000000;
          box-sizing: border-box;
        }

        .avatar {
          --avatar-size: min(80vw, 80vh);

          position: relative;
          width: var(--avatar-size);
          height: calc(var(--avatar-size) * 0.86);
          animation: breathe 5.2s ease-in-out infinite;
        }

        .eye {
          position: absolute;
          top: 39%;
          width: 8%;
          height: 14%;
          border-radius: 999px;
          background: #ffffff;
          animation: blink 7s infinite;
        }

        .eye-left {
          left: 32%;
        }

        .eye-right {
          right: 32%;
        }

        .brow {
          position: absolute;
          top: 21%;
          width: 14%;
          height: 12%;
        }

        .brow-left {
          left: 27%;
          transform: rotate(-7deg);
        }

        .brow-right {
          right: 27%;
          transform: rotate(7deg);
        }

        .brow svg {
          display: block;
          width: 100%;
          height: 100%;
          overflow: visible;
        }

        .brow path {
          fill: none;
          stroke: #ffffff;
          stroke-width: 18;
          stroke-linecap: round;
        }

        .mouth {
          position: absolute;
          top: 66%;
          left: 50%;
          width: 18%;
          height: 10%;
          overflow: hidden;
          border-radius: 12% 12% 70% 70% / 20% 20% 88% 88%;
          background: #ffffff;
          transform-origin: 50% 15%;
          transition: transform 80ms ease-out;
        }

        .avatar-frame-speaking .mouth {
          box-shadow: 0 0 24px rgba(255, 255, 255, 0.22);
        }

        @keyframes breathe {
          0%,
          100% {
            transform: translateY(0);
          }

          50% {
            transform: translateY(1.2%);
          }
        }

        @keyframes blink {
          0%,
          45%,
          49%,
          100% {
            transform: scaleY(1);
          }

          47% {
            transform: scaleY(0.12);
          }
        }
      `}</style>
    </>
  )
}

// --- Frame ---

export default function Frame({ integration, session }) {
  return <AvatarSurface integration={integration} session={session} />
}

Frame.theme = 'none'

Frame.getLayout = function (children) {
  return children
}

export async function getServerSideProps(context) {
  const integration = await prisma.avatarIntegration.findUnique({
    where: {
      id: context.query.avatarIntegrationId,
    },
    select: {
      id: true,
      userId: true,
      botId: true,
      visibility: true,
    },
  })

  if (!integration) {
    return {
      redirect: {
        destination: `/integrations/avatar/${context.query.avatarIntegrationId}/404`,
        permanent: false,
      },
    }
  }

  if (!integration.botId) {
    return {
      redirect: {
        destination: `/integrations/avatar/${integration.id}/404`,
        permanent: false,
      },
    }
  }

  // check public access
  {
    if (integration.visibility === Visibility.public) {
      return {
        props: makeJsonSafe({
          integration: {
            id: integration.id,
          },
          session: null,
        }),
      }
    }
  }

  // check user session
  {
    const session = await getSoftSession(context.req, context.res)

    if (session) {
      if (await canUseAvatarIntegration(session.user.id, integration)) {
        return {
          props: makeJsonSafe({
            integration: {
              id: integration.id,
            },
            session: null,
          }),
        }
      }
    }
  }

  // check query sesssion
  {
    const sessionToken =
      typeof context.query.session === 'string' ? context.query.session : ''

    const session = sessionToken
      ? await validateAvatarSession(sessionToken)
      : null

    if (session?.avatarIntegrationId === integration.id) {
      return {
        props: makeJsonSafe({
          integration: {
            id: integration.id,
          },
          session,
        }),
      }
    }

    return {
      redirect: {
        destination: `/integrations/avatar/${integration.id}/404`,
        permanent: false,
      },
    }
  }
}
