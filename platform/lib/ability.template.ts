import type { SpawnSchema as AgentSpawnSchema } from '@/lib/action.exec.agent'
import type {
  BlueprintBulletinCreateSchema,
  BlueprintBulletinListSchema,
  BlueprintMetaFetchSchema,
  BlueprintNoteListSchema,
  BlueprintResourceListSchema,
} from '@/lib/action.exec.blueprint'
import type {
  BotApplySchema,
  BotAskSchema,
  BotBackstoryReadSchema,
  BotBackstoryWriteSchema,
  BotCallSchema,
  BotListSchema,
} from '@/lib/action.exec.bot'
import type {
  ConversationFetchSchema,
  ConversationListSchema,
  ConversationSearchSchema,
} from '@/lib/action.exec.conversation'
import type { RequestSchema } from '@/lib/action.exec.fetch'
import type {
  FileAppendSchema,
  FilePrependSchema,
  FileReadSchema,
  FileReplaceSchema,
  FileRwSchema,
  FileWriteSchema,
} from '@/lib/action.exec.file'
import type {
  ImageCreateSchema,
  ImageEditSchema,
} from '@/lib/action.exec.image'
import type {
  ListPopSchema,
  ListPushSchema,
  ListReadSchema,
} from '@/lib/action.exec.list'
import type { InstallSchema as McpInstallSchema } from '@/lib/action.exec.mcp'
import type {
  MemoryCreateSchema,
  MemoryDeleteSchema,
  MemoryListSchema,
  MemorySearchSchema,
  MemoryUpdateSchema,
} from '@/lib/action.exec.memory'
import type { InstallSchema as PackInstallSchema } from '@/lib/action.exec.pack'
import type {
  RatingCreateSchema,
  RatingDeleteSchema,
  RatingFetchSchema,
  RatingListSchema,
} from '@/lib/action.exec.rating'
import type {
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
import type { InstallSchema as SkillsetInstallSchema } from '@/lib/action.exec.skillset'
import type {
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
  TaskCreateSchema,
  TaskDeleteSchema,
  TaskFetchSchema,
  TaskListSchema,
  TaskRunSchema,
  TaskUpdateSchema,
} from '@/lib/action.exec.task'
import type { TimeNowSchema } from '@/lib/action.exec.time'
import type { TodoManageSchema } from '@/lib/action.exec.todo'
import {
  ACTION_TAGS_SCHEMA,
  ArrayField,
  BooleanField,
  NumberField,
  ObjectField,
  Reference,
  StringField,
} from '@/lib/action.tags'
import { BracketType, stringifyField } from '@/lib/field'

import yaml from 'js-yaml'

// --- SYMBOLS ---

// @note schemas are imported by type in order to avoid importing dependencies
// from the actions into other parts of the codebase that don't need them

const FIELD_MARKER = Symbol('field')
const SECRET_MARKER = Symbol('secret')
const FILE_MARKER = Symbol('file')
const SPACE_MARKER = Symbol('space')
const BOT_MARKER = Symbol('bot')
const ARRAY_MARKER = Symbol('array')
const OBJECT_MARKER = Symbol('object')

// --- MARKERS ---

/**
 * Marker for dynamic field values that the AI fills in.
 */
export interface FieldMarker<TName extends string = string> {
  readonly [FIELD_MARKER]: true
  readonly name: TName
  readonly description?: string
  readonly type?: 'string' | 'number' | 'boolean'
  readonly required?: boolean
  readonly placeholder?: boolean
  readonly enum?: string[] | number[]
  readonly default?: unknown
  readonly min?: number
  readonly max?: number
  readonly local?: boolean
}

/**
 * Marker for typed array values.
 */
export interface ArrayMarker<TItems = InstructionValue> {
  readonly [ARRAY_MARKER]: true
  readonly items: TItems
  readonly name?: string
  readonly description?: string
  readonly optional?: boolean
  readonly minItems?: number
  readonly maxItems?: number
}

/**
 * Marker for typed object values with a specific shape.
 */
export interface ObjectMarker<
  TShape extends Record<string, InstructionValue> = Record<
    string,
    InstructionValue
  >,
> {
  readonly [OBJECT_MARKER]: true
  readonly shape: TShape
  readonly name?: string
  readonly description?: string
  readonly optional?: boolean
}

/**
 * Marker for secret values injected at runtime.
 */
export interface SecretMarker<TName extends string = 'DEFAULT'> {
  readonly [SECRET_MARKER]: true
  readonly name: TName
}

/**
 * Marker for file values injected at runtime.
 */
export interface FileMarker<TName extends string = 'DEFAULT'> {
  readonly [FILE_MARKER]: true
  readonly name: TName
}

/**
 * Marker for space values injected at runtime.
 */
export interface SpaceMarker<TName extends string = 'DEFAULT'> {
  readonly [SPACE_MARKER]: true
  readonly name: TName
}

/**
 * Marker for bot values injected at runtime.
 */
export interface BotMarker<TName extends string = 'DEFAULT'> {
  readonly [BOT_MARKER]: true
  readonly name: TName
}

/**
 * Type guard to check if a value is a FieldMarker.
 */
function isFieldMarker(value: unknown): value is FieldMarker {
  return (
    typeof value === 'object' &&
    value !== null &&
    FIELD_MARKER in value &&
    (value as FieldMarker)[FIELD_MARKER] === true
  )
}

/**
 * Type guard to check if a value is a SecretMarker.
 */
function isSecretMarker(value: unknown): value is SecretMarker {
  return (
    typeof value === 'object' &&
    value !== null &&
    SECRET_MARKER in value &&
    (value as SecretMarker)[SECRET_MARKER] === true
  )
}

/**
 * Type guard to check if a value is a FileMarker.
 */
function isFileMarker(value: unknown): value is FileMarker {
  return (
    typeof value === 'object' &&
    value !== null &&
    FILE_MARKER in value &&
    (value as FileMarker)[FILE_MARKER] === true
  )
}

/**
 * Type guard to check if a value is a SpaceMarker.
 */
function isSpaceMarker(value: unknown): value is SpaceMarker {
  return (
    typeof value === 'object' &&
    value !== null &&
    SPACE_MARKER in value &&
    (value as SpaceMarker)[SPACE_MARKER] === true
  )
}

/**
 * Type guard to check if a value is a BotMarker.
 */
function isBotMarker(value: unknown): value is BotMarker {
  return (
    typeof value === 'object' &&
    value !== null &&
    BOT_MARKER in value &&
    (value as BotMarker)[BOT_MARKER] === true
  )
}

/**
 * Type guard to check if a value is an ArrayMarker.
 */
function isArrayMarker(value: unknown): value is ArrayMarker {
  return (
    typeof value === 'object' &&
    value !== null &&
    ARRAY_MARKER in value &&
    (value as ArrayMarker)[ARRAY_MARKER] === true
  )
}

/**
 * Type guard to check if a value is an ObjectMarker.
 */
function isObjectMarker(value: unknown): value is ObjectMarker {
  return (
    typeof value === 'object' &&
    value !== null &&
    OBJECT_MARKER in value &&
    (value as ObjectMarker)[OBJECT_MARKER] === true
  )
}

/**
 * A value that can appear in an instruction.
 * Can be a literal, a field marker, a secret marker, array/object markers, or nested structures.
 */
export type InstructionValue =
  | string
  | number
  | boolean
  | FieldMarker
  | SecretMarker
  | FileMarker
  | SpaceMarker
  | BotMarker
  | ArrayMarker
  | ObjectMarker
  | InstructionValue[]
  | { [key: string]: InstructionValue }

/**
 * Helper type to convert array element types to allow markers.
 * For object elements, recursively applies WithMarkers.
 */
type WithMarkersArrayElement<U> = U extends object
  ?
      | WithMarkers<U>
      | FieldMarker
      | SecretMarker
      | FileMarker
      | SpaceMarker
      | BotMarker
  : U | FieldMarker | SecretMarker | FileMarker | SpaceMarker | BotMarker

/**
 * Helper type to convert schema fields to allow markers.
 * Transforms each field type to also accept FieldMarker, SecretMarker, FileMarker, SpaceMarker, or BotMarker.
 */
type WithMarkers<T> = {
  [K in keyof T]: T[K] extends string | (infer U)[] | undefined
    ? // @note handle union of string | array (e.g., path field)
      | T[K]
        | FieldMarker
        | SecretMarker
        | FileMarker
        | SpaceMarker
        | BotMarker
        | ArrayMarker
        | WithMarkersArrayElement<U>[]
    : T[K] extends string | undefined
      ? T[K] | FieldMarker | SecretMarker | FileMarker | SpaceMarker | BotMarker
      : T[K] extends number | undefined
        ? T[K] | FieldMarker
        : T[K] extends boolean | undefined
          ? T[K] | FieldMarker
          : T[K] extends Record<string, infer V> | undefined
            ?
                | Record<
                    string,
                    | V
                    | FieldMarker
                    | SecretMarker
                    | FileMarker
                    | SpaceMarker
                    | BotMarker
                  >
                | ObjectMarker<Record<string, InstructionValue>>
                | undefined
            : T[K] extends (infer U)[] | undefined
              ? WithMarkersArrayElement<U>[] | ArrayMarker | undefined
              : T[K] extends object | undefined
                ? WithMarkers<NonNullable<T[K]>> | undefined
                : T[K] | FieldMarker
}

// --- FIELDS & SECRETS ---

/**
 * Creates a field marker for dynamic values the AI fills in. The field is
 * always **required** unless specified otherwise (i.e. not optional).
 *
 * @example
 * ```typescript
 * field({ name: 'query', description: 'Search query' })
 * field({ name: 'limit', type: 'number', default: 10 })
 * field({ name: 'format', enum: ['json', 'xml'] })
 * ```
 */
export function field<TName extends string>(options: {
  name: TName
  description?: string
  type?: 'string' | 'number' | 'boolean'
  optional?: boolean
  placeholder?: boolean
  enum?: string[] | number[]
  default?: unknown
  min?: number
  max?: number
  local?: boolean
}): FieldMarker<TName> {
  return {
    [FIELD_MARKER]: true,
    name: options.name,
    description: options.description,
    type: options.type ?? 'string',
    required: !options.optional,
    placeholder: options.placeholder,
    enum: options.enum,
    default: options.default,
    min: options.min,
    max: options.max,
    local: options.local,
  }
}

/**
 * Creates a secret marker for secret values.
 *
 * @example
 * ```typescript
 * secret()           // → ${SECRET_DEFAULT}
 * secret('COINAPI')  // → ${SECRET_COINAPI}
 * ```
 */
export function secret<TName extends string = 'DEFAULT'>(
  name?: TName
): SecretMarker<TName> {
  return {
    [SECRET_MARKER]: true,
    name: (name ?? 'DEFAULT') as TName,
  }
}

/**
 * Creates a file marker for file values.
 *
 * @example
 * ```typescript
 * file()        // → ${FILE_DEFAULT}
 * file('CUSTOM') // → ${FILE_CUSTOM}
 * ```
 */
export function file<TName extends string = 'DEFAULT'>(
  name?: TName
): FileMarker<TName> {
  return {
    [FILE_MARKER]: true,
    name: (name ?? 'DEFAULT') as TName,
  }
}

/**
 * Creates a space marker for space values.
 *
 * @example
 * ```typescript
 * space()        // → ${SPACE_DEFAULT}
 * space('CUSTOM') // → ${SPACE_CUSTOM}
 * ```
 */
export function space<TName extends string = 'DEFAULT'>(
  name?: TName
): SpaceMarker<TName> {
  return {
    [SPACE_MARKER]: true,
    name: (name ?? 'DEFAULT') as TName,
  }
}

/**
 * Creates a bot marker for bot values.
 *
 * @example
 * ```typescript
 * bot()        // → ${BOT_DEFAULT}
 * bot('CUSTOM') // → ${BOT_CUSTOM}
 * ```
 */
export function bot<TName extends string = 'DEFAULT'>(
  name?: TName
): BotMarker<TName> {
  return {
    [BOT_MARKER]: true,
    name: (name ?? 'DEFAULT') as TName,
  }
}

/**
 * Creates an array marker for typed arrays.
 *
 * @example
 * ```typescript
 * // Array of dynamic string fields
 * array({
 *   items: field({ name: 'tag', description: 'A tag' }),
 *   minItems: 1,
 *   maxItems: 5,
 * })
 *
 * // Array of objects with a specific shape
 * array({
 *   items: object({
 *     shape: {
 *       role: field({ name: 'role', enum: ['user', 'assistant'] }),
 *       content: field({ name: 'content', description: 'Message text' }),
 *     }
 *   }),
 * })
 * ```
 */
export function array<TItems extends InstructionValue>(options: {
  items: TItems
  name?: string
  description?: string
  optional?: boolean
  minItems?: number
  maxItems?: number
}): ArrayMarker<TItems> {
  return {
    [ARRAY_MARKER]: true,
    items: options.items,
    name: options.name,
    description: options.description,
    optional: options.optional,
    minItems: options.minItems,
    maxItems: options.maxItems,
  }
}

/**
 * Creates an object marker for typed objects with a specific shape.
 *
 * @example
 * ```typescript
 * object({
 *   shape: {
 *     name: field({ name: 'userName', description: 'User name' }),
 *     email: field({ name: 'userEmail', description: 'User email' }),
 *     role: 'user', // static value
 *   }
 * })
 * ```
 */
export function object<
  TShape extends Record<string, InstructionValue>,
>(options: {
  shape: TShape
  name?: string
  description?: string
  optional?: boolean
}): ObjectMarker<TShape> {
  return {
    [OBJECT_MARKER]: true,
    shape: options.shape,
    optional: options.optional,
    name: options.name,
    description: options.description,
  }
}

// --- INSTRUCTIONS ---

export type AgentSpawnInstruction = WithMarkers<AgentSpawnSchema>
export type FetchInstruction = WithMarkers<RequestSchema>
export type SkillsetInstruction = WithMarkers<SkillsetInstallSchema>
export type McpInstruction = WithMarkers<McpInstallSchema>
export type PackInstruction = WithMarkers<PackInstallSchema>
export type FileReadInstruction = WithMarkers<FileReadSchema>
export type FileWriteInstruction = WithMarkers<FileWriteSchema>
export type FilePrependInstruction = WithMarkers<FilePrependSchema>
export type FileAppendInstruction = WithMarkers<FileAppendSchema>
export type FileReplaceInstruction = WithMarkers<FileReplaceSchema>
export type FileRwInstruction = WithMarkers<FileRwSchema>
export type TaskListInstruction = WithMarkers<TaskListSchema>
export type TaskFetchInstruction = WithMarkers<TaskFetchSchema>
export type TaskCreateInstruction = WithMarkers<TaskCreateSchema>
export type TaskUpdateInstruction = WithMarkers<TaskUpdateSchema>
export type TaskDeleteInstruction = WithMarkers<TaskDeleteSchema>
export type TaskRunInstruction = WithMarkers<TaskRunSchema>
export type TimeNowInstruction = WithMarkers<TimeNowSchema>
export type RatingListInstruction = WithMarkers<RatingListSchema>
export type RatingFetchInstruction = WithMarkers<RatingFetchSchema>
export type RatingCreateInstruction = WithMarkers<RatingCreateSchema>
export type RatingDeleteInstruction = WithMarkers<RatingDeleteSchema>
export type ConversationListInstruction = WithMarkers<ConversationListSchema>
export type ConversationFetchInstruction = WithMarkers<ConversationFetchSchema>
export type ConversationSearchInstruction =
  WithMarkers<ConversationSearchSchema>
export type MemoryCreateInstruction = WithMarkers<MemoryCreateSchema>
export type MemoryUpdateInstruction = WithMarkers<MemoryUpdateSchema>
export type MemoryDeleteInstruction = WithMarkers<MemoryDeleteSchema>
export type MemorySearchInstruction = WithMarkers<MemorySearchSchema>
export type MemoryListInstruction = WithMarkers<MemoryListSchema>
export type SpaceListInstruction = WithMarkers<SpaceListSchema>
export type SpaceFetchInstruction = WithMarkers<SpaceFetchSchema>
export type SpaceCreateInstruction = WithMarkers<SpaceCreateSchema>
export type SpaceUpdateInstruction = WithMarkers<SpaceUpdateSchema>
export type SpaceDeleteInstruction = WithMarkers<SpaceDeleteSchema>
export type SpaceStorageListInstruction = WithMarkers<SpaceStorageListSchema>
export type SpaceStorageReadInstruction = WithMarkers<SpaceStorageReadSchema>
export type SpaceStorageWriteInstruction = WithMarkers<SpaceStorageWriteSchema>
export type SpaceStorageRwInstruction = WithMarkers<SpaceStorageRwSchema>
export type SpaceStorageMoveInstruction = WithMarkers<SpaceStorageMoveSchema>
export type SpaceStorageCopyInstruction = WithMarkers<SpaceStorageCopySchema>
export type SpaceStorageDeleteInstruction =
  WithMarkers<SpaceStorageDeleteSchema>
export type SpaceStorageSearchInstruction =
  WithMarkers<SpaceStorageSearchSchema>
export type SpaceStorageImportInstruction =
  WithMarkers<SpaceStorageImportSchema>
export type SpaceStorageLinkInstruction = WithMarkers<SpaceStorageLinkSchema>
export type ShellExecInstruction = WithMarkers<ShellExecSchema>
export type ShellScriptInstruction = WithMarkers<ShellScriptSchema>
export type ShellReadInstruction = WithMarkers<ShellReadSchema>
export type ShellWriteInstruction = WithMarkers<ShellWriteSchema>
export type ShellRwInstruction = WithMarkers<ShellRwSchema>
export type ShellReplaceInstruction = WithMarkers<ShellReplaceSchema>
export type ShellEvalInstruction = WithMarkers<ShellEvalSchema>
export type ShellImportInstruction = WithMarkers<ShellImportSchema>
export type ShellSkillsetInstallInstruction =
  WithMarkers<ShellSkillsetInstallSchema>
export type BlueprintResourceListInstruction =
  WithMarkers<BlueprintResourceListSchema>
export type BlueprintNoteListInstruction = WithMarkers<BlueprintNoteListSchema>
export type BlueprintBulletinListInstruction =
  WithMarkers<BlueprintBulletinListSchema>
export type BlueprintBulletinCreateInstruction =
  WithMarkers<BlueprintBulletinCreateSchema>
export type BlueprintMetaFetchInstruction =
  WithMarkers<BlueprintMetaFetchSchema>
export type TodoManageInstruction = WithMarkers<TodoManageSchema>
export type ListPushInstruction = WithMarkers<ListPushSchema>
export type ListPopInstruction = WithMarkers<ListPopSchema>
export type ListReadInstruction = WithMarkers<ListReadSchema>
export type ImageCreateInstruction = WithMarkers<ImageCreateSchema>
export type ImageEditInstruction = WithMarkers<ImageEditSchema>
export type BotAskInstruction = WithMarkers<
  BotAskSchema & { botId?: string; botIds?: string; selectedBotIds?: string }
>
export type BotCallInstruction = WithMarkers<
  BotCallSchema & { botId?: string; botIds?: string; selectedBotIds?: string }
>
export type BotApplyInstruction = WithMarkers<
  BotApplySchema & { botId?: string; botIds?: string; selectedBotIds?: string }
>
export type BotListInstruction = WithMarkers<BotListSchema>
export type BotBackstoryReadInstruction = WithMarkers<
  BotBackstoryReadSchema & {
    botId?: string
    botIds?: string
    selectedBotIds?: string
  }
>
export type BotBackstoryWriteInstruction = WithMarkers<
  BotBackstoryWriteSchema & {
    botId?: string
    botIds?: string
    selectedBotIds?: string
  }
>

// --- TEMPLATES ---

/**
 * Base metadata for all ability templates.
 */
export interface TemplateMetadata {
  provider: string
  icon: `@logo/${string}` | `https://${string}`
  name: string
  description: string
  tags: string[]
  commentary?: string
  setup?: string
}

export type TemplateReference = `@${string}` | `#${string}`

export interface FetchTemplateConfig extends TemplateMetadata {
  instruction: FetchInstruction
  secret?: TemplateReference
}

export interface AbortTemplateConfig extends TemplateMetadata {
  instruction: {
    reason: FieldMarker
  }
}

export interface EchoTemplateConfig extends TemplateMetadata {
  instruction: {
    result: InstructionValue
  }
}

export interface SkillsetTemplateConfig extends TemplateMetadata {
  instruction: SkillsetInstruction
  operation: 'install' | 'activate' | 'load' | 'uninstall'
}

export interface McpTemplateConfig extends TemplateMetadata {
  instruction: McpInstruction
  operation: 'install' | 'activate' | 'load' | 'uninstall'
  secret?: TemplateReference
}

export interface AgentSpawnTemplateConfig extends TemplateMetadata {
  instruction: AgentSpawnInstruction
  operation: 'spawn'
}

export interface PackTemplateConfig extends TemplateMetadata {
  instruction: PackInstruction
  operation?: 'install' | 'uninstall'
  secret?: TemplateReference
  file?: TemplateReference
  space?: TemplateReference
  bot?: TemplateReference
}

export interface FileReadTemplateConfig extends TemplateMetadata {
  instruction: FileReadInstruction
  file?: TemplateReference
}

export interface FileWriteTemplateConfig extends TemplateMetadata {
  instruction: FileWriteInstruction
  file?: TemplateReference
}

export interface FilePrependTemplateConfig extends TemplateMetadata {
  instruction: FilePrependInstruction
  file?: TemplateReference
}

export interface FileAppendTemplateConfig extends TemplateMetadata {
  instruction: FileAppendInstruction
  file?: TemplateReference
}

export interface FileReplaceTemplateConfig extends TemplateMetadata {
  instruction: FileReplaceInstruction
  file?: TemplateReference
}

export interface FileRwTemplateConfig extends TemplateMetadata {
  instruction: FileRwInstruction
  file?: TemplateReference
}

export interface TaskListTemplateConfig extends TemplateMetadata {
  instruction: TaskListInstruction
  bot?: TemplateReference
}

export interface TaskFetchTemplateConfig extends TemplateMetadata {
  instruction: TaskFetchInstruction
  bot?: TemplateReference
}

export interface TaskCreateTemplateConfig extends TemplateMetadata {
  instruction: TaskCreateInstruction
  bot?: TemplateReference
}

export interface TaskUpdateTemplateConfig extends TemplateMetadata {
  instruction: TaskUpdateInstruction
  bot?: TemplateReference
}

export interface TaskDeleteTemplateConfig extends TemplateMetadata {
  instruction: TaskDeleteInstruction
  bot?: TemplateReference
}

export interface TaskRunTemplateConfig extends TemplateMetadata {
  instruction: TaskRunInstruction
  bot?: TemplateReference
}

export interface TimeNowTemplateConfig extends TemplateMetadata {
  instruction: TimeNowInstruction
}

export interface RatingListTemplateConfig extends TemplateMetadata {
  instruction: RatingListInstruction
  bot?: TemplateReference
}

export interface RatingFetchTemplateConfig extends TemplateMetadata {
  instruction: RatingFetchInstruction
  bot?: TemplateReference
}

export interface RatingCreateTemplateConfig extends TemplateMetadata {
  instruction: RatingCreateInstruction
  bot?: TemplateReference
}

export interface RatingDeleteTemplateConfig extends TemplateMetadata {
  instruction: RatingDeleteInstruction
  bot?: TemplateReference
}

export interface ConversationListTemplateConfig extends TemplateMetadata {
  instruction: ConversationListInstruction
}

export interface ConversationFetchTemplateConfig extends TemplateMetadata {
  instruction: ConversationFetchInstruction
}

export interface ConversationSearchTemplateConfig extends TemplateMetadata {
  instruction: ConversationSearchInstruction
}

export interface MemoryCreateTemplateConfig extends TemplateMetadata {
  instruction: MemoryCreateInstruction
}

export interface MemoryUpdateTemplateConfig extends TemplateMetadata {
  instruction: MemoryUpdateInstruction
}

export interface MemoryDeleteTemplateConfig extends TemplateMetadata {
  instruction: MemoryDeleteInstruction
}

export interface MemorySearchTemplateConfig extends TemplateMetadata {
  instruction: MemorySearchInstruction
}

export interface MemoryListTemplateConfig extends TemplateMetadata {
  instruction: MemoryListInstruction
}

export interface SpaceListTemplateConfig extends TemplateMetadata {
  instruction: SpaceListInstruction
}

export interface SpaceFetchTemplateConfig extends TemplateMetadata {
  instruction: SpaceFetchInstruction
}

export interface SpaceCreateTemplateConfig extends TemplateMetadata {
  instruction: SpaceCreateInstruction
}

export interface SpaceUpdateTemplateConfig extends TemplateMetadata {
  instruction: SpaceUpdateInstruction
}

export interface SpaceDeleteTemplateConfig extends TemplateMetadata {
  instruction: SpaceDeleteInstruction
}

export interface SpaceStorageListTemplateConfig extends TemplateMetadata {
  instruction: SpaceStorageListInstruction
  space?: TemplateReference
}

export interface SpaceStorageReadTemplateConfig extends TemplateMetadata {
  instruction: SpaceStorageReadInstruction
  space?: TemplateReference
}

export interface SpaceStorageWriteTemplateConfig extends TemplateMetadata {
  instruction: SpaceStorageWriteInstruction
  space?: TemplateReference
}

export interface SpaceStorageRwTemplateConfig extends TemplateMetadata {
  instruction: SpaceStorageRwInstruction
  space?: TemplateReference
}

export interface SpaceStorageMoveTemplateConfig extends TemplateMetadata {
  instruction: SpaceStorageMoveInstruction
  space?: TemplateReference
}

export interface SpaceStorageCopyTemplateConfig extends TemplateMetadata {
  instruction: SpaceStorageCopyInstruction
  space?: TemplateReference
}

export interface SpaceStorageDeleteTemplateConfig extends TemplateMetadata {
  instruction: SpaceStorageDeleteInstruction
  space?: TemplateReference
}

export interface SpaceStorageSearchTemplateConfig extends TemplateMetadata {
  instruction: SpaceStorageSearchInstruction
  space?: TemplateReference
}

export interface SpaceStorageImportTemplateConfig extends TemplateMetadata {
  instruction: SpaceStorageImportInstruction
  space?: TemplateReference
}

export interface SpaceStorageLinkTemplateConfig extends TemplateMetadata {
  instruction: SpaceStorageLinkInstruction
  space?: TemplateReference
}

export interface ShellExecTemplateConfig extends TemplateMetadata {
  instruction: ShellExecInstruction
  space?: TemplateReference
}

export interface ShellScriptTemplateConfig extends TemplateMetadata {
  instruction: ShellScriptInstruction
  space?: TemplateReference
}

export interface ShellReadTemplateConfig extends TemplateMetadata {
  instruction: ShellReadInstruction
  space?: TemplateReference
}

export interface ShellWriteTemplateConfig extends TemplateMetadata {
  instruction: ShellWriteInstruction
  space?: TemplateReference
}

export interface ShellRwTemplateConfig extends TemplateMetadata {
  instruction: ShellRwInstruction
  space?: TemplateReference
}

export interface ShellReplaceTemplateConfig extends TemplateMetadata {
  instruction: ShellReplaceInstruction
  space?: TemplateReference
}

export interface ShellEvalTemplateConfig extends TemplateMetadata {
  instruction: ShellEvalInstruction
  space?: TemplateReference
}

export interface ShellImportTemplateConfig extends TemplateMetadata {
  instruction: ShellImportInstruction
  space?: TemplateReference
}

export interface ShellSkillsetInstallTemplateConfig extends TemplateMetadata {
  instruction: ShellSkillsetInstallInstruction
  space?: TemplateReference
}

export interface BlueprintResourceListTemplateConfig extends TemplateMetadata {
  instruction: BlueprintResourceListInstruction
}

export interface BlueprintNoteListTemplateConfig extends TemplateMetadata {
  instruction: BlueprintNoteListInstruction
}

export interface BlueprintBulletinListTemplateConfig extends TemplateMetadata {
  instruction: BlueprintBulletinListInstruction
}

export interface BlueprintBulletinCreateTemplateConfig
  extends TemplateMetadata {
  instruction: BlueprintBulletinCreateInstruction
}

export interface BlueprintMetaFetchTemplateConfig extends TemplateMetadata {
  instruction: BlueprintMetaFetchInstruction
}

export interface TodoManageTemplateConfig extends TemplateMetadata {
  instruction: TodoManageInstruction
}

export interface ListPushTemplateConfig extends TemplateMetadata {
  instruction: ListPushInstruction
}

export interface ListPopTemplateConfig extends TemplateMetadata {
  instruction: ListPopInstruction
}

export interface ListReadTemplateConfig extends TemplateMetadata {
  instruction: ListReadInstruction
}

export interface ImageCreateTemplateConfig extends TemplateMetadata {
  instruction: ImageCreateInstruction
}

export interface ImageEditTemplateConfig extends TemplateMetadata {
  instruction: ImageEditInstruction
}

export interface BotAskTemplateConfig extends TemplateMetadata {
  instruction: BotAskInstruction
  bot?: TemplateReference
}

export interface BotCallTemplateConfig extends TemplateMetadata {
  instruction: BotCallInstruction
  bot?: TemplateReference
}

export interface BotApplyTemplateConfig extends TemplateMetadata {
  instruction: BotApplyInstruction
  bot?: TemplateReference
}

export interface BotListTemplateConfig extends TemplateMetadata {
  instruction: BotListInstruction
}

export interface BotBackstoryReadTemplateConfig extends TemplateMetadata {
  instruction: BotBackstoryReadInstruction
  bot?: TemplateReference
}

export interface BotBackstoryWriteTemplateConfig extends TemplateMetadata {
  instruction: BotBackstoryWriteInstruction
  bot?: TemplateReference
}

/**
 * Helper type to convert a schema field type to an instruction value type.
 */
type SchemaFieldToInstruction<T> = T extends string
  ? string | FieldMarker
  : T extends number
    ? number | FieldMarker
    : T extends boolean
      ? boolean | FieldMarker
      : T extends string[]
        ? (string | FieldMarker)[] | ArrayMarker
        : InstructionValue

/**
 * Configuration for auxiliary ability templates.
 * The TSchema type parameter ensures the instruction matches the expected shape.
 *
 * All instruction fields are optional since they may have defaults in the schema
 * or may not be needed for a particular ability variant.
 */
export interface AuxiliaryTemplateConfig<
  TSchema extends Record<string, unknown>,
> extends TemplateMetadata {
  path: `/api/auxiliary/skillset/ability/${string}`
  handler?: string
  secret?: TemplateReference
  file?: TemplateReference
  space?: TemplateReference
  instruction: {
    [K in keyof TSchema]?: SchemaFieldToInstruction<TSchema[K]>
  }
  options?: FetchInstruction['options']
}

/**
 * Output format for ability templates.
 */
export interface AbilityTemplate {
  provider: string
  icon: string
  name: string
  description: string
  tags?: string[]
  commentary?: string
  setup?: string
  instruction: string
  secret?: string
  file?: string
  space?: string
  bot?: string
}

interface ProcessedInstruction {
  body: Record<string, unknown>
}

/**
 * Process an instruction value, converting markers to structured field tags.
 */
function processValue(value: InstructionValue, contextKey?: string): unknown {
  // @note handle field markers - convert to structured field tags

  if (isFieldMarker(value)) {
    // @note determine which field class to use based on type

    switch (value.type) {
      case 'number': {
        return new NumberField({
          name: value.name,
          description: value.description,
          optional: !value.required,
          default: value.default as number | undefined,
          placeholder: value.placeholder,
          min: value.min,
          max: value.max,
          enum: value.enum as number[] | undefined,
        })
      }

      case 'boolean': {
        return new BooleanField({
          name: value.name,
          description: value.description,
          optional: !value.required,
          default: value.default as boolean | undefined,
          placeholder: value.placeholder,
        })
      }

      case 'string':
      default: {
        return new StringField({
          name: value.name,
          description: value.description,
          optional: !value.required,
          default: value.default as string | undefined,
          placeholder: value.placeholder,
          min: value.min,
          max: value.max,
          enum: value.enum as string[] | undefined,
        })
      }
    }
  }

  // @note handle secret markers - convert to Reference for ${SECRET_NAME} format

  if (isSecretMarker(value)) {
    return new Reference(`SECRET_${value.name}`)
  }

  // @note handle file markers - convert to Reference for ${FILE_NAME} format

  if (isFileMarker(value)) {
    return new Reference(`FILE_${value.name}`)
  }

  // @note handle space markers - convert to Reference for ${SPACE_NAME} format

  if (isSpaceMarker(value)) {
    return new Reference(`SPACE_${value.name}`)
  }

  // @note handle bot markers - convert to Reference for ${BOT_NAME} format

  if (isBotMarker(value)) {
    return new Reference(`BOT_${value.name}`)
  }

  // @note handle array markers - convert to ArrayField

  if (isArrayMarker(value)) {
    const processedItems = processValue(value.items)

    // @note ArrayField expects a nested field schema for items
    // @note use contextKey as fallback name so ArrayField.substitute() looks up
    // fieldValues[contextKey] (the YAML key) rather than 'items' (old default)

    return new ArrayField({
      name: value.name || contextKey || 'items',
      description: value.description,
      optional: value.optional ?? false,
      items: processedItems as Record<string, unknown>,
    })
  }

  // @note handle object markers - convert to ObjectField

  if (isObjectMarker(value)) {
    const properties: Record<string, unknown> = {}

    for (const [key, val] of Object.entries(value.shape)) {
      properties[key] = processValue(val as InstructionValue, key)
    }

    return new ObjectField({
      name: value.name || contextKey || 'object',
      description: value.description,
      optional: value.optional ?? false,
      properties: properties as Record<string, unknown>,
    })
  }

  // @note handle arrays recursively

  if (Array.isArray(value)) {
    return value.map((item) => processValue(item))
  }

  // @note handle objects recursively

  if (typeof value === 'object' && value !== null) {
    const result: Record<string, unknown> = {}

    for (const [key, val] of Object.entries(value)) {
      // @note pass the key so nested array/object markers without explicit
      // names can use the parent key as their field name for correct
      // substitution lookup
      result[key] = processValue(val as InstructionValue, key)
    }

    return result
  }

  // @note static values (strings, numbers, booleans) pass through directly

  return value
}

/**
 * Process a generic instruction object into a format ready for YAML serialization.
 */
function processGenericInstruction(
  instruction: Record<string, InstructionValue>
): ProcessedInstruction {
  const body = processValue(instruction) as Record<string, unknown>

  return { body }
}

/**
 * Common options for building ability templates.
 */
interface BuildTemplateOptions {
  /** The template metadata (provider, icon, name, description, tags, commentary) */
  metadata: TemplateMetadata
  /** The action tag prefix for structured templates (e.g., 'fetch', 'skillset.install') */
  actionTag: string
  /** The instruction object to process */
  instruction: Record<string, InstructionValue>
  /** Optional secret reference */
  secret?: string
  /** Optional file reference */
  file?: string
  /** Optional space reference */
  space?: string
  /** Optional bot reference */
  bot?: string
}

/**
 * Common helper to build ability templates using structured YAML action tags.
 * Generates structured instructions with proper action tags (e.g., !fetch, !skillset.install).
 */
function buildTemplate(options: BuildTemplateOptions): AbilityTemplate {
  const processed = processGenericInstruction(options.instruction)

  // @note serialize with the action tag prefix to create structured instruction

  const instruction = yaml
    .dump(processed.body, {
      schema: ACTION_TAGS_SCHEMA,
      lineWidth: -1,
    })
    .trim()

  // @note prepend the action tag to make it a structured instruction

  const structuredInstruction = `!${options.actionTag}\n${instruction}`

  return {
    provider: options.metadata.provider,
    icon: options.metadata.icon,
    name: options.metadata.name,
    description: options.metadata.description,
    tags: options.metadata.tags,
    ...(options.metadata.commentary
      ? { commentary: options.metadata.commentary }
      : {}),
    instruction: structuredInstruction,
    ...(options.secret ? { secret: options.secret } : {}),
    ...(options.file ? { file: options.file } : {}),
    ...(options.space ? { space: options.space } : {}),
    ...(options.bot ? { bot: options.bot } : {}),
  }
}

/**
 * Creates a fetch ability template.
 *
 * @example
 * ```typescript
 * createFetchTemplate({
 *   provider: 'coinapi',
 *   icon: '@logo/coinapi.io',
 *   name: 'Get Cryptocurrency Information',
 *   description: 'Fetch cryptocurrency data',
 *   tags: ['cryptocurrency'],
 *   secret: '@coinapi',
 *   instruction: {
 *     method: 'GET',
 *     url: 'https://rest.coinapi.io',
 *     path: ['/v1/assets/', field({ name: 'crypto', description: 'symbol' })],
 *     query: {
 *       apikey: secret(),
 *     },
 *   },
 * })
 * ```
 */
export function createFetchTemplate(
  config: FetchTemplateConfig
): AbilityTemplate {
  const existingOptions =
    (config.instruction.options as Record<string, unknown> | undefined) || {}

  const existingInternal =
    typeof existingOptions._internal === 'object' && existingOptions._internal
      ? (existingOptions._internal as Record<string, unknown>)
      : {}

  const instruction = {
    ...config.instruction,
    options: {
      ...existingOptions,
      _internal: {
        ...existingInternal,
        template: true,
      },
    },
  }

  return buildTemplate({
    metadata: config,
    actionTag: 'fetch',
    instruction: instruction as unknown as Record<string, InstructionValue>,
    secret: config.secret,
  })
}

/**
 * Creates an abort ability template.
 *
 * Abort templates use raw text format (just the reason field) instead of
 * structured YAML, since the abort action expects a plain string input.
 *
 * @example
 * ```typescript
 * createAbortTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Abort Operation',
 *   description: 'Abort the current operation',
 *   tags: ['abort'],
 *   instruction: {
 *     reason: field({ name: 'reason', description: 'a very short reason for the abort' }),
 *   },
 * })
 * ```
 */
export function createAbortTemplate(
  config: AbortTemplateConfig
): AbilityTemplate {
  const reasonField = config.instruction.reason

  // @note build operand string with type and modifiers
  const operand = [
    reasonField.type !== 'string' ? reasonField.type : '',
    reasonField.type === 'string' ? 'ys' : '',
    reasonField.enum ? `enum<${reasonField.enum.join(',')}>` : '',
    reasonField.default !== undefined ? `default<${reasonField.default}>` : '',
  ]
    .filter(Boolean)
    .join(' ')

  // @note abort uses raw text format, not YAML structured format
  const fieldString = stringifyField({
    type: reasonField.placeholder ? BracketType.round : BracketType.square,
    name: reasonField.name,
    description: reasonField.description || '',
    required: reasonField.required ?? false,
    operand,
  })

  const instruction = `\`\`\`abort\n${fieldString}\n\`\`\``

  return {
    provider: config.provider,
    icon: config.icon,
    name: config.name,
    description: config.description,
    tags: config.tags,
    ...(config.commentary ? { commentary: config.commentary } : {}),
    instruction,
  }
}

/**
 * Creates an echo ability template.
 *
 * Echo templates return a predefined result payload. They are useful for
 * lightweight guides, reference payloads, and canned outputs that do not need
 * to make network calls.
 */
export function createEchoTemplate(
  config: EchoTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'echo',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
  })
}

