import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import prisma from '@/prisma/client';
import { Visibility } from '@/prisma/enums'

import { canUseAnamIntegration } from '@/lib/anam.access'
import { validateAnamSession } from '@/lib/anam.session'
import debug from '@/lib/debug';
import fetch from '@/lib/fetch';
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct';

import useAvatarTransport from '@/hooks/useAvatarTransport';
import useAvatarInputAudioStream from '@/hooks/useAvatarInputAudioStream'
import useConversationManager, { ERROR_TYPE, RECEIVE_RESULT_TYPE, TOKEN_TYPE } from '@/hooks/useConversationManager';

// --- Tools ---

function useBubbleOverlay({ disabled = false } = {}) {
  const [bubbles, setBubbles] = useState([])

  const timeoutsRef = useRef([])

  const functions = useMemo(
    () =>
      disabled
        ? []
        : [
            {
              name: 'showBubblePopup',
              description:
                'Display a short popup bubble over the avatar for information that should be visually highlighted to the user.',
              parameters: {
                type: 'object',
                properties: {
                  title: {
                    type: 'string',
                    description: 'Optional short title for the popup bubble.',
                  },
                  text: {
                    type: 'string',
                    description: 'The popup bubble message to display.',
                  },
                  durationInSeconds: {
                    type: 'number',
                    description:
                      'Optional duration to keep the popup visible. Defaults to 5 seconds.',
                  },
                },
                required: ['text'],
              },
              handler: async (args = {}) => {
                const title =
                  typeof args.title === 'string' ? args.title.trim() : ''
                const text =
                  typeof args.text === 'string' ? args.text.trim() : ''
                const durationInSeconds =
                  typeof args.durationInSeconds === 'number'
                    ? args.durationInSeconds
                    : 5

                if (text) {
                  const id = Date.now()
                  const durationInMilliseconds =
                    Math.max(1, durationInSeconds) * 1000

                  debug('showing bubble popup', {
                    id,
                    hasTitle: !!title,
                    textLength: text.length,
                    durationInSeconds,
                  }).log('integration.anam.frame.bubble')

                  setBubbles((bubbles) =>
                    [
                      ...bubbles,
                      {
                        id,
                        title,
                        text,
                        leaving: false,
                      },
                    ].slice(-4)
                  )

                  timeoutsRef.current.push(
                    setTimeout(() => {
                      setBubbles((bubbles) =>
                        bubbles.map((bubble) =>
                          bubble.id === id
                            ? { ...bubble, leaving: true }
                            : bubble
                        )
                      )
                    }, durationInMilliseconds)
                  )

                  timeoutsRef.current.push(
                    setTimeout(() => {
                      setBubbles((bubbles) =>
                        bubbles.filter((bubble) => bubble.id !== id)
                      )
                    }, durationInMilliseconds + 320)
                  )
                }

                if (!text) {
                  debug('skipping bubble popup - missing text', {
                    hasTitle: !!title,
                  }).log('integration.anam.frame.bubble')
                }

                return {
                  displayed: !!text,
                }
              },
            },
          ],
    [disabled]
  )

  useEffect(() => {
    const timeouts = timeoutsRef.current

    return () => {
      for (const timeout of timeouts) {
        clearTimeout(timeout)
      }
    }
  }, [])

  const overlay = disabled ? null : (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      <div className="absolute bottom-[min(5vh,40px)] left-[min(5vw,40px)] flex w-[min(20vw,420px)] min-w-[260px] max-w-[calc(100vw-32px)] flex-col-reverse gap-3">
        {bubbles.map((bubble) => (
          <div
            key={bubble.id}
            className={[
              'rounded-lg border border-white/20 bg-black/75 p-[clamp(18px,2.2vw,28px)] text-white shadow-2xl backdrop-blur transition-all duration-300 ease-out',
              bubble.leaving
                ? 'translate-y-5 scale-95 opacity-0'
                : 'translate-y-0 scale-100 opacity-100',
            ].join(' ')}
          >
            {bubble.title ? (
              <div className="mb-2 text-[clamp(16px,1.25vw,22px)] font-semibold leading-tight">
                {bubble.title}
              </div>
            ) : null}
            <div className="text-[clamp(15px,1.05vw,19px)] leading-relaxed">
              {bubble.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return {
    functions,
    overlay,
  }
}

// --- Hooks ---

export function useAnamRealtimeSession({ integrationId, session }) {
  const sessionCreateRef = useRef(null)

  const getSessionData = useCallback(async () => {
    const sessionCreateUrl = `/api/v1/integration/anam/${integrationId}/session/create`
    const sessionCreateKey = session
      ? `${sessionCreateUrl}#signed-session`
      : sessionCreateUrl

    if (sessionCreateRef.current?.url !== sessionCreateKey) {
      sessionCreateRef.current = null
    }

    if (!sessionCreateRef.current) {
      debug('creating Anam frame session', {
        sessionCreateUrl,
        hasSignedSession: !!session,
      }).log('integration.anam.frame.session')

      const promise = session
        ? Promise.resolve(session)
        : (async () => {
            const response = await fetch(sessionCreateUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
              },
              body: JSON.stringify({}),
            })

            if (!response.ok) {
              const error = await response.json().catch(() => ({}))

              debug('Anam frame session create failed', {
                status: response.status,
                message: error.message,
              }).log('integration.anam.frame.session')

              throw new Error(error.message || 'Failed to create Anam session')
            }

            return response.json()
          })()

      sessionCreateRef.current = {
        url: sessionCreateKey,
        promise,
      }

      promise.catch(() => {
        if (sessionCreateRef.current?.promise === promise) {
          sessionCreateRef.current = null
        }
      })
    } else {
      debug('joining pending Anam frame session create', {
        sessionCreateUrl,
      }).log('integration.anam.frame.session')
    }

    return sessionCreateRef.current.promise
  }, [integrationId, session])

  return {
    getSessionData,
  }
}

// --- Surface ---

export function AnamSurface({ integration, session }) {
  const anamClientRef = useRef(null)
  const talkStreamRef = useRef(null)
  const didStreamTokenRef = useRef(false)
  const lastUserMessageTextRef = useRef('')
  const anamEventsRef = useRef(null)
  const requestedMicMutedRef = useRef(false)

  const [anamClient, setAnamClient] = useState(null)
  const { getSessionData } = useAnamRealtimeSession({
    integrationId: integration.id,
    session,
  })

  const {
    inputAudioStreamRef,
    resolveInputAudioStream,
    releaseInputAudioStream,
  } = useAvatarInputAudioStream()

  const {
    functions: bubbleOverlayFunctions,
    overlay: bubbleOverlay,
  } = useBubbleOverlay()

  const functions = useMemo(
    () => [...bubbleOverlayFunctions],
    [bubbleOverlayFunctions]
  )

  const handleConversationItem = useCallback(
    async (_conversationId, item) => {
      const talkStream = talkStreamRef.current

      switch (item.type) {
        case TOKEN_TYPE: {
          if (!talkStream?.isActive?.()) {
            debug('skipping token - talk stream inactive', {
              hasTalkStream: !!talkStream,
            }).log('integration.anam.frame.stream')

            return
          }

          const token = item.data?.token

          if (token) {
            if (!didStreamTokenRef.current) {
              debug('streaming first token chunk', {
                tokenLength: token.length,
              }).log('integration.anam.frame.stream')
            }

            didStreamTokenRef.current = true

            await talkStream.streamMessageChunk(token, false)
          }

          break
        }

        case RECEIVE_RESULT_TYPE: {
          if (!talkStream?.isActive?.()) {
            debug('skipping receive result - talk stream inactive', {
              hasTalkStream: !!talkStream,
            }).log('integration.anam.frame.stream')

            return
          }

          const text = item.data?.text

          if (text && !didStreamTokenRef.current) {
            debug('streaming receive result text', {
              textLength: text.length,
            }).log('integration.anam.frame.stream')

            await talkStream.streamMessageChunk(text, false)
          }

          if (talkStream.isActive()) {
            debug('ending talk stream after receive result', {
              hadStreamedToken: didStreamTokenRef.current,
              hasText: !!text,
            }).log('integration.anam.frame.stream')

            await talkStream.endMessage()
          }

          talkStreamRef.current = null
          didStreamTokenRef.current = false

          break
        }

        case ERROR_TYPE: {
          if (!talkStream?.isActive?.()) {
            debug('skipping error result - talk stream inactive', {
              hasTalkStream: !!talkStream,
            }).log('integration.anam.frame.stream')

            return
          }

          if (talkStream.isActive()) {
            debug('ending talk stream after conversation error').log(
              'integration.anam.frame.stream'
            )

            await talkStream.endMessage()
          }

          talkStreamRef.current = null
          didStreamTokenRef.current = false

          break
        }
      }
    },
    []
  )

  const {
    conversationId,
    completeMessage,
    abort,
    setConversationId,
    token,
    setToken,
  } = useConversationManager({
    stream: true,

    functions,

    onItem: handleConversationItem,
  })

  const applyMicMuted = useCallback((muted, reason = 'unknown') => {
    requestedMicMutedRef.current = muted

    const inputAudioStream = inputAudioStreamRef.current

    // @note Do not also toggle `track.enabled` here. In embedded Recall
    // sessions the audio stream can come from the parent frame, and disabling
    // that MediaStreamTrack appears to interfere with Anam's direct message
    // path while muted. Let the Anam SDK own input mute/unmute state instead.
    //
    // for (const track of inputAudioStream?.getAudioTracks?.() || []) {
    //   track.enabled = !muted
    // }

    const anamClient = anamClientRef.current

    debug('applying Anam mic control', {
      muted,
      reason,
      hasAnamClient: !!anamClient,
      customAudioTracks:
        inputAudioStream?.getAudioTracks?.().map((track) => ({
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
          label: track.label,
        })) || [],
    }).log('verbose:integration.anam.frame.media')

    if (!anamClient) {
      return
    }

    try {
      const audioState = muted
        ? anamClient.muteInputAudio?.()
        : anamClient.unmuteInputAudio?.()

      debug('applied Anam SDK mic control', {
        muted,
        reason,
        audioState,
      }).log('verbose:integration.anam.frame.media')
    } catch (error) {
      debug('failed to apply Anam SDK mic control', {
        muted,
        reason,
        error: error instanceof Error ? error.message : String(error),
      }).log('integration.anam.frame.media')
    }
  }, [inputAudioStreamRef])

  const respondToUserMessage = useCallback(
    async (text) => {
      if (!text || text === lastUserMessageTextRef.current) {
        debug('skipping user message response', {
          hasText: !!text,
          isDuplicate: !!text && text === lastUserMessageTextRef.current,
        }).log('integration.anam.frame.message')

        return
      }

      lastUserMessageTextRef.current = text

      debug('responding to user message', {
        textLength: text.length,
      }).log('integration.anam.frame.message')

      abort({ reason: 'Anam user message received' })

      const anamClient = anamClientRef.current

      if (!anamClient) {
        debug('skipping user message response - missing Anam client').log(
          'integration.anam.frame.message'
        )

        return
      }

      talkStreamRef.current = anamClient.createTalkMessageStream()
      didStreamTokenRef.current = false

      debug('created Anam talk message stream').log(
        'integration.anam.frame.stream'
      )

      try {
        await completeMessage({ textToUse: text })
      } catch (error) {
        debug('conversation completion failed for Anam message', {
          error: error instanceof Error ? error.message : String(error),
        }).log('integration.anam.frame.message')

        const talkStream = talkStreamRef.current

        if (talkStream?.isActive?.()) {
          debug('ending talk stream after completion failure').log(
            'integration.anam.frame.stream'
          )

          await talkStream.endMessage()
        }

        talkStreamRef.current = null
        didStreamTokenRef.current = false
      }
    },
    [abort, completeMessage]
  )

  const interruptPersona = useCallback(
    (reason = 'unknown') => {
      debug('interrupting Anam persona', {
        reason,
      }).log('integration.anam.frame.interrupt')

      abort({ reason: `Anam persona interrupted: ${reason}` })

      const anamClient = anamClientRef.current

      if (!anamClient) {
        debug('skipping Anam persona interrupt - missing Anam client').log(
          'integration.anam.frame.interrupt'
        )

        return
      }

      try {
        anamClient.interruptPersona?.()

        debug('applied Anam SDK persona interrupt', {
          reason,
        }).log('integration.anam.frame.interrupt')
      } catch (error) {
        debug('failed to interrupt Anam persona', {
          reason,
          error: error instanceof Error ? error.message : String(error),
        }).log('integration.anam.frame.interrupt')
      }

      talkStreamRef.current = null
      didStreamTokenRef.current = false
    },
    [abort]
  )

  useAvatarTransport({
    onMicControl: (message, event) => {
      const muted = message.muted === true

      debug('received parent mic control', {
        muted,
        origin: event.origin,
        source: message.source,
      }).log('verbose:integration.anam.frame.media')

      applyMicMuted(muted, 'parent-message')
    },

    onUserMessage: async (message, event) => {
      debug('received parent user message', {
        origin: event.origin,
        hasText: typeof message.text === 'string',
      }).log('integration.anam.frame.message')

      const text = typeof message.text === 'string' ? message.text.trim() : ''

      if (!text) {
        debug('skipping parent user message - missing text', {
          origin: event.origin,
        }).log('integration.anam.frame.message')

        return
      }

      await respondToUserMessage(text)
    },

    onInterrupt: (message, event) => {
      debug('received parent interrupt', {
        origin: event.origin,
        source: message.source,
        reason: message.reason,
      }).log('integration.anam.frame.interrupt')

      interruptPersona(message.reason || 'parent-message')
    },
  })

  useEffect(() => {
    let canceled = false
    let anamClient

    async function start() {
      try {
        const { anamSessionToken, conversationId, token } =
          await getSessionData()

        debug('loading Anam SDK', {
          conversationId,
          hasAnamSessionToken: !!anamSessionToken,
          hasToken: !!token,
        }).log('integration.anam.frame.session')

        const { AnamEvent, createClient } = await import(
          /* webpackIgnore: true */ 'https://esm.sh/@anam-ai/js-sdk@latest'
        )

        if (canceled) {
          debug('discarding Anam frame session after cancel', {
            conversationId,
          }).log('integration.anam.frame.session')

          return
        }

        setConversationId(conversationId)
        setToken(token)

        const {
          audioInputCount,
          isEmbedded,
          stream: inputAudioStream,
        } = await resolveInputAudioStream().catch((error) => {
          debug('failed to resolve Anam input audio stream', {
            error: error instanceof Error ? error.message : String(error),
          }).log('integration.anam.frame.media')

          return {
            audioInputCount: 0,
            isEmbedded: window.top !== window,
            stream: undefined,
          }
        })

        debug('resolved Anam audio inputs', {
          audioInputCount,
          isFramed: isEmbedded,
        }).log('integration.anam.frame.media')

        debug('resolved Anam input audio stream', {
          isEmbedded,
          hasInputAudioStream: !!inputAudioStream,
          inputAudioTrackCount: inputAudioStream?.getAudioTracks?.().length || 0,
        }).log('integration.anam.frame.media')

        anamClient = createClient(anamSessionToken)

        anamEventsRef.current = AnamEvent
        anamClientRef.current = anamClient

        setAnamClient(anamClient)

        applyMicMuted(requestedMicMutedRef.current, 'client-ready')

        debug('starting Anam video stream', {
          conversationId,
        }).log('integration.anam.frame.session')

        await anamClient.streamToVideoElement(
          'anam-persona-video',
          inputAudioStream
        )

        debug('started Anam video stream', {
          conversationId,
        }).log('integration.anam.frame.session')
      } catch (error) {
        debug('Anam frame session start failed', {
          error: error instanceof Error ? error.message : String(error),
        }).log('integration.anam.frame.session')
      }
    }

    start()

    return () => {
      canceled = true

      debug('unmounting Anam frame session', {
        integrationId: integration.id,
      }).log('integration.anam.frame.session')

      if (anamClientRef.current === anamClient) {
        anamClientRef.current = null
      }

      releaseInputAudioStream()

      setAnamClient(null)

      abort({ reason: 'Anam frame unmounted' })

      anamClient?.stopStreaming?.().catch?.((error) => {
        debug('failed to stop Anam streaming during cleanup', {
          error: error instanceof Error ? error.message : String(error),
        }).log('integration.anam.frame.session')
      })
    }
  }, [
    abort,
    applyMicMuted,
    getSessionData,
    integration.id,
    resolveInputAudioStream,
    setConversationId,
    setToken,
    releaseInputAudioStream,
  ])

  useEffect(() => {
    if (!anamClient || !conversationId || !token) {
      return
    }

    let active = true

    const AnamEvent = anamEventsRef.current

    const messageHistoryEvent =
      AnamEvent?.MESSAGE_HISTORY_UPDATED || 'MESSAGE_HISTORY_UPDATED'
    const talkInterruptedEvent =
      AnamEvent?.TALK_STREAM_INTERRUPTED || 'TALK_STREAM_INTERRUPTED'

    const messageStreamEvent =
      AnamEvent?.MESSAGE_STREAM_EVENT_RECEIVED ||
      'MESSAGE_STREAM_EVENT_RECEIVED'

    async function handleMessageHistory(event) {
      if (!active) {
        debug('skipping Anam message history event - listener inactive').log(
          'integration.anam.frame.event'
        )

        return
      }

      const messages = Array.isArray(event)
        ? event
        : event?.messages || event?.messageHistory || event?.history || []

      const message = messages
        .slice()
        .reverse()
        .find((message) => {
          const role = message?.role || message?.type

          return role === 'user' || role === 'human'
        })

      const content = message?.content || message?.text || message?.message
      const text = typeof content === 'string' ? content.trim() : ''

      debug('received Anam message history event', {
        messageCount: messages.length,
        hasUserMessage: !!message,
        textLength: text.length,
      }).log('integration.anam.frame.event')

      await respondToUserMessage(text)
    }

    function handleTalkInterrupted() {
      if (!active) {
        debug('skipping Anam talk interrupted event - listener inactive').log(
          'integration.anam.frame.event'
        )

        return
      }

      debug('received Anam talk interrupted event').log(
        'integration.anam.frame.event'
      )

      abort({ reason: 'Anam talk stream interrupted' })

      talkStreamRef.current = null
      didStreamTokenRef.current = false
    }

    function handleMessageStream() {
      if (!active) {
        debug('skipping Anam message stream event - listener inactive').log(
          'integration.anam.frame.event'
        )

        return
      }

      debug('received Anam message stream event').log(
        'integration.anam.frame.event'
      )
    }

    debug('registering Anam event listeners', {
      messageHistoryEvent,
      talkInterruptedEvent,
      messageStreamEvent,
    }).log('integration.anam.frame.event')

    anamClient.addListener?.(messageHistoryEvent, handleMessageHistory)
    anamClient.addListener?.(talkInterruptedEvent, handleTalkInterrupted)
    anamClient.addListener?.(messageStreamEvent, handleMessageStream)

    return () => {
      active = false

      anamClient.removeListener?.(messageHistoryEvent, handleMessageHistory)
      anamClient.removeListener?.(talkInterruptedEvent, handleTalkInterrupted)
      anamClient.removeListener?.(messageStreamEvent, handleMessageStream)

      debug('removed Anam event listeners', {
        messageHistoryEvent,
        talkInterruptedEvent,
        messageStreamEvent,
      }).log('integration.anam.frame.event')
    }
  }, [abort, anamClient, conversationId, respondToUserMessage, token])

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
      <main className="relative w-screen h-screen overflow-hidden bg-black text-white">
        <video
          id="anam-persona-video"
          className="absolute inset-0 w-full h-full object-cover object-top bg-black"
          autoPlay
          playsInline
        />
        {bubbleOverlay}
      </main>
    </>
  )
}

// --- Frame ---

export default function Frame({ integration, session }) {
  return <AnamSurface integration={integration} session={session} />
}

Frame.theme = 'none'

Frame.getLayout = function (children) {
  return children
}

export async function getServerSideProps(context) {
  const integration = await prisma.anamIntegration.findUnique({
    where: {
      id: context.query.anamIntegrationId,
    },

    select: {
      id: true,
      userId: true,
      apiKey: true,
      personaId: true,
      botId: true,
      visibility: true,
    },
  })

  if (!integration) {
    return {
      redirect: {
        destination: `/integrations/anam/${context.query.anamIntegrationId}/404`,
        permanent: false,
      },
    }
  }

  if (!integration.apiKey || !integration.personaId) {
    return {
      redirect: {
        destination: `/integrations/anam/${integration.id}/404`,
        permanent: false,
      },
    }
  }

  if (!integration.botId) {
    return {
      redirect: {
        destination: `/integrations/anam/${integration.id}/404`,
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
      if (await canUseAnamIntegration(session.user.id, integration)) {
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

  const sessionToken =
    typeof context.query.session === 'string' ? context.query.session : ''

  const session = sessionToken ? await validateAnamSession(sessionToken) : null

  if (session?.anamIntegrationId === integration.id) {
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
      destination: `/integrations/anam/${integration.id}/404`,
      permanent: false,
    },
  }
}
