// @ts-check
import { withAny } from '@/lib/method'
import { ok } from '@/lib/response'

export default withAny(async function (_req) {
  return ok()
})

/**
 * @manual API
 * @description The ChatBotKit REST API provides programmatic access to create, manage, and interact with conversational AI resources including bots, datasets, conversations, and more.
 * @category API
 * @tags api, rest, endpoints, http
 * @index 1
 *
 * The ChatBotKit API v1 is a comprehensive REST API that enables developers to
 * programmatically access all platform features for building conversational AI
 * applications. The API provides a consistent, action-oriented interface for
 * managing resources such as bots, datasets, conversations, skillsets, and
 * integrations.
 *
 * ## API Overview
 *
 * The API follows RESTful principles with a simplified approach that uses only
 * two HTTP methods: GET for retrieving data and POST for creating, updating,
 * and deleting resources. This design choice reduces complexity while
 * maintaining the clarity and predictability of REST architecture.
 *
 * ## Endpoint Structure
 *
 * The API organizes endpoints around resources using a consistent pattern that
 * makes navigation intuitive and predictable. Each resource type follows the
 * same structural conventions for common operations:
 *
 * - **Creating resources**: `POST /api/v1/{resource}/create`
 * - **Listing resources**: `GET /api/v1/{resource}/list`
 * - **Fetching single resource**: `GET /api/v1/{resource}/{id}/fetch`
 * - **Updating resources**: `POST /api/v1/{resource}/{id}/update`
 * - **Deleting resources**: `POST /api/v1/{resource}/{id}/delete`
 *
 * For nested resources that belong to a parent resource, the API uses nested
 * paths. For example, conversation messages follow this pattern:
 *
 * - `POST /api/v1/conversation/{conversationId}/message/create`
 * - `GET /api/v1/conversation/{conversationId}/message/list`
 * - `GET /api/v1/conversation/{conversationId}/message/{messageId}/fetch`
 *
 * This consistent structure means that once you understand how to work with one
 * resource type, you can apply the same patterns to all other resources in the
 * API.
 *
 * ## Request Format
 *
 * All POST requests to the API should include a `Content-Type` header set to
 * `application/json` and provide request data as a JSON-formatted body. The API
 * validates all input using comprehensive schemas that check data types,
 * required fields, and value constraints.
 *
 * ```http
 * POST /api/v1/dataset/create
 * Authorization: Bearer sk-your-secret-key-here
 * Content-Type: application/json
 *
 * {
 *   "name": "Customer Support KB",
 *   "description": "Knowledge base for customer support",
 *   "visibility": "private"
 * }
 * ```
 *
 * GET requests use query parameters for filtering, pagination, and sorting:
 *
 * ```http
 * GET /api/v1/dataset/list?cursor=next-page-token&order=desc&limit=25
 * Authorization: Bearer sk-your-secret-key-here
 * ```
 *
 * ## Response Format
 *
 * The API returns JSON responses for all operations with a consistent structure
 * that includes the requested data and metadata. Successful responses use HTTP
 * status code 200 and include the result in the response body:
 *
 * ```json
 * {
 *   "id": "dataset-id-here",
 *   "name": "Customer Support KB",
 *   "description": "Knowledge base for customer support",
 *   "visibility": "private",
 *   "createdAt": 1732579200000
 * }
 * ```
 *
 * List operations return paginated results with cursor-based navigation:
 *
 * ```json
 * {
 *   "items": [
 *     { "id": "item-1", "name": "First Item" },
 *     { "id": "item-2", "name": "Second Item" }
 *   ],
 *   "cursor": "next-page-cursor-token"
 * }
 * ```
 *
 * Error responses include descriptive messages and use appropriate HTTP status
 * codes to indicate the type of error encountered:
 *
 * ```json
 * {
 *   "error": {
 *     "message": "Dataset not found",
 *     "code": "NOT_FOUND"
 *   }
 * }
 * ```
 *
 * ## Error Handling
 *
 * The API uses standard HTTP status codes to indicate the outcome of requests:
 *
 * - **200 OK**: Request succeeded
 * - **400 Bad Request**: Invalid request parameters or body
 * - **401 Unauthorized**: Missing or invalid authentication credentials
 * - **403 Forbidden**: Authenticated but lacking permission for the resource
 * - **404 Not Found**: Requested resource does not exist
 * - **429 Too Many Requests**: Rate limit exceeded
 * - **500 Internal Server Error**: Unexpected server error
 *
 * Error responses include detailed information in the response body to help
 * diagnose and resolve issues. Always check both the status code and the error
 * message when handling failures.
 *
 * ## Getting Started
 *
 * To begin using the API:
 *
 * 1. **Obtain API credentials**: Generate a secret key from the ChatBotKit
 *    dashboard under your account settings
 * 2. **Choose a resource**: Identify which resource type you need to work with
 *    (bots, datasets, conversations, etc.)
 * 3. **Make your first request**: Start with a simple list operation to verify
 *    your authentication works
 * 4. **Build your integration**: Use the consistent endpoint patterns to
 *    implement the functionality you need
 *
 * For detailed examples, code samples, and integration guides, refer to the
 * specific manual sections for each resource type and the platform SDKs
 * available for Node.js, React, and Next.js.
 *
 * ## API Versions
 *
 * The current API version is v1, indicated by the `/api/v1/` prefix in all
 * endpoint URLs. The API maintains backward compatibility within major versions,
 * meaning existing integrations will continue to work as new features are added.
 * Any breaking changes will be introduced in a new major version (e.g., v2)
 * with a transition period to migrate existing integrations.
 *
 * **Important**: Always use versioned endpoints in production applications to
 * ensure stability and predictable behavior. Avoid using unversioned endpoints,
 * as they may change without notice.
 */
