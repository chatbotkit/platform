export type PositiveNumber = number & { __brand: 'PositiveNumber' }

export function isPositiveNumber(n: number): n is PositiveNumber {
  return n > 0
}

export type IntegerNumber = number & { __brand: 'IntegerNumber' }

export function isIntegerNumber(n: number): n is IntegerNumber {
  return Number.isInteger(n)
}

export type FloatNumber = number & { __brand: 'FloatNumber' }

export function IsFloatNumber(n: number): n is FloatNumber {
  return !Number.isInteger(n)
}
