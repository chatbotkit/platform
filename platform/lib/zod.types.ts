import { z } from 'zod'

export const zstatic = <T extends string | number | boolean>(val: T) => {
  return z.preprocess(() => val, z.literal(val))
}

export const timestamp = z.union([z.string(), z.number()]).transform((val) => {
  const date = new Date(val)
  const ts = date.getTime()

  if (isNaN(ts)) {
    throw new Error('Invalid date')
  }

  return ts
})
