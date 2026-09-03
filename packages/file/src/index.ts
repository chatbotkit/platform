import { chunk as chunkCsv } from '@chatbotkit-dev/file-csv'
import { chunk as chunkHtml } from '@chatbotkit-dev/file-html'
import { chunk as chunkJson } from '@chatbotkit-dev/file-json'
import { chunk as chunkJsonl } from '@chatbotkit-dev/file-jsonl'
import { chunk as chunkMd } from '@chatbotkit-dev/file-md'
import { chunk as chunkTxt } from '@chatbotkit-dev/file-txt'
import { chunk as chunkYaml } from '@chatbotkit-dev/file-yaml'

import type { CoreContentType, ExperimentalContentType } from './support'

interface Chunk {
  text: string
  meta: Record<string, unknown>
}

interface Options {
  size?: number
  overlap?: number
  separators?: string[]
  experimental?: boolean
}

function withoutOptions(fn: (blob: Blob) => AsyncGenerator<Chunk>) {
  return (blob: Blob, options: Options) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    options

    return fn(blob)
  }
}

function getBlobContentType(blob: Blob): string {
  return blob.type.toLowerCase().split(';')[0].trim()
}

const coreFns: Record<
  CoreContentType,
  (blob: Blob, options: Options) => AsyncGenerator<Chunk>
> = {
  'text/csv': withoutOptions(chunkCsv),
  'application/json': withoutOptions(chunkJson),
  'application/jsonl': withoutOptions(chunkJsonl),
  'application/yaml': withoutOptions(chunkYaml),
  'application/x-yaml': withoutOptions(chunkYaml),
  'text/yaml': withoutOptions(chunkYaml),
  'text/x-yaml': withoutOptions(chunkYaml),
}

const experimentalFns: Record<
  ExperimentalContentType,
  ((blob: Blob, options: Options) => AsyncGenerator<Chunk>) | null
> = {
  'text/plain': chunkTxt,
  'text/markdown': chunkMd,
  'text/html': chunkHtml,
  // @note the reason these are disabled for now is because we use the this
  // module inside components that are loaded in the edge environment and
  // unfortunately the document APIs are not supported well
  'application/pdf': null,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    null,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    null,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': null,
}

export function getChunkFunction(
  blob: Blob,
  options?: Options
): ((blob: Blob, options: Options) => AsyncGenerator<Chunk>) | null {
  const type = getBlobContentType(blob)

  let fn = type in coreFns ? coreFns[type as CoreContentType] : null

  if (options?.experimental) {
    fn ??=
      type in experimentalFns
        ? experimentalFns[type as ExperimentalContentType]
        : null
  }

  return fn
}

export function canChunk(blob: Blob, options?: Options): boolean {
  return !!getChunkFunction(blob, options)
}

export function canChunkContentType(
  contentType: string,
  options?: Options
): boolean {
  return !!getChunkFunction(new Blob([], { type: contentType }), options)
}

export async function* chunk(
  blob: Blob,
  options: Options
): AsyncGenerator<Chunk> {
  const fn = getChunkFunction(blob, options)

  if (!fn) {
    throw new Error(`Unsupported content type ${getBlobContentType(blob)}`)
  }

  for await (const chunk of fn(blob, options)) {
    yield chunk
  }
}
