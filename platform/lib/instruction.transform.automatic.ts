import debug from '@/lib/debug'
import type {
  InstructionTransformResult,
  TransformOptions,
} from '@/lib/instruction.transform.types'

/**
 * Transforms an automatic instruction by processing the input and options.
 *
 * @note Returns null as automatic instructions do not support transformation yet.
 */
export async function transformAutomaticInstruction(
  instruction: string,
  input: string,
  options: TransformOptions
): Promise<InstructionTransformResult | null> {
  debug(`transforming automatic instruction`, {
    instruction,
    input,
    options,
  }).log('instruction.automatic.transformAutomaticInstruction')

  return null
}

// @todo add @manual documentation for automatic instructions once this instruction type is fully implemented
