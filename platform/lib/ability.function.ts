import type { Ability } from '@/prisma/types'

import debug from '@/lib/debug'
import { BotInputError } from '@/lib/error'
import {
  type FieldSchema,
  extractInstructionFields,
} from '@/lib/instruction.field'
import type { JsonSchema, JsonSchemaObject } from '@/lib/jsonschema'
import { mergeAll } from '@/lib/object'
import { tryParse as tryParseYaml } from '@/lib/yaml'
import { tryRepair as tryRepairYaml } from '@/lib/yaml.repair'

import { convertJsonSchemaToZod } from 'zod-from-json-schema'
import { fromZodError } from 'zod-validation-error/v4'

// @note we use v4 here because zod-from-json-schema uses Zod 4 internally

function normalizeAbilityArgs(args: unknown): Record<string, unknown> | null {
  if (!args) {
    return null
  }

  if (typeof args === 'string') {
    const yaml = tryRepairYaml(args)
    const parsed = yaml ? tryParseYaml(yaml) : null

    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as Record<string, unknown>
    }

    return {
      input: args,
    }
  }

  return {
    ...(args as Record<string, unknown>),
  }
}

/**
 * Render the model-facing parameter schema for an ability as a compact string,
 * to be appended to validation errors. When the model sends malformed, missing
 * or empty arguments, handing it back the exact shape it was supposed to produce
 * gives it a concrete target to retry against instead of just "something was
 * wrong". Best-effort - returns an empty string if the schema can't be built.
 */
function describeExpectedSchema(
  ability: Pick<Ability, 'instruction' | 'meta'>
): string {
  try {
    return JSON.stringify(getAbilityFunctionParameters(ability))
  } catch {
    return ''
  }
}

/**
 * Append the expected schema to a validation error message so the model can
 * self-correct on the next attempt.
 */
function withExpectedSchema(
  message: string,
  ability: Pick<Ability, 'instruction' | 'meta'>
): string {
  const schema = describeExpectedSchema(ability)

  if (!schema) {
    return message
  }

  return `${message}. The arguments must match this JSON schema: ${schema}`
}

/**
 * Get the normalized name of the ability function.
 *
 * @throws {BotInputError} When the normalized name is empty
 */
export function getAbilityFunctionName(
  ability: Pick<Ability, 'name'>,
  options?: Record<string, unknown>
): string {
  debug(`getAbilityFunctionName`, { ability, options }).log(
    'ability.function.getAbilityFunctionName'
  )

  const name = ability.name

  // @todo move the slice to the corresponding adaptor for each model

  const normalizedName = (
    /^[a-zA-Z][\w_]*$/.test(name)
      ? name
      : name
          .trim()
          .replace(/\W+/g, '_')
          .replace(/[_-]+/g, '_')
          // .replace(/^_+/, '') // @note _ denotes are private function and it needs to be preserved
          .replace(/_+$/, '')
          .toLowerCase()
          .trim()
  ).slice(0, 64) // @note OpenAI functions have a limit of 64 characters

  // @note Throw error for empty names to prevent
  // OpenAI API errors like "Invalid 'tools[1].function.name': empty string"

  if (!normalizedName) {
    throw new BotInputError(
      `Ability name cannot be empty or contain only special characters: "${ability.name}"`
    )
  }

  return normalizedName
}

/**
 * Get the ability function description.
 */
export function getAbilityFunctionDescription(
  ability: Pick<Ability, 'description'>,
  options?: Record<string, unknown>
): string {
  debug(`getAbilityFunctionDescription`, { ability, options }).log(
    'ability.function.getAbilityFunctionDescription'
  )

  const description = ability.description

  return description.length > 10
    ? ability.description
    : `Performs an action based on action input. ${description}`
}

/**
 * Gets the ability function parameters.
 */
