// @ts-check
import { withGet } from '@/lib/method'
import { ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'
import { getUsageSeries } from '@/lib/usage.get'

/**
 * @swagger
 *
 * /usage/series/fetch:
 *   get:
 *     operationId: fetchUsageSeries
 *     summary: Fetch usage series
 *     description:
 *       Fetches a series of usage data points for the user for the last 90 days.
 *     tags:
 *       - Usage
 *     responses:
 *       200:
 *         description: The usage series information was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tokens:
 *                   description: The number of tokens the user has used
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         description: The date of the data point
 *                         type: number
 *                       total:
 *                         description: The total number of tokens the user has used
 *                         type: number
 *                     required:
 *                       - date
 *                       - total
 *                 conversations:
 *                   description: The number of conversations the user has created
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         description: The date of the data point
 *                         type: number
 *                       total:
 *                         description: The total number of conversations the user has used
 *                         type: number
 *                     required:
 *                       - date
 *                       - total
 *                 messages:
 *                   description: The number of messages the user has created
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
 *                 - tokens
 *                 - conversations
 *                 - messages
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (_req, session) {
    const { tokens, conversations, messages } = await getUsageSeries(
      session.user.id
    )

    return ok(
      makeJsonSafe({
        tokens: tokens.map(({ date, total }) => ({
          date,
          total,
        })),

        conversations: conversations.map(({ date, total }) => ({
          date,
          total,
        })),

        messages: messages.map(({ date, total }) => ({
          date,
          total,
        })),
      })
    )
  })
)

/**
 * @manual Usage
 *
 * ## Fetching Usage Time Series Data
 *
 * Retrieve detailed time-series usage data spanning the last 90 days to analyze
 * consumption trends, identify patterns, and track platform activity over time.
 * Unlike the snapshot endpoint that provides current billing period totals, the
 * series endpoint delivers daily data points enabling granular trend analysis,
 * forecasting, and historical comparisons.
 *
 * Time-series usage data is essential for understanding how your platform usage
 * evolves. It reveals daily and weekly patterns, helps identify consumption
 * spikes that might indicate viral growth or issues, supports accurate resource
 * planning and capacity forecasting, enables comparison of usage across different
 * time periods, and provides data for building custom usage dashboards and
 * analytics visualizations.
 *
 * ```http
 * GET /api/v1/usage/series/fetch
 * ```
 *
 * ### Response Structure and Data Points
 *
 * The endpoint returns three parallel time-series arrays covering the last 90
 * days, each containing daily aggregated totals. Every data point includes a
 * Unix timestamp (in milliseconds) marking midnight UTC for that day, paired
 * with the cumulative total for that metric on that specific day.
 *
 * **Token Series**: Daily token consumption across all AI model interactions.
 * Tokens represent the computational cost of language model operations including
 * chat completions, content generation, embeddings, and other AI-powered
 * features. Sharp increases in token usage indicate either growing user
 * engagement or the deployment of more token-intensive features. Use this data
 * to project future costs and optimize expensive operations.
 *
 * **Conversation Series**: Number of new conversation instances created each day.
 * Each conversation represents a distinct interaction session with bots or
 * agents. This metric tracks user engagement frequency and provides insight into
 * how many separate interactions occur daily. Conversation counts help measure
 * user adoption, identify high-traffic periods, and assess the effectiveness of
 * new features or marketing campaigns.
 *
 * **Message Series**: Total messages exchanged daily across all conversations,
 * including both user inputs and bot responses. Message volume relative to
 * conversation count indicates interaction depth and engagement quality. High
 * message-to-conversation ratios suggest users are having longer, more detailed
 * exchanges, while low ratios might indicate quick, transactional interactions
 * or potential user experience issues.
 *
 * ### Analysis and Visualization Patterns
 *
 * **Trend Detection**: Plot the time-series data to identify growth trajectories,
 * seasonal patterns, or usage anomalies. Sustained upward trends indicate healthy
 * growth, while sudden drops may signal technical issues or user experience
 * problems requiring investigation.
 *
 * **Comparative Analysis**: Compare usage across different periods to assess the
 * impact of new features, marketing campaigns, or pricing changes. For example,
 * compare the 30 days before and after launching a new bot to measure adoption
 * and engagement impact.
 *
 * **Peak Period Identification**: Identify days or periods with unusually high
 * usage to understand when your infrastructure experiences peak load. This
 * information guides capacity planning and helps schedule maintenance during
 * low-usage periods.
 *
 * **Cost Forecasting**: Use historical token consumption trends to project future
 * costs and plan budgets. Linear regression or time-series forecasting models
 * can predict upcoming usage based on historical patterns, enabling proactive
 * resource allocation.
 *
 * **Dashboard Integration**: Integrate time-series data into operational
 * dashboards to provide real-time visibility into platform health and usage
 * patterns. Consider building visualizations showing 7-day moving averages,
 * week-over-week growth, or month-over-month comparisons.
 *
 * ### Usage Pattern Examples
 *
 * **Daily Monitoring Workflow**:
 * ```javascript
 * // Fetch series data
 * const response = await fetch('/api/v1/usage/series/fetch');
 * const { tokens, conversations, messages } = await response.json();
 *
 * // Calculate yesterday's totals
 * const yesterday = tokens[tokens.length - 1];
 * console.log(`Yesterday: ${yesterday.total} tokens used`);
 *
 * // Detect sudden spikes (>50% increase)
 * const today = tokens[tokens.length - 1];
 * const previousDay = tokens[tokens.length - 2];
 * const percentChange = ((today.total - previousDay.total) / previousDay.total) * 100;
 *
 * if (percentChange > 50) {
 *   alert(`Token usage spike detected: ${percentChange.toFixed(1)}% increase`);
 * }
 * ```
 *
 * **Weekly Trend Analysis**:
 * ```javascript
 * // Calculate 7-day moving average to smooth out daily fluctuations
 * function calculateMovingAverage(series, window = 7) {
 *   return series.map((point, index) => {
 *     if (index < window - 1) return null;
 *     const windowData = series.slice(index - window + 1, index + 1);
 *     const average = windowData.reduce((sum, p) => sum + p.total, 0) / window;
 *     return { date: point.date, total: average };
 *   }).filter(p => p !== null);
 * }
 *
 * const smoothedTokens = calculateMovingAverage(tokens);
 * ```
 *
 * ### Data Interpretation Guidelines
 *
 * **Normal Fluctuations**: Daily usage naturally varies based on user activity
 * patterns, weekday vs. weekend differences, and time zones. Week-over-week
 * comparisons often provide more meaningful insights than day-to-day changes.
 *
 * **Seasonal Patterns**: Many applications exhibit weekly or monthly patterns.
 * Business-focused bots might see higher weekday usage, while consumer
 * applications might peak on weekends. Identify your application's natural
 * rhythms to distinguish normal patterns from anomalies.
 *
 * **Growth Assessment**: Healthy growth typically shows consistent upward trends
 * with manageable day-to-day variation. Exponential growth curves might indicate
 * viral adoption but could also strain infrastructure and budgets.
 *
 * **Important Note**: The series endpoint returns up to 90 days of historical
 * data. For longer retention periods or more granular (hourly) data, consider
 * implementing your own logging and storage solution that captures usage metrics
 * in real-time as they occur.
 */
