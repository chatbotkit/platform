import { type ParsedMail, simpleParser } from 'mailparser'

/**
 * Parses an email message and returns a structured representation.
 */
export async function parseMessage(
  message: string | Buffer
): Promise<ParsedMail> {
  return await simpleParser(message)
}
