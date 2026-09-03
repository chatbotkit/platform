import type { EngineSinkEvent } from '@/lib/conversation.tag'
import { tryParse as tryParseJson } from '@/lib/json'

export type RealtimeSocketAudioFormat = {
  encoding: 'pcm16'
  sampleRate: number
  channels: number
}

export type RealtimeSocketAudioData = {
  data: string
  format: RealtimeSocketAudioFormat
}

export type RealtimeSocketCompleteCommand = {
  type: 'complete'
  data?: {
    text?: string
    modality?: 'text' | 'audio'
    voice?: string
  }
}

export type RealtimeSocketInitiateCommand = {
  type: 'initiate'
  data: {
    text: string
    modality?: 'text' | 'audio'
    voice?: string
  }
}

export type RealtimeSocketSteerCommand = {
  type: 'steer'
  data: {
    text: string
    modality?: 'text' | 'audio'
    voice?: string
  }
}

export type RealtimeSocketAbortCommand = {
  type: 'abort'
}

export type RealtimeSocketAudioCommand = {
  type: 'audio'
  data: RealtimeSocketAudioData
}

export type RealtimeSocketCommand =
  | RealtimeSocketCompleteCommand
  | RealtimeSocketInitiateCommand
  | RealtimeSocketSteerCommand
  | RealtimeSocketAbortCommand
  | RealtimeSocketAudioCommand

export type RealtimeSocketEvent = EngineSinkEvent

export type RealtimeSocketEventHandler = (event: RealtimeSocketEvent) => void

export type RealtimeSocketMessageEvent = {
  data: unknown
}

export type RealtimeSocketLike = {
  readyState: number
  send(data: string): void
  close(): void
  addEventListener?(
    type: 'message',
    handler: (event: RealtimeSocketMessageEvent) => void
  ): void
  removeEventListener?(
    type: 'message',
    handler: (event: RealtimeSocketMessageEvent) => void
  ): void
  on?(type: 'message', handler: (data: unknown) => void): void
  off?(type: 'message', handler: (data: unknown) => void): void
}

export type RealtimeSocketConstructor = new (
  url: string | URL
) => RealtimeSocketLike

export type RealtimeSocketOptions = {
  WebSocket?: RealtimeSocketConstructor
}

export class RealtimeSocket {
  readonly socket: RealtimeSocketLike

  readonly #handlers = new Set<RealtimeSocketEventHandler>()

