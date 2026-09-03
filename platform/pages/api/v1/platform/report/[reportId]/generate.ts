import { captureException } from '@/lib/error'
import { getHeader } from '@/lib/header'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { registry } from '@/lib/report'
import { badRequest, internalServerError, notFound, ok, respondFromError } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /platform/report/{reportId}/generate:
 *   post:
 *     operationId: generatePlatformReport
 *     summary: Generate a specific report
 *     description: |
 *       Generates a report based on the specified report ID and input
 *       parameters.
 *     tags:
 *       - Platform
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           description: The ID of the report to generate
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Input parameters specific to the report type
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: The report was generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: Report output data specific to the report type
 *       404:
 *         description: Report not found
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const reportId = requiredUrlParam(req, 'reportId')

    const report = registry[reportId]

    if (!report) {
      return notFound()
    }

    let body: unknown

    try {
      const contentType = getHeader(req, 'content-type')

      if (contentType?.includes('application/json')) {
        body = await req.json()
      } else {
        body = {}
      }
    } catch {
      return badRequest('Invalid JSON in request body')
    }

    let validatedInput: unknown

    try {
      validatedInput = await report.input.parseAsync(body)
    } catch (error) {
      return respondFromError(error)
    }

    try {
      const result = await report.handler(session, validatedInput)

      const validatedOutput = await report.output.parseAsync(result)

      return ok(validatedOutput)
    } catch (error) {
      await captureException(error)

      return internalServerError()
    }
  })
)

/**
 * @manual Reports
 * @description Analytics reports provide comprehensive insights into your platform usage, including metrics on conversations, messages, ratings, contacts, and agent activities across customizable time periods.
 * @category Analytics
 * @tags reports, analytics, metrics
 * @index 1
 *
 * Reports are powerful analytics tools that help you understand how your
 * conversational AI applications are performing. They provide detailed metrics
 * and insights across various aspects of your platform usage, from user
 * engagement to bot performance.
 *
 * ## Generating Reports
 *
 * To generate a report, you need to make a POST request to the report endpoint
 * with the specific report ID you want to retrieve. Each report has unique
 * input requirements and generates structured output data tailored to the
 * metric being analyzed.
 *
 * Reports are identified by their unique report ID, which you can discover by
 * listing all available reports. Each report processes your request based on
 * the input parameters you provide and returns comprehensive analytics data
 * including current values, historical comparisons, and time-series breakdowns
 * where applicable.
 *
 * ```http
 * POST /api/v1/platform/report/{reportId}/generate
 * Content-Type: application/json
 *
 * {
 *   "periodDays": 30
 * }
 * ```
 *
 * Most reports accept a `periodDays` parameter that allows you to specify the
 * time window for the analysis. This parameter defaults to 30 days if not
 * provided, giving you flexibility to analyze trends over different time
 * periods such as weekly (7 days), monthly (30 days), quarterly (90 days), or
 * custom durations.
 *
 * ## Understanding Report Output
 *
 * Report responses typically include several key components that help you
 * understand both current performance and trends over time. The `value` field
 * represents the current metric for the specified period, while the `change`
 * field shows the difference compared to the previous equivalent period,
 * helping you identify growth or decline patterns.
 *
 * Many reports also include a `breakdown` array that provides day-by-day data
 * points within your specified period. This granular data enables you to create
 * visualizations, identify patterns, and understand how metrics fluctuate over
 * time rather than just seeing aggregate totals.
 *
 * ```javascript
 * {
 *   "value": 1250,
 *   "change": 180,
 *   "period": "last 30 days",
 *   "breakdown": [
 *     { "date": "2025-10-18", "total": 35 },
 *     { "date": "2025-10-19", "total": 42 },
 *     { "date": "2025-10-20", "total": 38 }
 *   ]
 * }
 * ```
 *
 * ## Report Categories
 *
 * The platform offers several categories of reports to help you analyze
 * different aspects of your conversational AI system:
 *
 * **Engagement Reports** track user interactions including total conversations,
 * active contacts, and message volumes. These metrics help you understand how
 * users are engaging with your bots and whether engagement is growing over
 * time.
 *
 * **Performance Reports** provide insights into bot behavior, including bot
 * response counts, agent actions taken, and average messages per conversation.
 * These metrics help you optimize your bot's configuration and understand its
 * operational efficiency.
 *
 * **Quality Reports** focus on user satisfaction through rating metrics,
 * including total ratings received and breakdowns of positive versus negative
 * feedback. These reports are essential for understanding user sentiment and
 * identifying areas for improvement.
 *
 * **Contact Reports** help you track your user base growth and activity levels,
 * showing both total unique contacts and active contacts within specified time
 * periods.
 *
 * ## Use Cases
 *
 * Reports can be integrated into dashboards, automated monitoring systems, or
 * business intelligence tools. For example, you might query engagement reports
 * daily to monitor platform health, track quality reports to identify declining
 * satisfaction scores, or analyze performance reports to optimize bot
 * configurations.
 *
 * By combining multiple reports, you can build a comprehensive understanding of
 * your platform's performance and make data-driven decisions about
 * improvements, scaling, and feature development.
 *
 * **Important:** Report data is calculated in real-time based on your current
 * database state, so metrics reflect the most up-to-date information available
 * at the time of the request.
 */
