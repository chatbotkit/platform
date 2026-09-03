import type { Conversation } from '@/prisma/types'

/**
 * Conversation "apps" that represent autonomous agent runs (triggers, scheduled
 * tasks) rather than a conversation with a human on the other side.
 *
 * Idle-driven integrations that exist to capture contact details or summarise
 * human chats (support, extract) must not run on these: there is no real
 * person, so the contact extractor hallucinates placeholder details (e.g.
 * "Daily Trigger" <daily_trigger@example.com>) and attaches a bogus contact to
 * the conversation - one per run.
 */
export const AUTONOMOUS_CONVERSATION_APPS = new Set(['trigger', 'task'])

/**
 * Returns true when the conversation was created by an autonomous agent run
 * (e.g. a trigger or a task) and therefore has no human counterpart.
 */
export function isAutonomousConversation(
  conversation: Pick<Conversation, 'meta'>
): boolean {
  const app = (conversation.meta as { app?: string } | null | undefined)?.app

  return app ? AUTONOMOUS_CONVERSATION_APPS.has(app) : false
}
