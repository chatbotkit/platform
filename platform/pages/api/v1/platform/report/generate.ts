import { getHeader } from '@/lib/header'
import { withPost } from '@/lib/method'
import { registry } from '@/lib/report'
import { badRequest, captureUnknownException, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /platform/report/generate:
 *   post:
 *     operationId: generatePlatformReports
 *     summary: Generate multiple reports
 *     description: |
 *       Generates multiple reports in a single request. Input is a map where
 *       each key is a report ID and each value contains the input parameters
 *       for that report. Returns a map with the same keys containing the
 *       corresponding report outputs.
 *     tags:
 *       - Platform
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Map of report IDs to their input parameters
 *             additionalProperties:
 *               type: object
 *               description: Input parameters specific to the report type
 *           example:
 *             clr3m5n8k000008jq7h9e5b1a:
 *               periodDays: 30
 *             clr3m5n8k000108jq7h9e5b1b:
 *               periodDays: 7
 *     responses:
 *       200:
 *         description: The reports were generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: Map of report IDs to their output data or error
 *               additionalProperties:
 *                 oneOf:
 *                   - type: object
 *                     description: Successful report output data
 *                   - type: object
 *                     properties:
 *                       error:
 *                         type: string
 *                         description: Error message if report generation failed
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    let body: Record<string, unknown>

    try {
      const contentType = getHeader(req, 'content-type')

      if (contentType?.includes('application/json')) {
        body = await req.json()
      } else {
        body = {}
      }

      if (typeof body !== 'object' || body === null || Array.isArray(body)) {
        return badRequest('Request body must be an object')
      }
    } catch {
      return badRequest('Invalid JSON in request body')
    }

    const reportPromises = Object.entries(body).map(
      async ([reportId, inputData]) => {
        const report = registry[reportId]

        if (!report) {
          return [reportId, { error: 'Report not found' }] as const
        }

        try {
          const validatedInput = await report.input.parseAsync(inputData)

          const result = await report.handler(session, validatedInput)

          const validatedOutput = await report.output.parseAsync(result)

          return [reportId, validatedOutput] as const
        } catch (error) {
          // @note route through captureUnknownException so expected per-report
          // failures (NOT_FOUND, BAD_REQUEST, rate limits, timeouts) are
          // returned to the caller without being reported to Sentry as bugs
          await captureUnknownException(error)

          if (error instanceof Error) {
            return [reportId, { error: error.message }] as const
          } else {
            return [reportId, { error: 'Unknown error occurred' }] as const
          }
        }
      }
    )

    const reportResults = await Promise.all(reportPromises)

    const results = Object.fromEntries(reportResults)

    return ok(results)
  })
)

