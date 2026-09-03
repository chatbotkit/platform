import type { DebugConfig } from '@chatbotkit-dev/debug'

import { z } from 'zod'

// @note this deployment's debug logging configuration: which log keys are
// enabled, at which level. It is applied to @chatbotkit-dev/debug by
// `@/lib/debug`, which every call site imports, so editing this file is all it
// takes to turn a key on or off.

const env = z
  .object({
    DEBUG_KEYS: z.string().optional(),
    WARN_KEYS: z.string().optional(),
    ERROR_KEYS: z.string().optional(),
  })
  .parse(process.env)

const config: DebugConfig = {
  debug: false,
  error: false,
  warn: false,

  log: {
    debug: {
      ...Object.fromEntries(
        (env.DEBUG_KEYS || '').split(',').map((key) => [key.trim(), true])
      ),

      /**
       * Critical
       *
       * These are critical debug logs that should always be enabled in debug
       * mode.
       */

      critical: true,
      'critical.*': true,

      /**
       * Temp
       *
       * Temporary debug logs for development and debugging purposes. These
       * can be removed or disabled once the related features are stable.
       */

      temp: true,
      'temp.*': true,

      'task.*': true, // @note we want to capture all task logs for now
      'integration.*': true, // @note we want to capture all integration logs for now
      'sandbox.shell.*': true, // @note we want to capture all sandbox shell logs for monitoring

      /**
       * Event Logs
       *
       * Logs related to event handling and processing within the system. We
       * want to capture these to help diagnose issues with event flows.
       */

      event: true,
      'event.*': true,

      /**
       * Metric Logs
       *
       * Structured logs emitted for metric collection purposes. These are
       * parsed by external services (e.g. a hosted log drain) to
       * populate Prometheus metrics.
       */

      metric: true,
      'metric.*': true,

      /**
       * Common Logs
       *
       * These are common debug logs that are frequently useful for debugging
       * various parts of the system. They can be enabled in debug mode to
       * provide more visibility into system operations. Some of these are too
       * noisy for permanent inclusion.
       */

      // 'session.*': true,
      // 'log.*': true,
      // 'call.*': true,
      'prisma.retry': true,
      // 'dsd.*': true,
      // 'oauth.*': true,
      // 'oauth.token.*': true,
      // 'auxiliary.google.*': true,
      // 'auxiliary.handler': true,
      // 'auxiliary.authenticatedHandler': true,
      // 'auxiliary.multiHandler': true,
      // 'auxiliary.authenticatedMultiHandler': true,
      'auth.adapter.createUser': true, // @todo remove after 2024/10/30
      // 'context.*': true,
      // 'usage.*': true,
      // 'prompt.*': true,
      'user.instance.queue.*': true, // @todo remove after 2024/10/30
      // 'model.*': true,
      // 'model.convertTokenCount': true,
      // 'model.getBaseModelTokenCount': true,
      // 'notify.*': true,
      // 'sendgrid.*': true,
      // 'reranker.types.*': true,
      // 'fetch.*': true,
      // 'fetch.fetch': true,
      // 'fetch.getFetchError': true,
      // 'openai.*': true,
      'openai.getOpenAIError': true, // @note we want to capture all errors just in case
      // 'openai.createChatCompletionStream': true,
      // 'openai.createTranscription': true,
      // 'openai.conv.*': true,
      // 'openai.conv.detectTokenLimitError': true,
      // 'openai.conv.completeChatConversationStream': true,
      // 'record.*': true,
      // 'partner.auth.*': true,
      // 'portal.auth.*': true,
      // 'token.validateReq': true,
      // 'limits.*': true,
      // 'api.v1.conversation.*': true,
      // 'conversation.*': true,
      // 'conversation.engine.*': true,
      // 'conversation.engine.CoreEngine.*': true,
      // 'conversation.engine.CoreEngine.getMessages': true,
      // 'conversation.engine.CoreEngine.executeSkillset': true,
      // 'conversation.engine.CoreEngine.getFunctions.*': true,
      // 'space.storage.*': true,
      // 'queue.*': true,
      // 'secret.*': true,
      // 'secret.value.*': true,
      // 'secret.value.getSecretValueAndType': true,
      // 'dataset.apply.applyDataset': true,
      // 'dataset.search.searchDataset': true,
      // 'dataset.instance.queue.*': true,
      'lib.workflow.*': true, // @todo remove after 2026/02/28
      // 'instruction.*': true,
      // 'instruction.template.*': true,
      // 'instruction.structured.*': true,
      // 'skillset.*': true,
      // 'skillset.apply.*': true,
      // 'skillset.apply.applySkillset': true,
      'skillset.chunk.*': true,
      // 'ability.function.*': true,
      // 'action.filter.*': true,
      // 'action.exec.*': true,
      // 'action.exec.task.*': true,
      // 'action.exec.pack.*': true,
      // 'action.exec.fetch.*': true,
      // 'development:action.exec.fetch.*': true,
      // 'action.exec.fetch.executeFetchAction.debug': true,
      // 'action.exec.listen.*': true,
      // 'action.exec.email.*': true,
      // 'action.exec.agent.*': true,
      // 'action.exec.bot.*': true,
      // 'action.exec.bot.doBotApply': true,
      // 'action.exec.image.*': true,
      // 'action.exec.shell.*': true,
      // 'action.exec.skillset.*': true,
      // 'action.exec.mcp.*': true,
      // 'mcp.*': true,
      // 'mcp.oauth.*': true,
      // 'mcp.idp.oauth.*': true,
      // 'api.v1.integration.mcpserver.oauth.*': true,
      // 'api.v1.oauth.connection.*': true,
      // 'extract.data.*': true,
      // 'tool.environment.*': true,
      // 'task.*': true,
      // 'task.queue.*': true,
      // 'task.workflow.*': true,
      // 'task.instance.queue.*': true,
      // 'task.instance.queue.handleInteractEvent': true,
      // 'task.instance.queue.handleTriggerEvent': true,
      // 'auxiliary.skillset.ability.chatbotkit.mcp.*': true,
      // 'auxiliary.skillset.ability.notion.*': true,
      // 'auxiliary.skillset.ability.hubspot.sql.*': true,
      // 'auxiliary.skillset.ability.google.*': true,
      // 'auxiliary.skillset.ability.atlassian.*': true,
      // 'auxiliary.skillset.ability.chatbotkit.url.sql': true,
      // 'auxiliary.secret.oauth.pipedream.*': true,
      // 'integration.trigger.*': true,
      // 'integration.slack.*': true,
      // 'integration.slack.event.withAny': true,
      // 'integration.whatsapp.*': true,
      // 'integration.twilio.*': true,
      'integration.anam.*': true,
      'integration.recall.*': true,
      // 'dataset.queue.*': true,
      // 'log.*': true,
      // 'triggerIntegration.*': true,
      // 'api.v1.session.file.*': true,
      // 'channel.*': true,
      // 'channel.core.*': true,
      // 'channel.session.*': true,
      // 'app.router.app.config.*': true,
      // 'app.router.*': true,
      // 'app.router.app.config.getPublicAppConfig': true,
      // 'app.router.app.config.getUserAppConfig': true,
      // 'pages.api.v1.auth.*': true,
      // 'pages.api.v1.graphql.*': true,
    },

    error: {
      ...Object.fromEntries(
        (env.ERROR_KEYS || '').split(',').map((key) => [key.trim(), true])
      ),

      'temp.*': true,

      // @note add other error keys here as needed
    },

    warn: {
      ...Object.fromEntries(
        (env.WARN_KEYS || '').split(',').map((key) => [key.trim(), true])
      ),

      'temp.*': true,

      // @note add other warn keys here as needed
    },
  },
}

export default config
