// @ts-check
import { withGet } from '@/lib/method'
import { getEventMetricSeries } from '@/lib/metric'
import { requiredUrlParam } from '@/lib/query.get'
import { ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * -@swagger
 *
 * /event/metric/series/fetch:
 *   get:
 *     operationId: fetchEventMetricSeries
 *     summary: Fetch event metric series
 *     description:
 *       Fetches a series of event metric data points for the user for the last 90 days.
 *     tags:
 *       - Event
 *     responses:
 *       200:
 *         description: The event metric series information was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 values:
 *                   description: The values of the event metrics
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         description: The date of the data point
 *                         type: number
 *                       total:
 *                         description: The total number of messages the user has used
 *                         type: number
 *                     required:
 *                       - date
 *                       - total
 *               required:
 *                 - values
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const values = await getEventMetricSeries(
      session.user,
      requiredUrlParam(req, 'type')
    )

    return ok(
      makeJsonSafe({
        values: values.map(({ date, total }) => ({
          date,
          total,
        })),
      })
    )
  })
)

/**
 * @manual Event Metrics
 * @description Event metrics provide aggregated, time-series analytics data about platform usage, resource consumption, and system activity, enabling detailed performance monitoring, capacity planning, billing analysis, and operational insights across conversations, integrations, and AI model usage.
 * @category Observability/Metrics
 * @tags metrics, analytics, monitoring, usage, performance, time-series
 * @index 1
 *
 * Event metrics represent aggregated analytical data derived from the
 * detailed event logs captured throughout the ChatBotKit platform. While
 * event logs provide granular, individual records of every action and
 * interaction, event metrics transform this raw data into meaningful
 * time-series aggregations that reveal patterns, trends, and usage
 * characteristics over time. This aggregated perspective is essential for
 * understanding system behavior at scale, monitoring resource consumption,
 * analyzing performance trends, and making data-driven decisions about
 * capacity planning and optimization.
 *
 * The metrics system continuously processes event data to generate daily
 * aggregates across multiple dimensions including message volume, token
 * consumption, API call frequency, integration activity, and resource
 * utilization. These aggregations provide a high-level view of platform
 * usage that complements the detailed event logs, enabling efficient
 * analysis of long-term trends without requiring exhaustive processing of
 * millions of individual event records.
 *
 * Event metrics are particularly valuable for several critical use cases.
 * For operational monitoring, metrics reveal usage patterns and load
 * characteristics that inform scaling decisions and capacity planning. For
 * billing and cost management, token consumption and API usage metrics
 * support accurate usage tracking and cost attribution. For performance
 * optimization, metrics identify anomalies, bottlenecks, and opportunities
 * for improvement. For business intelligence, usage trends and adoption
 * patterns guide product development and user engagement strategies.
 *
 * ## Fetching Event Metric Series
 *
 * The event metric series endpoint retrieves time-series data showing how
 * specific metrics evolve over time, providing a historical view of platform
 * activity that enables trend analysis, anomaly detection, and forecasting.
 * The series data spans the last 90 days by default, offering sufficient
 * history for identifying patterns while maintaining query performance.
 *
 * Each data point in the series includes a timestamp (as Unix epoch
 * milliseconds) and the aggregated total for that time period, typically
 * representing daily summations of the requested metric. This time-series
 * format is ideal for visualization in dashboards, integration with
 * monitoring systems, and analysis using time-series analytics tools.
 *
 * ```http
 * GET /api/v1/event/metric/series/fetch?type=message_count
 * Accept: application/json
 * ```
 *
 * The metric series functionality supports various metric types that track
 * different aspects of platform activity:
 *
 * - **message_count**: Total number of messages exchanged in conversations
 * - **token_usage**: Aggregate token consumption across all AI model
 *   interactions
 * - **conversation_count**: Number of conversation sessions created
 * - **integration_calls**: Frequency of integration endpoint invocations
 * - **api_requests**: Volume of API requests across all endpoints
 *
 * The response provides an array of time-series data points, each
 * representing a specific day's aggregated metric value. This format enables
 * straightforward visualization and analysis, allowing you to identify
 * usage patterns such as daily peaks, weekly cycles, growth trends, and
 * seasonal variations. The time-series data is particularly useful for
 * creating monitoring dashboards, generating usage reports, detecting
 * anomalies, and forecasting future resource requirements based on
 * historical patterns.
 *
 * **Response Structure:**
 *
 * ```json
 * {
 *   "values": [
 *     {
 *       "date": 1732060800000,
 *       "total": 1247
 *     },
 *     {
 *       "date": 1732147200000,
 *       "total": 1589
 *     }
 *   ]
 * }
 * ```
 *
 * The date field uses Unix epoch timestamps (milliseconds since January 1,
 * 1970 UTC), which can be easily converted to standard date formats in any
 * programming language or data analysis tool. The total field represents the
 * aggregated sum of the metric for that specific day, providing a clear
 * measure of daily activity levels.
 *
 * **Use Cases for Metric Series Data:**
 *
 * - **Capacity Planning**: Identify growth trends to predict future
 *   infrastructure needs and plan resource scaling
 * - **Cost Analysis**: Track token consumption and API usage patterns to
 *   understand and optimize operational costs
 * - **Performance Monitoring**: Detect unusual spikes or drops in activity
 *   that might indicate issues or opportunities
 * - **Business Intelligence**: Analyze user engagement patterns and adoption
 *   trends to inform product strategy
 * - **Billing Validation**: Verify usage charges against historical
 *   consumption patterns and identify unexpected changes
 */