/**
 * @manual Reports
 * @index 10
 *
 * Reports are powerful analytical tools that transform your platform's raw
 * activity data into meaningful insights. Each report is designed to answer
 * specific questions about your usage patterns, performance metrics, or
 * resource consumption, helping you understand trends, optimize operations,
 * and demonstrate value.
 *
 * ## Generating Reports
 *
 * The report generation endpoint allows you to request multiple reports in
 * a single API call. Each report is identified by a unique report ID, and
 * you provide the necessary input parameters for that specific report type.
 * The system processes all requested reports in parallel and returns results
 * for each.
 *
 * To generate reports, send a POST request with an object where each key is
 * a report ID (obtained from the platform/report/list endpoint) and each
 * value contains the input parameters required by that specific report. The
 * endpoint returns a similarly structured response with results or errors
 * for each requested report.
 *
 * ```http
 * POST /api/v1/platform/report/generate
 * Content-Type: application/json
 * Authorization: Bearer YOUR_API_TOKEN
 *
 * {
 *   "clr3m5n8k000008jq7h9e5b1a": {
 *     "periodDays": 30
 *   },
 *   "clr3m5n8k000108jq7h9e5b1b": {
 *     "periodDays": 7
 *   }
 * }
 * ```
 *
 * The response contains an object with the same report IDs as keys. Each
 * value is either the successfully generated report data or an error object
 * indicating why that specific report failed to generate. This design allows
 * partial success - you'll receive data for all reports that completed
 * successfully, even if some failed.
 *
 * ```json
 * {
 *   "clr3m5n8k000008jq7h9e5b1a": {
 *     "totalRatings": 1523,
 *     "positiveRatings": 1234,
 *     "negativeRatings": 289,
 *     "breakdown": { ... }
 *   },
 *   "clr3m5n8k000108jq7h9e5b1b": {
 *     "error": "Insufficient data for the specified period"
 *   }
 * }
 * ```
 *
 * ## Discovering Available Reports
 *
 * Before generating reports, use the `/api/v1/platform/report/list` endpoint
 * to discover which reports are available on the platform. Each report has a
 * unique identifier (ID), a descriptive name, and documentation about what
 * input parameters it requires and what data it returns.
 *
 * Different reports may require different input parameters. Common parameters
 * include time period specifications (like `periodDays` for the number of
 * days to analyze), resource filters (like `botId` to analyze a specific
 * bot), or analysis options (like `granularity` for data aggregation level).
 *
 * ## Report Input Parameters
 *
 * Each report type accepts specific input parameters that control what data
 * is analyzed and how it's aggregated. While parameter requirements vary by
 * report, common patterns include:
 *
 * - **Time Periods**: Most reports accept `periodDays` (number of days to
 *   analyze) or explicit `startDate`/`endDate` parameters
 * - **Resource Filters**: Many reports allow filtering by specific resources
 *   like `botId`, `datasetId`, or `integrationId`
 * - **Aggregation Options**: Some reports support different aggregation
 *   levels like `hourly`, `daily`, `weekly`, or `monthly`
 *
 * Consult the report list endpoint's response to understand the specific
 * input schema for each report type. Reports validate their inputs and
 * return clear error messages if required parameters are missing or invalid.
 *
 * ## Batch Report Generation
 *
 * Requesting multiple reports in a single API call is more efficient than
 * making separate requests. The endpoint processes reports in parallel,
 * reducing overall latency and minimizing the number of API calls needed
 * to gather comprehensive analytics.
 *
 * When batching reports, consider grouping related reports that cover the
 * same time period or analyze the same resources. This approach provides a
 * cohesive view of your platform activity and ensures consistent data across
 * different analytical dimensions.
 *
 * ## Error Handling and Partial Success
 *
 * The batch report generation endpoint uses a partial success model. If one
 * report encounters an error (due to invalid parameters, insufficient data,
 * or processing issues), other reports in the same request continue to
 * execute independently. Each report in the response indicates either
 * success (with data) or failure (with an error message).
 *
 * This design ensures you can always retrieve available data, even if some
 * specific reports can't be generated. Review each report's response to
 * identify which succeeded and which require attention or parameter
 * adjustments.
 *
 * ## Report Processing Performance
 *
 * Report generation involves analyzing platform activity data, which can
 * take several seconds depending on the time period, data volume, and
 * complexity of the analysis. Longer time periods and accounts with high
 * activity will generally require more processing time.
 *
 * For optimal performance:
 *
 * - Request only the reports you need rather than generating all available
 *   reports
 * - Use appropriate time periods - shorter periods generate faster while
 *   still providing useful insights
 * - Cache generated reports for reuse rather than regenerating the same
 *   analysis repeatedly
 * - Schedule resource-intensive reports during off-peak hours if running
 *   them regularly
 *
 * ## Best Practices
 *
 * - **Validate Report IDs**: Use the list endpoint to discover valid report
 *   IDs before attempting to generate reports
 * - **Understand Input Requirements**: Review each report's input schema to
 *   ensure you provide all required parameters correctly
 * - **Monitor for Errors**: Check response objects for error fields and
 *   handle failures gracefully in automated workflows
 * - **Regular Analysis**: Generate reports on a consistent schedule to track
 *   trends and identify patterns over time
 * - **Store Historical Data**: Archive report results for long-term trend
 *   analysis and compliance requirements
 *
 * **Important:** Report data reflects platform activity as recorded in the
 * analytics systems. There may be a brief delay (typically a few minutes)
 * between events occurring and appearing in generated reports due to data
 * processing pipelines.
 */
