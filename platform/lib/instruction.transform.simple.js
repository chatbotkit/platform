// @ts-check
import { isSpecialField } from '@/lib/ability.fields'
import { parseText } from '@/lib/action.parse'
import { debug } from '@/lib/debug'
import { BotInputError } from '@/lib/error'
import { extractDataFromInput } from '@/lib/extract.data'
import {
  BracketType,
  extractFields,
  getFieldValueDefault,
  substituteFields,
} from '@/lib/field'
import { Usage } from '@/lib/usage.model'
import { tryParse as tryParseYaml } from '@/lib/yaml'

import pluralize from 'pluralize'

/**
 * @typedef {(typeof BracketType)[keyof typeof BracketType]} BracketTypeValue
 */

/**
 * @param {string} instruction
 * @param {string} input
 * @param {import('@/lib/instruction.transform.types').TransformOptions} options
 * @returns {Promise<import('@/lib/instruction.transform.types').InstructionTransformResult|null>}
 */
export async function transformSimpleInstruction(instruction, input, options) {
  debug(`transforming simple instruction`, {
    instruction,
    input,
    options,
  }).log('instruction.simple.transformSimpleInstruction')

  const usage = new Usage()

  // Extract all expected fields from the instruction.

  const expectedFields = extractFields(instruction, {
    bracketType: BracketType.all,
  })

  // Filter all required fields to make sure we know what we must substitute
  // in the instruction.

  const requiredFields = expectedFields.filter(({ required }) => required)

  debug(`fields`, { expectedFields, requiredFields }).log(
    'instruction.simple.transformSimpleInstruction'
  )

  // Parse the input fields that will be used to substitute the instruction.

  let inputFields = tryParseYaml(input) || {}

  if (typeof inputFields !== 'object') {
    inputFields = {}
  }

  // Merge template-resolved params (override input values, non-special only).

  if (options.templateParams) {
    for (const field of expectedFields) {
      if (
        options.templateParams.hasOwnProperty(field.name) &&
        !isSpecialField(field.name)
      ) {
        inputFields[field.name] = options.templateParams[field.name]
      }
    }
  }

  // Merge engine-level substitutions last (override everything, non-special only).
  // @note substitutions from engine level should not override everything

  if (options.substitutions) {
    for (const field of expectedFields) {
      if (
        options.substitutions.hasOwnProperty(field.name) &&
        !isSpecialField(field.name)
      ) {
        inputFields[field.name] = options.substitutions[field.name]
      }
    }
  }

  // Add default values for the fields that are missing but have defaults.

  for (const field of expectedFields) {
    if (!inputFields.hasOwnProperty(field.name)) {
      const defaultValue = getFieldValueDefault(field)

      if (defaultValue !== undefined) {
        inputFields[field.name] = defaultValue
      }
    }
  }

  // Find all missing fields that are required to substitute the instruction.

  const requiredMissingFields = requiredFields.filter(
    ({ name }) => !inputFields.hasOwnProperty(name)
  )

  // @note condition disabled because it does not seem to be correct
  // If there are no missing fields and we have expected fields then we must
  // check if the input is empty.If it is empty then we must add all expected
  // fields to the missing fields. This is a special case when the input is
  // empty but we still have expected fields.
  // if (
  //   !missingFields.length &&
  //   expectedFields.length &&
  //   !Object.keys(inputFields).length
  // ) {
  //   missingFields.push(...expectedFields)
  // }

  // If there are missing fields then we must try to extract them using llm.

  if (requiredMissingFields.length) {
    // @todo extract in common function to be shared with other modules

    debug(`missing fields found`, {
      requiredMissingFields,
    }).log('instruction.simple.transformSimpleInstruction')

    // @note abort on common situations that cannot be resolved with llm
    {
      const niceInput = input.trim().toLowerCase()

      if (niceInput === '' || niceInput === '{}') {
        throw new BotInputError(
          `Required ${pluralize('field', requiredMissingFields.length)} "${requiredMissingFields
            .map(({ name }) => name)
            .join(', ')}" missing in the input.`
        )
      }
    }

    /** @type {import('@/lib/jsonschema').JsonSchemaObject} */
    const inputSchema = {
      type: 'object',
      properties: Object.fromEntries(
        requiredMissingFields.map(({ name, description }) => {
          return [
            name,
            {
              type: 'string', // @todo not always is string
              description: description || undefined,
            },
          ]
        })
      ),
      required: requiredMissingFields.map((field) => field.name),
    }

    const { data, usage: extractUsage } = await extractDataFromInput(
      `The instruction is:\n\n${instruction}\n\nThe user input is:\n\n${JSON.stringify(
        input
      )}`,
      inputSchema,
      {
        user: { id: options.userId },
      }
    )

    if (data) {
      if (typeof inputFields !== 'object') {
        inputFields = {}
      }

      for (const [key, value] of Object.entries(data)) {
        inputFields[key] = value
      }
    }

    usage.addUsage(extractUsage)
  } else {
    debug(`no missing fields found`).log(
      'instruction.simple.transformSimpleInstruction'
    )
  }

  // Group fields by type.

  /** @type {Record<Exclude<BracketTypeValue,'all'>, Record<string, any>>} */
  const inputFieldsByType = {
    square: {},
    curly: {},
    round: {},
  }

  for (const field of expectedFields) {
    // @note special fields should not be populated from input - they are only
    // populated from options.substitutions to prevent accidental injection

    if (field.type === 'curly' && isSpecialField(field.name)) {
      continue
    }

    inputFieldsByType[field.type][field.name] = inputFields[field.name]
  }

  // Merge external substitutions into the field maps.

  // Merge template-resolved params (override input values, non-special only).

  if (options.templateParams) {
    for (const field of expectedFields) {
      if (
        options.templateParams.hasOwnProperty(field.name) &&
        !isSpecialField(field.name)
      ) {
        inputFieldsByType[field.type][field.name] =
          options.templateParams[field.name]
      }
    }
  }

  // Merge engine-level substitutions last (override everything).
  // @note substitutions from engine level should not override everything

  if (options.substitutions) {
    for (const field of expectedFields) {
      if (options.substitutions.hasOwnProperty(field.name)) {
        inputFieldsByType[field.type][field.name] =
          options.substitutions[field.name]
      }
    }
  }

  // Substitute all fields in the instruction.

  let thisInstruction = instruction

  for (const [type, fields] of Object.entries(inputFieldsByType)) {
    thisInstruction = substituteFields(thisInstruction, fields, {
      bracketType: /** @type {Exclude<BracketTypeValue,'all'>} */ (type),
      validate: true,
      defaults: true,
    })
  }

  // Clean up any remaining unfilled fields by replacing them with empty strings.
  // Special fields (SECRET_, USER_, etc.) are preserved for action execution.

  const remainingFields = {
    ...Object.fromEntries(
      extractFields(thisInstruction, {
        bracketType: BracketType.square,
      }).map(({ name }) => [name, ''])
    ),

    ...Object.fromEntries(
      extractFields(thisInstruction, {
        bracketType: BracketType.curly,
      })
        .filter(({ name }) => !isSpecialField(name))
        .map(({ name }) => [name, ''])
    ),
  }

  thisInstruction = substituteFields(thisInstruction, remainingFields, {
    bracketType: BracketType.square,
    validate: true,
  })

  thisInstruction = substituteFields(thisInstruction, remainingFields, {
    bracketType: BracketType.curly,
    validate: true,
  })

  const tokenModelObject = usage.toTokenModelObject()

  // @note simple instructions have exactly one action block, so we extract
  // the action during transformation

  const { actions } = parseText(thisInstruction)

  const lastAction =
    actions.length > 0 ? actions[actions.length - 1] : undefined

  if (!lastAction) {
    throw new Error('No action found in simple instruction')
  }

  /** @type {import('@/lib/instruction.transform.types').InstructionTransformResult} */
  const result = {
    action: lastAction.name,
    params: lastAction.params,
    text: lastAction.text,
    usage: {
      tokensUsed: tokenModelObject.token,
      modelUsed: tokenModelObject.model,
    },
  }

  debug(`transformed simple instruction`, {
    result,
  }).log('instruction.simple.transformSimpleInstruction')

  return result
}