  readonly #handleMessageEvent = (event: RealtimeSocketMessageEvent) => {
    this.#handleMessageData(event.data)
  }

  readonly #handleMessageData = (data: unknown) => {
    const raw =
      data instanceof Buffer
        ? data.toString('utf8')
        : typeof data === 'string'
          ? data
          : String(data)

    const event = tryParseJson(raw) as RealtimeSocketEvent | null

    if (!event || typeof event !== 'object' || typeof event.type !== 'string') {
      return
    }

    for (const handler of this.#handlers) {
      handler(event)
    }
  }

  constructor(socketOrUrl: RealtimeSocketLike | string | URL, options = {}) {
    if (typeof socketOrUrl === 'string' || socketOrUrl instanceof URL) {
      const WebSocketConstructor =
        (options as RealtimeSocketOptions).WebSocket ?? WebSocket

      if (!WebSocketConstructor) {
        throw new Error('WebSocket constructor is not available')
      }

      this.socket = new WebSocketConstructor(socketOrUrl)
    } else {
      this.socket = socketOrUrl
    }

    if (this.socket.addEventListener) {
      this.socket.addEventListener('message', this.#handleMessageEvent)
    } else if (this.socket.on) {
      this.socket.on('message', this.#handleMessageData)
    }
  }

  get readyState(): number {
    return this.socket.readyState
  }

  onEvent(handler: RealtimeSocketEventHandler): () => void {
    this.#handlers.add(handler)

    return () => {
      this.#handlers.delete(handler)
    }
  }

  complete(
    text?: string,
    options: { modality?: 'text' | 'audio'; voice?: string } = {}
  ): void {
    this.send(
      text === undefined
        ? {
            type: 'complete',
            ...(Object.keys(options).length ? { data: options } : null),
          }
        : {
            type: 'complete',
            data: { text, ...options },
          }
    )
  }

  initiate(
    text: string,
    options: { modality?: 'text' | 'audio'; voice?: string } = {}
  ): void {
    this.send({
      type: 'initiate',
      data: { text, ...options },
    })
  }

  steer(
    text: string,
    options: { modality?: 'text' | 'audio'; voice?: string } = {}
  ): void {
    this.send({
      type: 'steer',
      data: { text, ...options },
    })
  }

  abort(): void {
    this.send({
      type: 'abort',
    })
  }

  audio(data: RealtimeSocketAudioData): void {
    this.send({
      type: 'audio',
      data,
    })
  }

  send(command: RealtimeSocketCommand): void {
    this.socket.send(JSON.stringify(command))
  }

  close(): void {
    this.socket.close()
  }

  dispose(): void {
    this.#handlers.clear()

    if (this.socket.removeEventListener) {
      this.socket.removeEventListener('message', this.#handleMessageEvent)
    } else if (this.socket.off) {
      this.socket.off('message', this.#handleMessageData)
    }
  }
}

export type RealtimeClientEvent = RealtimeSocketEvent | Record<string, unknown>

export type RealtimeClientEventHandler = (event: RealtimeClientEvent) => void

export interface RealtimeClientAudioOutput {
  write(data: RealtimeSocketAudioData): Promise<void> | void
  reset(): void
  dispose(): void
}

export interface RealtimeClientAudioInput {
  attach(send: (data: RealtimeSocketAudioData) => void): Promise<void> | void
  detach(): void
  dispose(): void
}

export type BrowserRealtimeMicrophoneInputOptions = {
  audioContext?: AudioContext
  format?: RealtimeSocketAudioData['format']
  stream?: MediaStream
  mediaDevices?: Pick<MediaDevices, 'getUserMedia'>
  processorBufferSize?: number
  constraints?: MediaTrackConstraints
}

function base64ToInt16Array(base64: string): Int16Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }

  return new Int16Array(bytes.buffer)
}

function int16ArrayToBase64(samples: Int16Array): string {
  const bytes = new Uint8Array(samples.buffer)
  let binary = ''

  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }

  return btoa(binary)
}

function downsampleBuffer(
  input: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number
): Float32Array {
  if (inputSampleRate === outputSampleRate) {
    return input
  }

  const ratio = inputSampleRate / outputSampleRate
  const length = Math.floor(input.length / ratio)
  const output = new Float32Array(length)

  for (let i = 0; i < length; i += 1) {
    output[i] = input[Math.floor(i * ratio)] || 0
  }

  return output
}

function floatToPcm16(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length)

  for (let i = 0; i < input.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[i]))

    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
  }

  return output
}

function isRealtimeClientEvent(data: unknown): data is RealtimeClientEvent {
  return typeof data === 'object' && data !== null && 'type' in data
}

function normalizeRealtimeClientEvent(
  data: unknown
): RealtimeClientEvent | null {
  if (!isRealtimeClientEvent(data)) {
    return null
  }

  if (
    data.type === 'event.output' &&
    'data' in data &&
    isRealtimeClientEvent(data.data)
  ) {
    return data.data
  }

  if (typeof data.type === 'string') {
    return data
  }

  return null
}

export class BrowserRealtimeAudioOutput implements RealtimeClientAudioOutput {
  readonly #audioContext: AudioContext

  readonly #sources = new Set<AudioBufferSourceNode>()

  #playAt = 0

  constructor(options: { audioContext?: AudioContext } = {}) {
    this.#audioContext = options.audioContext || new AudioContext()
  }

