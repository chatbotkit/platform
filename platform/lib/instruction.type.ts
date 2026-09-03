import { parseText } from '@/lib/action.parse'
import { isActionTag, parse as parseWithActionTags } from '@/lib/action.tags'

export type InstructionType =
  | 'template'
  | 'structured'
  | 'complex'
  | 'simple'
  | 'automatic'

/**
 * A template instruction is a yaml document that has template keys.
 */
export function isTemplateInstruction(input: string): boolean {
  input = input.trim()

  if (input.startsWith('@') && input.indexOf('\n') === -1) {
    return true
  }

  try {
    const result = parseWithActionTags(input)

    return typeof result === 'object' && result !== null && 'template' in result
  } catch {
    return false
  }
}

/**
 * A structured instruction is a yaml document that defines actions and other
 * parameters.
 */
export function isStructuredInstruction(input: string): boolean {
  input = input.trim()

  try {
    const result = parseWithActionTags(input)

    if (isActionTag(result)) {
      return true
    }

    if (typeof result === 'object' && result !== null && 'action' in result) {
      return isActionTag((result as Record<string, unknown>).action)
    }

    return false
  } catch {
    return false
  }
}

/**
 * A complex instruction is one that has some string content and actions.
 */
export function isComplexInstruction(input: string): boolean {
  const { stripped, actions } = parseText(input)

  return (
    actions.length > 1 || (actions.length > 0 && stripped.trim().length > 0)
  )
}

/**
 * A simple instruction has only one action and no string content.
 */
export function isSimpleInstruction(input: string): boolean {
  const { stripped, actions } = parseText(input)

  return actions.length === 1 && stripped.trim().length === 0
}

/**
 * Detects the type of instruction. The type of instruction can be one of the
 * following: template, complex, simple.
 */
export function getInstructionType(input: string): InstructionType {
  if (isTemplateInstruction(input)) {
    return 'template'
  }

  if (isStructuredInstruction(input)) {
    return 'structured'
  }

  if (isComplexInstruction(input)) {
    return 'complex'
  }

  if (isSimpleInstruction(input)) {
    return 'simple'
  }

  return 'automatic'
}

// @todo document the structure type

/**
 * @manual Instruction Types
 * @description Instruction types define how user input is interpreted and transformed into executable actions within the ChatBotKit platform, enabling flexible and powerful agent behaviors through different instruction patterns.
 * @category Resources/Skillsets
 * @tags instruction, skillset, ability, template
 * @index 20
 *
 * The instruction system in ChatBotKit provides a sophisticated mechanism for
 * defining how agents interpret and respond to user input. Instructions can take
 * several forms, each optimized for different use cases and complexity levels.
 * Understanding these instruction types is essential for building effective
 * skillsets and abilities.
 *
 * ## Understanding Instruction Types
 *
 * ChatBotKit supports three primary instruction types, each serving a specific
 * purpose in the instruction processing pipeline:
 *
 * 1. **Template Instructions** - Pre-defined, reusable instruction templates
 * 2. **Simple Instructions** - Single-action instructions with parameter substitution
 * 3. **Complex Instructions** - Multi-action instructions combining text and actions
 *
 * The platform automatically detects which type of instruction is being used based
 * on its structure and content, allowing for seamless integration of different
 * instruction patterns within the same skillset.
 *
 * ## Template Instructions
 *
 * Template instructions are pre-defined patterns that can be referenced by name
 * and configured with parameters. These provide the highest level of reusability
 * and consistency across your skillsets.
 *
 * A template instruction is identified by either:
 * - A single line starting with `@` (e.g., `@google/calendar/search`)
 * - A YAML document containing a `template` key
 *
 * ```yaml
 * template: google/calendar/search
 * parameters:
 *   query: ((query! ys|the search query))
 *   maxResults: 10
 * ```
 *
 * **Skillset Role:** Templates serve as building blocks for creating sophisticated
 * abilities without writing low-level action code. They encapsulate best practices
 * and tested patterns for common operations.
 *
 * **Ability Category:** Templates enable rapid ability creation by providing
 * pre-configured actions for services like Google Calendar, Notion, Slack, and more.
 *
 * ## Simple Instructions
 *
 * Simple instructions consist of a single action block with no additional text
 * content. These are ideal for straightforward operations that map directly to
 * a single action type.
 *
 * A simple instruction contains exactly one action block and no surrounding text:
 *
 * ````markdown
 * ```fetch
 * GET https://api.example.com/users
 * ```
 * ````
 *
 * The system automatically extracts parameters from the instruction using field
 * notation (`$[param]` or `((param))`), and can use AI to infer missing required
 * parameters from user input.
 *
 * **Skillset Role:** Simple instructions provide clear, focused actions that are
 * easy to understand and maintain. They're perfect for abilities that perform a
 * single, well-defined task.
 *
 * **Ability Category:** Simple instructions enable actions like fetching data,
 * searching datasets, sending emails, or generating content with a single,
 * straightforward operation.
 *
 * ## Complex Instructions
 *
 * Complex instructions combine multiple action blocks with descriptive text,
 * allowing for rich, context-aware behaviors. These instructions can include
 * explanatory text alongside action definitions.
 *
 * A complex instruction is detected when:
 * - Multiple action blocks are present, or
 * - Text content exists alongside action blocks
 *
 * Example:
 *
 * ````markdown
 * First, fetch the user profile to get their preferences.
 *
 * ```fetch
 * GET https://api.example.com/users/${userId}
 * ```
 *
 * Then, based on their preferences, send a personalized email.
 *
 * ```email/to=${userEmail}
 * Subject: Your Personalized Update
 *
 * ${emailContent}
 * ```
 * ````
 *
 * **Skillset Role:** Complex instructions enable sophisticated multi-step workflows
 * that combine different actions in a coherent sequence, with contextual guidance
 * for the AI agent.
 *
 * **Ability Category:** Complex instructions support advanced capabilities like
 * multi-step data processing, conditional workflows, and orchestrated operations
 * across multiple services.
 *
 * ## Type Detection Process
 *
 * The instruction type is automatically detected using the following logic:
 *
 * 1. **Check for Template** - Does it start with `@` or contain a `template` key?
 * 2. **Check for Complex** - Does it have multiple actions or text with actions?
 * 3. **Check for Simple** - Does it have exactly one action and no text?
 *
 * This automatic detection allows you to focus on writing effective instructions
 * without worrying about explicit type declarations.
 *
 * ## Choosing the Right Instruction Type
 *
 * **Use Template Instructions when:**
 * - Working with common, well-established patterns
 * - You want maximum reusability across multiple abilities
 * - Integration with third-party services follows standard patterns
 *
 * **Use Simple Instructions when:**
 * - You need a single, focused action
 * - The operation maps directly to one action type
 * - You want clear, maintainable ability definitions
 *
 * **Use Complex Instructions when:**
 * - Multiple actions need to work together
 * - Context and explanation enhance the agent's understanding
 * - You're orchestrating multi-step workflows
 *
 * ## Integration with Skillsets and Abilities
 *
 * Instructions form the core of ability definitions within skillsets. Each
 * ability's instruction field determines how the agent executes that capability
 * when triggered by user intent.
 *
 * The instruction type affects:
 * - **Token usage** - Templates and simple instructions are more token-efficient
 * - **Processing complexity** - Complex instructions require more AI interpretation
 * - **Maintenance** - Templates and simple instructions are easier to update
 * - **Flexibility** - Complex instructions offer more contextual adaptability
 */

// @todo update @manual documentation to include automatic instructions once this instruction type is fully implemented