/**
 * @manual Instruction Types
 * @index 21
 *
 * ## Simple Instructions: Parameter Substitution
 *
 * Simple instructions represent the most straightforward instruction pattern in
 * ChatBotKit, consisting of a single action block with parameter placeholders that
 * are automatically populated from user input. This type provides a clean,
 * efficient way to create abilities that perform focused, single-action operations.
 *
 * ### How Simple Instructions Work
 *
 * A simple instruction is automatically detected when it contains:
 * - Exactly one action block (like `fetch`, `search`, `email`, etc.)
 * - No additional text content outside the action block
 *
 * When a simple instruction is processed, the system:
 *
 * 1. **Extracts Parameters** - Identifies all field placeholders in the instruction
 * 2. **Parses User Input** - Attempts to parse the input as YAML/JSON for structured data
 * 3. **Identifies Missing Fields** - Compares expected parameters with provided input
 * 4. **Uses AI for Extraction** - If required fields are missing, uses an LLM to extract them from natural language input
 * 5. **Substitutes Parameters** - Replaces all placeholders with actual values
 *
 * ### Parameter Field Notation
 *
 * Simple instructions support multiple field bracket types for different purposes:
 *
 * **Square Brackets `$[param]`** - AI-populated fields
 * These fields are intended to be filled by the AI agent based on user input:
 *
 * ````markdown
 * ```fetch
 * GET https://api.example.com/search?q=$[query! euc|the user's search query]
 * ```
 * ````
 *
 * **Curly Brackets `${SECRET_NAME}`** - Secret and metadata references
 * These reference secrets or conversation metadata:
 *
 * ````markdown
 * ```fetch
 * GET https://api.example.com/data
 * Authorization: Bearer ${API_TOKEN}
 * ```
 * ````
 *
 * **Round Brackets `((param))`** - User-provided or template parameters
 * These are expected from structured input or template invocations:
 *
 * ````markdown
 * ```search/datasetId=((datasetId!|the dataset to search))
 * ((searchQuery ys|what to search for))
 * ```
 * ````
 *
 * ### Parameter Reference
 *
 * | Syntax                                                                | Description                                                  |
 * | --------------------------------------------------------------------- | ------------------------------------------------------------ |
 * | `${SECRET_NAME}` or `{{SECRET_NAME}}`                                 | Use a secret defined by name.                                |
 * | `${CONVERSATION_ID}` or `{{CONVERSATION_ID}}`                         | Use the current conversation id.                             |
 * | `${CONVERSATION_META_FIELD}` or `{{CONVERSATION_META_FIELD}}`         | Access a "field" from the meta properties of a conversation. |
 * | `$[param|parameter description]` or `[[param|parameter description]]` | Define and use a parameter filled by the user.               |
 * | `((param|parameter description))`                                     | Template or structured input parameter.                      |
 *
 * ### Required vs Optional Parameters
 *
 * Parameters can be marked as required using the `!` modifier:
 *
 * - `$[query! ys|description]` - Required field, must be provided or extracted
 * - `$[limit ys|description]` - Optional field, can be omitted
 *
 * When required fields are missing, the system automatically invokes an LLM to
 * extract them from the user's natural language input. This provides a seamless
 * experience where users don't need to provide structured data.
 *
 * ### Practical Examples
 *
 * **Example 1: Fetching Weather Data**
 *
 * ````markdown
 * ```fetch
 * GET https://wttr.in/$[location! euc|the city name]?format=4
 * User-Agent: curl/7.61.1
 * ```
 * ````
 *
 * When a user says "What's the weather in Paris?", the system:
 * 1. Detects this as a simple instruction (one action, no text)
 * 2. Identifies `location` as a required parameter
 * 3. Uses AI to extract "Paris" from the user input
 * 4. Substitutes to create: `GET https://wttr.in/Paris?format=4`
 *
 * **Example 2: Searching a Dataset**
 *
 * ````markdown
 * ```search/datasetId=((datasetId! ys))
 * $[query!|what the user wants to find]
 * ```
 * ````
 *
 * This instruction:
 * - Requires `datasetId` from structured input (template parameter)
 * - Extracts `query` from natural language user input
 * - Combines both to perform the search operation
 *
 * **Example 3: Sending an Email**
 *
 * ````markdown
 * ```email/to=((recipientEmail!))/replyTo=${USER_EMAIL}
 * Subject: $[subject ys|email subject line]
 *
 * $[emailBody ys|the content of the email]
 * ```
 * ````
 *
 * This demonstrates mixing all three parameter types:
 * - `recipientEmail` from template parameters
 * - `USER_EMAIL` from secrets/metadata
 * - `subject` and `emailBody` extracted from user input
 *
 * **Example 4: Using Parameter Hints**
 *
 * ````markdown
 * ```fetch
 * POST https://httpbin.org/anything/collect/details
 * Content-Type: application/json
 * Authorization: Bearer ${SECRET_TEST}
 *
 * {
 *   "name": "$[name|The name of the user]",
 *   "email": "$[email|The email of the user]"
 * }
 * ```
 * ````
 *
 * This example shows how to provide additional hints for parameter extraction. Rather
 * than leaving the request parameters open to interpretation, the descriptions guide
 * the AI in extracting the correct values from user input.
 *
 * ### Skillset and Ability Context
 *
 * **Skillset Role:** Simple instructions provide the foundation for creating clean,
 * maintainable abilities that perform specific tasks. They're ideal for building
 * comprehensive skillsets where each ability has a clear, focused purpose.
 *
 * **Ability Category:** Simple instructions enable a wide range of capabilities:
 * - **Data Retrieval** - Fetching information from APIs
 * - **Search Operations** - Querying datasets or external search engines
 * - **Communication** - Sending emails or messages
 * - **Content Generation** - Creating text or images with AI models
 *
 * ### Performance Characteristics
 *
 * Simple instructions are highly efficient:
 * - **Token Usage** - Minimal token consumption for parameter extraction
 * - **Processing Speed** - Fast transformation with predictable behavior
 * - **Maintainability** - Easy to understand and update
 *
 * When no required fields are missing, no AI calls are made at all, making the
 * transformation instantaneous. When AI extraction is needed, only the missing
 * fields are extracted, minimizing token usage.
 *
 * ### Best Practices
 *
 * 1. **Use descriptive field names** that clearly indicate their purpose
 * 2. **Include helpful descriptions** after the pipe `|` to guide AI extraction
 * 3. **Mark required fields** with `!` to ensure they're always provided
 * 4. **Choose appropriate bracket types** based on the parameter source
 * 5. **Keep instructions focused** on a single action for maximum clarity
 * 6. **Test with natural language input** to verify AI extraction works as expected
 *
 * **Warning:** Field descriptions contribute to token usage during AI extraction.
 * Balance descriptiveness with brevity to maintain efficient processing.
 */

