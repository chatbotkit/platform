export function undefinedOr<T>(value: T | undefined, defaultValue: T): T {
  return value === undefined ? defaultValue : value
}

export function nullOr<T>(value: T | null, defaultValue: T): T {
  return value === null ? defaultValue : value
}
