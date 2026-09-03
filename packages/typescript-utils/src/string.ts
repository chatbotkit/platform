export type NonEmptyString = string & { __brand: 'NonEmptyString' }

export function isNonEmptyString(value: string): value is NonEmptyString {
  return value !== ''
}

export type TrimmedNonEmptyString = string & {
  __brand: 'TrimmedNonEmptyString'
}

export function isTrimmedNonEmptyString(
  value: string
): value is TrimmedNonEmptyString {
  return value.trim() !== ''
}