/**
 * @doc Skillsets
 * @index 31
 *
 * ## Using Parameters
 *
 * Actions and other parts of the ability instruction can be customized with parameters. Parameters allow you to create dynamic abilities that adapt based on user input, secrets, or conversation context.
 *
 * ### Parameter Syntax
 *
 * ChatBotKit supports several parameter syntaxes for different purposes:
 *
 * | Syntax                                                                | Description                                                  |
 * | --------------------------------------------------------------------- | ------------------------------------------------------------ |
 * | `${SECRET_NAME}` or `{{SECRET_NAME}}`                                 | Use a secret defined by name.                                |
 * | `${CONVERSATION_ID}` or `{{CONVERSATION_ID}}`                         | Use the current conversation id.                             |
 * | `${CONVERSATION_META_FIELD}` or `{{CONVERSATION_META_FIELD}}`         | Access a "field" from the meta properties of a conversation. |
 * | `$[param|parameter description]` or `[[param|parameter description]]` | Define a parameter to be filled by the AI from user input.   |
 *
 * ### Parameter Example
 *
 * Here's an example showing how to use parameters in a fetch action:
 *
 * `````markdown
 * ```fetch
 * url: https://httpbin.org/anything/collect/details
 * method: POST
 * headers:
 *   Content-Type: application/json
 *   Authorization: Bearer ${SECRET_TEST}
 * body:
 *   name: $[name! ys|The name of the user]
 *   email: $[email! ys|The email of the user]
 * ```
 * `````
 *
 * In this example:
 * - `${SECRET_TEST}` references a secret for authentication
 * - `$[name! ys|...]` and `$[email! ys|...]` are required parameters that the AI will extract from the user's input
 * - The `!` marks them as required, `ys` handles YAML string escaping
 * - The descriptions after `|` help guide the AI in understanding what information to extract
 */
