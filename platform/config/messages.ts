// User-facing message strings shared across integrations.

export interface Messages {
  limitsReachedReply: string
}

const messages: Messages = {
  // Posted to a messaging channel when the account is over its usage limits,
  // so the end user gets a visible reply instead of silence.
  limitsReachedReply:
    "Sorry, this assistant has reached its usage limit and can't respond right now. Please try again later.",
}

export default messages
