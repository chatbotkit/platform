import { Base64 } from 'js-base64'

// we need to polyfill the ReadableStream for chrome and Safari
{
  if (
    typeof globalThis.ReadableStream === 'function' &&
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore Symbol is not defined
    typeof globalThis.ReadableStream.prototype[Symbol.asyncIterator] !==
      'function'
  ) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore Symbol is not defined
    globalThis.ReadableStream.prototype[Symbol.asyncIterator] = function () {
      const reader = this.getReader()

      return {
        next: () => reader.read(),
        return: () => {
          reader.releaseLock()

          return Promise.resolve({ done: true })
        },
      }
    }
  }
}

export function buf2str(
  buf: ArrayBuffer | ArrayBufferView,
  encoding: string | undefined = 'utf-8'
): string {
  return new TextDecoder(encoding).decode(buf)
}

export function str2buf(str: string): Uint8Array {
  return new TextEncoder().encode(str)
}

export function hex2buf(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error(`Invalid hex string: odd length (${hex.length})`)
  }

  const byteArray = new Uint8Array(hex.length / 2)

  for (let i = 0; i < byteArray.length; i++) {
    const byteCode = hex.substring(i * 2, i * 2 + 2)

    byteArray[i] = parseInt(byteCode, 16)
  }

  return byteArray
}

export function buf2hex(buf: Uint8Array): string {
  return Array.from(buf)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function b64d2buf(b64d: string): Uint8Array {
  return Base64.toUint8Array(b64d)
}

export function buf2b64d(buf: Uint8Array): string {
  return Base64.fromUint8Array(buf)
}

export function concatBufs(...bufs: (Uint8Array | ArrayBuffer)[]): ArrayBuffer {
  const totalLength = bufs.reduce((acc, buf) => acc + buf.byteLength, 0)

  const result = new Uint8Array(totalLength)

  let offset = 0

  for (const buf of bufs) {
    const view = new Uint8Array(buf)

    result.set(view, offset)

    offset += buf.byteLength
  }

  return result.buffer
}

export async function stream2buf(
  stream: ReadableStream<ArrayBuffer | Uint8Array>
): Promise<ArrayBuffer> {
  const chunks: (ArrayBuffer | Uint8Array)[] = []

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore this may not longer be necessary as streams are now iterable
  for await (const chunk of stream) {
    chunks.push(chunk)
  }

  return concatBufs(...chunks)
}

export async function buf2stream(
  buf: ArrayBuffer | Uint8Array
): Promise<ReadableStream<ArrayBuffer | Uint8Array>> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(buf)
      controller.close()
    },
  })
}