/**
 * Creates a skillset ability template.
 *
 * @example
 * ```typescript
 * createSkillsetTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Install Skillset',
 *   description: 'Bring a skillset into context by its ID',
 *   tags: ['skillset', 'install'],
 *   operation: 'install',
 *   instruction: {
 *     skillsetId: field({ name: 'skillsetId', description: 'the skillset ID', placeholder: true }),
 *   },
 * })
 * ```
 */
export function createSkillsetTemplate(
  config: SkillsetTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: `skillset.${config.operation}`,
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
  })
}

/**
 * Creates an MCP ability template.
 *
 * @example
 * ```typescript
 * createMcpTemplate({
 *   provider: 'mcp',
 *   icon: '@logo/mcp.io',
 *   name: 'Install MCP Server',
 *   description: 'Install an MCP server',
 *   tags: ['mcp', 'install'],
 *   operation: 'install',
 *   secret: '@notion[mcp]',
 *   instruction: {
 *     url: field({ name: 'url', description: 'MCP server URL' }),
 *     headers: {
 *       Authorization: secret(),
 *     },
 *   },
 * })
 * ```
 */
export function createMcpTemplate(config: McpTemplateConfig): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: `mcp.${config.operation}`,
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    secret: config.secret,
  })
}

/**
 * Creates an auxiliary ability template.
 *
 * Auxiliary templates are for internal API endpoints that process data.
 * The TSchema type parameter ensures the instruction matches the expected schema shape.
 *
 * @example
 * ```typescript
 * interface FileSchema {
 *   url: string
 *   ref: string
 *   filePath: string
 * }
 *
 * createAuxiliaryTemplate<FileSchema>({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Fetch Git File',
 *   description: 'Fetches a file from a Git repository',
 *   tags: ['git', 'file'],
 *   path: '/api/auxiliary/skillset/ability/chatbotkit/url/git',
 *   handler: 'file',
 *   instruction: {
 *     url: field({ name: 'url', description: 'Git repository URL', placeholder: true }),
 *     ref: field({ name: 'ref', description: 'Git reference', placeholder: true, default: 'main' }),
 *     filePath: field({ name: 'filePath', description: 'Path to file', placeholder: true }),
 *   },
 * })
 * ```
 */
