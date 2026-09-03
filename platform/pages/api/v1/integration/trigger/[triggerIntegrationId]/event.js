// @ts-check
import prisma from '@/prisma/client'

import debug from '@/lib/debug'
import { getHeader } from '@/lib/header'
import { withAny } from '@/lib/method'
import { queryParam, requiredUrlParam } from '@/lib/query.get'
import { notAuthenticated, notFound, ok } from '@/lib/response'

import {
  INTERACT_EVENT_TYPE,
  sendEvent,
} from '@/pages/api/v1/integration/trigger/[triggerIntegrationId]/queue'

export default withAny(async function (req) {
  const triggerIntegrationId = requiredUrlParam(req, 'triggerIntegrationId')

  let body

  if (req.method === 'GET') {
    body = ''
  } else {
    body = await req.text()
  }

  const triggerIntegration = await prisma.triggerIntegration.findUnique({
    where: {
      id: triggerIntegrationId,
    },
  })

  if (!triggerIntegration) {
    return notFound()
  }

  debug(`received event`, { body })

  if (triggerIntegration.authenticate) {
    let authenticated = false

    // basic auth
    {
      if (!authenticated) {
        const authorization = getHeader(req, 'authorization')

        if (authorization === `Bearer ${triggerIntegration.secret}`) {
          authenticated = true
        }
      }
    }

    // url signing
    {
      if (!authenticated) {
        // @todo implement
      }
    }

    if (!authenticated) {
      return notAuthenticated()
    }
  }

  await sendEvent(triggerIntegration.id, {
    type: INTERACT_EVENT_TYPE,
    payload: {
      session: queryParam(req, 'session'),
      contact: {
        name:
          queryParam(req, 'contact.name') || queryParam(req, 'contact_name'),
        email:
          queryParam(req, 'contact.email') || queryParam(req, 'contact_email'),
        phone:
          queryParam(req, 'contact.phone') || queryParam(req, 'contact_phone'),
      },
      body: body,
    },
  })

  return ok()
})

