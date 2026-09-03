import { roundToNearest } from '@chatbotkit-dev/math'

// Default maximum number of records to include in the bot response upon a
// search request. This means that if 10 records are found, only the first 5
// will be included in the response.

export const maxSearchRecords = 10

// Default maximum number of tokens for each record, rounded to the nearest 16
// tokens for consistency.

export const maxTokens = 768

// Default number of tokens that can overlap between records. This option cannot
// be adjusted by the user.

export const overlapTokens = roundToNearest(Math.max(64, maxTokens / 10), 16)
