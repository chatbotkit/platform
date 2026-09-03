import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import type {
  SPAWN_OPERATION_NAME as AGENT_SPAWN_OPERATION_NAME,
  SpawnSchema as AgentSpawnSchema,
} from '@/lib/action.exec.agent'
import type {
  BLUEPRINT_BULLETIN_CREATE_OPERATION_NAME,
  BLUEPRINT_BULLETIN_LIST_OPERATION_NAME,
  BLUEPRINT_META_FETCH_OPERATION_NAME,
  BLUEPRINT_NOTE_LIST_OPERATION_NAME,
  BLUEPRINT_RESOURCE_LIST_OPERATION_NAME,
  BlueprintBulletinCreateSchema,
  BlueprintBulletinListSchema,
  BlueprintMetaFetchSchema,
  BlueprintNoteListSchema,
  BlueprintResourceListSchema,
} from '@/lib/action.exec.blueprint'
import type {
  BOT_APPLY_OPERATION_NAME,
  BOT_ASK_OPERATION_NAME,
  BOT_BACKSTORY_READ_OPERATION_NAME,
  BOT_BACKSTORY_WRITE_OPERATION_NAME,
  BOT_CALL_OPERATION_NAME,
  BOT_LIST_OPERATION_NAME,
  BotApplySchema,
  BotAskSchema,
  BotBackstoryReadSchema,
  BotBackstoryWriteSchema,
  BotCallSchema,
  BotListSchema,
} from '@/lib/action.exec.bot'
import type {
  CONVERSATION_FETCH_OPERATION_NAME,
  CONVERSATION_LIST_OPERATION_NAME,
  CONVERSATION_SEARCH_OPERATION_NAME,
  ConversationFetchSchema,
  ConversationListSchema,
  ConversationSearchSchema,
} from '@/lib/action.exec.conversation'
import type { RequestSchema as FetchRequestSchema } from '@/lib/action.exec.fetch'
import type {
  FILE_APPEND_OPERATION_NAME,
  FILE_PREPEND_OPERATION_NAME,
  FILE_READ_OPERATION_NAME,
  FILE_REPLACE_OPERATION_NAME,
  FILE_RW_OPERATION_NAME,
  FILE_WRITE_OPERATION_NAME,
  FileAppendSchema,
  FilePrependSchema,
  FileReadSchema,
  FileReplaceSchema,
  FileRwSchema,
  FileWriteSchema,
} from '@/lib/action.exec.file'
import type {
  IMAGE_CREATE_OPERATION_NAME,
  IMAGE_EDIT_OPERATION_NAME,
  ImageCreateSchema,
  ImageEditSchema,
} from '@/lib/action.exec.image'
import type {
  LIST_POP_OPERATION_NAME,
  LIST_PUSH_OPERATION_NAME,
  LIST_READ_OPERATION_NAME,
  ListPopSchema,
  ListPushSchema,
  ListReadSchema,
} from '@/lib/action.exec.list'
import type {
  InstallSchema as MCPInstallSchema,
  UninstallSchema as MCPUninstallSchema,
  INSTALL_OPERATION_NAME as MCP_INSTALL_OPERATION_NAME,
  UNINSTALL_OPERATION_NAME as MCP_UNINSTALL_OPERATION_NAME,
} from '@/lib/action.exec.mcp'
import type {
  MEMORY_CREATE_OPERATION_NAME,
  MEMORY_DELETE_OPERATION_NAME,
  MEMORY_LIST_OPERATION_NAME,
  MEMORY_SEARCH_OPERATION_NAME,
  MEMORY_UPDATE_OPERATION_NAME,
  MemoryCreateSchema,
  MemoryDeleteSchema,
  MemoryListSchema,
  MemorySearchSchema,
  MemoryUpdateSchema,
} from '@/lib/action.exec.memory'
import type {
  INSTALL_OPERATION_NAME as PACK_INSTALL_OPERATION_NAME,
  UNINSTALL_OPERATION_NAME as PACK_UNINSTALL_OPERATION_NAME,
  InstallSchema as PackInstallSchema,
  UninstallSchema as PackUninstallSchema,
} from '@/lib/action.exec.pack'
import type {
  RATING_CREATE_OPERATION_NAME,
  RATING_DELETE_OPERATION_NAME,
  RATING_FETCH_OPERATION_NAME,
  RATING_LIST_OPERATION_NAME,
  RatingCreateSchema,
  RatingDeleteSchema,
  RatingFetchSchema,
  RatingListSchema,
} from '@/lib/action.exec.rating'
import type {
  SHELL_EVAL_OPERATION_NAME,
  SHELL_EXEC_OPERATION_NAME,
  SHELL_IMPORT_OPERATION_NAME,
  SHELL_READ_OPERATION_NAME,
  SHELL_REPLACE_OPERATION_NAME,
  SHELL_RW_OPERATION_NAME,
  SHELL_SCRIPT_OPERATION_NAME,
  SHELL_SKILLSET_INSTALL_OPERATION_NAME,
  SHELL_WRITE_OPERATION_NAME,
  ShellEvalSchema,
  ShellExecSchema,
  ShellImportSchema,
  ShellReadSchema,
  ShellReplaceSchema,
  ShellRwSchema,
  ShellScriptSchema,
  ShellSkillsetInstallSchema,
  ShellWriteSchema,
} from '@/lib/action.exec.shell'
import type {
  INSTALL_OPERATION_NAME as SKILLSET_INSTALL_OPERATION_NAME,
  UNINSTALL_OPERATION_NAME as SKILLSET_UNINSTALL_OPERATION_NAME,
  InstallSchema as SkillsetInstallSchema,
  UninstallSchema as SkillsetUninstallSchema,
} from '@/lib/action.exec.skillset'
import type {
  SPACE_CREATE_OPERATION_NAME,
  SPACE_DELETE_OPERATION_NAME,
  SPACE_FETCH_OPERATION_NAME,
  SPACE_LIST_OPERATION_NAME,
  SPACE_STORAGE_COPY_OPERATION_NAME,
  SPACE_STORAGE_DELETE_OPERATION_NAME,
  SPACE_STORAGE_IMPORT_OPERATION_NAME,
  SPACE_STORAGE_LINK_OPERATION_NAME,
  SPACE_STORAGE_LIST_OPERATION_NAME,
  SPACE_STORAGE_MOVE_OPERATION_NAME,
  SPACE_STORAGE_READ_OPERATION_NAME,
  SPACE_STORAGE_RW_OPERATION_NAME,
  SPACE_STORAGE_SEARCH_OPERATION_NAME,
  SPACE_STORAGE_WRITE_OPERATION_NAME,
  SPACE_UPDATE_OPERATION_NAME,
  SpaceCreateSchema,
  SpaceDeleteSchema,
  SpaceFetchSchema,
  SpaceListSchema,
  SpaceStorageCopySchema,
  SpaceStorageDeleteSchema,
  SpaceStorageImportSchema,
  SpaceStorageLinkSchema,
  SpaceStorageListSchema,
  SpaceStorageMoveSchema,
  SpaceStorageReadSchema,
  SpaceStorageRwSchema,
  SpaceStorageSearchSchema,
  SpaceStorageWriteSchema,
  SpaceUpdateSchema,
} from '@/lib/action.exec.space'
import type {
  TASK_CREATE_OPERATION_NAME,
  TASK_DELETE_OPERATION_NAME,
  TASK_FETCH_OPERATION_NAME,
  TASK_LIST_OPERATION_NAME,
  TASK_RUN_OPERATION_NAME,
  TASK_UPDATE_OPERATION_NAME,
  TaskCreateSchema,
  TaskDeleteSchema,
  TaskFetchSchema,
  TaskListSchema,
  TaskRunSchema,
  TaskUpdateSchema,
} from '@/lib/action.exec.task'
import type {
  TIME_NOW_OPERATION_NAME,
  TimeNowSchema,
} from '@/lib/action.exec.time'
import type {
  TODO_MANAGE_OPERATION_NAME,
  TodoManageSchema,
} from '@/lib/action.exec.todo'
import { ActionName } from '@/lib/action.name'
import { SafeInputError } from '@/lib/error'
import { z } from '@/lib/zod.schema'

import yaml from 'js-yaml'

/**
 * The yaml.Type instance contains the following properties and functions
 *
 * `kind`: The kind of YAML node the tag applies to. It can be 'scalar',
 * 'sequence', or 'mapping', corresponding to YAML scalar values, arrays, and
 * objects, respectively.
 *
 * `resolve`: A function used during the parsing (loading) process. It takes the
 * raw data associated with the tag and determines if it is valid for this
 * custom type. It must return true if the data is valid and can be processed by
 * the construct function, or false otherwise.
 *
 * `construct`: A function also used during the parsing (loading) process. If
 * resolve returns true, this function is called to transform the parsed YAML
 * data into the desired JavaScript object or value.
 *
 * `represent`: A function used during the serialization (dumping) process. It
 * takes a JavaScript object instance of the custom type and converts it back
 * into a YAML-compatible scalar or structure (string, object, etc.).
 *
 * `predicate`: A function used during the serialization (dumping) process. It
 * acts as a type guard for the dumper, checking if a given JavaScript object
 * instance matches the custom type. If it returns true, the represent function
 * is then used to output the data with the correct tag in the YAML file.
 */

// --- SYMBOLS ---

/**
 * Symbol used to indicate that an optional field should be omitted from the output
 * when no value is provided and no default is set.
 */
export const OMIT_FIELD = Symbol('OMIT_FIELD')

// --- UTILITY TYPES ---

/**
 * Helper type that enforces all keys from T must be present in the Zod schema shape.
 * Uses the -? modifier to make all keys required in the shape definition, which means
 * missing optional fields will cause a TypeScript error.
 *
 * @example
 * // This will error - 'timeout' key is missing:
 * const bad = z.object({
 *   cmd: z.string(),
 * }) satisfies EnsureSchemaKeys<ShellExecSchema>
 *
 * // This is correct - all keys present:
 * const good = z.object({
 *   cmd: z.string(),
 *   timeout: z.number().optional()
 * }) satisfies EnsureSchemaKeys<ShellExecSchema>
 */
type EnsureSchemaKeys<T> = z.ZodObject<
  {
    [K in keyof T]-?: z.ZodTypeAny
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any
>

/**
 * Compound utility type that combines WithDynamic and EnsureSchemaKeys for convenience.
 * Use this for all action tag schemas to ensure all keys are present and dynamic field
 * types are supported.
 *
 * @example
 * const shellExecSchema = z.object({
 *   cmd: dynamicStringSchema,
 *   timeout: dynamicNumberSchema.optional()
 * }) satisfies EnsureAllSchemaKeys<ShellExecSchema>
 */
type EnsureAllSchemaKeys<T> = EnsureSchemaKeys<WithDynamic<T>>

/**
 * Type that finds keys present in Source but missing from Actual.
 * Returns `never` if all keys are present, otherwise returns the missing key names.
 */
type MissingKeys<Actual, Source> = Exclude<
  keyof NonNullable<Source>,
  keyof NonNullable<Actual>
>

/**
 * Compile-time assertion that all keys from Source exist in Actual.
 * Evaluates to `true` if complete, or an error type with missing keys otherwise.
 *
 * @note Use this to validate nested object schemas that EnsureAllSchemaKeys misses.
 *
 * @example
 * type _Check = AssertNestedKeysPresent<
 *   z.infer<typeof mySchema>['options'],
 *   SourceType['options']
 * >
 * const _: _Check = true  // Compile error if keys are missing!
 */
type AssertNestedKeysPresent<Actual, Source> = [
  MissingKeys<Actual, Source>,
] extends [never]
  ? true
  : {
      __SCHEMA_SYNC_ERROR__: `Missing nested keys: ${MissingKeys<Actual, Source> & string}`
    }

// --- BASE CLASSES ---

/**
 * Common interface for all tag field value types. All field types (string,
 * number, boolean, array, object) share these properties.
 */
export interface TagFieldValue {
  name: string
  description?: string
  optional?: boolean
  default?: unknown
  placeholder?: boolean
  min?: number
  max?: number
}

/**
 * Base class for all field types. Provides common substitution logic.
 */
export abstract class BaseField<T extends TagFieldValue> {
  constructor(public readonly value: T) {}

  /**
   * Substitutes this field with a value from the fieldValues map.
   * Returns the resolved value or the default value.
   */
  abstract substitute(fieldValues: Record<string, unknown>): unknown
}

/**
 * Base class for all action types. Provides common serialization logic.
 */
abstract class BaseAction<T> {
  constructor(public readonly value: T) {}

  /**
   * The action name (e.g., 'fetch', 'skillset', 'mcp', 'pack')
   */
  abstract get action(): ActionName

  /**
   * The operation name, if any (e.g., 'install' for skillset/mcp, 'execute' for pack, etc.)
   */
  get operation(): string | undefined {
    return undefined
  }

  /**
   * Substitutes all field tags in this action with their resolved values.
   * Returns a new action instance with substituted values.
   */
  abstract substitute(fieldValues: Record<string, unknown>): BaseAction<T>

  /**
   * Converts this action to an action result with action name, params, and text.
   */
  toActionResult(): ActionResult {
    const yamlContent = yaml.dump(this.value, {
      schema: ACTION_TAGS_SCHEMA,
      forceQuotes: true,
      quotingType: '"',
    })

    // @note include operation in params if present

    const params: Record<string, unknown> = {}

    if (this.operation) {
      params[this.operation] = true

      for (let item of this.operation.split('/')) {
        item = item.trim()

        if (item) {
          params[item] = true
        }
      }
    }

    return {
      action: this.action,
      params,
      text: yamlContent.trim(),
    }
  }
}

/**
 * Result type for action tag conversion.
 */
export type ActionResult = {
  action: ActionName
  params: Record<string, unknown>
  text: string
}

// --- FIELDS ---

// @note nested field schemas don't require 'name' since they inherit context
// from parent these are used for items inside arrays and properties inside
// objects

const nestedStringFieldSchema = z.object({
  name: z.string().optional(),
  type: z.literal('string').optional(),
  description: z.string().optional(),
  optional: z.boolean().default(false),
  enum: z.array(z.string()).optional(),
  default: z.string().optional(),
  placeholder: z.boolean().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  transform: z
    .array(z.enum(['lower', 'upper', 'trim', 'urlencode']))
    .optional(),
})

const nestedNumberFieldSchema = z.object({
  name: z.string().optional(),
  type: z.literal('number').optional(),
  description: z.string().optional(),
  optional: z.boolean().default(false),
  enum: z.array(z.number()).optional(),
  default: z.number().optional(),
  placeholder: z.boolean().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
})

const nestedBooleanFieldSchema = z.object({
  name: z.string().optional(),
  type: z.literal('boolean').optional(),
  description: z.string().optional(),
  optional: z.boolean().default(false),
  default: z.boolean().optional(),
  placeholder: z.boolean().optional(),
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nestedArrayFieldSchema: z.ZodLazy<any> = z.lazy(() =>
  z.object({
    name: z.string().optional(),
    type: z.literal('array').optional(),
    description: z.string().optional(),
    optional: z.boolean().default(false),
    items: z.union([
      nestedStringFieldSchema,
      nestedNumberFieldSchema,
      nestedBooleanFieldSchema,
      nestedArrayFieldSchema,
      nestedObjectFieldSchema,
    ]),
    default: z.array(z.unknown()).optional(),
    placeholder: z.boolean().optional(),
  })
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nestedObjectFieldSchema: z.ZodLazy<any> = z.lazy(() =>
  z.object({
    name: z.string().optional(),
    type: z.literal('object').optional(),
    description: z.string().optional(),
    optional: z.boolean().default(false),
    properties: z.record(
      z.union([
        nestedStringFieldSchema,
        nestedNumberFieldSchema,
        nestedBooleanFieldSchema,
        nestedArrayFieldSchema,
        nestedObjectFieldSchema,
      ])
    ),
    default: z.record(z.unknown()).optional(),
    placeholder: z.boolean().optional(),
  })
)

const nestedFieldSchema = z.union([
  nestedStringFieldSchema,
  nestedNumberFieldSchema,
  nestedBooleanFieldSchema,
  nestedArrayFieldSchema,
  nestedObjectFieldSchema,
])

// @note top-level field schemas require 'name' for substitution

const stringFieldSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  optional: z.boolean().default(false),
  enum: z.array(z.string()).optional(),
  default: z.string().optional(),
  placeholder: z.boolean().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  transform: z
    .array(z.enum(['lower', 'upper', 'trim', 'urlencode']))
    .optional(),
})

const numberFieldSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  optional: z.boolean().default(false),
  enum: z.array(z.number()).optional(),
  default: z.number().optional(),
  placeholder: z.boolean().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
})

const booleanFieldSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  optional: z.boolean().default(false),
  default: z.boolean().optional(),
  placeholder: z.boolean().optional(),
})

const arrayFieldSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  optional: z.boolean().default(false),
  items: nestedFieldSchema,
  default: z.array(z.unknown()).optional(),
  placeholder: z.boolean().optional(),
})

const objectFieldSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  optional: z.boolean().default(false),
  properties: z.record(nestedFieldSchema),
  default: z.record(z.unknown()).optional(),
  placeholder: z.boolean().optional(),
})

export class StringField extends BaseField<z.infer<typeof stringFieldSchema>> {
  substitute(fieldValues: Record<string, unknown>): string | typeof OMIT_FIELD {
    const resolvedValue = fieldValues[this.value.name]

    if (resolvedValue !== undefined && resolvedValue !== null) {
      let result = String(resolvedValue)

      // @note apply transforms if specified

      if (this.value.transform) {
        for (const transform of this.value.transform) {
          switch (transform) {
            case 'lower': {
              result = result.toLowerCase()

              break
            }

            case 'upper': {
              result = result.toUpperCase()

              break
            }

            case 'trim': {
              result = result.trim()

              break
            }

            case 'urlencode': {
              result = encodeURIComponent(result)

              break
            }

            default:
              assertUnreachable(transform)
          }
        }
      }

      return result
    }

    // @note if a default is provided, use it

    if (this.value.default !== undefined) {
      return this.value.default
    }

    // @note if optional, omit the field; otherwise throw error for required field

    if (this.value.optional) {
      return OMIT_FIELD
    }

    throw new SafeInputError(
      `Required field '${this.value.name}' was not provided`
    )
  }
}

export class NumberField extends BaseField<z.infer<typeof numberFieldSchema>> {
  substitute(fieldValues: Record<string, unknown>): number | typeof OMIT_FIELD {
    const resolvedValue = fieldValues[this.value.name]

    if (resolvedValue !== undefined && resolvedValue !== null) {
      return Number(resolvedValue)
    }

    // @note if a default is provided, use it

    if (this.value.default !== undefined) {
      return this.value.default
    }

    // @note if optional, omit the field; otherwise throw error for required field

    if (this.value.optional) {
      return OMIT_FIELD
    }

    throw new SafeInputError(
      `Required field '${this.value.name}' was not provided`
    )
  }
}

export class BooleanField extends BaseField<
  z.infer<typeof booleanFieldSchema>
> {
  substitute(
    fieldValues: Record<string, unknown>
  ): boolean | typeof OMIT_FIELD {
    const resolvedValue = fieldValues[this.value.name]

    if (resolvedValue !== undefined && resolvedValue !== null) {
      return Boolean(resolvedValue)
    }

    // @note if a default is provided, use it

    if (this.value.default !== undefined) {
      return this.value.default
    }

    // @note if optional, omit the field; otherwise throw error for required field

    if (this.value.optional) {
      return OMIT_FIELD
    }

    throw new SafeInputError(
      `Required field '${this.value.name}' was not provided`
    )
  }
}

export class ArrayField extends BaseField<z.infer<typeof arrayFieldSchema>> {
  substitute(
    fieldValues: Record<string, unknown>
  ): unknown[] | typeof OMIT_FIELD {
    const resolvedValue = fieldValues[this.value.name]

    if (resolvedValue !== undefined && Array.isArray(resolvedValue)) {
      return resolvedValue
    }

    // @note if a default is provided, use it

    if (this.value.default !== undefined) {
      return this.value.default
    }

    // @note if optional, omit the field; otherwise throw error for required field

    if (this.value.optional) {
      return OMIT_FIELD
    }

    throw new SafeInputError(
      `Required field '${this.value.name}' was not provided`
    )
  }
}

export class ObjectField extends BaseField<z.infer<typeof objectFieldSchema>> {
  substitute(
    fieldValues: Record<string, unknown>
  ): Record<string, unknown> | typeof OMIT_FIELD {
    const resolvedValue = fieldValues[this.value.name]

    if (
      resolvedValue !== undefined &&
      typeof resolvedValue === 'object' &&
      resolvedValue !== null
    ) {
      return resolvedValue as Record<string, unknown>
    }

    // @note if a default is provided, use it

    if (this.value.default !== undefined) {
      return this.value.default
    }

    // @note if optional, omit the field; otherwise throw error for required field

    if (this.value.optional) {
      return OMIT_FIELD
    }

    throw new SafeInputError(
      `Required field '${this.value.name}' was not provided`
    )
  }
}

const stringTag = new yaml.Type('!string', {
  kind: 'mapping',
  instanceOf: StringField,

  construct(data: Record<string, unknown>): StringField {
    return new StringField(stringFieldSchema.parse(data))
  },

  represent(tag: StringField): z.infer<typeof stringFieldSchema> {
    return tag.value
  },
})

const numberTag = new yaml.Type('!number', {
  kind: 'mapping',
  instanceOf: NumberField,

  construct(data: Record<string, unknown>): NumberField {
    return new NumberField(numberFieldSchema.parse(data))
  },

  represent(tag: NumberField): z.infer<typeof numberFieldSchema> {
    return tag.value
  },
})

const booleanTag = new yaml.Type('!boolean', {
  kind: 'mapping',
  instanceOf: BooleanField,

  construct(data: Record<string, unknown>): BooleanField {
    return new BooleanField(booleanFieldSchema.parse(data))
  },

  represent(tag: BooleanField): z.infer<typeof booleanFieldSchema> {
    return tag.value
  },
})

/**
 * Recursively converts field class instances in parsed data to their plain value
 * representation. This is needed because js-yaml parses nested tags before the
 * parent, so when parsing !array, the !object inside items is already an ObjectField.
 *
 * @param data - The parsed data that may contain field class instances
 * @returns The data with field instances converted to plain objects
 */
function convertFieldInstancesToPlain(data: unknown): unknown {
  if (data instanceof StringField) {
    return { type: 'string', ...data.value }
  } else if (data instanceof NumberField) {
    return { type: 'number', ...data.value }
  } else if (data instanceof BooleanField) {
    return { type: 'boolean', ...data.value }
  } else if (data instanceof ArrayField) {
    return {
      type: 'array',
      ...data.value,
      items: convertFieldInstancesToPlain(data.value.items),
    }
  } else if (data instanceof ObjectField) {
    const properties: Record<string, unknown> = {}

    if (data.value.properties) {
      for (const [key, propValue] of Object.entries(data.value.properties)) {
        properties[key] = convertFieldInstancesToPlain(propValue)
      }
    }

    return {
      type: 'object',
      ...data.value,
      properties,
    }
  } else if (Array.isArray(data)) {
    return data.map(convertFieldInstancesToPlain)
  } else if (data && typeof data === 'object') {
    const result: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(data)) {
      result[key] = convertFieldInstancesToPlain(value)
    }

    return result
  }

  return data
}

const arrayTag = new yaml.Type('!array', {
  kind: 'mapping',
  instanceOf: ArrayField,

  construct(data: Record<string, unknown>): ArrayField {
    // @note convert any nested field instances (e.g., !object in items) to
    // plain objects

    const converted = convertFieldInstancesToPlain(data) as Record<
      string,
      unknown
    >

    return new ArrayField(arrayFieldSchema.parse(converted))
  },

  represent(tag: ArrayField): z.infer<typeof arrayFieldSchema> {
    return tag.value
  },
})

const objectTag = new yaml.Type('!object', {
  kind: 'mapping',
  instanceOf: ObjectField,

  construct(data: Record<string, unknown>): ObjectField {
    // @note convert any nested field instances in properties to plain objects

    const converted = convertFieldInstancesToPlain(data) as Record<
      string,
      unknown
    >

    return new ObjectField(objectFieldSchema.parse(converted))
  },

  represent(tag: ObjectField): z.infer<typeof objectFieldSchema> {
    return tag.value
  },
})

const optionalStringTag = new yaml.Type('!string?', {
  kind: 'mapping',
  instanceOf: StringField,

  construct(data: Record<string, unknown>): StringField {
    return new StringField(
      stringFieldSchema
        .extend({ optional: z.boolean().default(true) })
        .parse(data)
    )
  },

  represent(tag: StringField): z.infer<typeof stringFieldSchema> {
    return tag.value
  },
})

const optionalNumberTag = new yaml.Type('!number?', {
  kind: 'mapping',
  instanceOf: NumberField,

  construct(data: Record<string, unknown>): NumberField {
    return new NumberField(
      numberFieldSchema
        .extend({ optional: z.boolean().default(true) })
        .parse(data)
    )
  },

  represent(tag: NumberField): z.infer<typeof numberFieldSchema> {
    return tag.value
  },
})

const optionalBooleanTag = new yaml.Type('!boolean?', {
  kind: 'mapping',
  instanceOf: BooleanField,

  construct(data: Record<string, unknown>): BooleanField {
    return new BooleanField(
      booleanFieldSchema
        .extend({ optional: z.boolean().default(true) })
        .parse(data)
    )
  },

  represent(tag: BooleanField): z.infer<typeof booleanFieldSchema> {
    return tag.value
  },
})

const optionalArrayTag = new yaml.Type('!array?', {
  kind: 'mapping',
  instanceOf: ArrayField,

  construct(data: Record<string, unknown>): ArrayField {
    return new ArrayField(
      arrayFieldSchema
        .extend({ optional: z.boolean().default(true) })
        .parse(data)
    )
  },

  represent(tag: ArrayField): z.infer<typeof arrayFieldSchema> {
    return tag.value
  },
})

const optionalObjectTag = new yaml.Type('!object?', {
  kind: 'mapping',
  instanceOf: ObjectField,

  construct(data: Record<string, unknown>): ObjectField {
    return new ObjectField(
      objectFieldSchema
        .extend({ optional: z.boolean().default(true) })
        .parse(data)
    )
  },

  represent(tag: ObjectField): z.infer<typeof objectFieldSchema> {
    return tag.value
  },
})

// --- SPECIAL ---

export class Reference {
  constructor(public readonly name: string) {}

  /**
   * Converts this reference to a placeholder format: ${name}
   */
  toPlaceholder(): string {
    return `\${${this.name}}`
  }

  /**
   * Substitutes this reference with a value from the referenceValues map.
   * If no value is provided, returns the placeholder format.
   */
  substitute(referenceValues: Record<string, unknown>): unknown {
    const resolvedValue = referenceValues[this.name]

    if (resolvedValue !== undefined) {
      return resolvedValue
    }

    return this.toPlaceholder()
  }
}

const referenceTag = new yaml.Type('!reference', {
  kind: 'scalar',
  instanceOf: Reference,

  construct(data: string): Reference {
    return new Reference(data)
  },

  represent(tag: Reference): string {
    return tag.name
  },
})

// --- UTILITIES ---

const concatSchema = z.array(
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.instanceof(StringField),
    z.instanceof(NumberField),
    z.instanceof(BooleanField),
    z.instanceof(Reference),
  ])
)

export class Concat {
  constructor(public readonly value: z.infer<typeof concatSchema>) {}

  /**
   * Substitutes all field tags in this concat and joins the results.
   */
  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): string {
    return this.value
      .map((item) => {
        // @note an omitted optional field (no value, no default) resolves to
        // the OMIT_FIELD symbol; within a concat it contributes nothing rather
        // than crashing join() with "Cannot convert a Symbol value to a string"
        if (item instanceof StringField) {
          const substituted = item.substitute(fieldValues)

          return substituted === OMIT_FIELD ? '' : substituted
        }

        if (item instanceof NumberField) {
          const substituted = item.substitute(fieldValues)

          return substituted === OMIT_FIELD ? '' : String(substituted)
        }

        if (item instanceof BooleanField) {
          const substituted = item.substitute(fieldValues)

          return substituted === OMIT_FIELD ? '' : String(substituted)
        }

        if (item instanceof Reference) {
          return String(item.substitute(referenceValues))
        }

        if (
          typeof item === 'string' ||
          typeof item === 'number' ||
          typeof item === 'boolean'
        ) {
          return String(item)
        }

        assertUnreachable(item)
      })
      .join('')
  }
}

const concat = new yaml.Type('!concat', {
  kind: 'sequence',
  instanceOf: Concat,

  construct(def: Array<unknown>): Concat {
    return new Concat(concatSchema.parse(def))
  },

  represent(tag: Concat): z.infer<typeof concatSchema> {
    return tag.value
  },
})

// --- SUBSTITUTION ---

/**
 * Union of all field tag types that can be substituted.
 */
type FieldTag =
  | StringField
  | NumberField
  | BooleanField
  | ArrayField
  | ObjectField
  | Reference
  | Concat

/**
 * Union of all substitutable tag types. Uses ActionInstance from the centralized
 * ACTION_CLASSES registry to ensure all action classes are automatically included.
 *
 * When adding a new action class, add it to ACTION_CLASSES and it will
 * automatically be included here.
 */
type SubstitutableTag = FieldTag | ActionInstance

/**
 * Array of field tag classes for runtime checking.
 */
const FIELD_CLASSES = [
  StringField,
  NumberField,
  BooleanField,
  ArrayField,
  ObjectField,
  Reference,
  Concat,
] as const

/**
 * Substitutes a known tag type with its resolved value.
 */
function substituteTag(
  tag: SubstitutableTag,
  fieldValues: Record<string, unknown>,
  referenceValues: Record<string, unknown> = {}
): unknown {
  if (tag instanceof StringField) {
    return tag.substitute(fieldValues)
  }

  if (tag instanceof NumberField) {
    return tag.substitute(fieldValues)
  }

  if (tag instanceof BooleanField) {
    return tag.substitute(fieldValues)
  }

  if (tag instanceof ArrayField) {
    return tag.substitute(fieldValues)
  }

  if (tag instanceof ObjectField) {
    return tag.substitute(fieldValues)
  }

  if (tag instanceof Reference) {
    return tag.substitute(referenceValues)
  }

  if (tag instanceof Concat) {
    return tag.substitute(fieldValues, referenceValues)
  }

  // @note action tags have their own substitute methods that return new instances

  if (tag instanceof FetchAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof PackInstallAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof PackUninstallAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof SkillsetInstallAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof SkillsetUninstallAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof McpInstallAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof McpUninstallAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof TaskListAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof TaskFetchAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof TaskCreateAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof TaskUpdateAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof TaskDeleteAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof TaskRunAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof TimeNowAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof RatingListAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof RatingFetchAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof RatingCreateAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof RatingDeleteAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof FileReadAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof FileWriteAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof FilePrependAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof FileAppendAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof FileReplaceAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof FileRwAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof MemoryListAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof MemorySearchAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof MemoryCreateAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof MemoryUpdateAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof MemoryDeleteAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof ConversationListAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof ConversationFetchAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof ConversationSearchAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof SpaceListAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof SpaceFetchAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof SpaceCreateAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof SpaceUpdateAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof SpaceDeleteAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof SpaceStorageListAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof SpaceStorageReadAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof SpaceStorageWriteAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof SpaceStorageRwAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof SpaceStorageMoveAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof SpaceStorageCopyAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof SpaceStorageDeleteAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof SpaceStorageSearchAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof SpaceStorageImportAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof SpaceStorageLinkAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof ShellExecAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof ShellScriptAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof ShellReadAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof ShellWriteAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof ShellRwAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof ShellReplaceAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof ShellEvalAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof ShellImportAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof ShellSkillsetInstallAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof BlueprintResourceListAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof BlueprintNoteListAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof BlueprintBulletinListAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof BlueprintBulletinCreateAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof BlueprintMetaFetchAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof AgentSpawnAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof EchoAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof AbortAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof TodoManageAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof ListPushAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof ListPopAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof ListReadAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof ImageCreateAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof ImageEditAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof BotAskAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof BotCallAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof BotApplyAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof BotListAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof BotBackstoryReadAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  if (tag instanceof BotBackstoryWriteAction) {
    return tag.substitute(fieldValues, referenceValues)
  }

  assertUnreachable(tag)
}

/**
 * Type guard to check if a value is a field tag.
 */
function isFieldTag(value: unknown): value is FieldTag {
  return FIELD_CLASSES.some((FieldClass) => value instanceof FieldClass)
}

/**
 * Type guard to check if a value is a substitutable tag.
 * Uses the centralized FIELD_CLASSES and ACTION_CLASSES registries.
 */
function isSubstitutableTag(value: unknown): value is SubstitutableTag {
  return isFieldTag(value) || isActionTag(value)
}

/**
 * Recursively substitutes field tags in a value with their resolved values.
 * This is used by action classes to substitute their nested values.
 */
function substituteInValue(
  value: unknown,
  fieldValues: Record<string, unknown>,
  referenceValues: Record<string, unknown> = {}
): unknown {
  if (isSubstitutableTag(value)) {
    const result = substituteTag(value, fieldValues, referenceValues)

    // @note return OMIT_FIELD as-is so parent objects can filter it out

    return result
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => substituteInValue(item, fieldValues, referenceValues))
      .filter((item) => item !== OMIT_FIELD)
  }

  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {}

    for (const [key, v] of Object.entries(value)) {
      const substituted = substituteInValue(v, fieldValues, referenceValues)

      // @note filter out OMIT_FIELD values from the result object

      if (substituted !== OMIT_FIELD) {
        result[key] = substituted
      }
    }

    return result
  }

  return value
}