  async write({ data, format }: RealtimeSocketAudioData): Promise<void> {
    if (this.#audioContext.state === 'suspended') {
      await this.#audioContext.resume()
    }

    const samples = base64ToInt16Array(data)
    const buffer = this.#audioContext.createBuffer(
      format.channels || 1,
      samples.length,
      format.sampleRate
    )
    const channel = buffer.getChannelData(0)

    for (let i = 0; i < samples.length; i += 1) {
      channel[i] = samples[i] / 0x8000
    }

    const source = this.#audioContext.createBufferSource()

    source.buffer = buffer
    source.connect(this.#audioContext.destination)

    this.#sources.add(source)

    source.addEventListener('ended', () => {
      this.#sources.delete(source)
      source.disconnect()
    })

    const startAt = Math.max(
      this.#audioContext.currentTime + 0.02,
      this.#playAt
    )

    source.start(startAt)
    this.#playAt = startAt + buffer.duration
  }

  reset(): void {
    for (const source of this.#sources) {
      try {
        source.stop()
      } catch {}

      source.disconnect()
    }

    this.#sources.clear()
    this.#playAt = this.#audioContext.currentTime
  }

  dispose(): void {
    this.reset()
  }
}

export class BrowserRealtimeMicrophoneInput
  implements RealtimeClientAudioInput
{
  readonly #audioContext: AudioContext

  readonly #format: RealtimeSocketAudioData['format']

  readonly #mediaDevices: Pick<MediaDevices, 'getUserMedia'>

  readonly #processorBufferSize: number

  readonly #constraints: MediaTrackConstraints

  #stream?: MediaStream

  #ownsStream: boolean

  #source?: MediaStreamAudioSourceNode

  #processor?: ScriptProcessorNode

  constructor(options: BrowserRealtimeMicrophoneInputOptions = {}) {
    this.#audioContext = options.audioContext || new AudioContext()
    this.#format =
      options.format ||
      ({
        encoding: 'pcm16',
        sampleRate: 24000,
        channels: 1,
      } satisfies RealtimeSocketAudioData['format'])
    this.#mediaDevices =
      options.mediaDevices || (navigator.mediaDevices as MediaDevices)
    this.#processorBufferSize = options.processorBufferSize || 4096
    this.#constraints = options.constraints || {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
    }
    this.#stream = options.stream
    this.#ownsStream = !options.stream
  }

  async attach(send: (data: RealtimeSocketAudioData) => void): Promise<void> {
    if (this.#processor || this.#source) {
      return
    }

    if (this.#audioContext.state === 'suspended') {
      await this.#audioContext.resume()
    }

    const stream =
      this.#stream ||
      (await this.#mediaDevices.getUserMedia({ audio: this.#constraints }))

    this.#stream = stream
    this.#source = this.#audioContext.createMediaStreamSource(stream)
    this.#processor = this.#audioContext.createScriptProcessor(
      this.#processorBufferSize,
      1,
      1
    )

    this.#processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0)
      const downsampled = downsampleBuffer(
        input,
        this.#audioContext.sampleRate,
        this.#format.sampleRate
      )
      const pcm16 = floatToPcm16(downsampled)

      send({
        data: int16ArrayToBase64(pcm16),
        format: this.#format,
      })
    }

    this.#source.connect(this.#processor)
    this.#processor.connect(this.#audioContext.destination)
  }

  detach(): void {
    this.#processor?.disconnect()
    this.#source?.disconnect()

    if (this.#ownsStream) {
      this.#stream?.getTracks().forEach((track) => track.stop())
    }

    this.#processor = undefined
    this.#source = undefined
    this.#stream = undefined
  }

  dispose(): void {
    this.detach()
  }
}

export class RealtimeClient {
  readonly socket: RealtimeSocket

  readonly #handlers = new Set<RealtimeClientEventHandler>()

  #audioOutput: RealtimeClientAudioOutput | null = null

