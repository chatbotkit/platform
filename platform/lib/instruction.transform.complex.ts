import { isSpecialField } from '@/lib/ability.fields'
import { ActionName } from '@/lib/action.name'
import { parseText } from '@/lib/action.parse'
import debug from '@/lib/debug'
import { UserConfigError } from '@/lib/error'
import {
  BracketType,
  extractFields,
  simplifyFields,
  substituteFields,
} from '@/lib/field'
import type {
  InstructionTransformResult,
  TransformOptions,
} from '@/lib/instruction.transform.types'
import { execPrompt } from '@/lib/prompt'
import { joinWithOr } from '@/lib/string'
import { Usage } from '@/lib/usage.model'

import transformInstructionPrompt from '@/prompts/transform_instruction_v3.yaml'

export async function transformComplexInstruction(
  instruction: string,
  input: string,
  options: TransformOptions
): Promise<InstructionTransformResult | null> {
  debug(`transforming complex instruction`, {
    instruction,
    input,
    options,
  }).log('instruction.complex.transformComplexInstruction')

  const usage = new Usage()

  const { completion, tokensUsed, modelUsed } = await execPrompt(
    {
      ...transformInstructionPrompt,

      user: options.userId,

      retryTimeout: true,
    },
    {
      // provide a list of available actions to the model

      availableActions: joinWithOr(
        Object.keys(ActionName).map((key) => JSON.stringify(key))
      ),

      // provide the instruction to the model but with simplified fields that
      // are free from operands and descriptions

      instruction: simplifyFields(instruction, {
        bracketType: BracketType.all,
      }),

      // provide the input to the model

      input: typeof input === 'string' ? input : JSON.stringify(input),
    },
    {
      abortSignal: options.signal,
    }
  )

  usage.addTokens(tokensUsed, modelUsed)

  let transformedInstruction = completion.trim()

  // Apply external substitutions if provided.
  // Complex transforms use an LLM to generate the output, but external
  // substitutions can still fill remaining fields (especially special fields).

  if (options.substitutions) {
    // Extract fields that exist in the transformed instruction and apply
    // substitutions to them, filtering out special fields that should be
    // preserved for action execution.

    const substitutionsToApply = { ...options.substitutions }

    // Remove special fields from substitutions - they should be preserved
    for (const key of Object.keys(substitutionsToApply)) {
      if (isSpecialField(key)) {
        delete substitutionsToApply[key]
      }
    }

    transformedInstruction = substituteFields(
      transformedInstruction,
      substitutionsToApply,
      {
        bracketType: BracketType.square,
      }
    )

    transformedInstruction = substituteFields(
      transformedInstruction,
      substitutionsToApply,
      {
        bracketType: BracketType.curly,
      }
    )

    transformedInstruction = substituteFields(
      transformedInstruction,
      substitutionsToApply,
      {
        bracketType: BracketType.round,
      }
    )
  }

  // Clean up any remaining unfilled fields by replacing them with empty strings.
  // Special fields (SECRET_, USER_, etc.) are preserved for action execution.

  const remainingFields = {
    ...Object.fromEntries(
      extractFields(transformedInstruction, {
        bracketType: BracketType.square,
      }).map(({ name }) => [name, ''])
    ),

    ...Object.fromEntries(
      extractFields(transformedInstruction, {
        bracketType: BracketType.curly,
      })
        .filter(({ name }) => !isSpecialField(name))
        .map(({ name }) => [name, ''])
    ),
  }

  transformedInstruction = substituteFields(
    transformedInstruction,
    remainingFields,
    {
      bracketType: BracketType.square,
      validate: true,
    }
  )

  transformedInstruction = substituteFields(
    transformedInstruction,
    remainingFields,
    {
      bracketType: BracketType.curly,
      validate: true,
    }
  )

  const tokenModelObject = usage.toTokenModelObject()

  // @note complex instructions may have multiple actions, we extract the last
  // one during transformation

  const { actions } = parseText(transformedInstruction)

  const lastAction =
    actions.length > 0 ? actions[actions.length - 1] : undefined

  if (!lastAction) {
    throw new UserConfigError('No action found in complex instruction')
  }

  const result: InstructionTransformResult = {
    action: lastAction.name,
    params: lastAction.params,
    text: lastAction.text,
    usage: {
      tokensUsed: tokenModelObject.token,
      modelUsed: tokenModelObject.model,
    },
  }

  debug(`transformed complex instruction`, {
    result,
  }).log('instruction.complex.transformComplexInstruction')

  return result
}

