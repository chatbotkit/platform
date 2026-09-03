// @note the script harness: option parsing, prompting and output for the
// repository's command line scripts. Extracted from platform so
// scripts can live next to the code they operate on.
import { Command, Option } from 'commander'
import inquirer from 'inquirer'

/**
 * Copy enabled feature flags into process.env for script code paths that read
 * flags during module initialization.
 *
 * @param {Record<string, unknown>} [flags]
 */
/**
 * Terminates the process, printing anything passed first.
 *
 * @note inlined from platform/lib/debug.ts so this package stands alone.
 */
export function exit(...args: unknown[]): never {
  if (args.length) {
    // eslint-disable-next-line no-console
    ;(console.error || console.log)(...args)
  }

  process.exit(1)
}

/**
 * Copies truthy feature flags into the environment.
 *
 * @note the flags themselves are application specific, so they are passed in
 * rather than imported. platform applies its own on import of its shim.
 */
export function applyFlagsToProcessEnv(flags: Record<string, unknown>): void {
  Object.assign(
    process.env,
    Object.fromEntries(
      Object.entries(flags)
        .filter(([, value]) => value)
        .map(([name, value]) => [name, String(value)])
    )
  )
}

/**
 * Safely stringify an object, handling circular references.
 */
function safeStringify(obj: unknown, indent?: number): string {
  const seen = new WeakSet()

  return JSON.stringify(
    obj,
    (_key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]'
        }

        seen.add(value)
      }

      return value
    },
    indent
  )
}

/**
 * Log a message with `*` prefix to stderr.
 *
 * Use this for informational/diagnostic output. This writes to stderr so that
 * stdout remains clean for structured data output (JSON, etc.) that can be
 * piped to other tools like jq.
 *
 * @example
 * ```typescript
 * log('user found')
 * log('details', { id: 'abc123', email: 'user@example.com' })
 * ```
 */
export function log(...args: unknown[]): void {
  // eslint-disable-next-line no-console
  console.error(
    '*',
    ...args.map((arg) =>
      typeof arg === 'string' ? arg : safeStringify(arg, 2)
    )
  )
}

/**
 * Print raw output without prefix.
 *
 * Use this for raw output that should not be prefixed.
 *
 * @example
 * ```typescript
 * print('Raw output')
 * print(JSON.stringify(data))
 * ```
 */
export function print(...args: unknown[]): void {
  // eslint-disable-next-line no-console
  console.log(...args)
}

/**
 * Option type for script parameters.
 */
export type ScriptOptionType = 'string' | 'boolean' | 'confirm'

/**
 * Base option definition.
 */
interface BaseOptionDef {
  /**
   * Short flag (e.g., 'e' for -e).
   */
  short?: string

  /**
   * Description shown in help.
   */
  description: string

  /**
   * Message shown in interactive mode.
   */
  message?: string

  /**
   * Whether this option is required. If not provided via CLI, will prompt interactively.
   */
  required?: boolean

  /**
   * Default value for the option.
   */
  default?: string | boolean
}

/**
 * String option definition.
 */
export interface StringOptionDef extends BaseOptionDef {
  type: 'string'
  default?: string
}

/**
 * Boolean option definition (flag).
 */
export interface BooleanOptionDef extends BaseOptionDef {
  type: 'boolean'
  default?: boolean
}

/**
 * Confirm option definition (interactive confirmation).
 */
export interface ConfirmOptionDef extends BaseOptionDef {
  type: 'confirm'
  default?: boolean
}

export type ScriptOptionDef =
  | StringOptionDef
  | BooleanOptionDef
  | ConfirmOptionDef

/**
 * Map of option names to their definitions.
 */
export type ScriptOptions = Record<string, ScriptOptionDef>

/**
 * Infer the value type for a single option.
 */
type InferOptionValue<T extends ScriptOptionDef> = T extends StringOptionDef
  ? string
  : T extends BooleanOptionDef
  ? boolean
  : T extends ConfirmOptionDef
  ? boolean
  : never

/**
 * Infer the parsed values type from options definition.
 */
export type InferValues<T extends ScriptOptions> = {
  [K in keyof T]: T[K]['required'] extends true
    ? InferOptionValue<T[K]>
    : InferOptionValue<T[K]> | undefined
}

/**
 * Script configuration.
 */
export interface ScriptConfig<T extends ScriptOptions> {
  /**
   * Script name (used in help output).
   */
  name: string

  /**
   * Script description (used in help output).
   */
  description: string

  /**
   * Option definitions.
   */
  options: T

  /**
   * Handler function that receives the parsed values.
   */
  handler: (values: InferValues<T>) => Promise<void>
}

/**
 * Parse command-line flags using Commander.
 */