export function createAuxiliaryTemplate<
  TSchema extends Record<string, unknown>,
>(config: AuxiliaryTemplateConfig<TSchema>): AbilityTemplate {
  // @note build headers as an InstructionValue object

  const headers: Record<string, InstructionValue> = {
    'Content-Type': 'application/json',
  }

  if (config.secret) {
    headers['X-Access-Token'] = secret()
  }

  if (config.handler) {
    headers['x-chatbotkit-handler-name'] = config.handler
  }

  // @note build the full fetch instruction with body nested inside

  const fetchInstruction: Record<string, InstructionValue> = {
    method: 'POST',
    url: config.path,
    headers,
    body: config.instruction as unknown as InstructionValue,
    ...(config.options
      ? { options: config.options as unknown as InstructionValue }
      : {}),
  }

  return buildTemplate({
    metadata: config,
    actionTag: 'fetch',
    instruction: fetchInstruction,
    secret: config.secret,
    file: config.file,
    space: config.space,
  })
}

/**
 * Creates a pack ability template.
 *
 * Pack templates install multiple abilities into the conversation context as
 * callable tools. They're useful for grouping related abilities that should
 * be available together.
 *
 * @example
 * ```typescript
 * createPackTemplate({
 *   provider: 'airtable',
 *   icon: '@logo/airtable.com',
 *   name: 'Install Airtable Tools',
 *   description: 'Installs Airtable tools into the conversation.',
 *   tags: ['airtable', 'pack', 'beta'],
 *   secret: '@airtable',
 *   instruction: {
 *     abilities: [
 *       'airtable/base/list',
 *       'airtable/table/list',
 *       'airtable/record/create',
 *     ],
 *   },
 * })
 * ```
 */