  #audioInput: RealtimeClientAudioInput | null = null

  readonly #handleMessageEvent = (event: RealtimeSocketMessageEvent) => {
    this.#handleMessageData(event.data)
  }

  readonly #handleMessageData = (data: unknown) => {
    const raw =
      data instanceof Buffer
        ? data.toString('utf8')
        : typeof data === 'string'
          ? data
          : String(data)

    const parsed = tryParseJson(raw) as RealtimeClientEvent | null
    const event = normalizeRealtimeClientEvent(parsed)

    if (!event) {
      return
    }

    if (event.type === 'completeBegin') {
      this.#audioOutput?.reset()
    }

    if (
      event.type === 'audio' &&
      'data' in event &&
      event.data &&
      typeof event.data === 'object'
    ) {
      void this.#audioOutput?.write(event.data as RealtimeSocketAudioData)
    }

    for (const handler of this.#handlers) {
      handler(event)
    }
  }

  constructor(
    socketOrRealtimeSocket: RealtimeSocket | RealtimeSocketLike | string | URL,
    options: RealtimeSocketOptions = {}
  ) {
    this.socket =
      socketOrRealtimeSocket instanceof RealtimeSocket
        ? socketOrRealtimeSocket
        : new RealtimeSocket(socketOrRealtimeSocket, options)

    if (this.socket.socket.addEventListener) {
      this.socket.socket.addEventListener('message', this.#handleMessageEvent)
    } else if (this.socket.socket.on) {
      this.socket.socket.on('message', this.#handleMessageData)
    }
  }

  get readyState(): number {
    return this.socket.readyState
  }

  onEvent(handler: RealtimeClientEventHandler): () => void {
    this.#handlers.add(handler)

    return () => {
      this.#handlers.delete(handler)
    }
  }

  complete(
    text?: string,
    options: { modality?: 'text' | 'audio'; voice?: string } = {}
  ): void {
    this.socket.complete(text, options)
  }

  initiate(
    text: string,
    options: { modality?: 'text' | 'audio'; voice?: string } = {}
  ): void {
    this.socket.initiate(text, options)
  }

  steer(
    text: string,
    options: { modality?: 'text' | 'audio'; voice?: string } = {}
  ): void {
    this.socket.steer(text, options)
  }

  abort(): void {
    this.socket.abort()
  }

  audio(data: RealtimeSocketAudioData): void {
    this.socket.audio(data)
  }

  send(command: RealtimeSocketCommand): void {
    this.socket.send(command)
  }

  attachAudioOutput(
    audioOutput: RealtimeClientAudioOutput = new BrowserRealtimeAudioOutput()
  ): RealtimeClientAudioOutput {
    this.detachAudioOutput()

    this.#audioOutput = audioOutput

    return audioOutput
  }

  detachAudioOutput(): void {
    this.#audioOutput?.reset()
    this.#audioOutput?.dispose()
    this.#audioOutput = null
  }

  async attachMic(
    audioInput: RealtimeClientAudioInput = new BrowserRealtimeMicrophoneInput()
  ): Promise<RealtimeClientAudioInput> {
    this.detachMic()

    this.#audioInput = audioInput

    await audioInput.attach((data) => {
      this.socket.audio(data)
    })

    return audioInput
  }

  detachMic(): void {
    this.#audioInput?.detach()
    this.#audioInput?.dispose()
    this.#audioInput = null
  }

  disconnect(): void {
    this.detachMic()
    this.detachAudioOutput()
    this.socket.close()
  }

  dispose(): void {
    this.#handlers.clear()

    if (this.socket.socket.removeEventListener) {
      this.socket.socket.removeEventListener(
        'message',
        this.#handleMessageEvent
      )
    } else if (this.socket.socket.off) {
      this.socket.socket.off('message', this.#handleMessageData)
    }

    this.disconnect()
    this.socket.dispose()
  }
}
