/**
 * Return true of the bot name matches known model names, such as GPT, Claude,
 * Sonar, etc.
 */
export function isModelBot(bot: { name?: string }): boolean {
  return /gpt|claude|sonar|deepseek|llama|gemini|mistral|^o\d-|^o\d$/i.test(
    bot.name || ''
  )
}