export function createPackTemplate(
  config: PackTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: `pack.${config.operation || 'install'}`,
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    secret: config.secret,
    file: config.file,
    space: config.space,
    bot: config.bot,
  })
}

/**
 * Creates a file read ability template.
 *
 * @example
 * ```typescript
 * createFileReadTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Read File',
 *   description: 'Read the content of a file',
 *   tags: ['file', 'read'],
 *   file: '@file',
 *   instruction: {
 *     fileId: field({ name: 'fileId', description: 'the file ID to read', placeholder: true }),
 *   },
 * })
 * ```
 */
export function createFileReadTemplate(
  config: FileReadTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'file.read',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    file: config.file,
  })
}

/**
 * Creates a file write ability template.
 *
 * @example
 * ```typescript
 * createFileWriteTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Write File',
 *   description: 'Write content to a file',
 *   tags: ['file', 'write'],
 *   file: '@file',
 *   instruction: {
 *     fileId: field({ name: 'fileId', description: 'the file ID to write to', placeholder: true }),
 *     text: field({ name: 'content', description: 'content to write to the file' }),
 *   },
 * })
 * ```
 */
export function createFileWriteTemplate(
  config: FileWriteTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'file.write',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    file: config.file,
  })
}

/**
 * Creates a file prepend ability template.
 *
 * @example
 * ```typescript
 * createFilePrependTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Prepend to File',
 *   description: 'Prepend content to a file',
 *   tags: ['file', 'prepend'],
 *   file: '@file',
 *   instruction: {
 *     fileId: field({ name: 'fileId', description: 'the file ID to prepend to', placeholder: true }),
 *     text: field({ name: 'content', description: 'content to prepend to the file' }),
 *   },
 * })
 * ```
 */