// --- DYNAMIC ---

type WithDynamic<T> = T extends string
  ? T | StringField | Concat | Reference
  : T extends number
    ? T | NumberField
    : T extends boolean
      ? T | BooleanField
      : T extends Array<infer U>
        ? Array<WithDynamic<U>> | ArrayField
        : T extends object
          ? { [K in keyof T]: WithDynamic<T[K]> }
          : T

const dynamicStringSchema = z.union([
  z.string(),
  z.instanceof(StringField),
  z.instanceof(Concat),
  z.instanceof(Reference),
])

const dynamicNumberSchema = z.union([z.number(), z.instanceof(NumberField)])

const dynamicBooleanSchema = z.union([z.boolean(), z.instanceof(BooleanField)])

const dynamicValueSchema = z.union([
  dynamicStringSchema,
  dynamicNumberSchema,
  dynamicBooleanSchema,
])

// --- ACTIONS ---

// @note We deliberately rebuild the schemas by type to avoid importing all
// dependent files and create bloated bundles and security issues
//
// @note for action tag schemas, we use WithDynamic<T> to allow field tags in
// place of literal values. We use `satisfies` instead of createSchemaByType
// because the dynamic schema intentionally extends the base type with
// additional variants

const fetchRequestSchema = z.object({
  method: z
    .union([
      z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']),
      z.instanceof(StringField),
      z.instanceof(Concat),
      z.instanceof(Reference),
    ])
    .optional(),
  url: dynamicStringSchema,
  path: z.array(dynamicValueSchema).optional(),
  query: z.record(dynamicValueSchema).optional(),
  headers: z
    .union([z.record(dynamicValueSchema), z.instanceof(ObjectField)])
    .optional(),
  authorization: dynamicStringSchema.optional(),
  body: z.union([dynamicStringSchema, z.record(z.unknown())]).optional(),
  options: z
    .object({
      text: dynamicBooleanSchema.optional(),
      format: dynamicStringSchema.optional(),
      selectors: dynamicStringSchema.optional(),
      jsonpath: dynamicStringSchema.optional(),
      jmespath: dynamicStringSchema.optional(),
      errorJsonpath: dynamicStringSchema.optional(),
      errorJmespath: dynamicStringSchema.optional(),
      error: z
        .object({
          jsonpath: dynamicStringSchema.optional(),
          jmespath: dynamicStringSchema.optional(),
        })
        .optional(),
      rerank: dynamicStringSchema.optional(),
      transformNestedStrings: z
        .object({
          json: z.union([dynamicBooleanSchema, z.literal('toon')]).optional(),
          html: z.enum(['text', 'json', 'toon']).optional(),
          xml: z.enum(['text', 'json', 'toon']).optional(),
        })
        .optional(),
      auth: z.enum(['internal']).optional(),
      debug: dynamicBooleanSchema.optional(),
      context: z.array(z.enum(['user', 'conversation', 'contact'])).optional(),
      _internal: z
        .object({
          template: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
}) satisfies EnsureAllSchemaKeys<FetchRequestSchema>

// @note compile-time assertion that nested options keys stay in sync with source schema
{
  type _AssertFetchOptionsComplete = AssertNestedKeysPresent<
    z.infer<typeof fetchRequestSchema>['options'],
    FetchRequestSchema['options']
  >
  const _assertFetchOptions: _AssertFetchOptionsComplete = true
}

export class FetchAction extends BaseAction<
  z.infer<typeof fetchRequestSchema>
> {
  get action(): ActionName {
    return ActionName.fetch
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): FetchAction {
    return new FetchAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const fetch = new yaml.Type('!fetch', {
  kind: 'mapping',
  instanceOf: FetchAction,

  construct(def: Record<string, unknown>): FetchAction {
    return new FetchAction(fetchRequestSchema.parse(def))
  },

  represent(tag: FetchAction): z.infer<typeof fetchRequestSchema> {
    return tag.value
  },
})

const skillsetInstallSchema = z.object({
  skillsetId: dynamicStringSchema,
  prefix: dynamicStringSchema.optional(),
}) satisfies EnsureAllSchemaKeys<SkillsetInstallSchema>

export class SkillsetInstallAction extends BaseAction<
  z.infer<typeof skillsetInstallSchema>
> {
  get action(): ActionName {
    return ActionName.skillset
  }

  override get operation(): string {
    return 'install' satisfies typeof SKILLSET_INSTALL_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): SkillsetInstallAction {
    return new SkillsetInstallAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const skillsetInstall = new yaml.Type('!skillset.install', {
  kind: 'mapping',
  instanceOf: SkillsetInstallAction,

  construct(def: Record<string, unknown>): SkillsetInstallAction {
    return new SkillsetInstallAction(skillsetInstallSchema.parse(def))
  },

  represent(tag: SkillsetInstallAction): z.infer<typeof skillsetInstallSchema> {
    return tag.value
  },
})

const skillsetUninstallSchema = z.object({
  skillsetId: dynamicStringSchema,
}) satisfies EnsureAllSchemaKeys<SkillsetUninstallSchema>

export class SkillsetUninstallAction extends BaseAction<
  z.infer<typeof skillsetUninstallSchema>
> {
  get action(): ActionName {
    return ActionName.skillset
  }

  override get operation(): string {
    return 'uninstall' satisfies typeof SKILLSET_UNINSTALL_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): SkillsetUninstallAction {
    return new SkillsetUninstallAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const skillsetUninstall = new yaml.Type('!skillset.uninstall', {
  kind: 'mapping',
  instanceOf: SkillsetUninstallAction,

  construct(def: Record<string, unknown>): SkillsetUninstallAction {
    return new SkillsetUninstallAction(skillsetUninstallSchema.parse(def))
  },

  represent(
    tag: SkillsetUninstallAction
  ): z.infer<typeof skillsetUninstallSchema> {
    return tag.value
  },
})

const mcpInstallSchema = z.object({
  url: dynamicStringSchema,
  headers: z.record(dynamicValueSchema).optional(),
  tools: z
    .union([z.array(dynamicStringSchema), dynamicStringSchema])
    .optional(),
  prefix: dynamicStringSchema.optional(),
}) satisfies EnsureAllSchemaKeys<MCPInstallSchema>

export class McpInstallAction extends BaseAction<
  z.infer<typeof mcpInstallSchema>
> {
  get action(): ActionName {
    return ActionName.mcp
  }

  override get operation(): string {
    return 'install' satisfies typeof MCP_INSTALL_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): McpInstallAction {
    return new McpInstallAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const mcpInstall = new yaml.Type('!mcp.install', {
  kind: 'mapping',
  instanceOf: McpInstallAction,

  construct(def: Record<string, unknown>): McpInstallAction {
    return new McpInstallAction(mcpInstallSchema.parse(def))
  },

  represent(tag: McpInstallAction): z.infer<typeof mcpInstallSchema> {
    return tag.value
  },
})

const mcpUninstallSchema = z.object({
  url: dynamicStringSchema,
}) satisfies EnsureAllSchemaKeys<MCPUninstallSchema>

export class McpUninstallAction extends BaseAction<
  z.infer<typeof mcpUninstallSchema>
> {
  get action(): ActionName {
    return ActionName.mcp
  }

  override get operation(): string {
    return 'uninstall' satisfies typeof MCP_UNINSTALL_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): McpUninstallAction {
    return new McpUninstallAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const mcpUninstall = new yaml.Type('!mcp.uninstall', {
  kind: 'mapping',
  instanceOf: McpUninstallAction,

  construct(def: Record<string, unknown>): McpUninstallAction {
    return new McpUninstallAction(mcpUninstallSchema.parse(def))
  },

  represent(tag: McpUninstallAction): z.infer<typeof mcpUninstallSchema> {
    return tag.value
  },
})

const packInstallSchema = z.object({
  abilities: z.array(
    z.union([
      dynamicStringSchema,
      z.object({
        name: dynamicStringSchema,
        description: dynamicStringSchema,
        instruction: dynamicStringSchema,
      }),
    ])
  ),
  prefix: dynamicStringSchema.optional(),
}) satisfies EnsureAllSchemaKeys<PackInstallSchema>

export class PackInstallAction extends BaseAction<
  z.infer<typeof packInstallSchema>
> {
  get action(): ActionName {
    return ActionName.pack
  }

  override get operation(): string {
    return 'install' satisfies typeof PACK_INSTALL_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): PackInstallAction {
    return new PackInstallAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const packInstall = new yaml.Type('!pack.install', {
  kind: 'mapping',
  instanceOf: PackInstallAction,

  construct(def: Record<string, unknown>): PackInstallAction {
    return new PackInstallAction(packInstallSchema.parse(def))
  },

  represent(tag: PackInstallAction): z.infer<typeof packInstallSchema> {
    return tag.value
  },
})

const packUninstallSchema = z.object({
  abilities: z.array(dynamicStringSchema),
  prefix: dynamicStringSchema.optional(),
}) satisfies EnsureAllSchemaKeys<PackUninstallSchema>

export class PackUninstallAction extends BaseAction<
  z.infer<typeof packUninstallSchema>
> {
  get action(): ActionName {
    return ActionName.pack
  }

  override get operation(): string {
    return 'uninstall' satisfies typeof PACK_UNINSTALL_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): PackUninstallAction {
    return new PackUninstallAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const packUninstall = new yaml.Type('!pack.uninstall', {
  kind: 'mapping',
  instanceOf: PackUninstallAction,

  construct(def: Record<string, unknown>): PackUninstallAction {
    return new PackUninstallAction(packUninstallSchema.parse(def))
  },

  represent(tag: PackUninstallAction): z.infer<typeof packUninstallSchema> {
    return tag.value
  },
})

// --- TASK ACTIONS ---

const taskScopeSchema = z.union([
  z.enum(['user', 'contact', 'bot']),
  z.instanceof(StringField),
  z.instanceof(Concat),
  z.instanceof(Reference),
])

const taskListSchema = z.object({
  '@scope': taskScopeSchema,
  botId: dynamicStringSchema.optional(),
  meta: z
    .union([
      z.instanceof(ObjectField),
      z.instanceof(StringField),
      z.instanceof(Concat),
      z.instanceof(Reference),
      z.record(z.unknown()),
    ])
    .optional(),
}) satisfies EnsureAllSchemaKeys<TaskListSchema>

export class TaskListAction extends BaseAction<z.infer<typeof taskListSchema>> {
  get action(): ActionName {
    return ActionName.task
  }

  override get operation(): string {
    return 'list' satisfies typeof TASK_LIST_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): TaskListAction {
    return new TaskListAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const taskList = new yaml.Type('!task.list', {
  kind: 'mapping',
  instanceOf: TaskListAction,

  construct(def: Record<string, unknown>): TaskListAction {
    return new TaskListAction(taskListSchema.parse(def))
  },

  represent(tag: TaskListAction): z.infer<typeof taskListSchema> {
    return tag.value
  },
})

const taskFetchSchema = z.object({
  '@scope': taskScopeSchema,
  botId: dynamicStringSchema.optional(),
  taskId: dynamicStringSchema,
}) satisfies EnsureAllSchemaKeys<TaskFetchSchema>

export class TaskFetchAction extends BaseAction<
  z.infer<typeof taskFetchSchema>
> {
  get action(): ActionName {
    return ActionName.task
  }

  override get operation(): string {
    return 'fetch' satisfies typeof TASK_FETCH_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): TaskFetchAction {
    return new TaskFetchAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const taskFetch = new yaml.Type('!task.fetch', {
  kind: 'mapping',
  instanceOf: TaskFetchAction,

  construct(def: Record<string, unknown>): TaskFetchAction {
    return new TaskFetchAction(taskFetchSchema.parse(def))
  },

  represent(tag: TaskFetchAction): z.infer<typeof taskFetchSchema> {
    return tag.value
  },
})

const taskCreateSchema = z.object({
  '@scope': taskScopeSchema,
  botId: dynamicStringSchema.optional(),
  name: dynamicStringSchema.optional(),
  description: dynamicStringSchema.optional(),
  schedule: z
    .union([dynamicStringSchema, dynamicNumberSchema, z.null()])
    .optional(),
  timezone: dynamicStringSchema.optional(),
  maxIterations: dynamicNumberSchema.optional(),
  maxTime: z.union([dynamicStringSchema, dynamicNumberSchema]).optional(),
  maxCalls: dynamicNumberSchema.optional(),
  sessionDuration: z
    .union([dynamicStringSchema, dynamicNumberSchema])
    .optional(),
  meta: z
    .union([
      z.instanceof(ObjectField),
      z.instanceof(StringField),
      z.instanceof(Concat),
      z.instanceof(Reference),
      z.record(z.unknown()),
    ])
    .optional(),
}) satisfies EnsureAllSchemaKeys<TaskCreateSchema>

export class TaskCreateAction extends BaseAction<
  z.infer<typeof taskCreateSchema>
> {
  get action(): ActionName {
    return ActionName.task
  }

  override get operation(): string {
    return 'create' satisfies typeof TASK_CREATE_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): TaskCreateAction {
    return new TaskCreateAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const taskCreate = new yaml.Type('!task.create', {
  kind: 'mapping',
  instanceOf: TaskCreateAction,

  construct(def: Record<string, unknown>): TaskCreateAction {
    return new TaskCreateAction(taskCreateSchema.parse(def))
  },

  represent(tag: TaskCreateAction): z.infer<typeof taskCreateSchema> {
    return tag.value
  },
})

const taskUpdateSchema = z.object({
  '@scope': taskScopeSchema,
  botId: dynamicStringSchema.optional(),
  taskId: dynamicStringSchema,
  name: dynamicStringSchema.optional(),
  description: dynamicStringSchema.optional(),
  schedule: z
    .union([dynamicStringSchema, dynamicNumberSchema, z.null()])
    .optional(),
  timezone: z.union([dynamicStringSchema, z.null()]).optional(),
  maxIterations: z.union([dynamicNumberSchema, z.null()]).optional(),
  maxTime: z
    .union([dynamicStringSchema, dynamicNumberSchema, z.null()])
    .optional(),
  maxCalls: z.union([dynamicNumberSchema, z.null()]).optional(),
  sessionDuration: z
    .union([dynamicStringSchema, dynamicNumberSchema, z.null()])
    .optional(),
  meta: z
    .union([
      z.instanceof(ObjectField),
      z.instanceof(StringField),
      z.instanceof(Concat),
      z.instanceof(Reference),
      z.record(z.unknown()),
    ])
    .optional(),
}) satisfies EnsureAllSchemaKeys<TaskUpdateSchema>

export class TaskUpdateAction extends BaseAction<
  z.infer<typeof taskUpdateSchema>
> {
  get action(): ActionName {
    return ActionName.task
  }

  override get operation(): string {
    return 'update' satisfies typeof TASK_UPDATE_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): TaskUpdateAction {
    return new TaskUpdateAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const taskUpdate = new yaml.Type('!task.update', {
  kind: 'mapping',
  instanceOf: TaskUpdateAction,

  construct(def: Record<string, unknown>): TaskUpdateAction {
    return new TaskUpdateAction(taskUpdateSchema.parse(def))
  },

  represent(tag: TaskUpdateAction): z.infer<typeof taskUpdateSchema> {
    return tag.value
  },
})

const taskDeleteSchema = z.object({
  '@scope': taskScopeSchema,
  botId: dynamicStringSchema.optional(),
  taskId: dynamicStringSchema,
}) satisfies EnsureAllSchemaKeys<TaskDeleteSchema>

export class TaskDeleteAction extends BaseAction<
  z.infer<typeof taskDeleteSchema>
> {
  get action(): ActionName {
    return ActionName.task
  }

  override get operation(): string {
    return 'delete' satisfies typeof TASK_DELETE_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): TaskDeleteAction {
    return new TaskDeleteAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const taskDelete = new yaml.Type('!task.delete', {
  kind: 'mapping',
  instanceOf: TaskDeleteAction,

  construct(def: Record<string, unknown>): TaskDeleteAction {
    return new TaskDeleteAction(taskDeleteSchema.parse(def))
  },

  represent(tag: TaskDeleteAction): z.infer<typeof taskDeleteSchema> {
    return tag.value
  },
})

const taskRunSchema = z.object({
  '@scope': taskScopeSchema,
  botId: dynamicStringSchema.optional(),
  taskId: dynamicStringSchema,
}) satisfies EnsureAllSchemaKeys<TaskRunSchema>

export class TaskRunAction extends BaseAction<z.infer<typeof taskRunSchema>> {
  get action(): ActionName {
    return ActionName.task
  }

  override get operation(): string {
    return 'run' satisfies typeof TASK_RUN_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): TaskRunAction {
    return new TaskRunAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const taskRun = new yaml.Type('!task.run', {
  kind: 'mapping',
  instanceOf: TaskRunAction,

  construct(def: Record<string, unknown>): TaskRunAction {
    return new TaskRunAction(taskRunSchema.parse(def))
  },

  represent(tag: TaskRunAction): z.infer<typeof taskRunSchema> {
    return tag.value
  },
})

// --- TIME ACTIONS ---

const timeNowSchema = z.object({
  timezone: dynamicStringSchema.optional(),
  format: z
    .union([
      z.enum(['datetime', 'date', 'time', 'iso', 'unix']),
      dynamicStringSchema,
    ])
    .optional(),
}) satisfies EnsureAllSchemaKeys<TimeNowSchema>

export class TimeNowAction extends BaseAction<z.infer<typeof timeNowSchema>> {
  get action(): ActionName {
    return ActionName.time
  }

  override get operation(): string {
    return 'now' satisfies typeof TIME_NOW_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): TimeNowAction {
    return new TimeNowAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const timeNow = new yaml.Type('!time.now', {
  kind: 'mapping',
  instanceOf: TimeNowAction,

  construct(def: Record<string, unknown>): TimeNowAction {
    return new TimeNowAction(timeNowSchema.parse(def))
  },

  represent(tag: TimeNowAction): z.infer<typeof timeNowSchema> {
    return tag.value
  },
})

// --- RATING ACTIONS ---

const ratingScopeSchema = z.union([
  z.enum(['user', 'contact', 'bot']),
  z.instanceof(StringField),
  z.instanceof(Concat),
  z.instanceof(Reference),
])

const ratingListSchema = z.object({
  '@scope': ratingScopeSchema,
  botId: dynamicStringSchema.optional(),
  value: dynamicNumberSchema.optional(),
  meta: z
    .union([
      z.instanceof(ObjectField),
      z.instanceof(StringField),
      z.instanceof(Concat),
      z.instanceof(Reference),
      z.record(z.unknown()),
    ])
    .optional(),
}) satisfies EnsureAllSchemaKeys<RatingListSchema>

export class RatingListAction extends BaseAction<
  z.infer<typeof ratingListSchema>
> {
  get action(): ActionName {
    return ActionName.rating
  }

  override get operation(): string {
    return 'list' satisfies typeof RATING_LIST_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): RatingListAction {
    return new RatingListAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const ratingList = new yaml.Type('!rating.list', {
  kind: 'mapping',
  instanceOf: RatingListAction,

  construct(def: Record<string, unknown>): RatingListAction {
    return new RatingListAction(ratingListSchema.parse(def))
  },

  represent(tag: RatingListAction): z.infer<typeof ratingListSchema> {
    return tag.value
  },
})

const ratingFetchSchema = z.object({
  '@scope': ratingScopeSchema,
  botId: dynamicStringSchema.optional(),
  ratingId: dynamicStringSchema,
}) satisfies EnsureAllSchemaKeys<RatingFetchSchema>

export class RatingFetchAction extends BaseAction<
  z.infer<typeof ratingFetchSchema>
> {
  get action(): ActionName {
    return ActionName.rating
  }

  override get operation(): string {
    return 'fetch' satisfies typeof RATING_FETCH_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): RatingFetchAction {
    return new RatingFetchAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const ratingFetch = new yaml.Type('!rating.fetch', {
  kind: 'mapping',
  instanceOf: RatingFetchAction,

  construct(def: Record<string, unknown>): RatingFetchAction {
    return new RatingFetchAction(ratingFetchSchema.parse(def))
  },

  represent(tag: RatingFetchAction): z.infer<typeof ratingFetchSchema> {
    return tag.value
  },
})

const ratingCreateSchema = z.object({
  '@scope': ratingScopeSchema,
  botId: dynamicStringSchema.optional(),
  name: dynamicStringSchema.optional(),
  description: dynamicStringSchema.optional(),
  value: dynamicNumberSchema,
  reason: z.union([dynamicStringSchema, z.null()]).optional(),
  conversationId: dynamicStringSchema.optional(),
  messageId: dynamicStringSchema.optional(),
  meta: z
    .union([
      z.instanceof(ObjectField),
      z.instanceof(StringField),
      z.instanceof(Concat),
      z.instanceof(Reference),
      z.record(z.unknown()),
    ])
    .optional(),
}) satisfies EnsureAllSchemaKeys<RatingCreateSchema>

export class RatingCreateAction extends BaseAction<
  z.infer<typeof ratingCreateSchema>
> {
  get action(): ActionName {
    return ActionName.rating
  }

  override get operation(): string {
    return 'create' satisfies typeof RATING_CREATE_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): RatingCreateAction {
    return new RatingCreateAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const ratingCreate = new yaml.Type('!rating.create', {
  kind: 'mapping',
  instanceOf: RatingCreateAction,

  construct(def: Record<string, unknown>): RatingCreateAction {
    return new RatingCreateAction(ratingCreateSchema.parse(def))
  },

  represent(tag: RatingCreateAction): z.infer<typeof ratingCreateSchema> {
    return tag.value
  },
})

const ratingDeleteSchema = z.object({
  '@scope': ratingScopeSchema,
  botId: dynamicStringSchema.optional(),
  ratingId: dynamicStringSchema,
}) satisfies EnsureAllSchemaKeys<RatingDeleteSchema>

export class RatingDeleteAction extends BaseAction<
  z.infer<typeof ratingDeleteSchema>
> {
  get action(): ActionName {
    return ActionName.rating
  }

  override get operation(): string {
    return 'delete' satisfies typeof RATING_DELETE_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): RatingDeleteAction {
    return new RatingDeleteAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const ratingDelete = new yaml.Type('!rating.delete', {
  kind: 'mapping',
  instanceOf: RatingDeleteAction,

  construct(def: Record<string, unknown>): RatingDeleteAction {
    return new RatingDeleteAction(ratingDeleteSchema.parse(def))
  },

  represent(tag: RatingDeleteAction): z.infer<typeof ratingDeleteSchema> {
    return tag.value
  },
})

// --- FILE ACTIONS ---

const fileReadSchema = z.object({
  fileId: dynamicStringSchema.optional(),
  id: dynamicStringSchema.optional(),
  startLine: dynamicNumberSchema.optional(),
  endLine: dynamicNumberSchema.optional(),
}) satisfies EnsureAllSchemaKeys<FileReadSchema>

export class FileReadAction extends BaseAction<z.infer<typeof fileReadSchema>> {
  get action(): ActionName {
    return ActionName.file
  }

  override get operation(): string {
    return 'read' satisfies typeof FILE_READ_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): FileReadAction {
    return new FileReadAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const fileRead = new yaml.Type('!file.read', {
  kind: 'mapping',
  instanceOf: FileReadAction,

  construct(def: Record<string, unknown>): FileReadAction {
    return new FileReadAction(fileReadSchema.parse(def))
  },

  represent(tag: FileReadAction): z.infer<typeof fileReadSchema> {
    return tag.value
  },
})

const fileWriteSchema = z.object({
  fileId: dynamicStringSchema.optional(),
  id: dynamicStringSchema.optional(),
  text: dynamicStringSchema,
  startLine: dynamicNumberSchema.optional(),
  endLine: dynamicNumberSchema.optional(),
}) satisfies EnsureAllSchemaKeys<FileWriteSchema>

export class FileWriteAction extends BaseAction<
  z.infer<typeof fileWriteSchema>
> {
  get action(): ActionName {
    return ActionName.file
  }

  override get operation(): string {
    return 'write' satisfies typeof FILE_WRITE_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): FileWriteAction {
    return new FileWriteAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const fileWrite = new yaml.Type('!file.write', {
  kind: 'mapping',
  instanceOf: FileWriteAction,

  construct(def: Record<string, unknown>): FileWriteAction {
    return new FileWriteAction(fileWriteSchema.parse(def))
  },

  represent(tag: FileWriteAction): z.infer<typeof fileWriteSchema> {
    return tag.value
  },
})

const filePrependSchema = z.object({
  fileId: dynamicStringSchema.optional(),
  id: dynamicStringSchema.optional(),
  text: dynamicStringSchema,
}) satisfies EnsureAllSchemaKeys<FilePrependSchema>

export class FilePrependAction extends BaseAction<
  z.infer<typeof filePrependSchema>
> {
  get action(): ActionName {
    return ActionName.file
  }

  override get operation(): string {
    return 'prepend' satisfies typeof FILE_PREPEND_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): FilePrependAction {
    return new FilePrependAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const filePrepend = new yaml.Type('!file.prepend', {
  kind: 'mapping',
  instanceOf: FilePrependAction,

  construct(def: Record<string, unknown>): FilePrependAction {
    return new FilePrependAction(filePrependSchema.parse(def))
  },

  represent(tag: FilePrependAction): z.infer<typeof filePrependSchema> {
    return tag.value
  },
})

const fileAppendSchema = z.object({
  fileId: dynamicStringSchema.optional(),
  id: dynamicStringSchema.optional(),
  text: dynamicStringSchema,
}) satisfies EnsureAllSchemaKeys<FileAppendSchema>

export class FileAppendAction extends BaseAction<
  z.infer<typeof fileAppendSchema>
> {
  get action(): ActionName {
    return ActionName.file
  }

  override get operation(): string {
    return 'append' satisfies typeof FILE_APPEND_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): FileAppendAction {
    return new FileAppendAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const fileAppend = new yaml.Type('!file.append', {
  kind: 'mapping',
  instanceOf: FileAppendAction,

  construct(def: Record<string, unknown>): FileAppendAction {
    return new FileAppendAction(fileAppendSchema.parse(def))
  },

  represent(tag: FileAppendAction): z.infer<typeof fileAppendSchema> {
    return tag.value
  },
})

const fileReplaceSchema = z.object({
  fileId: dynamicStringSchema.optional(),
  id: dynamicStringSchema.optional(),
  search: dynamicStringSchema,
  replace: dynamicStringSchema,
  count: dynamicNumberSchema.optional(),
}) satisfies EnsureAllSchemaKeys<FileReplaceSchema>

export class FileReplaceAction extends BaseAction<
  z.infer<typeof fileReplaceSchema>
> {
  get action(): ActionName {
    return ActionName.file
  }

  override get operation(): string {
    return 'replace' satisfies typeof FILE_REPLACE_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): FileReplaceAction {
    return new FileReplaceAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const fileReplace = new yaml.Type('!file.replace', {
  kind: 'mapping',
  instanceOf: FileReplaceAction,

  construct(def: Record<string, unknown>): FileReplaceAction {
    return new FileReplaceAction(fileReplaceSchema.parse(def))
  },

  represent(tag: FileReplaceAction): z.infer<typeof fileReplaceSchema> {
    return tag.value
  },
})

const fileRwSchema = z.object({
  fileId: dynamicStringSchema.optional(),
  id: dynamicStringSchema.optional(),
  mode: z.union([
    z.enum(['read', 'write']),
    z.instanceof(StringField),
    z.instanceof(Concat),
    z.instanceof(Reference),
  ]),
  text: dynamicStringSchema.optional(),
  startLine: dynamicNumberSchema.optional(),
  endLine: dynamicNumberSchema.optional(),
}) satisfies EnsureAllSchemaKeys<FileRwSchema>

export class FileRwAction extends BaseAction<z.infer<typeof fileRwSchema>> {
  get action(): ActionName {
    return ActionName.file
  }

  override get operation(): string {
    return 'rw' satisfies typeof FILE_RW_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): FileRwAction {
    return new FileRwAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const fileRw = new yaml.Type('!file.rw', {
  kind: 'mapping',
  instanceOf: FileRwAction,

  construct(def: Record<string, unknown>): FileRwAction {
    return new FileRwAction(fileRwSchema.parse(def))
  },

  represent(tag: FileRwAction): z.infer<typeof fileRwSchema> {
    return tag.value
  },
})

// --- MEMORY ACTIONS ---

const memoryScopeSchema = z.union([
  z.enum(['user', 'contact', 'bot']),
  z.instanceof(StringField),
  z.instanceof(Concat),
  z.instanceof(Reference),
])

const memoryListSchema = z.object({
  '@scope': memoryScopeSchema,
}) satisfies EnsureAllSchemaKeys<MemoryListSchema>

export class MemoryListAction extends BaseAction<
  z.infer<typeof memoryListSchema>
> {
  get action(): ActionName {
    return ActionName.memory
  }

  override get operation(): string {
    return 'list' satisfies typeof MEMORY_LIST_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): MemoryListAction {
    return new MemoryListAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const memoryList = new yaml.Type('!memory.list', {
  kind: 'mapping',
  instanceOf: MemoryListAction,

  construct(def: Record<string, unknown>): MemoryListAction {
    return new MemoryListAction(memoryListSchema.parse(def))
  },

  represent(tag: MemoryListAction): z.infer<typeof memoryListSchema> {
    return tag.value
  },
})

const memorySearchSchema = z.object({
  '@scope': memoryScopeSchema,
  query: dynamicStringSchema,
}) satisfies EnsureAllSchemaKeys<MemorySearchSchema>

export class MemorySearchAction extends BaseAction<
  z.infer<typeof memorySearchSchema>
> {
  get action(): ActionName {
    return ActionName.memory
  }

  override get operation(): string {
    return 'search' satisfies typeof MEMORY_SEARCH_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): MemorySearchAction {
    return new MemorySearchAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const memorySearch = new yaml.Type('!memory.search', {
  kind: 'mapping',
  instanceOf: MemorySearchAction,

  construct(def: Record<string, unknown>): MemorySearchAction {
    return new MemorySearchAction(memorySearchSchema.parse(def))
  },

  represent(tag: MemorySearchAction): z.infer<typeof memorySearchSchema> {
    return tag.value
  },
})

const memoryCreateSchema = z.object({
  '@scope': memoryScopeSchema,
  text: dynamicStringSchema,
}) satisfies EnsureAllSchemaKeys<MemoryCreateSchema>

export class MemoryCreateAction extends BaseAction<
  z.infer<typeof memoryCreateSchema>
> {
  get action(): ActionName {
    return ActionName.memory
  }

  override get operation(): string {
    return 'create' satisfies typeof MEMORY_CREATE_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): MemoryCreateAction {
    return new MemoryCreateAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const memoryCreate = new yaml.Type('!memory.create', {
  kind: 'mapping',
  instanceOf: MemoryCreateAction,

  construct(def: Record<string, unknown>): MemoryCreateAction {
    return new MemoryCreateAction(memoryCreateSchema.parse(def))
  },

  represent(tag: MemoryCreateAction): z.infer<typeof memoryCreateSchema> {
    return tag.value
  },
})

const memoryUpdateSchema = z.object({
  '@scope': memoryScopeSchema,
  memoryId: dynamicStringSchema,
  text: dynamicStringSchema,
}) satisfies EnsureAllSchemaKeys<MemoryUpdateSchema>

export class MemoryUpdateAction extends BaseAction<
  z.infer<typeof memoryUpdateSchema>
> {
  get action(): ActionName {
    return ActionName.memory
  }

  override get operation(): string {
    return 'update' satisfies typeof MEMORY_UPDATE_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): MemoryUpdateAction {
    return new MemoryUpdateAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const memoryUpdate = new yaml.Type('!memory.update', {
  kind: 'mapping',
  instanceOf: MemoryUpdateAction,

  construct(def: Record<string, unknown>): MemoryUpdateAction {
    return new MemoryUpdateAction(memoryUpdateSchema.parse(def))
  },

  represent(tag: MemoryUpdateAction): z.infer<typeof memoryUpdateSchema> {
    return tag.value
  },
})

const memoryDeleteSchema = z.object({
  '@scope': memoryScopeSchema,
  memoryId: dynamicStringSchema,
}) satisfies EnsureAllSchemaKeys<MemoryDeleteSchema>

export class MemoryDeleteAction extends BaseAction<
  z.infer<typeof memoryDeleteSchema>
> {
  get action(): ActionName {
    return ActionName.memory
  }

  override get operation(): string {
    return 'delete' satisfies typeof MEMORY_DELETE_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): MemoryDeleteAction {
    return new MemoryDeleteAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const memoryDelete = new yaml.Type('!memory.delete', {
  kind: 'mapping',
  instanceOf: MemoryDeleteAction,

  construct(def: Record<string, unknown>): MemoryDeleteAction {
    return new MemoryDeleteAction(memoryDeleteSchema.parse(def))
  },

  represent(tag: MemoryDeleteAction): z.infer<typeof memoryDeleteSchema> {
    return tag.value
  },
})

// --- CONVERSATION ACTIONS ---

const conversationScopeSchema = z.union([
  z.enum(['user', 'contact', 'bot']),
  z.instanceof(StringField),
  z.instanceof(Concat),
  z.instanceof(Reference),
])

const conversationListSchema = z.object({
  '@scope': conversationScopeSchema,
}) satisfies EnsureAllSchemaKeys<ConversationListSchema>

export class ConversationListAction extends BaseAction<
  z.infer<typeof conversationListSchema>
> {
  get action(): ActionName {
    return ActionName.conversation
  }

  override get operation(): string {
    return 'list' satisfies typeof CONVERSATION_LIST_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): ConversationListAction {
    return new ConversationListAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const conversationList = new yaml.Type('!conversation.list', {
  kind: 'mapping',
  instanceOf: ConversationListAction,

  construct(def: Record<string, unknown>): ConversationListAction {
    return new ConversationListAction(conversationListSchema.parse(def))
  },

  represent(
    tag: ConversationListAction
  ): z.infer<typeof conversationListSchema> {
    return tag.value
  },
})

const conversationFetchSchema = z.object({
  '@scope': conversationScopeSchema,
  conversationId: dynamicStringSchema,
}) satisfies EnsureAllSchemaKeys<ConversationFetchSchema>

export class ConversationFetchAction extends BaseAction<
  z.infer<typeof conversationFetchSchema>
> {
  get action(): ActionName {
    return ActionName.conversation
  }

  override get operation(): string {
    return 'fetch' satisfies typeof CONVERSATION_FETCH_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): ConversationFetchAction {
    return new ConversationFetchAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const conversationFetch = new yaml.Type('!conversation.fetch', {
  kind: 'mapping',
  instanceOf: ConversationFetchAction,

  construct(def: Record<string, unknown>): ConversationFetchAction {
    return new ConversationFetchAction(conversationFetchSchema.parse(def))
  },

  represent(
    tag: ConversationFetchAction
  ): z.infer<typeof conversationFetchSchema> {
    return tag.value
  },
})

const conversationSearchSchema = z.object({
  '@scope': conversationScopeSchema,
  query: dynamicStringSchema,
}) satisfies EnsureAllSchemaKeys<ConversationSearchSchema>

export class ConversationSearchAction extends BaseAction<
  z.infer<typeof conversationSearchSchema>
> {
  get action(): ActionName {
    return ActionName.conversation
  }

  override get operation(): string {
    return 'search' satisfies typeof CONVERSATION_SEARCH_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): ConversationSearchAction {
    return new ConversationSearchAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const conversationSearch = new yaml.Type('!conversation.search', {
  kind: 'mapping',
  instanceOf: ConversationSearchAction,

  construct(def: Record<string, unknown>): ConversationSearchAction {
    return new ConversationSearchAction(conversationSearchSchema.parse(def))
  },

  represent(
    tag: ConversationSearchAction
  ): z.infer<typeof conversationSearchSchema> {
    return tag.value
  },
})

// --- SPACE ACTIONS ---

const spaceScopeSchema = z.union([
  z.enum(['user', 'blueprint', 'contact']),
  z.instanceof(StringField),
  z.instanceof(Concat),
  z.instanceof(Reference),
])

const spaceListSchema = z.object({
  '@scope': spaceScopeSchema,
}) satisfies EnsureAllSchemaKeys<SpaceListSchema>

export class SpaceListAction extends BaseAction<
  z.infer<typeof spaceListSchema>
> {
  get action(): ActionName {
    return ActionName.space
  }

  override get operation(): string {
    return 'list' satisfies typeof SPACE_LIST_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): SpaceListAction {
    return new SpaceListAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const spaceList = new yaml.Type('!space.list', {
  kind: 'mapping',
  instanceOf: SpaceListAction,

  construct(def: Record<string, unknown>): SpaceListAction {
    return new SpaceListAction(spaceListSchema.parse(def))
  },

  represent(tag: SpaceListAction): z.infer<typeof spaceListSchema> {
    return tag.value
  },
})

const spaceFetchSchema = z.object({
  '@scope': spaceScopeSchema,
  spaceId: dynamicStringSchema,
}) satisfies EnsureAllSchemaKeys<SpaceFetchSchema>

export class SpaceFetchAction extends BaseAction<
  z.infer<typeof spaceFetchSchema>
> {
  get action(): ActionName {
    return ActionName.space
  }

  override get operation(): string {
    return 'fetch' satisfies typeof SPACE_FETCH_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): SpaceFetchAction {
    return new SpaceFetchAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const spaceFetch = new yaml.Type('!space.fetch', {
  kind: 'mapping',
  instanceOf: SpaceFetchAction,

  construct(def: Record<string, unknown>): SpaceFetchAction {
    return new SpaceFetchAction(spaceFetchSchema.parse(def))
  },

  represent(tag: SpaceFetchAction): z.infer<typeof spaceFetchSchema> {
    return tag.value
  },
})

const spaceCreateSchema = z.object({
  '@scope': spaceScopeSchema,
  name: dynamicStringSchema,
  description: dynamicStringSchema.optional(),
}) satisfies EnsureAllSchemaKeys<SpaceCreateSchema>

export class SpaceCreateAction extends BaseAction<
  z.infer<typeof spaceCreateSchema>
> {
  get action(): ActionName {
    return ActionName.space
  }

  override get operation(): string {
    return 'create' satisfies typeof SPACE_CREATE_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): SpaceCreateAction {
    return new SpaceCreateAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const spaceCreate = new yaml.Type('!space.create', {
  kind: 'mapping',
  instanceOf: SpaceCreateAction,

  construct(def: Record<string, unknown>): SpaceCreateAction {
    return new SpaceCreateAction(spaceCreateSchema.parse(def))
  },

  represent(tag: SpaceCreateAction): z.infer<typeof spaceCreateSchema> {
    return tag.value
  },
})

const spaceUpdateSchema = z.object({
  '@scope': spaceScopeSchema,
  spaceId: dynamicStringSchema,
  name: dynamicStringSchema.optional(),
  description: dynamicStringSchema.optional(),
}) satisfies EnsureAllSchemaKeys<SpaceUpdateSchema>

export class SpaceUpdateAction extends BaseAction<
  z.infer<typeof spaceUpdateSchema>
> {
  get action(): ActionName {
    return ActionName.space
  }

  override get operation(): string {
    return 'update' satisfies typeof SPACE_UPDATE_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): SpaceUpdateAction {
    return new SpaceUpdateAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const spaceUpdate = new yaml.Type('!space.update', {
  kind: 'mapping',
  instanceOf: SpaceUpdateAction,

  construct(def: Record<string, unknown>): SpaceUpdateAction {
    return new SpaceUpdateAction(spaceUpdateSchema.parse(def))
  },

  represent(tag: SpaceUpdateAction): z.infer<typeof spaceUpdateSchema> {
    return tag.value
  },
})

const spaceDeleteSchema = z.object({
  '@scope': spaceScopeSchema,
  spaceId: dynamicStringSchema,
}) satisfies EnsureAllSchemaKeys<SpaceDeleteSchema>

export class SpaceDeleteAction extends BaseAction<
  z.infer<typeof spaceDeleteSchema>
> {
  get action(): ActionName {
    return ActionName.space
  }

  override get operation(): string {
    return 'delete' satisfies typeof SPACE_DELETE_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): SpaceDeleteAction {
    return new SpaceDeleteAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const spaceDelete = new yaml.Type('!space.delete', {
  kind: 'mapping',
  instanceOf: SpaceDeleteAction,

  construct(def: Record<string, unknown>): SpaceDeleteAction {
    return new SpaceDeleteAction(spaceDeleteSchema.parse(def))
  },

  represent(tag: SpaceDeleteAction): z.infer<typeof spaceDeleteSchema> {
    return tag.value
  },
})

// --- SPACE STORAGE ACTIONS ---

const spaceStorageListSchema = z.object({
  '@scope': spaceScopeSchema,
  spaceId: dynamicStringSchema,
  path: dynamicStringSchema.optional(),
  recursive: dynamicBooleanSchema.optional(),
}) satisfies EnsureAllSchemaKeys<SpaceStorageListSchema>

export class SpaceStorageListAction extends BaseAction<
  z.infer<typeof spaceStorageListSchema>
> {
  get action(): ActionName {
    return ActionName.space
  }

  override get operation(): string {
    return 'storage/list' satisfies typeof SPACE_STORAGE_LIST_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): SpaceStorageListAction {
    return new SpaceStorageListAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const spaceStorageList = new yaml.Type('!space.storage.list', {
  kind: 'mapping',
  instanceOf: SpaceStorageListAction,

  construct(def: Record<string, unknown>): SpaceStorageListAction {
    return new SpaceStorageListAction(spaceStorageListSchema.parse(def))
  },

  represent(
    tag: SpaceStorageListAction
  ): z.infer<typeof spaceStorageListSchema> {
    return tag.value
  },
})

const spaceStorageReadSchema = z.object({
  '@scope': spaceScopeSchema,
  spaceId: dynamicStringSchema,
  path: dynamicStringSchema,
  startLine: dynamicNumberSchema.optional(),
  endLine: dynamicNumberSchema.optional(),
}) satisfies EnsureAllSchemaKeys<SpaceStorageReadSchema>

export class SpaceStorageReadAction extends BaseAction<
  z.infer<typeof spaceStorageReadSchema>
> {
  get action(): ActionName {
    return ActionName.space
  }

  override get operation(): string {
    return 'storage/read' satisfies typeof SPACE_STORAGE_READ_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): SpaceStorageReadAction {
    return new SpaceStorageReadAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const spaceStorageRead = new yaml.Type('!space.storage.read', {
  kind: 'mapping',
  instanceOf: SpaceStorageReadAction,

  construct(def: Record<string, unknown>): SpaceStorageReadAction {
    return new SpaceStorageReadAction(spaceStorageReadSchema.parse(def))
  },

  represent(
    tag: SpaceStorageReadAction
  ): z.infer<typeof spaceStorageReadSchema> {
    return tag.value
  },
})

const spaceStorageWriteSchema = z.object({
  '@scope': spaceScopeSchema,
  spaceId: dynamicStringSchema,
  path: dynamicStringSchema,
  content: dynamicStringSchema,
  startLine: dynamicNumberSchema.optional(),
  endLine: dynamicNumberSchema.optional(),
}) satisfies EnsureAllSchemaKeys<SpaceStorageWriteSchema>

export class SpaceStorageWriteAction extends BaseAction<
  z.infer<typeof spaceStorageWriteSchema>
> {
  get action(): ActionName {
    return ActionName.space
  }

  override get operation(): string {
    return 'storage/write' satisfies typeof SPACE_STORAGE_WRITE_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): SpaceStorageWriteAction {
    return new SpaceStorageWriteAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const spaceStorageWrite = new yaml.Type('!space.storage.write', {
  kind: 'mapping',
  instanceOf: SpaceStorageWriteAction,

  construct(def: Record<string, unknown>): SpaceStorageWriteAction {
    return new SpaceStorageWriteAction(spaceStorageWriteSchema.parse(def))
  },

  represent(
    tag: SpaceStorageWriteAction
  ): z.infer<typeof spaceStorageWriteSchema> {
    return tag.value
  },
})

const spaceStorageRwSchema = z.object({
  '@scope': spaceScopeSchema,
  spaceId: dynamicStringSchema,
  path: dynamicStringSchema,
  mode: z.union([
    z.enum(['read', 'write']),
    z.instanceof(StringField),
    z.instanceof(Concat),
    z.instanceof(Reference),
  ]),
  content: dynamicStringSchema.optional(),
  startLine: dynamicNumberSchema.optional(),
  endLine: dynamicNumberSchema.optional(),
}) satisfies EnsureAllSchemaKeys<SpaceStorageRwSchema>

export class SpaceStorageRwAction extends BaseAction<
  z.infer<typeof spaceStorageRwSchema>
> {
  get action(): ActionName {
    return ActionName.space
  }

  override get operation(): string {
    return 'storage/rw' satisfies typeof SPACE_STORAGE_RW_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): SpaceStorageRwAction {
    return new SpaceStorageRwAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const spaceStorageRw = new yaml.Type('!space.storage.rw', {
  kind: 'mapping',
  instanceOf: SpaceStorageRwAction,

  construct(def: Record<string, unknown>): SpaceStorageRwAction {
    return new SpaceStorageRwAction(spaceStorageRwSchema.parse(def))
  },

  represent(tag: SpaceStorageRwAction): z.infer<typeof spaceStorageRwSchema> {
    return tag.value
  },
})

const spaceStorageMoveSchema = z.object({
  '@scope': spaceScopeSchema,
  spaceId: dynamicStringSchema,
  path: dynamicStringSchema,
  destinationPath: dynamicStringSchema,
}) satisfies EnsureAllSchemaKeys<SpaceStorageMoveSchema>

export class SpaceStorageMoveAction extends BaseAction<
  z.infer<typeof spaceStorageMoveSchema>
> {
  get action(): ActionName {
    return ActionName.space
  }

  override get operation(): string {
    return 'storage/move' satisfies typeof SPACE_STORAGE_MOVE_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): SpaceStorageMoveAction {
    return new SpaceStorageMoveAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const spaceStorageMove = new yaml.Type('!space.storage.move', {
  kind: 'mapping',
  instanceOf: SpaceStorageMoveAction,

  construct(def: Record<string, unknown>): SpaceStorageMoveAction {
    return new SpaceStorageMoveAction(spaceStorageMoveSchema.parse(def))
  },

  represent(
    tag: SpaceStorageMoveAction
  ): z.infer<typeof spaceStorageMoveSchema> {
    return tag.value
  },
})

const spaceStorageCopySchema = z.object({
  '@scope': spaceScopeSchema,
  spaceId: dynamicStringSchema,
  path: dynamicStringSchema,
  destinationPath: dynamicStringSchema,
}) satisfies EnsureAllSchemaKeys<SpaceStorageCopySchema>

export class SpaceStorageCopyAction extends BaseAction<
  z.infer<typeof spaceStorageCopySchema>
> {
  get action(): ActionName {
    return ActionName.space
  }

  override get operation(): string {
    return 'storage/copy' satisfies typeof SPACE_STORAGE_COPY_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): SpaceStorageCopyAction {
    return new SpaceStorageCopyAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const spaceStorageCopy = new yaml.Type('!space.storage.copy', {
  kind: 'mapping',
  instanceOf: SpaceStorageCopyAction,

  construct(def: Record<string, unknown>): SpaceStorageCopyAction {
    return new SpaceStorageCopyAction(spaceStorageCopySchema.parse(def))
  },

  represent(
    tag: SpaceStorageCopyAction
  ): z.infer<typeof spaceStorageCopySchema> {
    return tag.value
  },
})

const spaceStorageDeleteSchema = z.object({
  '@scope': spaceScopeSchema,
  spaceId: dynamicStringSchema,
  path: dynamicStringSchema,
}) satisfies EnsureAllSchemaKeys<SpaceStorageDeleteSchema>

export class SpaceStorageDeleteAction extends BaseAction<
  z.infer<typeof spaceStorageDeleteSchema>
> {
  get action(): ActionName {
    return ActionName.space
  }

  override get operation(): string {
    return 'storage/delete' satisfies typeof SPACE_STORAGE_DELETE_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): SpaceStorageDeleteAction {
    return new SpaceStorageDeleteAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const spaceStorageDelete = new yaml.Type('!space.storage.delete', {
  kind: 'mapping',
  instanceOf: SpaceStorageDeleteAction,

  construct(def: Record<string, unknown>): SpaceStorageDeleteAction {
    return new SpaceStorageDeleteAction(spaceStorageDeleteSchema.parse(def))
  },

  represent(
    tag: SpaceStorageDeleteAction
  ): z.infer<typeof spaceStorageDeleteSchema> {
    return tag.value
  },
})

const spaceStorageSearchSchema = z.object({
  '@scope': spaceScopeSchema,
  spaceId: dynamicStringSchema,
  query: dynamicStringSchema,
}) satisfies EnsureAllSchemaKeys<SpaceStorageSearchSchema>

export class SpaceStorageSearchAction extends BaseAction<
  z.infer<typeof spaceStorageSearchSchema>
> {
  get action(): ActionName {
    return ActionName.space
  }

  override get operation(): string {
    return 'storage/search' satisfies typeof SPACE_STORAGE_SEARCH_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): SpaceStorageSearchAction {
    return new SpaceStorageSearchAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const spaceStorageSearch = new yaml.Type('!space.storage.search', {
  kind: 'mapping',
  instanceOf: SpaceStorageSearchAction,

  construct(def: Record<string, unknown>): SpaceStorageSearchAction {
    return new SpaceStorageSearchAction(spaceStorageSearchSchema.parse(def))
  },

  represent(
    tag: SpaceStorageSearchAction
  ): z.infer<typeof spaceStorageSearchSchema> {
    return tag.value
  },
})

const spaceStorageImportSchema = z.object({
  '@scope': spaceScopeSchema,
  spaceId: dynamicStringSchema,
  url: dynamicStringSchema,
  path: dynamicStringSchema,
}) satisfies EnsureAllSchemaKeys<SpaceStorageImportSchema>

export class SpaceStorageImportAction extends BaseAction<
  z.infer<typeof spaceStorageImportSchema>
> {
  get action(): ActionName {
    return ActionName.space
  }

  override get operation(): string {
    return 'storage/import' satisfies typeof SPACE_STORAGE_IMPORT_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): SpaceStorageImportAction {
    return new SpaceStorageImportAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const spaceStorageImport = new yaml.Type('!space.storage.import', {
  kind: 'mapping',
  instanceOf: SpaceStorageImportAction,

  construct(def: Record<string, unknown>): SpaceStorageImportAction {
    return new SpaceStorageImportAction(spaceStorageImportSchema.parse(def))
  },

  represent(
    tag: SpaceStorageImportAction
  ): z.infer<typeof spaceStorageImportSchema> {
    return tag.value
  },
})

const spaceStorageLinkSchema = z.object({
  '@scope': spaceScopeSchema,
  spaceId: dynamicStringSchema,
  path: dynamicStringSchema,
}) satisfies EnsureAllSchemaKeys<SpaceStorageLinkSchema>

export class SpaceStorageLinkAction extends BaseAction<
  z.infer<typeof spaceStorageLinkSchema>
> {
  get action(): ActionName {
    return ActionName.space
  }

  override get operation(): string {
    return 'storage/link' satisfies typeof SPACE_STORAGE_LINK_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): SpaceStorageLinkAction {
    return new SpaceStorageLinkAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const spaceStorageLink = new yaml.Type('!space.storage.link', {
  kind: 'mapping',
  instanceOf: SpaceStorageLinkAction,

  construct(def: Record<string, unknown>): SpaceStorageLinkAction {
    return new SpaceStorageLinkAction(spaceStorageLinkSchema.parse(def))
  },

  represent(
    tag: SpaceStorageLinkAction
  ): z.infer<typeof spaceStorageLinkSchema> {
    return tag.value
  },
})

// --- SHELL ACTIONS ---

const shellExecSchema = z.object({
  cmd: dynamicStringSchema,
  files: z
    .array(
      z.object({
        path: dynamicStringSchema,
        contents: dynamicStringSchema,
      })
    )
    .optional(),
  timeout: dynamicNumberSchema.optional(),
  sessionId: dynamicStringSchema.optional(),
  spaceId: dynamicStringSchema.optional(),
}) satisfies EnsureAllSchemaKeys<ShellExecSchema>

const shellScriptSchema = z.object({
  source: dynamicStringSchema,
  runtime: z.union([
    z.enum(['python', 'node']),
    z.instanceof(StringField),
    z.instanceof(Concat),
    z.instanceof(Reference),
  ]),
  timeout: dynamicNumberSchema.optional(),
  sessionId: dynamicStringSchema.optional(),
  spaceId: dynamicStringSchema.optional(),
}) satisfies EnsureAllSchemaKeys<ShellScriptSchema>

export class ShellExecAction extends BaseAction<
  z.infer<typeof shellExecSchema>
> {
  get action(): ActionName {
    return ActionName.shell
  }

  override get operation(): string {
    return 'exec' satisfies typeof SHELL_EXEC_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): ShellExecAction {
    return new ShellExecAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const shellExec = new yaml.Type('!shell.exec', {
  kind: 'mapping',
  instanceOf: ShellExecAction,

  construct(def: Record<string, unknown>): ShellExecAction {
    return new ShellExecAction(shellExecSchema.parse(def))
  },

  represent(tag: ShellExecAction): z.infer<typeof shellExecSchema> {
    return tag.value
  },
})

export class ShellScriptAction extends BaseAction<
  z.infer<typeof shellScriptSchema>
> {
  get action(): ActionName {
    return ActionName.shell
  }

  override get operation(): string {
    return 'script' satisfies typeof SHELL_SCRIPT_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): ShellScriptAction {
    return new ShellScriptAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const shellScript = new yaml.Type('!shell.script', {
  kind: 'mapping',
  instanceOf: ShellScriptAction,

  construct(def: Record<string, unknown>): ShellScriptAction {
    return new ShellScriptAction(shellScriptSchema.parse(def))
  },

  represent(tag: ShellScriptAction): z.infer<typeof shellScriptSchema> {
    return tag.value
  },
})

const shellReadSchema = z.object({
  file: dynamicStringSchema,
  startLine: dynamicNumberSchema.optional(),
  endLine: dynamicNumberSchema.optional(),
  sessionId: dynamicStringSchema.optional(),
  spaceId: dynamicStringSchema.optional(),
}) satisfies EnsureAllSchemaKeys<ShellReadSchema>

export class ShellReadAction extends BaseAction<
  z.infer<typeof shellReadSchema>
> {
  get action(): ActionName {
    return ActionName.shell
  }

  override get operation(): string {
    return 'read' satisfies typeof SHELL_READ_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): ShellReadAction {
    return new ShellReadAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const shellRead = new yaml.Type('!shell.read', {
  kind: 'mapping',
  instanceOf: ShellReadAction,

  construct(def: Record<string, unknown>): ShellReadAction {
    return new ShellReadAction(shellReadSchema.parse(def))
  },

  represent(tag: ShellReadAction): z.infer<typeof shellReadSchema> {
    return tag.value
  },
})

const shellWriteSchema = z.object({
  file: dynamicStringSchema,
  contents: dynamicStringSchema,
  startLine: dynamicNumberSchema.optional(),
  endLine: dynamicNumberSchema.optional(),
  sessionId: dynamicStringSchema.optional(),
  spaceId: dynamicStringSchema.optional(),
}) satisfies EnsureAllSchemaKeys<ShellWriteSchema>

export class ShellWriteAction extends BaseAction<
  z.infer<typeof shellWriteSchema>
> {
  get action(): ActionName {
    return ActionName.shell
  }

  override get operation(): string {
    return 'write' satisfies typeof SHELL_WRITE_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): ShellWriteAction {
    return new ShellWriteAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const shellWrite = new yaml.Type('!shell.write', {
  kind: 'mapping',
  instanceOf: ShellWriteAction,

  construct(def: Record<string, unknown>): ShellWriteAction {
    return new ShellWriteAction(shellWriteSchema.parse(def))
  },

  represent(tag: ShellWriteAction): z.infer<typeof shellWriteSchema> {
    return tag.value
  },
})

const shellRwSchema = z.object({
  file: dynamicStringSchema,
  mode: z.union([
    z.enum(['read', 'write']),
    z.instanceof(StringField),
    z.instanceof(Concat),
    z.instanceof(Reference),
  ]),
  contents: dynamicStringSchema.optional(),
  startLine: dynamicNumberSchema.optional(),
  endLine: dynamicNumberSchema.optional(),
  sessionId: dynamicStringSchema.optional(),
  spaceId: dynamicStringSchema.optional(),
}) satisfies EnsureAllSchemaKeys<ShellRwSchema>

export class ShellRwAction extends BaseAction<z.infer<typeof shellRwSchema>> {
  get action(): ActionName {
    return ActionName.shell
  }

  override get operation(): string {
    return 'rw' satisfies typeof SHELL_RW_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): ShellRwAction {
    return new ShellRwAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const shellRw = new yaml.Type('!shell.rw', {
  kind: 'mapping',
  instanceOf: ShellRwAction,

  construct(def: Record<string, unknown>): ShellRwAction {
    return new ShellRwAction(shellRwSchema.parse(def))
  },

  represent(tag: ShellRwAction): z.infer<typeof shellRwSchema> {
    return tag.value
  },
})

const shellReplaceSchema = z.object({
  file: dynamicStringSchema,
  search: dynamicStringSchema,
  replace: dynamicStringSchema,
  count: dynamicNumberSchema.optional(),
  sessionId: dynamicStringSchema.optional(),
  spaceId: dynamicStringSchema.optional(),
}) satisfies EnsureAllSchemaKeys<ShellReplaceSchema>

export class ShellReplaceAction extends BaseAction<
  z.infer<typeof shellReplaceSchema>
> {
  get action(): ActionName {
    return ActionName.shell
  }

  override get operation(): string {
    return 'replace' satisfies typeof SHELL_REPLACE_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): ShellReplaceAction {
    return new ShellReplaceAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const shellReplace = new yaml.Type('!shell.replace', {
  kind: 'mapping',
  instanceOf: ShellReplaceAction,

  construct(def: Record<string, unknown>): ShellReplaceAction {
    return new ShellReplaceAction(shellReplaceSchema.parse(def))
  },

  represent(tag: ShellReplaceAction): z.infer<typeof shellReplaceSchema> {
    return tag.value
  },
})

const shellEvalSchema = z.object({
  code: dynamicStringSchema,
  runtime: z.union([
    z.enum(['python', 'node']),
    z.instanceof(StringField),
    z.instanceof(Concat),
    z.instanceof(Reference),
  ]),
  timeout: dynamicNumberSchema.optional(),
  sessionId: dynamicStringSchema.optional(),
  spaceId: dynamicStringSchema.optional(),
}) satisfies EnsureAllSchemaKeys<ShellEvalSchema>

export class ShellEvalAction extends BaseAction<
  z.infer<typeof shellEvalSchema>
> {
  get action(): ActionName {
    return ActionName.shell
  }

  override get operation(): string {
    return 'eval' satisfies typeof SHELL_EVAL_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): ShellEvalAction {
    return new ShellEvalAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const shellEval = new yaml.Type('!shell.eval', {
  kind: 'mapping',
  instanceOf: ShellEvalAction,

  construct(def: Record<string, unknown>): ShellEvalAction {
    return new ShellEvalAction(shellEvalSchema.parse(def))
  },

  represent(tag: ShellEvalAction): z.infer<typeof shellEvalSchema> {
    return tag.value
  },
})

const shellImportSchema = z.object({
  url: dynamicStringSchema,
  path: dynamicStringSchema,
  headers: z.record(dynamicStringSchema).optional(),
  sessionId: dynamicStringSchema.optional(),
  spaceId: dynamicStringSchema.optional(),
}) satisfies EnsureAllSchemaKeys<ShellImportSchema>

export class ShellImportAction extends BaseAction<
  z.infer<typeof shellImportSchema>
> {
  get action(): ActionName {
    return ActionName.shell
  }

  override get operation(): string {
    return 'import' satisfies typeof SHELL_IMPORT_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): ShellImportAction {
    return new ShellImportAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const shellImport = new yaml.Type('!shell.import', {
  kind: 'mapping',
  instanceOf: ShellImportAction,

  construct(def: Record<string, unknown>): ShellImportAction {
    return new ShellImportAction(shellImportSchema.parse(def))
  },

  represent(tag: ShellImportAction): z.infer<typeof shellImportSchema> {
    return tag.value
  },
})

const shellSkillsetInstallSchema = z.object({
  skillsetId: dynamicStringSchema,
  sessionId: dynamicStringSchema.optional(),
  spaceId: dynamicStringSchema.optional(),
}) satisfies EnsureAllSchemaKeys<ShellSkillsetInstallSchema>

export class ShellSkillsetInstallAction extends BaseAction<
  z.infer<typeof shellSkillsetInstallSchema>
> {
  get action(): ActionName {
    return ActionName.shell
  }

  override get operation(): string {
    return 'skillset/install' satisfies typeof SHELL_SKILLSET_INSTALL_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): ShellSkillsetInstallAction {
    return new ShellSkillsetInstallAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const shellSkillsetInstall = new yaml.Type('!shell.skillset.install', {
  kind: 'mapping',
  instanceOf: ShellSkillsetInstallAction,

  construct(def: Record<string, unknown>): ShellSkillsetInstallAction {
    return new ShellSkillsetInstallAction(shellSkillsetInstallSchema.parse(def))
  },

  represent(
    tag: ShellSkillsetInstallAction
  ): z.infer<typeof shellSkillsetInstallSchema> {
    return tag.value
  },
})

// --- BLUEPRINT ACTIONS ---

const blueprintResourceListSchema = z.object({
  blueprintId: dynamicStringSchema.optional(),
  type: z
    .union([
      z.enum([
        'all',
        'bot',
        'dataset',
        'skillset',
        'ability',
        'file',
        'secret',
        'space',
      ]),
      z.instanceof(StringField),
      z.instanceof(Concat),
      z.instanceof(Reference),
    ])
    .optional(),
}) satisfies EnsureAllSchemaKeys<BlueprintResourceListSchema>

export class BlueprintResourceListAction extends BaseAction<
  z.infer<typeof blueprintResourceListSchema>
> {
  get action(): ActionName {
    return ActionName.blueprint
  }

  override get operation(): string {
    return 'resource/list' satisfies typeof BLUEPRINT_RESOURCE_LIST_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): BlueprintResourceListAction {
    return new BlueprintResourceListAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const blueprintResourceList = new yaml.Type('!blueprint.resource.list', {
  kind: 'mapping',
  instanceOf: BlueprintResourceListAction,

  construct(def: Record<string, unknown>): BlueprintResourceListAction {
    return new BlueprintResourceListAction(
      blueprintResourceListSchema.parse(def)
    )
  },

  represent(
    tag: BlueprintResourceListAction
  ): z.infer<typeof blueprintResourceListSchema> {
    return tag.value
  },
})

const blueprintNoteListSchema = z.object({
  blueprintId: dynamicStringSchema.optional(),
}) satisfies EnsureAllSchemaKeys<BlueprintNoteListSchema>

export class BlueprintNoteListAction extends BaseAction<
  z.infer<typeof blueprintNoteListSchema>
> {
  get action(): ActionName {
    return ActionName.blueprint
  }

  override get operation(): string {
    return 'note/list' satisfies typeof BLUEPRINT_NOTE_LIST_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): BlueprintNoteListAction {
    return new BlueprintNoteListAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const blueprintNoteList = new yaml.Type('!blueprint.note.list', {
  kind: 'mapping',
  instanceOf: BlueprintNoteListAction,

  construct(def: Record<string, unknown>): BlueprintNoteListAction {
    return new BlueprintNoteListAction(blueprintNoteListSchema.parse(def))
  },

  represent(
    tag: BlueprintNoteListAction
  ): z.infer<typeof blueprintNoteListSchema> {
    return tag.value
  },
})

const blueprintBulletinListSchema = z.object({
  blueprintId: dynamicStringSchema.optional(),
}) satisfies EnsureAllSchemaKeys<BlueprintBulletinListSchema>

export class BlueprintBulletinListAction extends BaseAction<
  z.infer<typeof blueprintBulletinListSchema>
> {
  get action(): ActionName {
    return ActionName.blueprint
  }

  override get operation(): string {
    return 'bulletin/list' satisfies typeof BLUEPRINT_BULLETIN_LIST_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): BlueprintBulletinListAction {
    return new BlueprintBulletinListAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const blueprintBulletinList = new yaml.Type('!blueprint.bulletin.list', {
  kind: 'mapping',
  instanceOf: BlueprintBulletinListAction,

  construct(def: Record<string, unknown>): BlueprintBulletinListAction {
    return new BlueprintBulletinListAction(
      blueprintBulletinListSchema.parse(def)
    )
  },

  represent(
    tag: BlueprintBulletinListAction
  ): z.infer<typeof blueprintBulletinListSchema> {
    return tag.value
  },
})

const blueprintBulletinCreateSchema = z.object({
  blueprintId: dynamicStringSchema.optional(),
  text: dynamicStringSchema,
  // @note ttl accepts a number of seconds or a duration string like "1 hour"
  // (resolved in blueprint.bulletin.ts), so the structured tag must permit both
  // a dynamic number and a dynamic string field
  ttl: z.union([dynamicNumberSchema, dynamicStringSchema]).optional(),
}) satisfies EnsureAllSchemaKeys<BlueprintBulletinCreateSchema>

export class BlueprintBulletinCreateAction extends BaseAction<
  z.infer<typeof blueprintBulletinCreateSchema>
> {
  get action(): ActionName {
    return ActionName.blueprint
  }

  override get operation(): string {
    return 'bulletin/create' satisfies typeof BLUEPRINT_BULLETIN_CREATE_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): BlueprintBulletinCreateAction {
    return new BlueprintBulletinCreateAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const blueprintBulletinCreate = new yaml.Type('!blueprint.bulletin.create', {
  kind: 'mapping',
  instanceOf: BlueprintBulletinCreateAction,

  construct(def: Record<string, unknown>): BlueprintBulletinCreateAction {
    return new BlueprintBulletinCreateAction(
      blueprintBulletinCreateSchema.parse(def)
    )
  },

  represent(
    tag: BlueprintBulletinCreateAction
  ): z.infer<typeof blueprintBulletinCreateSchema> {
    return tag.value
  },
})

const blueprintMetaFetchSchema = z.object({
  blueprintId: dynamicStringSchema.optional(),
  jsonpath: dynamicStringSchema.optional(),
  jmespath: dynamicStringSchema.optional(),
}) satisfies EnsureAllSchemaKeys<BlueprintMetaFetchSchema>

export class BlueprintMetaFetchAction extends BaseAction<
  z.infer<typeof blueprintMetaFetchSchema>
> {
  get action(): ActionName {
    return ActionName.blueprint
  }

  override get operation(): string {
    return 'meta/fetch' satisfies typeof BLUEPRINT_META_FETCH_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): BlueprintMetaFetchAction {
    return new BlueprintMetaFetchAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const blueprintMetaFetch = new yaml.Type('!blueprint.meta.fetch', {
  kind: 'mapping',
  instanceOf: BlueprintMetaFetchAction,

  construct(def: Record<string, unknown>): BlueprintMetaFetchAction {
    return new BlueprintMetaFetchAction(blueprintMetaFetchSchema.parse(def))
  },

  represent(
    tag: BlueprintMetaFetchAction
  ): z.infer<typeof blueprintMetaFetchSchema> {
    return tag.value
  },
})

// --- AGENT ACTIONS ---

const agentSpawnSchema = z.object({
  backstory: dynamicStringSchema.optional(),
  model: dynamicStringSchema.optional(),
  instructions: dynamicStringSchema,
  timeout: dynamicNumberSchema.optional(),
}) satisfies EnsureAllSchemaKeys<AgentSpawnSchema>

export class AgentSpawnAction extends BaseAction<
  z.infer<typeof agentSpawnSchema>
> {
  get action(): ActionName {
    return ActionName.agent
  }

  override get operation(): string {
    return 'spawn' satisfies typeof AGENT_SPAWN_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): AgentSpawnAction {
    return new AgentSpawnAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const agentSpawn = new yaml.Type('!agent.spawn', {
  kind: 'mapping',
  instanceOf: AgentSpawnAction,

  construct(def: Record<string, unknown>): AgentSpawnAction {
    return new AgentSpawnAction(agentSpawnSchema.parse(def))
  },

  represent(tag: AgentSpawnAction): z.infer<typeof agentSpawnSchema> {
    return tag.value
  },
})

// --- ECHO ACTION ---

const echoSchema = z.object({
  result: z.unknown().optional(),
})

export class EchoAction extends BaseAction<z.infer<typeof echoSchema>> {
  get action(): ActionName {
    return ActionName.echo
  }

  override get operation(): string {
    return 'echo'
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): EchoAction {
    return new EchoAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const echo = new yaml.Type('!echo', {
  kind: 'mapping',
  instanceOf: EchoAction,

  construct(def: Record<string, unknown>): EchoAction {
    return new EchoAction(echoSchema.parse(def))
  },

  represent(tag: EchoAction): z.infer<typeof echoSchema> {
    return tag.value
  },
})

// --- ABORT ACTION ---

const abortSchema = z.object({
  reason: dynamicStringSchema,
})

export class AbortAction extends BaseAction<z.infer<typeof abortSchema>> {
  get action(): ActionName {
    return ActionName.abort
  }

  override get operation(): string {
    return 'abort'
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): AbortAction {
    return new AbortAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const abort = new yaml.Type('!abort', {
  kind: 'mapping',
  instanceOf: AbortAction,

  construct(def: Record<string, unknown>): AbortAction {
    return new AbortAction(abortSchema.parse(def))
  },

  represent(tag: AbortAction): z.infer<typeof abortSchema> {
    return tag.value
  },
})

// --- TODO ACTIONS ---

const todoItemSchema = z.object({
  id: z.union([z.number(), z.instanceof(NumberField)]),
  title: dynamicStringSchema,
  status: z.union([
    z.enum(['not-started', 'in-progress', 'completed']),
    z.instanceof(StringField),
    z.instanceof(Concat),
    z.instanceof(Reference),
  ]),
})

const todoManageSchema = z.object({
  op: z.union([
    z.enum(['read', 'write']),
    z.instanceof(StringField),
    z.instanceof(Concat),
    z.instanceof(Reference),
  ]),
  todoList: z
    .union([z.array(todoItemSchema), z.instanceof(ArrayField)])
    .optional(),
}) satisfies EnsureAllSchemaKeys<TodoManageSchema>

export class TodoManageAction extends BaseAction<
  z.infer<typeof todoManageSchema>
> {
  get action(): ActionName {
    return ActionName.todo
  }

  override get operation(): string {
    // @note operation is determined by the 'op' field in the schema
    return 'manage' satisfies typeof TODO_MANAGE_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): TodoManageAction {
    return new TodoManageAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const todoManage = new yaml.Type('!todo.manage', {
  kind: 'mapping',
  instanceOf: TodoManageAction,

  construct(def: Record<string, unknown>): TodoManageAction {
    return new TodoManageAction(todoManageSchema.parse(def))
  },

  represent(tag: TodoManageAction): z.infer<typeof todoManageSchema> {
    return tag.value
  },
})

// --- LIST ACTIONS ---

const listItemActionSchema = z.union([
  dynamicValueSchema,
  z.null(),
  z.array(z.unknown()),
  z.record(z.unknown()),
  z.instanceof(ArrayField),
  z.instanceof(ObjectField),
])

const listPushSchema = z.object({
  name: dynamicStringSchema,
  item: listItemActionSchema,
  position: z
    .union([z.enum(['start', 'end']), z.instanceof(StringField)])
    .optional(),
}) satisfies EnsureAllSchemaKeys<ListPushSchema>

export class ListPushAction extends BaseAction<
  z.infer<typeof listPushSchema>
> {
  get action(): ActionName {
    return ActionName.list
  }

  override get operation(): string {
    return 'push' satisfies typeof LIST_PUSH_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): ListPushAction {
    return new ListPushAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const listPush = new yaml.Type('!list.push', {
  kind: 'mapping',
  instanceOf: ListPushAction,

  construct(def: Record<string, unknown>): ListPushAction {
    return new ListPushAction(listPushSchema.parse(def))
  },

  represent(tag: ListPushAction): z.infer<typeof listPushSchema> {
    return tag.value
  },
})

const listPopSchema = z.object({
  name: dynamicStringSchema,
  position: z
    .union([z.enum(['start', 'end']), z.instanceof(StringField)])
    .optional(),
}) satisfies EnsureAllSchemaKeys<ListPopSchema>

export class ListPopAction extends BaseAction<z.infer<typeof listPopSchema>> {
  get action(): ActionName {
    return ActionName.list
  }

  override get operation(): string {
    return 'pop' satisfies typeof LIST_POP_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): ListPopAction {
    return new ListPopAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const listPop = new yaml.Type('!list.pop', {
  kind: 'mapping',
  instanceOf: ListPopAction,

  construct(def: Record<string, unknown>): ListPopAction {
    return new ListPopAction(listPopSchema.parse(def))
  },

  represent(tag: ListPopAction): z.infer<typeof listPopSchema> {
    return tag.value
  },
})

const listReadSchema = z.object({
  name: dynamicStringSchema,
  position: z
    .union([z.enum(['start', 'end']), z.instanceof(StringField)])
    .optional(),
  offset: dynamicNumberSchema.optional(),
  limit: dynamicNumberSchema.optional(),
}) satisfies EnsureAllSchemaKeys<ListReadSchema>

export class ListReadAction extends BaseAction<
  z.infer<typeof listReadSchema>
> {
  get action(): ActionName {
    return ActionName.list
  }

  override get operation(): string {
    return 'read' satisfies typeof LIST_READ_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): ListReadAction {
    return new ListReadAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const listRead = new yaml.Type('!list.read', {
  kind: 'mapping',
  instanceOf: ListReadAction,

  construct(def: Record<string, unknown>): ListReadAction {
    return new ListReadAction(listReadSchema.parse(def))
  },

  represent(tag: ListReadAction): z.infer<typeof listReadSchema> {
    return tag.value
  },
})

// --- IMAGE ACTIONS ---

const imageCreateActionSchema = z.object({
  directions: dynamicStringSchema.optional(),
  prompt: dynamicStringSchema,
  model: dynamicStringSchema,
  size: z
    .union([
      z.enum([
        'auto',
        '1024x1024',
        '1536x1024',
        '1024x1536',
        '256x256',
        '512x512',
      ]),
      z.instanceof(StringField),
    ])
    .optional(),
  region: z.union([z.enum(['us']), z.instanceof(StringField)]).optional(),
}) satisfies EnsureAllSchemaKeys<ImageCreateSchema>

export class ImageCreateAction extends BaseAction<
  z.infer<typeof imageCreateActionSchema>
> {
  get action(): ActionName {
    return ActionName.image
  }

  override get operation(): string {
    return 'create' satisfies typeof IMAGE_CREATE_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): ImageCreateAction {
    return new ImageCreateAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const imageCreate = new yaml.Type('!image.create', {
  kind: 'mapping',
  instanceOf: ImageCreateAction,

  construct(def: Record<string, unknown>): ImageCreateAction {
    return new ImageCreateAction(imageCreateActionSchema.parse(def))
  },

  represent(tag: ImageCreateAction): z.infer<typeof imageCreateActionSchema> {
    return tag.value
  },
})

const imageEditActionSchema = z.object({
  directions: dynamicStringSchema.optional(),
  prompt: dynamicStringSchema,
  images: z.union([z.array(dynamicStringSchema), z.instanceof(ArrayField)]),
  mask: dynamicStringSchema.optional(),
  model: dynamicStringSchema,
  size: z
    .union([
      z.enum([
        'auto',
        '1024x1024',
        '1536x1024',
        '1024x1536',
        '256x256',
        '512x512',
      ]),
      z.instanceof(StringField),
    ])
    .optional(),
  region: z.union([z.enum(['us']), z.instanceof(StringField)]).optional(),
}) satisfies EnsureSchemaKeys<
  WithDynamic<Omit<ImageEditSchema, 'images'> & { images: string[] }>
>

export class ImageEditAction extends BaseAction<
  z.infer<typeof imageEditActionSchema>
> {
  get action(): ActionName {
    return ActionName.image
  }

  override get operation(): string {
    return 'edit' satisfies typeof IMAGE_EDIT_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): ImageEditAction {
    return new ImageEditAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const imageEdit = new yaml.Type('!image.edit', {
  kind: 'mapping',
  instanceOf: ImageEditAction,

  construct(def: Record<string, unknown>): ImageEditAction {
    return new ImageEditAction(imageEditActionSchema.parse(def))
  },

  represent(tag: ImageEditAction): z.infer<typeof imageEditActionSchema> {
    return tag.value
  },
})

// --- BOT ACTIONS ---

const botAskSchema = z.object({
  botId: dynamicStringSchema.optional(),
  botIds: dynamicStringSchema.optional(),
  selectedBotIds: dynamicStringSchema.optional(),
  prompt: dynamicStringSchema,
  timeout: dynamicNumberSchema.optional(),
}) satisfies EnsureAllSchemaKeys<
  BotAskSchema & { botId?: string; botIds?: string; selectedBotIds?: string }
>

export class BotAskAction extends BaseAction<z.infer<typeof botAskSchema>> {
  get action(): ActionName {
    return ActionName.bot
  }

  override get operation(): string {
    return 'ask' satisfies typeof BOT_ASK_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): BotAskAction {
    return new BotAskAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const botAsk = new yaml.Type('!bot.ask', {
  kind: 'mapping',
  instanceOf: BotAskAction,

  construct(def: Record<string, unknown>): BotAskAction {
    return new BotAskAction(botAskSchema.parse(def))
  },

  represent(tag: BotAskAction): z.infer<typeof botAskSchema> {
    return tag.value
  },
})

const botCallSchema = z.object({
  botId: dynamicStringSchema.optional(),
  botIds: dynamicStringSchema.optional(),
  selectedBotIds: dynamicStringSchema.optional(),
  prompt: dynamicStringSchema,
  timeout: dynamicNumberSchema.optional(),
}) satisfies EnsureAllSchemaKeys<
  BotCallSchema & { botId?: string; botIds?: string; selectedBotIds?: string }
>

export class BotCallAction extends BaseAction<z.infer<typeof botCallSchema>> {
  get action(): ActionName {
    return ActionName.bot
  }

  override get operation(): string {
    return 'call' satisfies typeof BOT_CALL_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): BotCallAction {
    return new BotCallAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const botCall = new yaml.Type('!bot.call', {
  kind: 'mapping',
  instanceOf: BotCallAction,

  construct(def: Record<string, unknown>): BotCallAction {
    return new BotCallAction(botCallSchema.parse(def))
  },

  represent(tag: BotCallAction): z.infer<typeof botCallSchema> {
    return tag.value
  },
})

const botApplySchema = z.object({
  botId: dynamicStringSchema.optional(),
  botIds: dynamicStringSchema.optional(),
  selectedBotIds: dynamicStringSchema.optional(),
  timeout: dynamicNumberSchema.optional(),
}) satisfies EnsureAllSchemaKeys<
  BotApplySchema & { botId?: string; botIds?: string; selectedBotIds?: string }
>

export class BotApplyAction extends BaseAction<z.infer<typeof botApplySchema>> {
  get action(): ActionName {
    return ActionName.bot
  }

  override get operation(): string {
    return 'apply' satisfies typeof BOT_APPLY_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): BotApplyAction {
    return new BotApplyAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const botApply = new yaml.Type('!bot.apply', {
  kind: 'mapping',
  instanceOf: BotApplyAction,

  construct(def: Record<string, unknown>): BotApplyAction {
    return new BotApplyAction(botApplySchema.parse(def))
  },

  represent(tag: BotApplyAction): z.infer<typeof botApplySchema> {
    return tag.value
  },
})

const botListSchema = z.object({
  take: dynamicNumberSchema.optional(),
}) satisfies EnsureAllSchemaKeys<BotListSchema>

export class BotListAction extends BaseAction<z.infer<typeof botListSchema>> {
  get action(): ActionName {
    return ActionName.bot
  }

  override get operation(): string {
    return 'list' satisfies typeof BOT_LIST_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): BotListAction {
    return new BotListAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const botList = new yaml.Type('!bot.list', {
  kind: 'mapping',
  instanceOf: BotListAction,

  construct(def: Record<string, unknown>): BotListAction {
    return new BotListAction(botListSchema.parse(def))
  },

  represent(tag: BotListAction): z.infer<typeof botListSchema> {
    return tag.value
  },
})

const botBackstoryReadSchema = z.object({
  botId: dynamicStringSchema.optional(),
}) satisfies EnsureAllSchemaKeys<BotBackstoryReadSchema & { botId?: string }>

export class BotBackstoryReadAction extends BaseAction<
  z.infer<typeof botBackstoryReadSchema>
> {
  get action(): ActionName {
    return ActionName.bot
  }

  override get operation(): string {
    return 'backstory/read' satisfies typeof BOT_BACKSTORY_READ_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): BotBackstoryReadAction {
    return new BotBackstoryReadAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const botBackstoryRead = new yaml.Type('!bot.backstory.read', {
  kind: 'mapping',
  instanceOf: BotBackstoryReadAction,

  construct(def: Record<string, unknown>): BotBackstoryReadAction {
    return new BotBackstoryReadAction(botBackstoryReadSchema.parse(def))
  },

  represent(
    tag: BotBackstoryReadAction
  ): z.infer<typeof botBackstoryReadSchema> {
    return tag.value
  },
})

const botBackstoryWriteSchema = z.object({
  botId: dynamicStringSchema.optional(),
  // @note field is named 'content' (not 'backstory') to avoid collision with
  // the 'backstory' routing segment key that toActionResult() adds to params
  content: dynamicStringSchema,
}) satisfies EnsureAllSchemaKeys<BotBackstoryWriteSchema & { botId?: string }>

export class BotBackstoryWriteAction extends BaseAction<
  z.infer<typeof botBackstoryWriteSchema>
> {
  get action(): ActionName {
    return ActionName.bot
  }

  override get operation(): string {
    return 'backstory/write' satisfies typeof BOT_BACKSTORY_WRITE_OPERATION_NAME
  }

  substitute(
    fieldValues: Record<string, unknown>,
    referenceValues: Record<string, unknown> = {}
  ): BotBackstoryWriteAction {
    return new BotBackstoryWriteAction(
      substituteInValue(
        this.value,
        fieldValues,
        referenceValues
      ) as typeof this.value
    )
  }
}

const botBackstoryWrite = new yaml.Type('!bot.backstory.write', {
  kind: 'mapping',
  instanceOf: BotBackstoryWriteAction,

  construct(def: Record<string, unknown>): BotBackstoryWriteAction {
    return new BotBackstoryWriteAction(botBackstoryWriteSchema.parse(def))
  },

  represent(
    tag: BotBackstoryWriteAction
  ): z.infer<typeof botBackstoryWriteSchema> {
    return tag.value
  },
})

// --- TO BE DONE ---

// @todo add !listen from action.exec.listen.ts
// @todo add !dataset.list, !dataset.create, !dataset.search, !dataset.record.create, !dataset.record.delete from action.exec.dataset.ts
// @todo add !text from action.exec.text.ts
// @todo add !view from action.exec.view.ts
// @todo add !agent.process, !agent.ensemble from action.exec.agent.ts
// @todo add !search.web, !search.news, !search.images, !search.videos, !search.dataset from action.exec.search.ts

// --- EXPORTS ---

/**
 * YAML schema that includes all Action tags.
 */
export const ACTION_TAGS_SCHEMA = yaml.DEFAULT_SCHEMA.extend([
  // fields
  stringTag,
  numberTag,
  booleanTag,
  arrayTag,
  objectTag,
  // optional
  optionalStringTag,
  optionalNumberTag,
  optionalBooleanTag,
  optionalArrayTag,
  optionalObjectTag,
  // special
  referenceTag,
  // utilities
  concat,
  // actions
  fetch,
  skillsetInstall,
  skillsetUninstall,
  mcpInstall,
  mcpUninstall,
  packInstall,
  packUninstall,
  // task actions
  taskList,
  taskFetch,
  taskCreate,
  taskUpdate,
  taskDelete,
  taskRun,
  // time actions
  timeNow,
  // rating actions
  ratingList,
  ratingFetch,
  ratingCreate,
  ratingDelete,
  // file actions
  fileRead,
  fileWrite,
  filePrepend,
  fileAppend,
  fileReplace,
  fileRw,
  // memory actions
  memoryList,
  memorySearch,
  memoryCreate,
  memoryUpdate,
  memoryDelete,
  // conversation actions
  conversationList,
  conversationFetch,
  conversationSearch,
  // space actions
  spaceList,
  spaceFetch,
  spaceCreate,
  spaceUpdate,
  spaceDelete,
  // space storage actions
  spaceStorageList,
  spaceStorageRead,
  spaceStorageWrite,
  spaceStorageRw,
  spaceStorageMove,
  spaceStorageCopy,
  spaceStorageDelete,
  spaceStorageSearch,
  spaceStorageImport,
  spaceStorageLink,
  // shell actions
  shellExec,
  shellScript,
  shellRead,
  shellWrite,
  shellRw,
  shellReplace,
  shellEval,
  shellImport,
  shellSkillsetInstall,
  // blueprint actions
  blueprintResourceList,
  blueprintNoteList,
  blueprintBulletinList,
  blueprintBulletinCreate,
  blueprintMetaFetch,
  // agent actions
  agentSpawn,
  // echo action
  echo,
  // abort action
  abort,
  // todo actions
  todoManage,
  // list actions
  listPush,
  listPop,
  listRead,
  // image actions
  imageCreate,
  imageEdit,
  // bot actions
  botAsk,
  botCall,
  botApply,
  botList,
  botBackstoryRead,
  botBackstoryWrite,
])

// --- ACTION CLASS REGISTRY ---

/**
 * Centralized registry of all action classes. This is the SINGLE SOURCE OF
 * TRUTH for action registration. When adding a new action class:
 *
 * 1. Add it to this array
 * 2. TypeScript will enforce updates to SubstitutableTag type and related functions
 *
 * @note This array is used by isActionTag, isSubstitutableTag, and unit tests
 * to ensure complete registration of all action classes.
 */
export const ACTION_CLASSES = [
  FetchAction,
  SkillsetInstallAction,
  SkillsetUninstallAction,
  McpInstallAction,
  McpUninstallAction,
  PackInstallAction,
  PackUninstallAction,
  TaskListAction,
  TaskFetchAction,
  TaskCreateAction,
  TaskUpdateAction,
  TaskDeleteAction,
  TaskRunAction,
  TimeNowAction,
  RatingListAction,
  RatingFetchAction,
  RatingCreateAction,
  RatingDeleteAction,
  FileReadAction,
  FileWriteAction,
  FilePrependAction,
  FileAppendAction,
  FileReplaceAction,
  FileRwAction,
  MemoryListAction,
  MemorySearchAction,
  MemoryCreateAction,
  MemoryUpdateAction,
  MemoryDeleteAction,
  ConversationListAction,
  ConversationFetchAction,
  ConversationSearchAction,
  SpaceListAction,
  SpaceFetchAction,
  SpaceCreateAction,
  SpaceUpdateAction,
  SpaceDeleteAction,
  SpaceStorageListAction,
  SpaceStorageReadAction,
  SpaceStorageWriteAction,
  SpaceStorageRwAction,
  SpaceStorageMoveAction,
  SpaceStorageCopyAction,
  SpaceStorageDeleteAction,
  SpaceStorageSearchAction,
  SpaceStorageImportAction,
  SpaceStorageLinkAction,
  ShellExecAction,
  ShellScriptAction,
  ShellReadAction,
  ShellWriteAction,
  ShellRwAction,
  ShellReplaceAction,
  ShellEvalAction,
  ShellImportAction,
  ShellSkillsetInstallAction,
  BlueprintResourceListAction,
  BlueprintNoteListAction,
  BlueprintBulletinListAction,
  BlueprintBulletinCreateAction,
  BlueprintMetaFetchAction,
  AgentSpawnAction,
  EchoAction,
  AbortAction,
  TodoManageAction,
  ListPushAction,
  ListPopAction,
  ListReadAction,
  ImageCreateAction,
  ImageEditAction,
  BotAskAction,
  BotCallAction,
  BotApplyAction,
  BotListAction,
  BotBackstoryReadAction,
  BotBackstoryWriteAction,
] as const

/**
 * Type representing all action class constructors in the registry.
 */
export type ActionClass = (typeof ACTION_CLASSES)[number]

/**
 * Type representing instances of all action classes.
 */
export type ActionInstance = InstanceType<ActionClass>

// --- PARSE ---

/**
 * Parses an input string containing Action tags in YAML format.
 *
 * @param input - The input string to parse
 * @returns The parsed object with Action tags
 */
export function parse(input: string): unknown {
  return yaml.load(input, { schema: ACTION_TAGS_SCHEMA })
}

/**
 * Attempts to parse an input string containing Action tags in YAML format.
 * Returns null if parsing fails.
 *
 * @param input - The input string to parse
 * @returns The parsed object with Action tags, or null if parsing fails
 */
export function tryParse(input: string): unknown {
  try {
    return parse(input)
  } catch {
    return null
  }
}

// --- UTILS ---

/**
 * Checks if a value is an Action tag using the centralized ACTION_CLASSES registry.
 *
 * @param value - The value to check
 * @returns True if the value is an instance of any registered action class
 */
export function isActionTag(value: unknown): value is ActionInstance {
  // @note uses the centralized ACTION_CLASSES registry to ensure all actions are checked

  return ACTION_CLASSES.some((ActionClass) => value instanceof ActionClass)
}

// --- EXTRACTION & SUBSTITUTION ---

/**
 * Defines the possible field types that can be extracted.
 */
type FieldType =
  | ({ type: 'string' } & z.infer<typeof stringFieldSchema>)
  | ({ type: 'number' } & z.infer<typeof numberFieldSchema>)
  | ({ type: 'boolean' } & z.infer<typeof booleanFieldSchema>)
  | ({ type: 'array' } & z.infer<typeof arrayFieldSchema>)
  | ({ type: 'object' } & z.infer<typeof objectFieldSchema>)
  | { type: 'reference'; name: string }

/**
 * Converts a field instance (or nested field value) to a plain object structure
 * suitable for JSON schema conversion. Handles nested arrays and objects.
 *
 * @param value - The field value which may be a field instance or plain object
 * @returns A plain object representation of the field
 */
function fieldToPlainObject(
  value: unknown
): Record<string, unknown> | undefined {
  if (value instanceof StringField) {
    return { type: 'string', ...value.value }
  } else if (value instanceof NumberField) {
    return { type: 'number', ...value.value }
  } else if (value instanceof BooleanField) {
    return { type: 'boolean', ...value.value }
  } else if (value instanceof ArrayField) {
    return {
      type: 'array',
      ...value.value,
      items: fieldToPlainObject(value.value.items),
    }
  } else if (value instanceof ObjectField) {
    const properties: Record<string, unknown> = {}

    if (value.value.properties) {
      for (const [key, propValue] of Object.entries(value.value.properties)) {
        properties[key] = fieldToPlainObject(propValue)
      }
    }

    return {
      type: 'object',
      ...value.value,
      properties,
    }
  } else if (typeof value === 'object' && value !== null) {
    // @note plain nested field object (not wrapped in a field class)

    const obj = value as Record<string, unknown>

    if (obj.type === 'object' && obj.properties) {
      const properties: Record<string, unknown> = {}

      for (const [key, propValue] of Object.entries(
        obj.properties as Record<string, unknown>
      )) {
        properties[key] = fieldToPlainObject(propValue)
      }

      return { ...obj, properties }
    }

    if (obj.type === 'array' && obj.items) {
      return { ...obj, items: fieldToPlainObject(obj.items) }
    }

    return obj
  }

  return undefined
}

/**
 * Infers a field type from a plain object definition when the YAML tag has
 * already been stripped during serialization.
 */
function inferPlainFieldType(
  value: Record<string, unknown>
): FieldType['type'] | undefined {
  if (typeof value.type === 'string') {
    switch (value.type) {
      case 'string':
      case 'number':
      case 'boolean':
      case 'array':
      case 'object':
      case 'reference': {
        return value.type
      }
    }
  }

  if ('items' in value) {
    return 'array'
  }

  if ('properties' in value) {
    return 'object'
  }

  if (typeof value.default === 'number') {
    return 'number'
  }

  if (typeof value.default === 'boolean') {
    return 'boolean'
  }

  if ('name' in value && typeof value.name === 'string') {
    return 'string'
  }

  return undefined
}

/**
 * Detects plain field definitions that may have lost their YAML tag wrapper.
 */
function isPlainFieldObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const obj = value as Record<string, unknown>
  const type = inferPlainFieldType(obj)

  if (!type || !('name' in obj) || typeof obj.name !== 'string') {
    return false
  }

  return true
}

/**
 * Converts a plain field definition back into the extracted field shape.
 */
function plainFieldObjectToFieldType(
  value: Record<string, unknown>
): FieldType {
  const type = inferPlainFieldType(value) || 'string'

  if (type === 'object') {
    const properties =
      typeof value.properties === 'object' && value.properties !== null
        ? Object.fromEntries(
            Object.entries(value.properties as Record<string, unknown>).map(
              ([key, propertyValue]) => {
                return [
                  key,
                  isPlainFieldObject(propertyValue)
                    ? plainFieldObjectToFieldType(propertyValue)
                    : propertyValue,
                ]
              }
            )
          )
        : {}

    return {
      ...(value as Omit<FieldType, 'type'>),
      type,
      properties,
    } as FieldType
  }

  if (type === 'array') {
    return {
      ...(value as Omit<FieldType, 'type'>),
      type,
      items:
        isPlainFieldObject(value.items) && value.items
          ? plainFieldObjectToFieldType(value.items)
          : (value.items as FieldType | undefined),
    } as FieldType
  }

  return {
    ...(value as Omit<FieldType, 'type'>),
    type,
  } as FieldType
}

/**
 * Recursively extracts field tags from a parsed value.
 *
 * @param value - The value to extract fields from
 * @param fields - The array to collect fields into
 */
function extractFieldsFromValue(value: unknown, fields: FieldType[]): void {
  if (value instanceof StringField) {
    fields.push({ type: 'string', ...value.value })
  } else if (value instanceof NumberField) {
    fields.push({ type: 'number', ...value.value })
  } else if (value instanceof BooleanField) {
    fields.push({ type: 'boolean', ...value.value })
  } else if (value instanceof ArrayField) {
    // @note convert nested items to plain objects for proper JSON schema generation
    const plainField = fieldToPlainObject(value) as FieldType

    fields.push(plainField)
  } else if (value instanceof ObjectField) {
    // @note convert nested properties to plain objects for proper JSON schema generation
    const plainField = fieldToPlainObject(value) as FieldType

    fields.push(plainField)
  } else if (value instanceof Reference) {
    fields.push({ type: 'reference', name: value.name })
  } else if (value instanceof Concat) {
    // @note ConcatTag contains an array of values that may include field tags
    for (const item of value.value) {
      extractFieldsFromValue(item, fields)
    }
  } else if (
    typeof value === 'object' &&
    value !== null &&
    'value' in value &&
    isPlainFieldObject((value as { value: unknown }).value)
  ) {
    fields.push(
      plainFieldObjectToFieldType(
        (value as { value: Record<string, unknown> }).value
      )
    )
  } else if (isPlainFieldObject(value)) {
    fields.push(plainFieldObjectToFieldType(value))
  } else if (isActionTag(value)) {
    // @note extract fields from any action tag's value object
    // @note safe cast since isActionTag verifies value extends BaseAction
    extractFieldsFromValue((value as BaseAction<unknown>).value, fields)
  } else if (Array.isArray(value)) {
    // @note recursively extract from arrays
    for (const item of value) {
      extractFieldsFromValue(item, fields)
    }
  } else if (value && typeof value === 'object') {
    // @note recursively extract from plain objects
    for (const v of Object.values(value)) {
      extractFieldsFromValue(v, fields)
    }
  }
}

/**
 * Extracts all field tags from a structured instruction.
 *
 * @param input - The structured instruction YAML string
 * @returns An array of extracted field definitions
 */
export function extractFields(input: string): FieldType[] {
  const parsed = tryParse(input)

  if (!parsed || typeof parsed !== 'object') {
    return []
  }

  const fields: FieldType[] = []

  extractFieldsFromValue(parsed, fields)

  return fields
}

/**
 * Substitutes field tags in a structured instruction with their resolved
 * values. Returns the YAML representation with all field tags replaced by their
 * values.
 *
 * @param input - The structured instruction YAML string
 * @param fieldValues - Map of field names to their resolved values
 * @param referenceValues - Map of reference names to their resolved values
 * @returns The instruction with field tags replaced by values as YAML
 */
export function substituteFields(
  input: string,
  fieldValues: Record<string, unknown>,
  referenceValues: Record<string, unknown> = {}
): string {
  const parsed = tryParse(input)

  if (!parsed) {
    return input
  }

  const substituted = substituteInValue(parsed, fieldValues, referenceValues)

  const dumpOptions = {
    schema: ACTION_TAGS_SCHEMA,
    forceQuotes: true,
    quotingType: '"' as const,
  }

  // @note action tags are dumped as their underlying value objects
  // @note safe cast since isActionTag verifies value extends BaseAction
  if (isActionTag(substituted)) {
    return yaml.dump((substituted as BaseAction<unknown>).value, dumpOptions)
  }

  return yaml.dump(substituted, dumpOptions)
}

/**
 * Substitutes field tags in a structured instruction and returns the result
 * as an action result (action, params, text).
 *
 * This is the preferred method for structured instruction transforms as it
 * directly returns the action components without needing to re-parse.
 *
 * @param input - The structured instruction YAML string
 * @param fieldValues - Map of field names to their resolved values
 * @param referenceValues - Map of reference names to their resolved values
 * @returns The action components or null if parsing fails
 */
export function substituteAndTransform(
  input: string,
  fieldValues: Record<string, unknown>,
  referenceValues: Record<string, unknown> = {}
): ActionResult | null {
  const parsed = tryParse(input)

  if (!parsed) {
    return null
  }

  const substituted = substituteInValue(parsed, fieldValues, referenceValues)

  // @note if the substituted value is an action tag, use toActionResult()

  if (isActionTag(substituted)) {
    return (substituted as BaseAction<unknown>).toActionResult()
  }

  // @note if not an action tag, return null - caller should handle this case

  return null
}
