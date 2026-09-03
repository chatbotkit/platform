import {
  MAX_DB_STRING_BYTES_LENGTH,
  MAX_DB_TEXT_BYTES_LENGTH,
} from '@/prisma/constraints'

import schema from '@/lib/joi.schema'
import { byteLength } from '@/lib/string'

import backstorySchema from '@/schemas/backstory'
import featuresSchema from '@/schemas/features'

import { z } from 'zod'

/**
 * The inline `extensions` shape accepted by the conversation routes
 * (complete, apply, compact, send, receive). The zod schemas are the single
 * source of truth for the inline dataset/skillset/ability shapes - the joi
 * `extensionsSchema` below bridges them for the route handlers and
 * `scripts/build-api-spec.ts` derives the OpenAPI definition from them.
 */

// ---

/**
 * Optional resource-level name/description - mirrors `schemas/name` and
 * `schemas/description` (nullable, empty allowed, byte-length bound).
 */
function optionalBoundedString(maxBytes: number, description: string) {
  return z
    .string()
    .refine((value) => byteLength(value) <= maxBytes, {
      message: `must be less than or equal to ${maxBytes} bytes long`,
    })
    .nullable()
    .optional()
    .describe(description)
}

// @note an open bag - the previous joi `schema.object({})` rejected every key,
// which was a latent bug that made the public spec advertise a closed empty
// object and turned every generated SDK's `meta` into an empty struct
const metaSchema = z.record(z.unknown())

// ---

export const InlineRecordSchema = z
  .object({
    text: z.string().min(1).describe('The text content of the record'),
    meta: metaSchema.optional().describe('Additional metadata for the record'),
  })
  .strict()

export const InlineDatasetSchema = z
  .object({
    name: optionalBoundedString(
      MAX_DB_STRING_BYTES_LENGTH,
      'The name of the dataset'
    ),
    description: optionalBoundedString(
      MAX_DB_TEXT_BYTES_LENGTH,
      'The description of the dataset'
    ),
    records: z.array(InlineRecordSchema).describe('The records in the dataset'),
  })
  .strict()

export const InlineAbilitySchema = z
  .object({
    name: z.string().min(1).describe('The name of the ability'),
    description: z
      .string()
      .min(1)
      .describe('The description of the ability'),
    instruction: z
      .string()
      .min(1)
      .describe('The instruction for the ability'),
    linkedSecretId: z
      .string()
      .min(1)
      .optional()
      .describe('Optional secret ID for the ability'),
    linkedSpaceId: z
      .string()
      .min(1)
      .optional()
      .describe('Optional space ID for the ability'),
    meta: metaSchema.optional().describe('Additional metadata for the ability'),
  })
  .strict()

export const InlineSkillsetSchema = z
  .object({
    name: optionalBoundedString(
      MAX_DB_STRING_BYTES_LENGTH,
      'The name of the skillset'
    ),
    description: optionalBoundedString(
      MAX_DB_TEXT_BYTES_LENGTH,
      'The description of the skillset'
    ),
    abilities: z
      .array(InlineAbilitySchema)
      .describe('The abilities in the skillset'),
  })
  .strict()

export const InlineDatasetsSchema = z
  .array(InlineDatasetSchema)
  .describe('Inline datasets to provide additional context')

export const InlineSkillsetsSchema = z
  .array(InlineSkillsetSchema)
  .describe('Inline skillsets to provide additional abilities')

// ---

export type InlineRecord = z.infer<typeof InlineRecordSchema>
export type InlineDataset = z.infer<typeof InlineDatasetSchema>
export type InlineAbility = z.infer<typeof InlineAbilitySchema>
export type InlineSkillset = z.infer<typeof InlineSkillsetSchema>

// ---

const extensionsSchema = schema.object({
  backstory: backstorySchema,

  datasets: schema.array().items(schema.object().zodSchema(InlineDatasetSchema)),

  skillsets: schema
    .array()
    .items(schema.object().zodSchema(InlineSkillsetSchema)),

  features: featuresSchema,
})

export default extensionsSchema