export function createFilePrependTemplate(
  config: FilePrependTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'file.prepend',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    file: config.file,
  })
}

/**
 * Creates a file append ability template.
 *
 * @example
 * ```typescript
 * createFileAppendTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Append to File',
 *   description: 'Append content to a file',
 *   tags: ['file', 'append'],
 *   file: '@file',
 *   instruction: {
 *     fileId: field({ name: 'fileId', description: 'the file ID to append to', placeholder: true }),
 *     text: field({ name: 'content', description: 'content to append to the file' }),
 *   },
 * })
 * ```
 */
export function createFileAppendTemplate(
  config: FileAppendTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'file.append',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    file: config.file,
  })
}

/**
 * Creates a file replace ability template.
 *
 * @example
 * ```typescript
 * createFileReplaceTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Replace in File',
 *   description: 'Replace text in a file',
 *   tags: ['file', 'replace'],
 *   file: '@file',
 *   instruction: {
 *     fileId: field({ name: 'fileId', description: 'the file ID to replace in', placeholder: true }),
 *     search: field({ name: 'search', description: 'text to search for' }),
 *     replace: field({ name: 'replace', description: 'text to replace with' }),
 *     count: field({ name: 'count', description: 'number of occurrences to replace (optional, replaces all if not specified)', type: 'number' }),
 *   },
 * })
 * ```
 */
export function createFileReplaceTemplate(
  config: FileReplaceTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'file.replace',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    file: config.file,
  })
}

/**
 * Creates a file read/write ability template that combines read and write operations.
 *
 * @example
 * ```typescript
 * createFileReadWriteTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Read/Write File',
 *   description: 'Read or write file content with optional line ranges',
 *   tags: ['file', 'rw'],
 *   file: '@file',
 *   instruction: {
 *     fileId: field({ name: 'fileId', description: 'the file ID to read from or write to', placeholder: true }),
 *     mode: field({ name: 'mode', description: 'operation mode: read or write' }),
 *     text: field({ name: 'content', description: 'content to write (required for write mode)', optional: true }),
 *     startLine: field({ name: 'startLine', description: 'line number to start from (1-indexed)', type: 'number', optional: true }),
 *     endLine: field({ name: 'endLine', description: 'line number to end at, inclusive (1-indexed)', type: 'number', optional: true }),
 *   },
 * })
 * ```
 */
export function createFileRwTemplate(
  config: FileRwTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'file.rw',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    file: config.file,
  })
}

/**
 * Creates a shell exec ability template.
 *
 * @example
 * ```typescript
 * createShellExecTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Execute Shell Command',
 *   description: 'Execute a shell command or script',
 *   tags: ['shell', 'command', 'beta'],
 *   instruction: {
 *     cmd: field({ name: 'command', description: 'the bash shell command or script' }),
 *   },
 * })
 * ```
 */
export function createShellExecTemplate(
  config: ShellExecTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'shell.exec',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    space: config.space,
  })
}

/**
 * Creates a shell script ability template.
 */
export function createShellScriptTemplate(
  config: ShellScriptTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'shell.script',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    space: config.space,
  })
}

/**
 * Creates a shell read ability template.
 *
 * @example
 * ```typescript
 * createShellReadTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Read File from Shell Environment',
 *   description: 'Read the content of a file in a shell environment',
 *   tags: ['shell', 'file', 'read', 'beta'],
 *   instruction: {
 *     file: field({ name: 'path', description: 'the path to the file to read' }),
 *   },
 * })
 * ```
 */
export function createShellReadTemplate(
  config: ShellReadTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'shell.read',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    space: config.space,
  })
}

/**
 * Creates a shell write ability template.
 *
 * @example
 * ```typescript
 * createShellWriteTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Write File in Shell Environment',
 *   description: 'Write content to a file in a shell environment',
 *   tags: ['shell', 'file', 'write', 'beta'],
 *   instruction: {
 *     file: field({ name: 'path', description: 'the path to the file to write to' }),
 *     contents: field({ name: 'content', description: 'the content to write to the file' }),
 *   },
 * })
 * ```
 */
export function createShellWriteTemplate(
  config: ShellWriteTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'shell.write',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    space: config.space,
  })
}

/**
 * Creates a shell read/write ability template that combines read and write operations.
 *
 * @example
 * ```typescript
 * createShellRwTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Read/Write File in Shell Environment',
 *   description: 'Read or write file content in a shell environment with optional line ranges',
 *   tags: ['shell', 'file', 'rw', 'beta'],
 *   instruction: {
 *     file: field({ name: 'path', description: 'the path to the file' }),
 *     mode: field({ name: 'mode', description: 'operation mode: read or write' }),
 *     contents: field({ name: 'content', description: 'content to write (required for write mode)', optional: true }),
 *     startLine: field({ name: 'startLine', description: 'line number to start from (1-indexed)', type: 'number', optional: true }),
 *     endLine: field({ name: 'endLine', description: 'line number to end at, inclusive (1-indexed)', type: 'number', optional: true }),
 *   },
 * })
 * ```
 */
