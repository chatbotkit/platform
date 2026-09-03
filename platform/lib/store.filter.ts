import { z } from 'zod'

export const FilterSchema = z.record(
  z.string(),
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z
      .object({
        $eq: z.union([z.string(), z.number(), z.boolean()]),
      })
      .strict(),
    z
      .object({
        $ne: z.union([z.string(), z.number(), z.boolean()]),
      })
      .strict(),
    z
      .object({
        $gt: z.number(),
      })
      .strict(),
    z
      .object({
        $gte: z.number(),
      })
      .strict(),
    z
      .object({
        $lt: z.number(),
      })
      .strict(),
    z
      .object({
        $lte: z.number(),
      })
      .strict(),
  ])
)

export type Filter = z.infer<typeof FilterSchema>
