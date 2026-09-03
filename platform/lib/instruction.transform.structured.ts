import { isSpecialField } from '@/lib/ability.fields'
import { extractFields, substituteAndTransform } from '@/lib/action.tags'
import { debug } from '@/lib/debug'
import { BotInputError } from '@/lib/error'
import { extractDataFromInput } from '@/lib/extract.data'
import type {
  InstructionTransformResult,
  TransformOptions,
} from '@/lib/instruction.transform.types'
import type { JsonSchemaObject } from '@/lib/jsonschema'
import { Usage } from '@/lib/usage.model'
import { tryParse as tryParseYaml } from '@/lib/yaml'

import pluralize from 'pluralize'

/**
 * Transforms a structured instruction by extracting fields and substituting values
 */
export async function transformStructuredInstruction(
  instruction: string,
  input: string,
  options: TransformOptions
): Promise<InstructionTransformResult | null> {
  debug(`transforming structured instruction`, {
    instruction,
    input,
    options,
  }).log('instruction.structured.transformStructuredInstruction')

  const usage = new Usage()

  // Extract all expected fields from the instruction using action tags parser

  const expectedFields = extractFields(instruction)

  // @note reference fields don't have optional/default/description properties

  const nonReferenceFields = expectedFields.filter(
    (field) => field.type !== 'reference'
  )

  // Filter all required fields (optional: false means required)

  const requiredFields = nonReferenceFields.filter(({ optional }) => !optional)

  debug(`fields`, { expectedFields, nonReferenceFields, requiredFields }).log(
    'instruction.structured.transformStructuredInstruction'
  )

  // Parse the input fields that will be used to substitute the instruction

  let inputFields: Record<string, unknown> = (tryParseYaml(input) ||
    {}) as Record<string, unknown>

  if (typeof inputFields !== 'object') {
    inputFields = {} as Record<string, unknown>
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

  // Add default values for the fields that are missing but have defaults

  for (const field of nonReferenceFields) {
    if (!inputFields.hasOwnProperty(field.name)) {
      if (field.default !== undefined) {
        inputFields[field.name] = field.default
      }
    }
  }

  // Find all missing fields that are required

  const requiredMissingFields = requiredFields.filter(
    ({ name }) => !inputFields.hasOwnProperty(name)
  )

  // If there are missing fields then we must try to extract them using llm

  if (requiredMissingFields.length) {
    // @todo extract in common function to be shared with other modules

    debug(`missing fields found`, {
      requiredMissingFields,
    }).log('instruction.structured.transformStructuredInstruction')

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

    const inputSchema: JsonSchemaObject = {
      type: 'object',
      properties: Object.fromEntries(
        requiredMissingFields.map((field) => {
          // @note use the field's actual type for proper LLM extraction so
          // array fields receive arrays rather than strings from the LLM

          if (field.type === 'array') {
            return [
              field.name,
              {
                type: 'array' as const,
                items: { type: 'string' as const },
                description: field.description || undefined,
              },
            ]
          }

          const scalarType =
            field.type === 'number'
              ? ('number' as const)
              : field.type === 'boolean'
                ? ('boolean' as const)
                : ('string' as const)

          return [
            field.name,
            {
              type: scalarType,
              description: field.description || undefined,
            },
          ]
        })
      ),
      required: requiredMissingFields.map((f) => f.name),
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

    // @note if LLM doesn't provide values for missing required fields, set them to empty string
    // this prevents substituteFields from throwing for required fields without values

    for (const field of requiredMissingFields) {
      if (!inputFields.hasOwnProperty(field.name)) {
        inputFields[field.name] = ''
      }
    }

    usage.addUsage(extractUsage)
  } else {
    debug(`no missing fields found`).log(
      'instruction.structured.transformStructuredInstruction'
    )
  }

  // Process substitutions:
  // 1. Special fields (matching isSpecialField) go to referenceValues (3rd param)
  // 2. Non-special fields override inputFields

  const referenceValues: Record<string, unknown> = {}

  if (options.substitutions) {
    for (const [name, value] of Object.entries(options.substitutions)) {
      if (isSpecialField(name)) {
        // @note special fields are passed as referenceValues (3rd parameter)
        referenceValues[name] = value
      } else {
        // @note non-special fields override input values
        inputFields[name] = value
      }
    }
  }

  // Substitute field tags with their resolved values
  // First try substituteAndTransform which returns action components directly

  const transformResult = substituteAndTransform(
    instruction,
    inputFields,
    referenceValues
  )

  const tokenModelObject = usage.toTokenModelObject()

  if (transformResult) {
    // @note substituteAndTransform returns action components directly for action tags

    const result: InstructionTransformResult = {
      action: transformResult.action,
      params: transformResult.params,
      text: transformResult.text,
      usage: {
        tokensUsed: tokenModelObject.token,
        modelUsed: tokenModelObject.model,
      },
    }

    debug(`transformed structured instruction via substituteAndTransform`, {
      result,
    }).log('instruction.structured.transformStructuredInstruction')

    return result
  }

  // @note no action tag found - return null and let caller handle it

  debug(`no action tag found in structured instruction, returning null`).log(
    'instruction.structured.transformStructuredInstruction'
  )

  return null
}

/**
 * @manual Instruction Types
 * @index 24
 *
 * ## Structured Instructions: Typed YAML Schemas
 *
 * Structured instructions describe a single action using an explicit, typed YAML
 * schema. Where a simple instruction relies on inline placeholder notation, a
 * structured instruction declares each parameter as a typed field with its own
 * name, type, description, and defaults. This gives you strict typing, nested
 * request bodies, and reliable AI extraction for missing values without the cost
 * or variability of a full complex (LLM-rewritten) transform.
 *
 * ### How Structured Instructions Work
 *
 * A structured instruction is a YAML document whose root is an action tag - a
 * `!action` such as `!fetch`, `!image.edit`, or `!skillset.install` - or an object
 * with an `action` key that resolves to one. Individual values inside the document
 * are declared as typed fields using YAML tags.
 *
 * ### Field Type Tags
 *
 * Each parameter is declared with a YAML tag that fixes its type:
 *
 * | Tag                 | Resolves to                                                        |
 * | ------------------- | ------------------------------------------------------------------ |
 * | `!string`           | A text value.                                                      |
 * | `!number`           | A numeric value.                                                   |
 * | `!boolean`          | A `true`/`false` value.                                            |
 * | `!array`            | A list of values, described by an `items` definition.             |
 * | `!object`           | A nested object, described by a `properties` map.                 |
 * | `!reference NAME`   | An engine-resolved special value such as `CONVERSATION_ID`.        |
 *
 * ### Field Properties
 *
 * A field tag is followed by a small map of properties that describe it:
 *
 * - **name** - The parameter key matched against user input, template params, and substitutions. Required on top-level fields.
 * - **description** - Guides AI extraction when the value is missing from input.
 * - **optional** - Defaults to `false`. Set `optional: true` to make the field optional.
 * - **default** - The value used when the field is absent from input.
 * - **enum** - Restricts a `!string` or `!number` field to a fixed set of allowed values.
 * - **min** / **max** - Numeric or length bounds for `!string` and `!number` fields.
 * - **items** - The element definition for an `!array` field.
 * - **properties** - The nested field map for an `!object` field.
 * - **transform** - String post-processing for `!string` fields: `lower`, `upper`, `trim`, or `urlencode`.
 *
 * ### Required, Optional, and Default Values
 *
 * Fields are **required by default** - omitting `optional` keeps the field
 * required. Requiredness is controlled entirely by the `optional` property:
 *
 * - `optional: true` marks a field as optional; when it has no value it is omitted from the output
 * - A required field that declares a `default` never triggers AI extraction - the default fills it
 * - Explicit input values win over defaults, including falsy values like `false`, `0`, and empty strings
 *
 * ### Reference Fields and Injection Safety
 *
 * Special fields are declared with `!reference`, for example:
 *
 * ```yaml
 * ...
 * conversationId: !reference CONVERSATION_ID
 * userId: !reference USER_ID
 * ...
 * ```
 *
 * Reference fields can only be filled by engine-level substitutions - never from
 * user input or template params. Until they are substituted they render as
 * `${CONVERSATION_ID}` style placeholders. This prevents a user from supplying a
 * value for a privileged field through ordinary input.
 *
 * ### Resolution Order
 *
 * When the same field is provided from multiple sources, later sources win:
 *
 * ```
 * input values  <  template params  <  engine substitutions
 * ```
 *
 * Reference (special) fields ignore input and template params entirely and are
 * filled only by engine substitutions.
 *
 * ### AI Extraction for Missing Fields
 *
 * Only required fields that are missing and have no default are sent to the LLM.
 * The extraction schema preserves each field's declared type, so an `!array` field
 * is requested as an array and a `!number` field as a number, and it includes each
 * field's `description` to guide the model. When the input is empty or `{}` and a
 * required field is still missing, the system raises an input error instead of
 * calling the LLM.
 *
 * ### Practical Examples
 *
 * **Example 1: Typed Search Request**
 *
 * ```yaml
 * !fetch
 * method: GET
 * url: /api/search
 * query:
 *   q: !string
 *     name: query
 *     description: the search term
 *   limit: !number
 *     name: limit
 *     default: 20
 * ```
 *
 * The `query` field is required and, if absent from the input, is extracted from
 * natural language using its description. The `limit` field defaults to `20`, so it
 * never requires an AI call.
 *
 * **Example 2: Nested Body with a Reference and an Optional Field**
 *
 * ```yaml
 * !fetch
 * method: POST
 * url: /api/calendar/events
 * body:
 *   calendarId: !string
 *     name: calendarId
 *   summary: !string
 *     name: summary
 *     description: a short title for the event
 *   duration: !number
 *     name: duration
 *     default: 60
 *   attendees: !string
 *     name: attendees
 *     optional: true
 *   conversationId: !reference CONVERSATION_ID
 * ```
 *
 * Here `calendarId` and `summary` are required, `duration` defaults to `60`,
 * `attendees` is optional and omitted when empty, and `conversationId` is injected
 * safely from the engine.
 *
 * **Example 3: Array Field**
 *
 * ```yaml
 * !image.edit
 * model: dalle3
 * prompt: !string
 *   name: prompt
 *   description: how the image should be edited
 * images: !array
 *   name: images
 *   description: the URLs of the images to edit
 *   items:
 *     name: image_url
 *     description: a single image URL
 * ```
 *
 * Because `images` is declared as an `!array`, AI extraction returns a list of
 * strings rather than a single value.
 *
 * ### Skillset and Ability Context
 *
 * **Skillset Role:** Structured instructions sit between simple and complex
 * instructions. They describe a single action like a simple instruction, but with
 * an explicit, typed schema for every parameter. They are ideal for abilities that
 * call structured APIs with strongly-typed payloads.
 *
 * **Ability Category:** Structured instructions support capabilities that benefit
 * from strict typing and nested data:
 * - **Typed API Calls** - Requests with numeric, boolean, array, or enum parameters
 * - **Structured Payloads** - Nested request bodies and headers
 * - **Context-Aware Requests** - Conversation and user values injected via references
 *
 * ### Performance Characteristics
 *
 * Structured instructions are efficient and predictable:
 * - **Deterministic by Default** - When all fields resolve from input, defaults, or substitutions, no AI call is made and no tokens are consumed
 * - **Targeted Extraction** - When required fields are missing, a single extraction call is scoped to just those fields
 * - **Type Fidelity** - Values arrive in the correct shape because the extraction schema mirrors the declared field types
 *
 * ### Best Practices
 *
 * 1. **Give every field a clear `name`** - it is the key used for substitution
 * 2. **Add descriptions** to fields that may need AI extraction
 * 3. **Use the correct type tag** (`!number`, `!boolean`, `!array`) so values arrive in the right shape
 * 4. **Set defaults** for optional configuration to avoid unnecessary AI calls
 * 5. **Use `!reference`** for conversation or user context instead of accepting it as input
 * 6. **Mark truly optional fields** with `optional: true` so they are omitted when empty
 *
 * ### When to Use Structured Instructions
 *
 * Choose structured instructions when:
 * - A single action needs strongly-typed parameters (numbers, booleans, arrays, enums)
 * - You have nested request bodies or structured payloads
 * - You want dependable AI extraction for missing fields with minimal tokens
 * - You need conversation or user context injected safely via references
 *
 * Prefer simple instructions for plain placeholder substitution, complex
 * instructions for multi-step text-and-action workflows, and template instructions
 * for reusable catalog patterns.
 */