export function createShellRwTemplate(
  config: ShellRwTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'shell.rw',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    space: config.space,
  })
}

/**
 * Creates a shell replace ability template for find-and-replace edits.
 *
 * @example
 * ```typescript
 * createShellReplaceTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Replace in File in Shell Environment',
 *   description: 'Find and replace text in a file in a shell environment',
 *   tags: ['shell', 'file', 'replace'],
 *   instruction: {
 *     file: field({ name: 'path', description: 'the path to the file to edit' }),
 *     search: field({ name: 'search', description: 'text to search for' }),
 *     replace: field({ name: 'replace', description: 'text to replace with' }),
 *     count: field({ name: 'count', description: 'number of occurrences to replace (optional, replaces all if not specified)', type: 'number', optional: true }),
 *   },
 * })
 * ```
 */
export function createShellReplaceTemplate(
  config: ShellReplaceTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'shell.replace',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    space: config.space,
  })
}

/**
 * Creates a shell eval ability template.
 *
 * @example
 * ```typescript
 * createShellEvalTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Evaluate Code',
 *   description: 'Evaluate Python or JavaScript code',
 *   tags: ['shell', 'code', 'eval', 'beta'],
 *   instruction: {
 *     code: field({ name: 'code', description: 'the code to evaluate' }),
 *     language: field({ name: 'language', description: 'the programming language (python or javascript)', optional: true }),
 *   },
 * })
 * ```
 */
export function createShellEvalTemplate(
  config: ShellEvalTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'shell.eval',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    space: config.space,
  })
}

/**
 * Creates a shell import ability template for importing data from a URL
 * and saving it to a file in the shell environment.
 *
 * @example
 * ```typescript
 * createShellImportTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Import URL to Shell Environment',
 *   description: 'Import data from a URL and save it to a file in the shell environment',
 *   tags: ['shell', 'import', 'url', 'beta'],
 *   instruction: {
 *     url: field({ name: 'url', description: 'the URL to import data from' }),
 *     path: field({ name: 'path', description: 'the path to save the imported data to' }),
 *   },
 * })
 * ```
 */
export function createShellImportTemplate(
  config: ShellImportTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'shell.import',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    space: config.space,
  })
}

/**
 * Creates a shell skillset install ability template for installing a skillset
 * as a shell command in the sandbox environment.
 *
 * @example
 * ```typescript
 * createShellSkillsetInstallTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Install Skillset as Shell Command',
 *   description: 'Install a skillset as an executable shell command',
 *   tags: ['shell', 'skillset', 'install', 'beta'],
 *   instruction: {
 *     skillsetId: field({ name: 'skillsetId', description: 'the skillset ID to install' }),
 *   },
 * })
 * ```
 */
export function createShellSkillsetInstallTemplate(
  config: ShellSkillsetInstallTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'shell.skillset.install',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    space: config.space,
  })
}

/**
 * Creates a blueprint resource list ability template.
 *
 * @example
 * ```typescript
 * createBlueprintResourceListTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'List Blueprint Resources',
 *   description: 'List resources available in the current blueprint',
 *   tags: ['blueprint', 'resource', 'list'],
 *   instruction: {
 *     type: field({ name: 'type', description: 'The resource type to filter by', optional: true }),
 *   },
 * })
 * ```
 */
export function createBlueprintResourceListTemplate(
  config: BlueprintResourceListTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'blueprint.resource.list',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
  })
}

/**
 * Creates a blueprint note list ability template.
 *
 * @example
 * ```typescript
 * createBlueprintNoteListTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'List Blueprint Notes',
 *   description: 'List notes stored in the current blueprint',
 *   tags: ['blueprint', 'note', 'list'],
 *   instruction: {},
 * })
 * ```
 */
export function createBlueprintNoteListTemplate(
  config: BlueprintNoteListTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'blueprint.note.list',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
  })
}

/**
 * Creates a blueprint bulletin list ability template.
 *
 * @example
 * ```typescript
 * createBlueprintBulletinListTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'List Blueprint Bulletins',
 *   description: 'List the bulletins on the current blueprint board',
 *   tags: ['blueprint', 'bulletin', 'list'],
 *   instruction: {},
 * })
 * ```
 */
export function createBlueprintBulletinListTemplate(
  config: BlueprintBulletinListTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'blueprint.bulletin.list',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
  })
}

/**
 * Creates a blueprint bulletin create ability template.
 *
 * @example
 * ```typescript
 * createBlueprintBulletinCreateTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Post Blueprint Bulletin',
 *   description: 'Post a message to the current blueprint board',
 *   tags: ['blueprint', 'bulletin', 'create'],
 *   instruction: {
 *     text: field({ name: 'text', description: 'The message to post' }),
 *     ttl: field({ name: 'ttl', description: 'Seconds before the message expires', type: 'number', optional: true }),
 *   },
 * })
 * ```
 */
export function createBlueprintBulletinCreateTemplate(
  config: BlueprintBulletinCreateTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'blueprint.bulletin.create',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
  })
}

/**
 * Creates a blueprint meta fetch ability template.
 *
 * @example
 * ```typescript
 * createBlueprintMetaFetchTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Fetch Blueprint Meta',
 *   description: 'Retrieve the meta information of the current blueprint',
 *   tags: ['blueprint', 'meta', 'fetch'],
 *   instruction: {
 *     jmespath: field({ name: 'jmespath', description: 'Optional JMESPath filter expression', optional: true }),
 *   },
 * })
 * ```
 */
export function createBlueprintMetaFetchTemplate(
  config: BlueprintMetaFetchTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'blueprint.meta.fetch',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
  })
}

/**
 * Creates a task list ability template.
 *
 * @example
 * ```typescript
 * createTaskListTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'List Tasks',
 *   description: 'List all scheduled tasks',
 *   tags: ['task', 'list'],
 *   instruction: {},
 * })
 * ```
 */
export function createTaskListTemplate(
  config: TaskListTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'task.list',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    bot: config.bot,
  })
}

/**
 * Creates a task fetch ability template.
 *
 * @example
 * ```typescript
 * createTaskFetchTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Fetch Task',
 *   description: 'Fetch a specific task by ID',
 *   tags: ['task', 'fetch'],
 *   instruction: {
 *     id: field({ name: 'taskId', description: 'The task ID to fetch', placeholder: true }),
 *   },
 * })
 * ```
 */
export function createTaskFetchTemplate(
  config: TaskFetchTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'task.fetch',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    bot: config.bot,
  })
}

/**
 * Creates a task create ability template.
 *
 * @example
 * ```typescript
 * createTaskCreateTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Create Task',
 *   description: 'Create a new scheduled task',
 *   tags: ['task', 'create'],
 *   instruction: {
 *     name: field({ name: 'name', description: 'Task name', placeholder: true }),
 *     description: field({ name: 'description', description: 'Task description', placeholder: true }),
 *     schedule: field({ name: 'schedule', description: 'Task schedule', placeholder: true }),
 *   },
 * })
 * ```
 */
export function createTaskCreateTemplate(
  config: TaskCreateTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'task.create',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    bot: config.bot,
  })
}

/**
 * Creates a task update ability template.
 *
 * @example
 * ```typescript
 * createTaskUpdateTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Update Task',
 *   description: 'Update an existing task',
 *   tags: ['task', 'update'],
 *   instruction: {
 *     id: field({ name: 'taskId', description: 'The task ID to update', placeholder: true }),
 *     name: field({ name: 'name', description: 'New task name', placeholder: true }),
 *   },
 * })
 * ```
 */
export function createTaskUpdateTemplate(
  config: TaskUpdateTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'task.update',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    bot: config.bot,
  })
}

/**
 * Creates a task delete ability template.
 *
 * @example
 * ```typescript
 * createTaskDeleteTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Delete Task',
 *   description: 'Delete a task by ID',
 *   tags: ['task', 'delete'],
 *   instruction: {
 *     id: field({ name: 'taskId', description: 'The task ID to delete', placeholder: true }),
 *   },
 * })
 * ```
 */
export function createTaskDeleteTemplate(
  config: TaskDeleteTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'task.delete',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    bot: config.bot,
  })
}

/**
 * Creates a task run ability template.
 *
 * @example
 * ```typescript
 * createTaskRunTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Run Task',
 *   description: 'Run a task immediately',
 *   tags: ['task', 'run'],
 *   instruction: {
 *     id: field({ name: 'taskId', description: 'The task ID to run', placeholder: true }),
 *   },
 * })
 * ```
 */
export function createTaskRunTemplate(
  config: TaskRunTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'task.run',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    bot: config.bot,
  })
}

/**
 * Creates a time now ability template.
 */
export function createTimeNowTemplate(
  config: TimeNowTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'time.now',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
  })
}

export function createRatingListTemplate(
  config: RatingListTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'rating.list',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    bot: config.bot,
  })
}

export function createRatingFetchTemplate(
  config: RatingFetchTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'rating.fetch',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    bot: config.bot,
  })
}

export function createRatingCreateTemplate(
  config: RatingCreateTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'rating.create',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    bot: config.bot,
  })
}

export function createRatingDeleteTemplate(
  config: RatingDeleteTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'rating.delete',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    bot: config.bot,
  })
}

/**
 * Creates a conversation list ability template.
 *
 * @example
 * ```typescript
 * createConversationListTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'List Conversations',
 *   description: 'List all conversations',
 *   tags: ['conversation', 'list'],
 *   instruction: {},
 * })
 * ```
 */
export function createConversationListTemplate(
  config: ConversationListTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'conversation.list',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
  })
}

/**
 * Creates a conversation fetch ability template.
 *
 * @example
 * ```typescript
 * createConversationFetchTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Fetch Conversation',
 *   description: 'Fetch a specific conversation by ID',
 *   tags: ['conversation', 'fetch'],
 *   instruction: {
 *     id: field({ name: 'conversationId', description: 'The conversation ID to fetch', placeholder: true }),
 *   },
 * })
 * ```
 */
