/* eslint-disable custom-eslint-rules/no-plain-fetch-in-routes -- self (platform local host URL) */
// @ts-check
import { fetch } from '@/lib/fetch'

import { getExternalHostURL, getLocalHostURL } from '@/lib/host'
import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { SafeJson } from '@/lib/struct'

import examplesData from '@/examples'

/**
 * @swagger
 *
 * /platform/example/{exampleId}/fetch:
 *   get:
 *     operationId: fetchPlatformExample
 *     summary: Fetch a specific platform example with full details
 *     tags:
 *       - Platform
 *     parameters:
 *       - in: path
 *         name: exampleId
 *         required: true
 *         schema:
 *           description: The ID (slug) of the example
 *           type: string
 *     responses:
 *       200:
 *         description: The example was fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID (slug) of the example
 *                   type: string
 *                 name:
 *                   description: The name of the example
 *                   type: string
 *                 description:
 *                   description: The description of the example
 *                   type: string
 *                 type:
 *                   description: The type of the example
 *                   type: string
 *                   enum:
 *                     - blueprint
 *                     - project
 *                     - widget
 *                     - slack
 *                     - discord
 *                     - whatsapp
 *                     - messenger
 *                     - telegram
 *                     - twilio
 *                     - email
 *                     - trigger
 *                 config:
 *                   description: The full configuration details of the example
 *                   type: object
 *                   properties: {}
 *                   additionalProperties: true
 *                 link:
 *                   description: The URL to the official example page
 *                   type: string
 *                 tags:
 *                   description: Tags associated with the example
 *                   type: array
 *                   items:
 *                     type: string
 *                 createdAt:
 *                   description: The creation timestamp
 *                   type: number
 *                 updatedAt:
 *                   description: The last update timestamp
 *                   type: number
 *               required:
 *                 - id
 *                 - name
 *                 - description
 *                 - type
 *                 - config
 *                 - link
 *       404:
 *         description: The example was not found
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, _session) {
    const exampleId = requiredUrlParam(req, 'exampleId')

    const example = examplesData.find((ex) => ex.slug === exampleId)

    if (!example) {
      return notFound()
    }

    const isBlueprint = example.blueprint !== undefined
    const isProject = Array.isArray(example.files)

    let files = example.files || []

    if (isProject && example.url && example.url.includes('github.com')) {
      try {
        const filesUrl = getLocalHostURL(`/examples/${example.slug}/files.json`)

        const response = await fetch(filesUrl)

        if (response.ok) {
          const generatedFiles = await response.json()

          if (Array.isArray(generatedFiles) && generatedFiles.length > 0) {
            files = generatedFiles
          }
        }
      } catch {
        // fall back to original files if fetch fails
      }
    }

    return ok({
      id: example.slug,

      name: example.title,
      description: example.description,

      type: isBlueprint
        ? 'blueprint'
        : isProject
          ? 'project'
          : example.integration || 'widget',

      config: isBlueprint
        ? new SafeJson({ blueprint: example.blueprint })
        : isProject
          ? { files, url: example.url }
          : {
              backstory: example.backstory || undefined,
              model: example.model || undefined,
              theme: example.theme || undefined,
            },

      tags: example.keywords,

      link: getExternalHostURL(`/examples/${example.slug}`),

      createdAt: example.date ? new Date(example.date).getTime() : Date.now(),
      updatedAt: example.date ? new Date(example.date).getTime() : Date.now(),
    })
  })
)

/**
 * @manual Platform Examples
 * @description Platform Examples provide pre-configured templates and reference implementations that demonstrate ChatBotKit capabilities, enabling rapid prototyping and learning through working code and configurations.
 * @category Platform
 * @tags examples, templates, blueprints, quickstart
 * @index 30
 *
 * Platform Examples are curated, ready-to-use templates that showcase ChatBotKit's
 * capabilities and accelerate development by providing proven implementations of
 * common use cases. Each example includes complete configuration, documentation,
 * and working code that can be deployed immediately or customized for specific
 * needs. Examples cover various categories including customer support bots,
 * integration patterns, specialized AI agents, and complete application workflows.
 *
 * Examples serve multiple purposes: they provide educational resources for learning
 * platform features, offer starting points that dramatically reduce initial
 * development time, demonstrate best practices for bot configuration and integration,
 * and showcase advanced capabilities that might not be immediately obvious from
 * API documentation alone.
 *
 * ## Fetching a Specific Example
 *
 * Retrieve detailed configuration and implementation information for a specific
 * platform example. This endpoint provides the complete example specification
 * including its configuration, type, associated resources, and documentation
 * links, enabling programmatic access to example templates for automated
 * deployment or inspection.
 *
 * ```http
 * GET /api/v1/platform/example/{exampleId}/fetch
 * ```
 *
 * ### Example Types and Configurations
 *
 * **Blueprint Examples**: These examples include complete blueprint configurations
 * that bundle bots, datasets, skillsets, and other resources into deployable
 * packages. Blueprint examples are ideal for deploying comprehensive solutions
 * like customer support systems, knowledge base assistants, or multi-capability
 * agent workflows. The `config.blueprint` object contains the full blueprint
 * specification ready for instantiation.
 *
 * **Project Examples**: Project-based examples include full application code,
 * typically as downloadable file collections. These demonstrate integration
 * patterns, custom UI implementations, or complete application architectures.
 * The `config.files` array contains source code, configuration files, and
 * documentation, while `config.url` points to repository or deployment resources.
 *
 * **Widget Examples**: Widget examples focus on chat interface integrations for
 * websites and applications. They include pre-configured bot settings optimized
 * for specific use cases, with `config.backstory` defining bot behavior,
 * `config.model` specifying the AI model, and `config.theme` customizing visual
 * appearance. These examples are perfect for quick website chat deployments.
 *
 * **Integration Examples**: These demonstrate connections with external platforms
 * like Slack, Discord, WhatsApp, Email, and other communication channels. Each
 * integration example includes the specific configuration needed for that
 * platform, authentication setup guidance, and best practices for channel-specific
 * features and limitations.
 *
 * ### Practical Usage Patterns
 *
 * **Example Instantiation Workflow**:
 * ```javascript
 * // Fetch example details
 * const response = await fetch('/api/v1/platform/example/customer-support-bot/fetch');
 * const example = await response.json();
 *
 * // For blueprint examples, deploy directly
 * if (example.type === 'blueprint') {
 *   const deployment = await fetch('/api/v1/blueprint/create', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({
 *       name: `My ${example.name}`,
 *       description: example.description,
 *       ...example.config.blueprint
 *     })
 *   });
 * }
 *
 * // For widget examples, create bot with example configuration
 * if (example.type === 'widget') {
 *   const bot = await fetch('/api/v1/bot/create', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({
 *       name: example.name,
 *       description: example.description,
 *       backstory: example.config.backstory,
 *       model: example.config.model
 *     })
 *   });
 * }
 * ```
 *
 * **Example Catalog Building**:
 * ```javascript
 * // Build a searchable example catalog
 * const exampleIds = ['customer-support', 'lead-qualification', 'knowledge-base'];
 * const catalog = await Promise.all(
 *   exampleIds.map(async (id) => {
 *     const response = await fetch(`/api/v1/platform/example/${id}/fetch`);
 *     return await response.json();
 *   })
 * );
 *
 * // Filter by tags
 * const supportExamples = catalog.filter(ex =>
 *   ex.tags.includes('customer-support')
 * );
 * ```
 *
 * ### Example Discovery and Selection
 *
 * **Tag-Based Organization**: Examples include descriptive tags that categorize
 * functionality, use cases, and technical characteristics. Common tags include
 * industry verticals (healthcare, finance, education), use cases (support,
 * sales, documentation), integration types (slack, discord, api), and technical
 * features (nlp, rag, functions).
 *
 * **Link to Official Documentation**: Each example includes a `link` field
 * pointing to comprehensive documentation on chatbotkit.com. This documentation
 * provides detailed setup instructions, customization guides, video walkthroughs,
 * and community discussions. Always review the official documentation before
 * deploying examples to production.
 *
 * **Version and Update Information**: The `createdAt` and `updatedAt` timestamps
 * indicate when examples were published or last revised. More recent examples
 * often incorporate improved practices and newer platform features. Check these
 * dates when evaluating multiple examples for similar use cases.
 *
 * ### Customization and Extension
 *
 * Examples are designed as starting points for customization rather than
 * production-ready deployments. After fetching an example, review its
 * configuration and adapt it to your specific requirements:
 *
 * - **Backstory Refinement**: Customize bot instructions to match your brand
 *   voice, domain expertise, and specific use case requirements
 * - **Model Selection**: Choose AI models that balance performance, cost, and
 *   latency for your application's needs
 * - **Resource Integration**: Link examples to your datasets, skillsets, and
 *   other platform resources to provide domain-specific knowledge and capabilities
 * - **Security Configuration**: Add authentication, rate limiting, and access
 *   controls appropriate for your security requirements
 * - **Monitoring Setup**: Implement logging, analytics, and alerting to track
 *   example performance in your environment
 *
 * ### Best Practices for Example Usage
 *
 * **Testing Before Deployment**: Always test example configurations in development
 * environments before production deployment. Examples demonstrate capabilities
 * but may require tuning for specific use cases and traffic patterns.
 *
 * **Documentation Review**: Read the linked official documentation thoroughly
 * to understand example limitations, dependencies, and configuration options.
 * Examples may have prerequisites or special setup requirements.
 *
 * **Customization Planning**: Treat examples as educational templates rather
 * than turnkey solutions. Successful deployments typically involve significant
 * customization to match specific business requirements and user expectations.
 *
 * **Version Awareness**: Examples reflect platform capabilities at their creation
 * time. Newer platform features may offer better approaches than older examples.
 * Consider consulting updated documentation when working with older examples.
 *
 * **Important Note**: Example configurations are simplified for demonstration
 * purposes and may not include all security, performance, and reliability
 * features required for production deployments. Always enhance examples with
 * appropriate error handling, monitoring, and security measures before production
 * use.
 */
