// @ts-check
import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import { isSpecialField } from '@/lib/ability.fields'
import { OMIT_FIELD } from '@/lib/action.tags'
import debug from '@/lib/debug'
import { BotInputError } from '@/lib/error'
import { getFieldValueDefault, parseField } from '@/lib/field'
import {
  isBracketField,
  isTagField,
  parseTemplateInstruction,
} from '@/lib/instruction.template.parse'
import { unpackTemplateInstruction } from '@/lib/instruction.template.unpack'
import { transformAutomaticInstruction } from '@/lib/instruction.transform.automatic'
import { transformComplexInstruction } from '@/lib/instruction.transform.complex'
import { transformSimpleInstruction } from '@/lib/instruction.transform.simple'
import { transformStructuredInstruction } from '@/lib/instruction.transform.structured'
import { getInstructionType } from '@/lib/instruction.type'
import { tryParse as tryParseJson } from '@/lib/json'
import { Usage } from '@/lib/usage.model'

/**
 * @param {string} instruction
 * @param {string} input
 * @param {import('@/lib/instruction.transform.types').TransformOptions} options
 * @returns {Promise<import('@/lib/instruction.transform.types').InstructionTransformResult|null>}
 * @throws {Error} When the template cannot be found or other errors occur during transformation
 */
export async function transformTemplateInstruction(
  instruction,
  input,
  options
) {
  debug(`transforming template instruction`, {
    instruction,
    input,
    options,
  }).log('instruction.template.transformTemplateInstruction')

  const { template, parameters } = parseTemplateInstruction(instruction)

  debug(`parsed template instruction`, {
    instruction,
    template,
    parameters,
  }).log('instruction.template.transformTemplateInstruction')

  const templateInstance = unpackTemplateInstruction(template)

  debug(`unpacked template instruction`, {
    template,
    templateInstance,
  }).log('instruction.template.transformTemplateInstruction')

  if (!templateInstance) {
    throw new Error(`Ability template not found: ${template}`)
  }

  const thisInstruction = templateInstance.instruction

  // @note resolve template parameters to values
  //
  // Template parameters can be:
  // 1. Standard values (strings, numbers, etc.) - used as-is
  // 2. Tag fields (!string, !number) - resolved via substitute() method
  // 3. Bracket fields (((field))) - kept as-is for downstream
  //
  // Resolved params are passed as templateParams to downstream transforms,
  // which handle the actual instruction substitution.

  /** @type {Record<string, unknown>} */
  const resolvedParams = {}

  const inputValues = tryParseJson(input) || {}

  for (const [key, value] of Object.entries(parameters)) {
    // @note filter empty string parameters

    if (value === '') {
      continue // @todo verify this is a good idea
    }

    if (isTagField(value)) {
      // @note resolve tag field using its substitute() method

      const fieldDef =
        /** @type {import('@/lib/action.tags').BaseField<import('@/lib/action.tags').TagFieldValue>} */ (
          value
        )

      try {
        const resolvedValue = fieldDef.substitute(inputValues)

        if (resolvedValue !== OMIT_FIELD) {
          resolvedParams[key] = resolvedValue
        }
      } catch {
        // @note the above method will throw if required value is missing which
        // will prevent further processing - this is the expected behaviour for
        // the field but certainly not ideal for template parameter resolution
        // @todo evaluate if we should be doing something different here
      }

      continue
    }

    if (isBracketField(value)) {
      // @note check if this is a special field reference like ${CONVERSATION_*}
      // these should be passed through as-is for later resolution

      const fieldDef = parseField(value)
      const fieldName = fieldDef.name

      if (isSpecialField(fieldName)) {
        // @note special field references are passed through unchanged

        resolvedParams[key] = value

        continue
      }

      // @note regular bracket fields are resolved from input or default

      try {
        if (fieldName in inputValues) {
          resolvedParams[key] = inputValues[fieldName]
        } else {
          const defaultValue = getFieldValueDefault(fieldDef)

          if (defaultValue !== undefined) {
            resolvedParams[key] = defaultValue
          } else if (fieldDef.required) {
            throw new BotInputError(
              `Required field "${fieldName}" missing in the input.`
            )
          }

          // @note if no input and no default, don't include in resolvedParams
          // downstream will handle validation for the instruction's own fields
        }
      } catch {
        // @note the above method will throw if required value is missing which
        // will prevent further processing - this is the expected behaviour for
        // the field but certainly not ideal for template parameter resolution
        // @todo evaluate if we should be doing something different here
      }

      continue
    }

    // @note standard value - use as-is

    resolvedParams[key] = value
  }

  debug(`resolved template parameters`, {
    parameters,
    resolvedParams,
  }).log('instruction.template.transformTemplateInstruction')

  const instructionType = getInstructionType(thisInstruction)

  debug(`instruction type`, {
    instructionType,
  }).log('instruction.template.transformTemplateInstruction')

  const usage = new Usage()

  // @note merge resolved template params into options for downstream

  const downstreamOptions = {
    ...options,

    templateParams: {
      ...options.templateParams,
      ...resolvedParams,
    },
  }

  /** @type {import('@/lib/instruction.transform.types').InstructionTransformResult|null} */
  let transformResult

  switch (instructionType) {
    case 'template': {
      throw new Error(`Nested templates not supported`)
    }

    case 'complex': {
      transformResult = await transformComplexInstruction(
        thisInstruction,
        input,
        downstreamOptions
      )

      break
    }

    case 'simple': {
      transformResult = await transformSimpleInstruction(
        thisInstruction,
        input,
        downstreamOptions
      )

      break
    }

    case 'structured': {
      transformResult = await transformStructuredInstruction(
        thisInstruction,
        input,
        downstreamOptions
      )

      break
    }

    case 'automatic': {
      transformResult = await transformAutomaticInstruction(
        thisInstruction,
        input,
        downstreamOptions
      )

      break
    }

    default: {
      assertUnreachable(instructionType)
    }
  }

  if (!transformResult) {
    debug(`no transform result produced`).log(
      'instruction.template.transformTemplateInstruction'
    )

    return null
  }

  usage.addTokens(
    transformResult.usage.tokensUsed,
    transformResult.usage.modelUsed
  )

  const tokenModelObject = usage.toTokenModelObject()

  /** @type {import('@/lib/instruction.transform.types').InstructionTransformResult} */
  const result = {
    action: transformResult.action,
    params: transformResult.params,
    text: transformResult.text,
    usage: {
      tokensUsed: tokenModelObject.token,
      modelUsed: tokenModelObject.model,
    },
  }

  debug(`transformed template instruction`, {
    result,
  }).log('instruction.template.transformTemplateInstruction')

  return result
}