function parseCliOptions<T extends ScriptOptions>(
  config: ScriptConfig<T>,
  argv: string[]
): Partial<InferValues<T>> {
  const program = new Command()

  const normalizedArgv =
    argv[2] === '--' ? [argv[0], argv[1], ...argv.slice(3)] : argv

  program.name(config.name).description(config.description)

  for (const [key, def] of Object.entries(config.options)) {
    const shortFlag = def.short ? `-${def.short}, ` : ''
    const longFlag = `--${key}`
    const valueSpec = def.type === 'string' ? ' <value>' : ''
    const flags = `${shortFlag}${longFlag}${valueSpec}`

    const option = new Option(flags, def.description)

    if (def.default !== undefined) {
      option.default(def.default)
    }

    program.addOption(option)
  }

  // @note allow --help to work but catch other errors to allow interactive fallback
  program.exitOverride((err) => {
    if (err.code === 'commander.helpDisplayed') {
      process.exit(0)
    }

    throw err
  })

  try {
    program.parse(normalizedArgv)
  } catch {
    // @note commander throws on parse errors, we continue to interactive mode
  }

  const opts = program.opts()

  return opts as Partial<InferValues<T>>
}

/**
 * Check if all required options are provided.
 */
function getMissingRequired<T extends ScriptOptions>(
  config: ScriptConfig<T>,
  values: Partial<InferValues<T>>
): string[] {
  const missing: string[] = []

  for (const [key, def] of Object.entries(config.options)) {
    if (def.required && (values[key] === undefined || values[key] === '')) {
      missing.push(key)
    }
  }

  return missing
}

/**
 * Prompt for missing values interactively.
 */
async function promptForMissing<T extends ScriptOptions>(
  config: ScriptConfig<T>,
  existingValues: Partial<InferValues<T>>,
  keys: string[]
): Promise<InferValues<T>> {
  const result = { ...existingValues } as InferValues<T>

  // @note prompting for each missing key individually to maintain order
  for (const key of keys) {
    const def = config.options[key]

    if (!def) {
      continue
    }

    const message = def.message || def.description

    if (def.type === 'string') {
      const { value } = await inquirer.prompt([
        {
          type: 'input',
          name: 'value',
          message,
          default: def.default,
        },
      ])

      result[key as keyof InferValues<T>] = value
    } else if (def.type === 'boolean') {
      const { value } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'value',
          message,
          default: def.default ?? false,
        },
      ])

      result[key as keyof InferValues<T>] = value
    } else if (def.type === 'confirm') {
      const { value } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'value',
          message,
          default: def.default ?? false,
        },
      ])

      result[key as keyof InferValues<T>] = value
    }
  }

  return result
}

/**
 * Create and run a script with the given configuration.
 *
 * This function combines Commander.js for CLI argument parsing with Inquirer
 * for interactive prompts when required options are not provided.
 *
 * @example
 * ```typescript
 * import { script } from '@chatbotkit-dev/script'
 *
 * script({
 *   name: 'find-user',
 *   description: 'Find a user by email',
 *   options: {
 *     email: {
 *       type: 'string',
 *       short: 'e',
 *       description: 'User email address',
 *       message: 'What is the email address for the user?',
 *       required: true,
 *     },
 *   },
 *   handler: async ({ email }) => {
 *     // email is guaranteed to be a string here
 *     console.log(`Finding user: ${email}`)
 *   },
 * })
 * ```
 */
export async function script<T extends ScriptOptions>(
  config: ScriptConfig<T>,
  argv: string[] = process.argv
): Promise<void> {
  const cliValues = parseCliOptions(config, argv)
  const missing = getMissingRequired(config, cliValues)

  let finalValues: InferValues<T>

  if (missing.length > 0) {
    // @note fall back to interactive mode for missing required options
    finalValues = await promptForMissing(config, cliValues, missing)
  } else {
    finalValues = cliValues as InferValues<T>
  }

  await config.handler(finalValues)
}

/**
 * Run a script with error handling.
 *
 * Wraps the script function with proper error handling that logs errors
 * and exits with code 1.
 */
export function runScript<T extends ScriptOptions>(
  config: ScriptConfig<T>,
  argv: string[] = process.argv
): void {
  script(config, argv).catch(exit)
}

/**
 * Helper to prompt for confirmation.
 *
 * Use this for destructive operations that need user confirmation.
 *
 * @example
 * ```typescript
 * const confirmed = await confirm('Do you really want to delete this user?')
 * if (!confirmed) {
 *   log('Aborted')
 *   return
 * }
 * ```
 */
export async function confirm(
  message: string,
  defaultValue: boolean = false
): Promise<boolean> {
  const { value } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'value',
      message,
      default: defaultValue,
    },
  ])

  return value
}

/**
 * Helper to prompt for input.
 *
 * Use this for additional inputs not covered by the script options.
 *
 * @example
 * ```typescript
 * const newEmail = await prompt('What is the new email address?')
 * ```
 */
export async function prompt(
  message: string,
  defaultValue?: string
): Promise<string> {
  const { value } = await inquirer.prompt([
    {
      type: 'input',
      name: 'value',
      message,
      default: defaultValue,
    },
  ])

  return value
}

export default script
