import debug from '@/lib/debug'

/**
 * BASE I/O DETAILS
 */
interface BaseInputDetails {
  backstory?: string | null
  model?: string | null
  datasetId?: string | null
  skillsetId?: string | null
  privacy?: boolean | null
  moderation?: boolean | null
}

interface BaseOutputDetails {
  backstory?: string
  model?: string
  datasetId?: string
  skillsetId?: string
  privacy?: boolean
  moderation?: boolean
}

/**
 * INPUT DETAILS
 *
 * @note the id field is required to avoid some types of bugs
 */
interface BotInputDetails extends BaseInputDetails {
  id: string
}

/**
 * @note the bot field is required to avoid some types of bugs
 */
interface InputDetails extends BaseInputDetails {
  bot?: BotInputDetails | null
}

/**
 * OUTPUT DETAILS
 */
interface OutputDetails extends BaseOutputDetails {
  botId?: string
}

/**
 * Retrieves the conversation details from the input.
 */
export function getConversationDetails(details: InputDetails): OutputDetails {
  const {
    backstory,

    model,

    datasetId,
    skillsetId,

    privacy,
    moderation,

    // pulled-in resources

    bot,
  } = details

  debug(`getting conversation details`, { details })

  let response

  if (bot?.id) {
    response = {
      botId: bot.id,
    }
  } else {
    response = {
      backstory: backstory ?? undefined,

      model: model ?? undefined,

      datasetId: datasetId ?? undefined,
      skillsetId: skillsetId ?? undefined,

      privacy: privacy ?? undefined,
      moderation: moderation ?? undefined,
    }
  }

  debug(`conversation details`, { response })

  return response
}

/**
 * Retrieves the conversation details from the input, giving precedence to the
 * bot's details.
 *
 * NOTE: keep in mind that we use nullish coalescing (??) so if the field is set
 * to null it will continue to the next precedence level - this is not true for
 * other falsy values like empty string or false
 */
export function getConversationDetailsWithReversedPrecedence(
  details: InputDetails
): OutputDetails {
  const {
    backstory,

    model,

    datasetId,
    skillsetId,

    privacy,
    moderation,

    // pulled-in resources

    bot,
  } = details

  const response = {
    backstory: backstory ?? bot?.backstory ?? undefined,

    model: model ?? bot?.model ?? undefined,

    datasetId: datasetId ?? bot?.datasetId ?? undefined,
    skillsetId: skillsetId ?? bot?.skillsetId ?? undefined,

    privacy: privacy ?? bot?.privacy ?? undefined,
    moderation: moderation ?? bot?.moderation ?? undefined,
  }

  debug(`conversation details`, { response })

  return response
}

type ConversationField =
  | 'backstory'
  | 'model'
  | 'botId'
  | 'datasetId'
  | 'skillsetId'
  | 'privacy'
  | 'moderation'

/**
 * Retrieves a field from the conversation details first by checking the bot
 * details, then the main details.
 *
 * NOTE: keep in mind that we use nullish coalescing (??) so if the field is set
 * to null it will continue to the next precedence level - this is not true for
 * other falsy values like empty string or false
 */
export function getConversationDetailsField<T = unknown>(
  details: InputDetails,
  field: ConversationField,
  defaultValue: T | null = null
): T | null {
  return (
    details.bot?.[field === 'botId' ? 'id' : field] ??
    details[field] ??
    defaultValue
  )
}

/**
 * Retrieves a field from the conversation details first by checking the main
 * details, then the bot details.
 *
 * NOTE: keep in mind that we use nullish coalescing (??) so if the field is set
 * to null it will continue to the next precedence level - this is not true for
 * other falsy values like empty string or false
 */
export function getConversationDetailsFieldWithReversedPrecedence<T = unknown>(
  details: InputDetails,
  field: ConversationField,
  defaultValue: T | null = null
): T | null {
  return (
    details[field] ??
    details.bot?.[field === 'botId' ? 'id' : field] ??
    defaultValue
  )
}