export function createConversationFetchTemplate(
  config: ConversationFetchTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'conversation.fetch',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
  })
}

/**
 * Creates a conversation search ability template.
 *
 * @example
 * ```typescript
 * createConversationSearchTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Search Conversations',
 *   description: 'Search conversations by query',
 *   tags: ['conversation', 'search'],
 *   instruction: {
 *     query: field({ name: 'query', description: 'The search query', placeholder: true }),
 *   },
 * })
 * ```
 */
export function createConversationSearchTemplate(
  config: ConversationSearchTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'conversation.search',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
  })
}

/**
 * Creates a memory create ability template.
 *
 * @example
 * ```typescript
 * createMemoryCreateTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Create Memory',
 *   description: 'Create a new memory',
 *   tags: ['memory', 'create'],
 *   instruction: {
 *     text: field({ name: 'text', description: 'The memory text content', placeholder: true }),
 *   },
 * })
 * ```
 */
export function createMemoryCreateTemplate(
  config: MemoryCreateTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'memory.create',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
  })
}

/**
 * Creates a memory update ability template.
 *
 * @example
 * ```typescript
 * createMemoryUpdateTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Update Memory',
 *   description: 'Update an existing memory',
 *   tags: ['memory', 'update'],
 *   instruction: {
 *     id: field({ name: 'memoryId', description: 'The memory ID to update', placeholder: true }),
 *     text: field({ name: 'text', description: 'The new memory text', placeholder: true }),
 *   },
 * })
 * ```
 */
export function createMemoryUpdateTemplate(
  config: MemoryUpdateTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'memory.update',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
  })
}

/**
 * Creates a memory delete ability template.
 *
 * @example
 * ```typescript
 * createMemoryDeleteTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Delete Memory',
 *   description: 'Delete a memory by ID',
 *   tags: ['memory', 'delete'],
 *   instruction: {
 *     id: field({ name: 'memoryId', description: 'The memory ID to delete', placeholder: true }),
 *   },
 * })
 * ```
 */
export function createMemoryDeleteTemplate(
  config: MemoryDeleteTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'memory.delete',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
  })
}

/**
 * Creates a memory search ability template.
 *
 * @example
 * ```typescript
 * createMemorySearchTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Search Memories',
 *   description: 'Search memories by query',
 *   tags: ['memory', 'search'],
 *   instruction: {
 *     query: field({ name: 'query', description: 'The search query', placeholder: true }),
 *   },
 * })
 * ```
 */
export function createMemorySearchTemplate(
  config: MemorySearchTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'memory.search',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
  })
}

/**
 * Creates a memory list ability template.
 *
 * @example
 * ```typescript
 * createMemoryListTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'List Memories',
 *   description: 'List recent memories',
 *   tags: ['memory', 'list'],
 *   instruction: {},
 * })
 * ```
 */
export function createMemoryListTemplate(
  config: MemoryListTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'memory.list',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
  })
}

/**
 * Creates a space list ability template.
 *
 * @example
 * ```typescript
 * createSpaceListTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'List Spaces',
 *   description: 'List all spaces',
 *   tags: ['space', 'list'],
 *   instruction: {},
 * })
 * ```
 */
export function createSpaceListTemplate(
  config: SpaceListTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'space.list',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
  })
}

/**
 * Creates a space fetch ability template.
 *
 * @example
 * ```typescript
 * createSpaceFetchTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Fetch Space',
 *   description: 'Fetch a specific space by ID',
 *   tags: ['space', 'fetch'],
 *   instruction: {
 *     spaceId: field({ name: 'spaceId', description: 'The space ID', placeholder: true }),
 *   },
 * })
 * ```
 */
export function createSpaceFetchTemplate(
  config: SpaceFetchTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'space.fetch',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
  })
}

/**
 * Creates a space create ability template.
 *
 * @example
 * ```typescript
 * createSpaceCreateTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Create Space',
 *   description: 'Create a new space',
 *   tags: ['space', 'create'],
 *   instruction: {
 *     name: field({ name: 'name', description: 'The name of the space', placeholder: true }),
 *   },
 * })
 * ```
 */
export function createSpaceCreateTemplate(
  config: SpaceCreateTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'space.create',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
  })
}

/**
 * Creates a space update ability template.
 *
 * @example
 * ```typescript
 * createSpaceUpdateTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Update Space',
 *   description: 'Update an existing space',
 *   tags: ['space', 'update'],
 *   instruction: {
 *     spaceId: field({ name: 'spaceId', description: 'The space ID', placeholder: true }),
 *   },
 * })
 * ```
 */
export function createSpaceUpdateTemplate(
  config: SpaceUpdateTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'space.update',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
  })
}

/**
 * Creates a space delete ability template.
 *
 * @example
 * ```typescript
 * createSpaceDeleteTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Delete Space',
 *   description: 'Delete a space',
 *   tags: ['space', 'delete'],
 *   instruction: {
 *     spaceId: field({ name: 'spaceId', description: 'The space ID', placeholder: true }),
 *   },
 * })
 * ```
 */
export function createSpaceDeleteTemplate(
  config: SpaceDeleteTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'space.delete',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
  })
}

/**
 * Creates a space storage list ability template.
 *
 * @example
 * ```typescript
 * createSpaceStorageListTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'List Space Storage',
 *   description: 'List files in space storage',
 *   tags: ['space', 'storage', 'list'],
 *   instruction: {
 *     spaceId: field({ name: 'spaceId', description: 'The space ID', placeholder: true }),
 *     path: field({ name: 'path', description: 'The path to list', placeholder: true }),
 *   },
 * })
 * ```
 */
export function createSpaceStorageListTemplate(
  config: SpaceStorageListTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'space.storage.list',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    space: config.space,
  })
}

/**
 * Creates a space storage read ability template.
 *
 * @example
 * ```typescript
 * createSpaceStorageReadTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Read Space Storage',
 *   description: 'Read a file from space storage',
 *   tags: ['space', 'storage', 'read'],
 *   instruction: {
 *     spaceId: field({ name: 'spaceId', description: 'The space ID', placeholder: true }),
 *     path: field({ name: 'path', description: 'The file path to read', placeholder: true }),
 *   },
 * })
 * ```
 */
export function createSpaceStorageReadTemplate(
  config: SpaceStorageReadTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'space.storage.read',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    space: config.space,
  })
}

/**
 * Creates a space storage write ability template.
 *
 * @example
 * ```typescript
 * createSpaceStorageWriteTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Write Space Storage',
 *   description: 'Write a file to space storage',
 *   tags: ['space', 'storage', 'write'],
 *   instruction: {
 *     spaceId: field({ name: 'spaceId', description: 'The space ID', placeholder: true }),
 *     path: field({ name: 'path', description: 'The file path to write', placeholder: true }),
 *     content: field({ name: 'content', description: 'The content to write', placeholder: true }),
 *   },
 * })
 * ```
 */
export function createSpaceStorageWriteTemplate(
  config: SpaceStorageWriteTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'space.storage.write',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    space: config.space,
  })
}

/**
 * Creates a space storage read/write ability template with mode parameter.
 *
 * @example
 * ```typescript
 * createSpaceStorageRwTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Read/Write Space Storage',
 *   description: 'Read or write a file in space storage',
 *   tags: ['space', 'storage', 'read', 'write'],
 *   instruction: {
 *     spaceId: field({ name: 'spaceId', description: 'The space ID', placeholder: true }),
 *     path: field({ name: 'path', description: 'The file path', placeholder: true }),
 *     mode: field({ name: 'mode', description: 'The mode: read or write', placeholder: true }),
 *     content: field({ name: 'content', description: 'The content to write', placeholder: true }),
 *     startLine: field({ name: 'startLine', description: 'The start line', optional: true }),
 *     endLine: field({ name: 'endLine', description: 'The end line', optional: true }),
 *   },
 * })
 * ```
 */
export function createSpaceStorageRwTemplate(
  config: SpaceStorageRwTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'space.storage.rw',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    space: config.space,
  })
}

/**
 * Creates a space storage move ability template.
 *
 * @example
 * ```typescript
 * createSpaceStorageMoveTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Move Space Storage',
 *   description: 'Move a file in space storage',
 *   tags: ['space', 'storage', 'move'],
 *   instruction: {
 *     spaceId: field({ name: 'spaceId', description: 'The space ID', placeholder: true }),
 *     path: field({ name: 'path', description: 'The source path', placeholder: true }),
 *     destinationPath: field({ name: 'destinationPath', description: 'The destination path', placeholder: true }),
 *   },
 * })
 * ```
 */
export function createSpaceStorageMoveTemplate(
  config: SpaceStorageMoveTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'space.storage.move',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    space: config.space,
  })
}

/**
 * Creates a space storage copy ability template.
 *
 * @example
 * ```typescript
 * createSpaceStorageCopyTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Copy Space Storage',
 *   description: 'Copy a file in space storage',
 *   tags: ['space', 'storage', 'copy'],
 *   instruction: {
 *     spaceId: field({ name: 'spaceId', description: 'The space ID', placeholder: true }),
 *     path: field({ name: 'path', description: 'The source path', placeholder: true }),
 *     destinationPath: field({ name: 'destinationPath', description: 'The destination path', placeholder: true }),
 *   },
 * })
 * ```
 */
export function createSpaceStorageCopyTemplate(
  config: SpaceStorageCopyTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'space.storage.copy',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    space: config.space,
  })
}

/**
 * Creates a space storage delete ability template.
 *
 * @example
 * ```typescript
 * createSpaceStorageDeleteTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Delete Space Storage',
 *   description: 'Delete a file from space storage',
 *   tags: ['space', 'storage', 'delete'],
 *   instruction: {
 *     spaceId: field({ name: 'spaceId', description: 'The space ID', placeholder: true }),
 *     path: field({ name: 'path', description: 'The file path to delete', placeholder: true }),
 *   },
 * })
 * ```
 */
export function createSpaceStorageDeleteTemplate(
  config: SpaceStorageDeleteTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'space.storage.delete',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    space: config.space,
  })
}

