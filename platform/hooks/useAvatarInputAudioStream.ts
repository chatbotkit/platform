import { useCallback, useRef } from 'react'

type UseAvatarInputAudioStreamOptions = {
  constraints?: MediaStreamConstraints['audio']
  requestCurrentPageStream?: boolean
}

type ResolveInputAudioStreamResult = {
  audioInputCount: number
  isEmbedded: boolean
  stream?: MediaStream
}

export default function useAvatarInputAudioStream({
  constraints = true,
  requestCurrentPageStream = false,
}: UseAvatarInputAudioStreamOptions = {}) {
  const inputAudioStreamRef = useRef<MediaStream | null>(null)

  const releaseInputAudioStream = useCallback(() => {
    if (inputAudioStreamRef.current) {
      inputAudioStreamRef.current.getTracks().forEach((track) => track.stop())
      inputAudioStreamRef.current = null
    }
  }, [])

  const resolveInputAudioStream =
    useCallback(async (): Promise<ResolveInputAudioStreamResult> => {
      const audioInputs =
        (await navigator.mediaDevices
          ?.enumerateDevices?.()
          .then((devices) =>
            devices.filter((device) => device.kind === 'audioinput')
          )
          .catch(() => [])) || []

      const isEmbedded = window.top !== window

      const stream =
        audioInputs.length === 0 && isEmbedded
          ? await window.top?.navigator?.mediaDevices?.getUserMedia?.({
              audio: constraints,
            })
          : requestCurrentPageStream
            ? await navigator.mediaDevices.getUserMedia({
                audio: constraints,
              })
            : undefined

      inputAudioStreamRef.current = stream || null

      return {
        audioInputCount: audioInputs.length,
        isEmbedded,
        stream,
      }
    }, [constraints, requestCurrentPageStream])

  return {
    inputAudioStreamRef,
    resolveInputAudioStream,
    releaseInputAudioStream,
  }
}
