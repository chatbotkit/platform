export const coreContentTypes = [
  'text/csv',
  'application/json',
  'application/jsonl',
  'application/yaml',
  'application/x-yaml',
  'text/yaml',
  'text/x-yaml',
] as const

export const experimentalContentTypes = [
  'text/plain',
  'text/markdown',
  'text/html',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const

export type CoreContentType = (typeof coreContentTypes)[number]
export type ExperimentalContentType = (typeof experimentalContentTypes)[number]

export type SupportedContentType<Experimental extends boolean = false> =
  Experimental extends true
    ? CoreContentType | ExperimentalContentType
    : CoreContentType

export function getSupportedContentTypes<E extends boolean = false>(options?: {
  experimental?: E
}): SupportedContentType<E>[] {
  return [
    ...coreContentTypes,
    ...(options?.experimental ? experimentalContentTypes : []),
  ] as SupportedContentType<E>[]
}