export function getAbilityFunctionParameters(
  ability: Pick<Ability, 'instruction' | 'meta'>,
  options?: {
    preserveLocalFields?: boolean
    preservePrivateFields?: boolean
    includeJustification?: boolean
  }
): JsonSchema {
  debug(`getAbilityFunctionParameters`, { ability, options }).log(
    'ability.function.getAbilityFunctionParameters'
  )

  // @todo move the _instruction to a specific compiled instruction inside the
  // ability model

  const instruction = ability.meta?._instruction || ability.instruction

  const allFields = extractInstructionFields(instruction)

  // @note filter out certain fields

  const fields = allFields
    // skip local-only fields unless preserved
    .filter((field) => {
      return options?.preserveLocalFields || !field.local
    })
    // skip private fields (starting with _#@$) unless preserved
    .filter((field) => {
      return options?.preservePrivateFields || !/^[_#@$]/.test(field.name)
    })
    // skip error fields that don't start with a letter or private prefix
    .filter((field) => {
      return /^[a-zA-Z_#@$]/.test(field.name)
    })
    // skip 'reference' type fields
    .filter((field) => {
      return field.type !== 'reference'
    })

  debug(`generating ability function parameters`, {
    ability,
    instruction,
    fields,
  }).log('ability.function.getAbilityFunctionParameters')

  /**
   * Removes undefined values from an object to keep the schema clean.
   */
  function cleanObject<T extends object>(obj: T): T {
    return Object.fromEntries(
      Object.entries(obj).filter(([, value]) => value !== undefined)
    ) as T
  }

  /**
   * Converts a field schema to JSON Schema format, handling nested arrays and objects.
   */
  function fieldToJsonSchema(field: FieldSchema): JsonSchema {
    // @note handle array type with items schema

    if (field.type === 'array') {
      return cleanObject({
        type: 'array',
        description: field.description,
        default: field.default,
        items: field.items ? fieldToJsonSchema(field.items) : undefined,
      })
    }

    // @note handle object type with properties schema

    if (field.type === 'object') {
      // @note collect required fields from properties where required is true

      const requiredFields: string[] = []

      if (field.properties) {
        for (const [key, value] of Object.entries(field.properties)) {
          // @note mark as required if the field has required: true

          if (value && value.required) {
            requiredFields.push(key)
          }
        }
      }

      return cleanObject({
        type: 'object',
        description: field.description,
        default: field.default,
        properties: field.properties
          ? Object.fromEntries(
              Object.entries(field.properties).map(([key, value]) => [
                key,
                fieldToJsonSchema(value),
              ])
            )
          : undefined,
        required: requiredFields.length > 0 ? requiredFields : undefined,
      })
    }

    // @note handle string, number, boolean types

    if (field.type === 'string') {
      return cleanObject({
        type: 'string',
        description: field.description,
        default: field.default,
        enum: field.enum as string[] | undefined,
        min: field.min,
        max: field.max,
      })
    }

    if (field.type === 'number') {
      return cleanObject({
        type: 'number',
        description: field.description,
        default: field.default,
        enum: field.enum as number[] | undefined,
        min: field.min,
        max: field.max,
      })
    }

    if (field.type === 'boolean') {
      return cleanObject({
        type: 'boolean',
        description: field.description,
        default: field.default,
      })
    }

    // @note fallback to string type for unknown types

    return cleanObject({
      type: 'string',
      description: field.description,
      default: field.default,
    })
  }

  const fieldProperties = Object.fromEntries(
    fields.map((field) => [field.name, fieldToJsonSchema(field)])
  )

  const fieldRequired = Array.from(
    new Set(
      fields.filter(({ required }) => required).map((field) => field.name)
    )
  )

  // @note rule 4: if justification is requested AND the ability declares its own
  // `justification` field, the two collide at the top level - so (and only then)
  // wrap the fields under `input` and keep the activity justification on top

  const justificationClashes =
    !!options?.includeJustification && 'justification' in fieldProperties

  let parameters: JsonSchema

  if (justificationClashes) {
    parameters = {
      type: 'object',
      title: 'Action request',

      properties: {
        input: {
          type: 'object',
          title: 'Action input',
          properties: fieldProperties,
          required: fieldRequired,
          additionalProperties: false,
        },
      },

      required: ['input'],
      additionalProperties: false,
    }
  } else {
    // @note rules 1 & 2: fields live at the top level; no fields means no input

    parameters = {
      type: 'object',
      title: 'Action request',

      properties: fieldProperties,
      required: fieldRequired,
      additionalProperties: false,
    }
  }

  // @note rule 3: justification is just another top-level parameter

  if (options?.includeJustification) {
    parameters.properties = {
      ...parameters.properties,

      justification: {
        type: 'string',
        title: 'Justification for the action',
      },
    }

    parameters.required = [...(parameters.required || []), 'justification']
  }

  debug(`generated ability function parameters`, {
    ability,
    parameters,
  }).log('ability.function.getAbilityFunctionParameters')

  return parameters
}

/**
 * Get the ability function input.
 *
 * @throws {BotInputError} When the input fails validation
 */
export function getAbilityFunctionInput(
  ability: Pick<Ability, 'id' | 'instruction' | 'meta'>,
  args: unknown,
  options?: Record<string, unknown>
): string {
  debug(`getAbilityFunctionInput`, { ability, args, options }).log(
    'ability.function.getAbilityFunctionInput'
  )

  if (!args) {
    return ''
  }

  const thisArgs = normalizeAbilityArgs(args)

  if (!thisArgs) {
    return ''
  }

  // @note the flat field schema - fields live at the top level.
  // getAbilityFunctionParameters is called without includeJustification, so it
  // never wraps and schema.properties is exactly the field set.

  let schema: JsonSchemaObject

  try {
    schema = getAbilityFunctionParameters(ability, {
      preserveLocalFields: true,
      preservePrivateFields: true,
    }) as JsonSchemaObject
  } catch {
    // @note corrupted ability - best-effort stringify

    debug(`failed to get schema, using fallback`, { ability }).log(
      'ability.function.getAbilityFunctionInput'
    )

    return JSON.stringify(thisArgs)
  }

  const fieldNames = Object.keys(schema.properties || {})

  // @note rule 1: an ability with no fields takes no input at all

  if (fieldNames.length === 0) {
    return ''
  }

  // @note resolve the field payload from the model arguments. Accept the flat
  // shape, the legacy `{ input: { ... } }` wrapper, and the rule 4 wrapped shape
  // when justification collides with an ability field. Activity justification is
  // always a sibling, never part of the fields, so it is dropped here.

  const justificationApplies = !!options?.includeJustification

  let payload: Record<string, unknown>

  if (justificationApplies && fieldNames.includes('justification')) {
    // @note rule 4: the fields are wrapped under `input` so the activity
    // justification can sit beside them at the top level
    payload =
      typeof thisArgs.input === 'object' && thisArgs.input !== null
        ? (thisArgs.input as Record<string, unknown>)
        : {}
  } else if (
    justificationApplies &&
    'justification' in thisArgs &&
    !fieldNames.includes('justification')
  ) {
    // @note strip the activity justification - it is a sibling, not a field
    const { justification: _justification, ...fields } = thisArgs

    payload = fields
  } else {
    // @note flat only - the fields are the arguments verbatim. The legacy
    // `{ input: { ... } }` wrapper is no longer unwrapped; a stray `input` key
    // is just an unexpected property and is stripped by validation.
    payload = thisArgs
  }

  // @note build defaults from the field schema so required fields get them

  function recurse(
    object: JsonSchema,
    parent?: JsonSchema,
    name?: string
  ): unknown {
    const isRequiredField =
      parent?.type === 'object' && parent.required?.includes(name || '')

    switch (object.type) {
      case 'object': {
        if (object.default !== undefined) {
          return object.default
        }

        if (!object.properties) {
          return parent ? undefined : {}
        }

        const value = Object.fromEntries(
          Object.entries(object.properties)
            .map(([key, value]) => {
              return [key, recurse(value, object, key)]
            })
            .filter(([, value]) => value !== undefined)
        )

        if (parent && Object.keys(value).length === 0) {
          return undefined
        }

        return value
      }

      case 'array': {
        if (object.default !== undefined) {
          return object.default
        }

        if (isRequiredField) {
          return undefined
        }

        if (!object.items) {
          return []
        }

        const itemDefault = recurse(object.items, object)

        return itemDefault !== undefined ? [itemDefault] : []
      }

      default: {
        if (object.default !== undefined) {
          return object.default
        }

        if ('enum' in object && object.enum) {
          if (isRequiredField) {
            return object.enum[0]
          }
        }
      }
    }
  }

  const defaults = recurse(schema)

  // @note merge defaults first so required fields get them; user-provided arrays
  // replace defaults rather than concatenating

  const merged = mergeAll([defaults, payload] as object[], {
    arrayMerge: (_target, source) => source,
  }) as Record<string, unknown>

  // @note coerce string values to numbers for number fields - LLMs sometimes
  // serialize numeric arguments as strings, which Zod 4 strict parsing rejects

  if (schema.properties) {
    for (const [key, fieldSchema] of Object.entries(schema.properties)) {
      const value = merged[key]

      if (
        (fieldSchema as JsonSchema).type === 'number' &&
        typeof value === 'string' &&
        value.trim() !== '' &&
        !isNaN(Number(value))
      ) {
        merged[key] = Number(value)
      }
    }
  }

  // @note validate and strip extra properties against the field schema

  try {
    // @note cast to unknown first since our JsonSchema type is stricter than what zod-from-json-schema expects
    const zodSchema = convertJsonSchemaToZod(
      schema as unknown as Parameters<typeof convertJsonSchemaToZod>[0]
    )

    const validated = zodSchema.parse(merged) as Record<string, unknown>

    debug(`generated ability function input`, { ability, args, validated }).log(
      'ability.function.getAbilityFunctionInput'
    )

    return JSON.stringify(validated)
  } catch (error) {
    // @note Zod validation failed, throw a friendly error

    debug(`Zod validation failed`, { error }).log(
      'ability.function.getAbilityFunctionInput'
    )

    // @note check by name instead of instanceof - zod-from-json-schema uses its
    // own Zod 4 instance, different from our Zod 3 instance

    if (
      error instanceof Error &&
      error.name === 'ZodError' &&
      'issues' in error
    ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const friendlyMessage = fromZodError(error as any, {
        prefix: null,
      }).message

      // @note Zod 4 already prefixes its messages with "Invalid input:", so only
      // add our own prefix when it isn't already there

      const normalizedMessage = /^invalid input/i.test(friendlyMessage)
        ? friendlyMessage
        : `Invalid input: ${friendlyMessage}`

      throw new BotInputError(withExpectedSchema(normalizedMessage, ability))
    }

    // @note for non-Zod errors (e.g., schema conversion issues), rethrow

    throw error
  }
}

/**
 * Get the ability function justification.
 *
 * @throws {BotInputError} When the justification is not a string
 */
export function getAbilityFunctionJustification(
  ability: Pick<Ability, 'id' | 'instruction' | 'meta'>,
  args: unknown,
  options?: Record<string, unknown>
): string | undefined {
  debug(`getAbilityFunctionJustification`, { ability, args, options }).log(
    'ability.function.getAbilityFunctionJustification'
  )

  if (!args) {
    return undefined
  }

  const thisArgs = normalizeAbilityArgs(args)

  if (!thisArgs) {
    return undefined
  }

  if (thisArgs.justification === null || thisArgs.justification === undefined) {
    return undefined
  }

  if (typeof thisArgs.justification !== 'string') {
    throw new BotInputError(
      `Justification must be a string for ability "${ability.id}"`
    )
  }

  debug(`generated ability function justification`, {
    ability,
    args,
    justification: thisArgs.justification,
  }).log('ability.function.getAbilityFunctionJustification')

  return thisArgs.justification
}
