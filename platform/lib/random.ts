/**
 * Generates a random integer between min and max (inclusive)
 */
export function getRandomNumberBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min)
}

/**
 * Returns a random item from the provided array
 */
export function getRandomArrayItem<T>(items: T[]): T | undefined {
  if (!items || items.length === 0) {
    return undefined
  }

  const randomIndex = Math.floor(Math.random() * items.length)

  return items[randomIndex]
}