/**
 * @manual Instruction Types
 * @index 22
 *
 * ## Complex Instructions: Multi-Action Orchestration
 *
 * Complex instructions enable sophisticated agent behaviors by combining multiple
 * action blocks with descriptive text, creating rich, context-aware workflows
 * that guide the AI agent through multi-step operations. This instruction type
 * provides the highest level of flexibility and expressiveness for advanced
 * use cases.
 *
 * ### How Complex Instructions Work
 *
 * A complex instruction is automatically detected when:
 * - Multiple action blocks are present in the instruction, or
 * - Text content exists alongside one or more action blocks
 *
 * When a complex instruction is processed, the system:
 *
 * 1. **Analyzes Structure** - Identifies all action blocks and text content
 * 2. **Simplifies Fields** - Removes operand details and descriptions from parameters
 * 3. **Invokes AI Transformation** - Uses an LLM to adapt the instruction based on user input
 * 4. **Returns Transformed Instruction** - Provides a fully contextualized instruction ready for execution
 *
 * Unlike simple instructions that use deterministic parameter substitution, complex
 * instructions leverage AI to intelligently interpret and adapt the entire instruction
 * based on the context of the user's request.
 *
 * ### Structure of Complex Instructions
 *
 * Complex instructions combine three key elements:
 *
 * **1. Descriptive Text** - Provides context and guidance
 *
 * ```
 * First, retrieve the user's profile to understand their preferences and settings.
 * This information will help personalize the response.
 * ```
 *
 * **2. Action Blocks** - Define specific operations
 *
 * ````markdown
 * ```fetch
 * GET https://api.example.com/users/${userId}
 * ```
 * ````
 *
 * **3. Sequential Flow** - Orders operations logically
 *
 * ```
 * After obtaining the profile, use the preferences to customize the content
 * generation for the user's specific interests.
 * ```
 *
 * ### AI-Powered Transformation
 *
 * Complex instructions undergo AI-powered transformation using a specialized prompt
 * template. This transformation:
 *
 * - **Contextualizes Actions** - Adapts actions based on user input context
 * - **Resolves Parameters** - Intelligently fills in parameter values
 * - **Maintains Structure** - Preserves action block syntax while adapting content
 * - **Handles Complexity** - Manages interactions between multiple actions
 *
 * The AI receives:
 * - A list of available action types (fetch, search, email, etc.)
 * - The simplified instruction with parameter placeholders
 * - The user's input or request
 *
 * It returns a fully populated instruction ready for execution.
 *
 * ### Practical Examples
 *
 * **Example 1: Multi-Step Data Processing**
 *
 * ````markdown
 * First, search our internal knowledge base for relevant information about the
 * user's query. Focus on recent updates and verified data.
 *
 * ```search/datasetId=kb-12345
 * $[searchQuery|what the user is looking for]
 * ```
 *
 * Once you have the search results, analyze them and prepare a comprehensive
 * summary that addresses the user's specific needs. Include citations and links
 * to source materials.
 *
 * ```text/model=glm-5.2
 * Based on the search results:
 * $[searchResults]
 *
 * Create a detailed summary answering: $[userQuery]
 * ```
 * ````
 *
 * **Example 2: Conditional Workflow**
 *
 * ````markdown
 * Check if the user has an existing support ticket for their issue.
 *
 * ```fetch
 * GET https://api.support.com/tickets?user=$[userId]&status=open
 * ```
 *
 * If they have an open ticket, update it with the new information. If not,
 * create a new ticket and send a confirmation email.
 *
 * ```email/to=$[userEmail]
 * Subject: Support Ticket Update
 *
 * Your ticket has been updated with the following information:
 * $[ticketDetails]
 * ```
 * ````
 *
 * **Example 3: Integration Orchestration**
 *
 * ````markdown
 * Retrieve the user's calendar events for the requested date range to check
 * their availability.
 *
 * ```fetch
 * GET https://api.calendar.com/events?start=$[startDate]&end=$[endDate]
 * Authorization: Bearer ${CALENDAR_TOKEN}
 * ```
 *
 * Based on their availability, send them recommendations for scheduling a meeting.
 * Consider their preferences for meeting times and typical schedule patterns.
 *
 * ```text/model=glm-5.2
 * Calendar events: $[calendarData]
 * User preferences: $[userPreferences]
 *
 * Suggest 3 optimal meeting times for: $[meetingPurpose]
 * ```
 *
 * Send the recommendations via email with calendar invite links.
 *
 * ```email/to=$[userEmail]/replyTo=${SUPPORT_EMAIL}
 * Subject: Meeting Time Recommendations
 *
 * $[meetingRecommendations]
 * ```
 * ````
 *
 * ### Skillset and Ability Context
 *
 * **Skillset Role:** Complex instructions enable sophisticated abilities that
 * handle nuanced, multi-step workflows. They're essential for building advanced
 * skillsets that go beyond simple command-response patterns to create truly
 * intelligent agent behaviors.
 *
 * **Ability Category:** Complex instructions support advanced capabilities:
 * - **Multi-Step Workflows** - Orchestrating sequences of operations
 * - **Conditional Logic** - Adapting behavior based on intermediate results
 * - **Data Transformation Pipelines** - Processing data through multiple stages
 * - **Integration Choreography** - Coordinating multiple service interactions
 * - **Context-Aware Operations** - Leveraging conversational context throughout the workflow
 *
 * ### Parameter Handling
 *
 * Complex instructions support all three field bracket types, but handle them
 * differently than simple instructions:
 *
 * - **Field Simplification** - Parameter descriptions and operands are simplified before AI processing
 * - **AI-Driven Population** - The AI determines appropriate values based on context
 * - **Flexible Interpretation** - The AI can adapt parameter usage based on the situation
 *
 * This flexibility allows complex instructions to handle ambiguous or incomplete
 * user input more gracefully than simple instructions.
 *
 * ### Performance Considerations
 *
 * Complex instructions have different performance characteristics:
 *
 * - **Higher Token Usage** - AI transformation requires more tokens
 * - **Increased Latency** - Additional AI call adds processing time
 * - **Greater Flexibility** - Handles more varied input patterns
 * - **Enhanced Context Awareness** - Better adapts to conversational context
 *
 * **Best Practice:** Use complex instructions when the added flexibility justifies
 * the performance cost. For straightforward operations, prefer simple instructions.
 *
 * ### Best Practices
 *
 * 1. **Provide Clear Context** - Text descriptions guide AI interpretation
 * 2. **Order Actions Logically** - Structure flows from general to specific
 * 3. **Explain Dependencies** - Clarify how actions relate to each other
 * 4. **Use Descriptive Variables** - Help AI understand parameter purposes
 * 5. **Consider Token Efficiency** - Balance detail with brevity
 * 6. **Test with Varied Input** - Verify AI handles different phrasings
 * 7. **Document Expectations** - Include notes about expected behavior
 *
 * ### When to Use Complex Instructions
 *
 * Choose complex instructions when:
 * - Multiple actions need to work together sequentially
 * - Context and explanation enhance agent understanding
 * - Conditional logic or decision-making is required
 * - The workflow adapts based on intermediate results
 * - Rich, natural language guidance adds value
 *
 * Avoid complex instructions when:
 * - A single action suffices (use simple instructions)
 * - A standard pattern exists (use template instructions)
 * - Token efficiency is critical
 * - Deterministic behavior is required
 *
 * **Warning:** Complex instructions rely on AI transformation, which can
 * introduce variability in behavior. For critical operations requiring
 * consistent, predictable behavior, consider using simple or template instructions.
 */
