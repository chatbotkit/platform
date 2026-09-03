import type { ActionName } from '@/lib/action.name'

/**
 * Options passed to instruction transform functions.
 */
export interface TransformOptions {
  /** The user ID performing the transformation */
  userId: string

  /** Signal used to abort transformation work on disconnect */
  signal?: AbortSignal

  /**
   * Engine-level field substitutions applied first during transformation. These
   * are trusted values from the engine (e.g., special fields).
   */
  substitutions?: Record<string, string>

  /**
   * Template-resolved parameters applied after substitutions. These come from
   * template param resolution and cannot override engine-provided
   * substitutions.
   */
  templateParams?: Record<string, unknown>
}

/**
 * Result structure returned by all instruction transform functions.
 * Contains the action details ready for execution along with usage information.
 */
export interface InstructionTransformResult {
  /** The action name to execute (e.g., 'fetch', 'search', 'email') */
  action: ActionName

  /** The parameters to pass to the action, extracted from the instruction */
  params: Record<string, unknown>

  /** The raw text content to pass to the action (the body of the action block) */
  text: string

  /** Usage information for the transformation */
  usage: {
    /** Number of tokens used during the transformation */
    tokensUsed: number

    /** The model used for the transformation (or 'base' if no model was used) */
    modelUsed: string
  }
}
