// @ts-check
import schema from '@/lib/joi.schema'

/**
 * Schema for a position object with x and y coordinates
 */
const positionSchema = schema.object({
  x: schema.number().required(),
  y: schema.number().required(),
})

/**
 * Schema for a note object with position, data, and optional dimensions
 */
const noteSchema = schema.object({
  position: positionSchema,
  data: schema.object().pattern(/./, schema.any()),
  width: schema.number(),
  height: schema.number(),
})

/**
 * Schema for an image object with position, data, and optional dimensions
 */
const imageSchema = schema.object({
  position: positionSchema,
  data: schema.object().pattern(/./, schema.any()),
  width: schema.number(),
  height: schema.number(),
})

/**
 * Schema for a frame object with position, data, and optional dimensions
 */
const frameSchema = schema.object({
  position: positionSchema,
  data: schema.object().pattern(/./, schema.any()),
  width: schema.number(),
  height: schema.number(),
})

/**
 * Schema for a tool object with type, position, data, and dimensions
 */
const toolSchema = schema.object({
  type: schema.string().required(),
  position: positionSchema,
  data: schema.object().pattern(/./, schema.any()),
  width: schema.number(),
  height: schema.number(),
})

/**
 * Schema for blueprint config that stores UI-related configuration such as
 * element positions, notes, and tools in the blueprint designer.
 *
 * This schema validates the structure of the config field and supports
 * the $update pattern for partial updates.
 */
export const blueprintConfigSchema = schema
  .object({
    positions: schema.object().pattern(/./, positionSchema),
    notes: schema.object().pattern(/./, noteSchema),
    images: schema.object().pattern(/./, imageSchema),
    frames: schema.object().pattern(/./, frameSchema),
    tools: schema.object().pattern(/./, toolSchema),

    // allow $update for partial updates
    $update: schema.object({
      positions: schema.object().pattern(/./, positionSchema),
      notes: schema.object().pattern(/./, noteSchema),
      images: schema.object().pattern(/./, imageSchema),
      frames: schema.object().pattern(/./, frameSchema),
      tools: schema.object().pattern(/./, toolSchema),
    }),
  })
  .allow(null)

export default blueprintConfigSchema
