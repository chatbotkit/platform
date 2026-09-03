export function splitHalf<T>(arr: T[]): [T[], T[]] {
  const half = Math.floor(arr.length / 2)

  const firstHalf = arr.slice(0, half)
  const secondHalf = arr.slice(half)

  // @note If we use ceil we do not need to do the next line but since we use
  // this function in particular circumstances we have to.

  if (firstHalf.length === 0) {
    return [secondHalf, []]
  } else {
    return [firstHalf, secondHalf]
  }
}

export function getFirst<T>(arr: T[]): T | undefined {
  return arr[0]
}

export function getLast<T>(arr: T[]): T | undefined {
  return arr.slice(-1)[0]
}

export function allTrue(arr: boolean[]): boolean {
  return arr.every((ele) => !!ele)
}

export function allFalse(arr: boolean[]): boolean {
  return arr.every((ele) => !ele)
}

export function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}

/**
 * Get N number of items from array distributed evenly.
 */
export function distributed<T>(arr: T[], n: number): T[] {
  if (arr.length === 0 || n <= 0) {
    return []
  }

  // if n is greater than array length, return the entire array

  if (n >= arr.length) {
    return [...arr]
  }

  // special case for n=1

  if (n === 1) {
    return [arr[0]]
  }

  const result: T[] = []

  // for n elements, distribute evenly from first to last

  for (let i = 0; i < n; i++) {
    // this formula places indices evenly from 0 to arr.length-1

    const index = Math.round((arr.length - 1) * (i / (n - 1)))

    result.push(arr[index])
  }

  return result
}