/**
 * @manual Instruction Types
 * @index 23
 *
 * ## Template Instructions: Reusable Patterns
 *
 * Template instructions provide the highest level of abstraction and reusability
 * in the ChatBotKit instruction system. They allow you to reference pre-defined,
 * tested instruction patterns by name and configure them with parameters, enabling
 * rapid ability creation and ensuring consistency across your skillsets.
 *
 * ### How Template Instructions Work
 *
 * A template instruction is automatically detected when:
 * - It starts with `@` followed by a template identifier (e.g., `@google/calendar/search`)
 * - It's a YAML document containing a `template` key
 *
 * When a template instruction is processed, the system:
 *
 * 1. **Parses Template Reference** - Extracts the template ID and parameters
 * 2. **Unpacks Template** - Retrieves the full instruction definition from the catalog
 * 3. **Substitutes Parameters** - Replaces parameter placeholders with provided values
 * 4. **Detects Instruction Type** - Determines if the resulting instruction is simple, complex, or automatic
 * 5. **Transforms Accordingly** - Processes the instruction using the appropriate handler
 *
 * Templates act as instruction generators, producing complete instructions that
 * are then processed through the normal instruction pipeline.
 *
 * ### Template Reference Syntax
 *
 * **Single-Line Format** (for templates without parameters):
 *
 * ```
 * @google/calendar/list
 * ```
 *
 * **YAML Format** (for templates with parameters):
 *
 * ```yaml
 * template: google/calendar/search
 * parameters:
 *   query: ((query! ys|the search query))
 *   maxResults: 10
 * ```
 *
 * The YAML format provides full control over parameter values, allowing you to:
 * - Specify parameter values directly
 * - Pass field definitions that will be further processed
 * - Set default values for optional parameters
 * - Chain templates with other instructions
 *
 * ### Template Catalog Structure
 *
 * Templates are organized in a hierarchical catalog by provider and function:
 *
 * - `google/calendar/search` - Search Google Calendar events
 * - `google/drive/files/list` - List files in Google Drive
 * - `notion/database/query` - Query a Notion database
 * - `slack/message/post` - Post a message to Slack
 * - `pack/google` - Complete Google services pack
 *
 * Each template includes:
 * - **Provider** - The service it integrates with
 * - **Icon** - Visual identifier for UI display
 * - **Name** - Human-readable name
 * - **Description** - Brief explanation of functionality
 * - **Instruction** - The actual instruction template with parameter placeholders
 * - **Secret** - Reference to required authentication credentials
 * - **Tags** - Keywords for categorization
 *
 * ### Parameter Substitution
 *
 * Template parameters are substituted into the instruction using round bracket
 * notation `((parameter))`. The substitution process:
 *
 * **Standard Parameters** - Simple values are substituted directly:
 *
 * ```yaml
 * template: google/calendar/search
 * parameters:
 *   query: "team meeting"
 *   maxResults: 5
 * ```
 *
 * **Field Parameters** - Field definitions are substituted while preserving their structure:
 *
 * ```yaml
 * template: google/calendar/search
 * parameters:
 *   query: $[searchTerm ys|what to search for]
 * ```
 *
 * This allows templates to accept dynamic parameters that will be resolved later
 * in the instruction processing pipeline.
 *
 * **Empty Parameters** - Parameters with empty string values are filtered out,
 * distinguishing between intentionally empty values and missing parameters.
 *
 * ### Template Nesting
 *
 * **Important:** Template instructions do not support nesting. If a template
 * produces another template instruction, the system will throw an error. This
 * prevents infinite recursion and maintains predictable behavior.
 *
 * ### Practical Examples
 *
 * **Example 1: Simple Template Usage**
 *
 * ```
 * @notion/database/query
 * ```
 *
 * This references a pre-defined Notion database query template without any
 * parameters, using defaults defined in the template itself.
 *
 * **Example 2: Template with Parameters**
 *
 * ```yaml
 * template: google/calendar/search
 * parameters:
 *   query: ((userQuery! ys|what the user wants to find))
 *   timeMin: ((startDate ys|search start date))
 *   timeMax: ((endDate ys|search end date))
 *   maxResults: 10
 * ```
 *
 * This configures the Google Calendar search template with specific parameters,
 * some of which are fields that will be populated from user input.
 *
 * **Example 3: Pack Template**
 *
 * ```yaml
 * template: pack/google
 * parameters:
 *   task: ((task! ys|the task to perform with Google services))
 * ```
 *
 * Pack templates provide access to multiple related abilities, allowing the AI
 * agent to choose the appropriate operation based on the task description.
 *
 * **Example 4: Template in Ability Definition**
 *
 * When defining an ability in a skillset, you can use a template instruction:
 *
 * ```yaml
 * name: "Search Calendar"
 * description: "Search the user's Google Calendar for events"
 * instruction: |
 *   template: google/calendar/search
 *   parameters:
 *     query: $[query ys|the search query]
 *     maxResults: 10
 * ```
 *
 * This creates an ability that leverages the pre-tested Google Calendar search
 * template, ensuring reliable integration with Google's API.
 *
 * ### Template Transformation Pipeline
 *
 * After parameter substitution, the resulting instruction is processed based on
 * its detected type:
 *
 * 1. **Simple Instruction** - Uses deterministic parameter substitution
 * 2. **Complex Instruction** - Uses AI-powered transformation
 * 3. **Automatic Instruction** - Currently throws an error (not implemented)
 *
 * This means templates can generate any type of instruction, giving template
 * authors full flexibility in defining behavior.
 *
 * ### Skillset and Ability Context
 *
 * **Skillset Role:** Templates are the building blocks for rapid skillset
 * development. They encapsulate best practices and tested patterns, allowing
 * you to build comprehensive skillsets quickly without reinventing common
 * integration patterns.
 *
 * **Ability Category:** Templates enable a wide range of capabilities:
 * - **Third-Party Integrations** - Google, Notion, Slack, GitHub, etc.
 * - **Data Operations** - Database queries, file operations, search
 * - **Communication** - Messaging, email, notifications
 * - **Content Generation** - Text, images, documents
 * - **Workflow Automation** - Multi-step processes via pack templates
 *
 * ### Benefits of Template Instructions
 *
 * **Consistency** - Ensures all abilities use the same proven patterns for
 * interacting with services, reducing bugs and improving reliability.
 *
 * **Maintainability** - Updates to templates automatically propagate to all
 * abilities using them, making maintenance easier.
 *
 * **Rapid Development** - Pre-built templates allow you to create abilities
 * in minutes rather than hours.
 *
 * **Security** - Templates handle authentication and security best practices,
 * reducing the risk of credentials exposure.
 *
 * **Documentation** - Templates are self-documenting, with descriptions and
 * examples built into the catalog.
 *
 * ### Performance Considerations
 *
 * Template instructions have minimal overhead:
 * - **Template Lookup** - Fast catalog lookup by template ID
 * - **Parameter Substitution** - Efficient string replacement operations
 * - **Nested Processing** - The resulting instruction is processed normally
 *
 * The performance characteristics depend on what type of instruction the template
 * produces (simple, complex, or automatic).
 *
 * ### Best Practices
 *
 * 1. **Use Templates First** - Check the catalog before writing custom instructions
 * 2. **Provide Required Parameters** - Ensure all required parameters are specified
 * 3. **Leverage Field Notation** - Use field definitions for dynamic parameters
 * 4. **Choose Appropriate Templates** - Select templates that match your use case
 * 5. **Test Parameter Values** - Verify parameter substitution produces expected results
 *
 * ### When to Use Template Instructions
 *
 * Choose template instructions when:
 * - A suitable template exists in the catalog
 * - You're integrating with a supported third-party service
 * - You want to ensure consistency across multiple abilities
 * - You need to leverage tested, production-ready patterns
 * - Rapid ability development is a priority
 *
 * Create custom templates when:
 * - You have a pattern that will be reused across many abilities
 * - You're integrating a new service that others might use
 * - You want to abstract complexity for easier ability creation
 *
 * **Warning:** Template instructions require the template to exist in the catalog.
 * If a template is not found, the system will throw an error. Always verify
 * template availability before referencing them in abilities.
 */