/**
 * @manual Trigger Integration
 * @index 30
 *
 * ## Sending Events to Trigger Integrations
 *
 * The event endpoint is the primary way to send data and trigger bot execution
 * through Trigger Integrations. When you send an event to this endpoint, ChatBotKit
 * queues it for background processing, allowing your application to continue
 * immediately without waiting for the bot to complete its work. The bot processes
 * the event asynchronously, executes any configured actions through its skillsets,
 * and records all results in the conversation history for auditing and tracking.
 *
 * This endpoint is designed for maximum flexibility, accepting events via both GET
 * and POST requests, supporting optional contact information for personalized
 * interactions, and enabling session-based conversation continuity. It's the
 * cornerstone of event-driven bot workflows, agent systems, scheduled tasks, and
 * automated background processing scenarios where immediate responses aren't
 * required but reliable execution and tracking are essential.
 *
 * ### Event Endpoint URL Structure
 *
 * Each trigger integration has a unique event endpoint URL constructed from its ID:
 *
 * ```
 * https://api.chatbotkit.com/v1/integration/trigger/{triggerIntegrationId}/event
 * ```
 *
 * Replace `{triggerIntegrationId}` with your trigger's actual identifier. You can
 * obtain this ID from the response when creating the trigger or by listing your
 * trigger integrations.
 *
 * ### Sending Events via POST (Recommended)
 *
 * The recommended approach for sending events is using POST requests with a JSON
 * or text body containing the event data:
 *
 * ```http
 * POST /api/v1/integration/trigger/{triggerIntegrationId}/event
 * Content-Type: application/json
 * Authorization: Bearer your_trigger_secret
 *
 * {
 *   "order_id": "12345",
 *   "customer": "John Smith",
 *   "total": 99.99,
 *   "status": "pending"
 * }
 * ```
 *
 * The body content can be any valid text, JSON, or structured data that your bot
 * needs to process. The bot receives the entire body as context and can use it to
 * make decisions and take actions.
 *
 * ### Sending Events via GET
 *
 * For simple scenarios or when POST requests aren't feasible, you can trigger
 * events using GET requests. This is useful for webhooks from third-party services
 * that only support GET callbacks:
 *
 * ```http
 * GET /api/v1/integration/trigger/{triggerIntegrationId}/event?session=user123
 * Authorization: Bearer your_trigger_secret
 * ```
 *
 * With GET requests, the body is empty by default. Use query parameters to pass
 * session and contact information.
 *
 * ### Authentication
 *
 * If your trigger integration has authentication enabled (the `authenticate` field
 * is `true`), you must include the trigger's secret in the Authorization header:
 *
 * ```
 * Authorization: Bearer {trigger_secret}
 * ```
 *
 * The secret is provided when you create the trigger or can be retrieved using the
 * fetch endpoint. Store this secret securely - anyone with access to it can send
 * events to your trigger.
 *
 * **Security Note:** For production triggers handling sensitive data, always enable
 * authentication to prevent unauthorized event submissions. Without authentication,
 * anyone who knows your trigger ID can send events to it.
 *
 * ### Session Management and Contact Information
 *
 * The event endpoint supports optional query parameters for maintaining conversation
 * continuity and associating events with specific contacts:
 *
 * **Session Parameter:**
 *
 * ```http
 * POST /api/v1/integration/trigger/{triggerIntegrationId}/event?session=checkout_abc123
 * ```
 *
 * The `session` parameter groups related events into the same conversation, allowing
 * the bot to maintain context across multiple events. This is essential for multi-step
 * workflows where the bot needs to remember previous interactions.
 *
 * **Contact Parameters:**
 *
 * Associate events with contacts by providing contact information:
 *
 * ```http
 * POST /api/v1/integration/trigger/{triggerIntegrationId}/event?contact.name=John+Smith&contact.email=john@example.com&contact.phone=555-0123
 * ```
 *
 * Alternative parameter formats are also supported:
 *
 * ```http
 * ?contact_name=John+Smith&contact_email=john@example.com&contact_phone=555-0123
 * ```
 *
 * When contact information is provided, ChatBotKit automatically creates or updates
 * contact records, enabling personalized interactions and contact-scoped conversation
 * history. The bot can reference contact information during processing for more
 * contextual responses.
 *
 * ### Event Processing Flow
 *
 * Understanding the event processing lifecycle helps you design effective trigger-based
 * workflows:
 *
 * 1. **Event Reception**: Your application sends an event to the trigger endpoint
 * 2. **Immediate Acknowledgment**: The endpoint returns success immediately, queuing
 *    the event for background processing
 * 3. **Session Management**: ChatBotKit checks for an existing session or creates a
 *    new conversation based on the session parameter
 * 4. **Contact Resolution**: If contact information is provided, creates or updates
 *    the associated contact record
 * 5. **Bot Invocation**: The configured bot receives the event data and conversation
 *    context
 * 6. **Action Execution**: The bot processes the event, potentially executing
 *    skillset actions like API calls, database queries, or notifications
 * 7. **History Recording**: All interactions, decisions, and action results are
 *    recorded in the conversation history
 *
 * ### Response Behavior
 *
 * The event endpoint returns an immediate success response after queuing the event:
 *
 * ```json
 * {
 *   "ok": true
 * }
 * ```
 *
 * This response indicates the event was successfully queued, **not** that the bot
 * has finished processing it. The bot executes asynchronously in the background.
 * To monitor execution results, check the Conversations tab in your ChatBotKit
 * dashboard or use the conversation API to retrieve the conversation history
 * associated with the trigger integration.
 *
 * ### Practical Examples
 *
 * **Example 1: Order Processing Workflow**
 *
 * ```http
 * POST /api/v1/integration/trigger/trigger_abc123/event?session=order_12345&contact.email=customer@example.com
 * Authorization: Bearer abc123secret
 * Content-Type: application/json
 *
 * {
 *   "event": "order_created",
 *   "order_id": "12345",
 *   "amount": 149.99,
 *   "items": ["SKU-001", "SKU-042"],
 *   "shipping_address": "123 Main St, Anytown, USA"
 * }
 * ```
 *
 * The bot can process this order, validate inventory, send confirmation emails,
 * update databases, and notify fulfillment systems - all automatically in the
 * background.
 *
 * **Example 2: Scheduled Report Generation**
 *
 * ```http
 * POST /api/v1/integration/trigger/trigger_def456/event?session=daily_report
 * Authorization: Bearer def456secret
 * Content-Type: text/plain
 *
 * Generate daily sales report for 2024-01-15
 * ```
 *
 * The bot executes on schedule, retrieves sales data, generates the report, and
 * sends it to designated recipients.
 *
 * **Example 3: Simple GET-based Webhook**
 *
 * ```http
 * GET /api/v1/integration/trigger/trigger_ghi789/event?session=monitoring&contact_name=System+Monitor
 * Authorization: Bearer ghi789secret
 * ```
 *
 * Useful for health checks, monitoring systems, or third-party services that only
 * support GET webhooks.
 *
 * ### Error Handling
 *
 * The endpoint returns standard HTTP error codes for common issues:
 *
 * - **401 Unauthorized**: Authentication required but missing or invalid credentials
 * - **404 Not Found**: Trigger integration doesn't exist or has been deleted
 * - **400 Bad Request**: Malformed request or invalid parameters
 * - **500 Internal Server Error**: Server-side processing error
 *
 * Always implement retry logic with exponential backoff for transient errors,
 * especially in production systems sending high-volume events.
 *
 * ### Best Practices
 *
 * **Use Descriptive Sessions**: Name sessions based on their purpose (e.g.,
 * `user_123_checkout` or `report_2024_01`) to make conversation history easier
 * to navigate and debug.
 *
 * **Include Context in Events**: Send all relevant information in the event body
 * that the bot might need for decision-making. Avoid requiring the bot to make
 * additional API calls to retrieve basic context.
 *
 * **Monitor Conversation History**: Regularly review the conversations created by
 * your trigger to ensure the bot is processing events correctly and taking expected
 * actions.
 *
 * **Implement Idempotency**: Design your event-sending logic to handle duplicate
 * submissions gracefully, as network issues may cause retries.
 *
 * **Secure Your Secrets**: Never commit trigger secrets to version control or expose
 * them in client-side code. Use environment variables or secure configuration
 * management systems.
 *
 * **Test with Varied Payloads**: Before deploying to production, test your trigger
 * with diverse event payloads to ensure the bot handles edge cases and malformed
 * data appropriately.
 *
 * For detailed information about configuring trigger integrations and managing
 * authentication, refer to the trigger integration creation documentation.
 */