/**
 * Creates a space storage search ability template.
 *
 * @example
 * ```typescript
 * createSpaceStorageSearchTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Search Space Storage',
 *   description: 'Search files in space storage',
 *   tags: ['space', 'storage', 'search'],
 *   instruction: {
 *     spaceId: field({ name: 'spaceId', description: 'The space ID', placeholder: true }),
 *     query: field({ name: 'query', description: 'The search query', placeholder: true }),
 *   },
 * })
 * ```
 */
export function createSpaceStorageSearchTemplate(
  config: SpaceStorageSearchTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'space.storage.search',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    space: config.space,
  })
}

/**
 * Creates a space storage import ability template.
 *
 * @example
 * ```typescript
 * createSpaceStorageImportTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Import to Space Storage',
 *   description: 'Import a file from a URL into space storage',
 *   tags: ['space', 'storage', 'import'],
 *   instruction: {
 *     spaceId: field({ name: 'spaceId', description: 'The space ID', placeholder: true }),
 *     url: field({ name: 'url', description: 'The URL to import from', placeholder: true }),
 *     path: field({ name: 'path', description: 'The destination path', placeholder: true }),
 *   },
 * })
 * ```
 */
export function createSpaceStorageImportTemplate(
  config: SpaceStorageImportTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'space.storage.import',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    space: config.space,
  })
}

/**
 * Creates a space storage link ability template.
 *
 * @example
 * ```typescript
 * createSpaceStorageLinkTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Get Space Storage Link',
 *   description: 'Get a public link for a file in space storage',
 *   tags: ['space', 'storage', 'link'],
 *   instruction: {
 *     spaceId: field({ name: 'spaceId', description: 'The space ID', placeholder: true }),
 *     path: field({ name: 'path', description: 'The file path', placeholder: true }),
 *   },
 * })
 * ```
 */
export function createSpaceStorageLinkTemplate(
  config: SpaceStorageLinkTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'space.storage.link',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    space: config.space,
  })
}

/**
 * Creates an agent spawn ability template.
 *
 * Agent spawn templates allow spawning a sub-agent with configurable backstory,
 * model, and instructions. The spawned agent will process the given instructions
 * and return the result.
 *
 * @example
 * ```typescript
 * createAgentSpawnTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Evaluate Task Execution',
 *   description: 'Evaluate how well a task was executed by an agent',
 *   tags: ['agent', 'evaluate', 'beta'],
 *   operation: 'spawn',
 *   instruction: {
 *     backstory: field({
 *       name: 'backstory',
 *       description: 'the role and personality of the agent',
 *     }),
 *     model: field({
 *       name: 'model',
 *       description: 'the model to use',
 *       default: 'o3-mini',
 *     }),
 *     instructions: field({
 *       name: 'instructions',
 *       description: 'instructions for the evaluation',
 *       placeholder: true,
 *     }),
 *   },
 * })
 * ```
 */
export function createAgentSpawnTemplate(
  config: AgentSpawnTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: `agent.${config.operation}`,
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
  })
}

/**
 * Creates a todo manage ability template.
 *
 * Todo manage templates allow reading and writing a temporary todo list
 * that is stored in Redis and expires after inactivity. The todo list is
 * scoped to the current namespace or session.
 *
 * @example
 * ```typescript
 * createTodoManageTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Manage Todos',
 *   description: 'Read or write a todo list',
 *   tags: ['todo', 'manage', 'beta'],
 *   instruction: {
 *     op: field({
 *       name: 'operation',
 *       description: 'the operation to perform',
 *       enum: ['read', 'write'],
 *     }),
 *     todoList: array({
 *       items: object({
 *         shape: {
 *           id: field({ name: 'id', type: 'number', description: 'unique id' }),
 *           title: field({ name: 'title', description: 'task title' }),
 *           status: field({ name: 'status', enum: ['not-started', 'in-progress', 'completed'] }),
 *         },
 *       }),
 *     }),
 *   },
 * })
 * ```
 */
export function createTodoManageTemplate(
  config: TodoManageTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'todo.manage',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
  })
}

/**
 * Creates a list push ability template.
 */
export function createListPushTemplate(
  config: ListPushTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'list.push',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
  })
}

/**
 * Creates a list pop ability template.
 */
export function createListPopTemplate(
  config: ListPopTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'list.pop',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
  })
}

/**
 * Creates a list read ability template.
 */
export function createListReadTemplate(
  config: ListReadTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'list.read',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
  })
}

/**
 * Creates an image create ability template.
 *
 * Image create templates generate images from text prompts using various
 * AI image models like gpt-image-1, dalle3, or stablediffusion.
 *
 * @example
 * ```typescript
 * createImageCreateTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Generate Image',
 *   description: 'Generate an image from a text prompt',
 *   tags: ['image', 'generation'],
 *   instruction: {
 *     prompt: field({
 *       name: 'prompt',
 *       description: 'the prompt to use for image generation',
 *       placeholder: true,
 *     }),
 *     model: 'gpt-image-1',
 *   },
 * })
 * ```
 */
export function createImageCreateTemplate(
  config: ImageCreateTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'image.create',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
  })
}

/**
 * Creates an image edit ability template.
 *
 * Image edit templates modify existing images based on text prompts using
 * AI image models that support editing capabilities.
 *
 * @example
 * ```typescript
 * createImageEditTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Modify Image',
 *   description: 'Modify an image based on a text prompt',
 *   tags: ['image', 'edit'],
 *   instruction: {
 *     prompt: field({
 *       name: 'prompt',
 *       description: 'the prompt to use for image modification',
 *       placeholder: true,
 *     }),
 *     images: array({
 *       items: field({
 *         name: 'image_url',
 *         description: 'the URL of the image to edit',
 *         placeholder: true,
 *       }),
 *     }),
 *     model: 'gpt-image-1',
 *   },
 * })
 * ```
 */
export function createImageEditTemplate(
  config: ImageEditTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'image.edit',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
  })
}

/**
 * Creates a bot ask ability template.
 *
 * Bot ask templates send a question to another bot and return the response.
 * The bot only sees the question without any additional context.
 *
 * @example
 * ```typescript
 * createBotAskTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Ask Bot',
 *   description: 'Ask another bot a question',
 *   tags: ['bot', 'ask', 'beta'],
 *   instruction: {
 *     botId: bot(),
 *     prompt: field({
 *       name: 'question',
 *       description: 'the question to ask the bot',
 *       placeholder: true,
 *     }),
 *   },
 * })
 * ```
 */
export function createBotAskTemplate(
  config: BotAskTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'bot.ask',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    bot: config.bot,
  })
}

/**
 * Creates a bot call ability template.
 *
 * Bot call templates call another bot to perform an action. The bot sees
 * the full conversation context and generates additional context based on
 * the action being performed.
 *
 * @example
 * ```typescript
 * createBotCallTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Call Bot',
 *   description: 'Call another bot to perform an action',
 *   tags: ['bot', 'call', 'beta'],
 *   instruction: {
 *     botId: bot(),
 *     prompt: field({
 *       name: 'action',
 *       description: 'detailed description of the action to be performed',
 *       placeholder: true,
 *     }),
 *   },
 * })
 * ```
 */
export function createBotCallTemplate(
  config: BotCallTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'bot.call',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    bot: config.bot,
  })
}

/**
 * Creates a bot apply ability template.
 *
 * Bot apply templates apply another bot to the current visible execution
 * context using a configured intent instead of a raw prompt.
 *
 * @example
 * ```typescript
 * createBotApplyTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Apply Bot',
 *   description: 'Apply another bot to the current context',
 *   tags: ['bot', 'apply', 'beta'],
 *   instruction: {
 *     botId: bot(),
 *   },
 * })
 * ```
 */
export function createBotApplyTemplate(
  config: BotApplyTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'bot.apply',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    bot: config.bot,
  })
}

/**
 * Creates a bot list ability template.
 *
 * Bot list templates return a list of all bots available to the current
 * user account.
 *
 * @example
 * ```typescript
 * createBotListTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'List Bots',
 *   description: 'List all available bots for the current user account',
 *   tags: ['bot', 'list', 'beta'],
 *   instruction: {
 *     take: field({
 *       name: 'take',
 *       description: 'optional limit on the number of bots to return',
 *       type: 'number',
 *       optional: true,
 *       default: 100,
 *     }),
 *   },
 * })
 * ```
 */
export function createBotListTemplate(
  config: BotListTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'bot.list',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
  })
}
/**
 * Creates a bot backstory read ability template.
 *
 * Bot backstory read templates read the current backstory of a connected bot.
 *
 * @example
 * ```typescript
 * createBotBackstoryReadTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Read Bot Backstory',
 *   description: 'Read the backstory of a connected bot',
 *   tags: ['bot', 'backstory', 'read', 'beta'],
 *   bot: '#bot',
 *   instruction: {
 *     botId: bot(),
 *   },
 * })
 * ```
 */
export function createBotBackstoryReadTemplate(
  config: BotBackstoryReadTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'bot.backstory.read',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    bot: config.bot,
  })
}

/**
 * Creates a bot backstory write ability template.
 *
 * Bot backstory write templates update the backstory of a connected bot.
 *
 * @example
 * ```typescript
 * createBotBackstoryWriteTemplate({
 *   provider: 'cbk',
 *   icon: '@logo/chatbotkit.com',
 *   name: 'Write Bot Backstory',
 *   description: 'Write the backstory of a connected bot',
 *   tags: ['bot', 'backstory', 'write', 'beta'],
 *   bot: '#bot',
 *   instruction: {
 *     botId: bot(),
 *     backstory: field({
 *       name: 'backstory',
 *       description: 'the new backstory content for the bot',
 *       placeholder: true,
 *     }),
 *   },
 * })
 * ```
 */
export function createBotBackstoryWriteTemplate(
  config: BotBackstoryWriteTemplateConfig
): AbilityTemplate {
  return buildTemplate({
    metadata: config,
    actionTag: 'bot.backstory.write',
    instruction: config.instruction as unknown as Record<
      string,
      InstructionValue
    >,
    bot: config.bot,
  })
}
