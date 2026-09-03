import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import DocsLink from '@/components/DocsLink'
import FAQ from '@/components/FAQ'
import Hero from '@/components/Hero'
import Link from '@/components/Link'
import RatingList from '@/components/RatingList'

import faq from '@/content/faqs/platform-ratings.yaml'

export default function Index({
  authenticated,
  botId,
  contactId,
  conversationId,
  messageId,
  sentiment,
}) {
  return (
    <section className="section-white">
      <div className="main-page main-page-list">
        <RatingList
          botId={botId}
          contactId={contactId}
          conversationId={conversationId}
          messageId={messageId}
          sentiment={sentiment}
          autoLoad
          loadMore="auto"
          actions={
            authenticated ? (
              <Link
                className="primary-button opacity-0 pointer-events-none"
                href="/ratings/new"
              >
                Create Rating
              </Link>
            ) : null
          }
        />
      </div>
    </section>
  )
}

Index.getLayout = function (children, { authenticated }) {
  return (
    <Dashboard
      breadcrumbs={['ChatBotKit']}
      title="Ratings"
      description="Review and analyze customer feedback to understand user preferences and improve your chatbot's performance through valuable rating insights."
      authenticated={authenticated}
    >
      {authenticated ? (
        children
      ) : (
        <PageHero>
          <DocsLink className="default-button" slug="ratings">
            Learn More
          </DocsLink>
          {/* <Link
          className="primary-button"
          href={{
            pathname: '/signin',
            query: {
              callbackUrl: '/ratings',
            },
          }}
        >
          Sign in
        </Link> */}
        </PageHero>
      )}
      <FAQ faq={faq} />
    </Dashboard>
  )
}

export function PageHero(props) {
  return (
    <Hero
      {...props}
      title={['Review the feedback', 'received from your customers']}
      description="Collect and analyze user ratings to understand customer preferences and improve your chatbot's performance through valuable feedback insights."
      compact={true}
    />
  )
}

export async function getServerSideProps(context) {
  const session = await getSoftSession(context.req, context.res)

  if (!session) {
    return {
      props: makeJsonSafe({
        authenticated: false,
      }),
    }
  }

  const queryString = (name) => {
    const value = context.query[name]

    return typeof value === 'string' ? value : undefined
  }

  return {
    props: makeJsonSafe({
      authenticated: true,

      botId: queryString('botId'),
      contactId: queryString('contactId'),
      conversationId: queryString('conversationId'),
      messageId: queryString('messageId'),
      sentiment: queryString('sentiment'),
    }),
  }
}

/**
 * @doc Ratings
 * @description Collect and analyze user feedback to understand how well your chatbot is performing and identify areas for improvement
 * @category Objects
 * @tags ratings, feedback, thumbs up, thumbs down, user satisfaction, analytics, improvement
 * @index 10
 * @date Wed, Dec 24, 2025, 12:00 AM
 *
 * Ratings are the thumbs up and thumbs down feedback that users give during conversations with your chatbot. This simple yet powerful feedback mechanism helps you understand what's working well and what needs improvement, giving you direct insight into user satisfaction and bot performance.
 *
 * ## What Are Ratings?
 *
 * When users interact with your chatbot, they can rate individual bot responses with a thumbs up (positive) or thumbs down (negative) reaction. Each rating captures the user's immediate feedback on a specific message, and can optionally include a reason explaining why they gave that rating.
 *
 * Ratings help you:
 * - **Measure Satisfaction**: See at a glance how users feel about your bot's responses
 * - **Identify Problems**: Quickly spot which types of responses or topics generate negative feedback
 * - **Track Improvement**: Monitor whether changes you make lead to better ratings over time
 * - **Understand Context**: See the exact conversation and message that received each rating
 * - **Prioritize Work**: Focus your bot improvements on areas with the most negative feedback
 *
 * ## How Ratings Work
 *
 * Ratings are collected automatically when users click the thumbs up or thumbs down buttons that appear next to bot messages in the chat interface. When a user rates a message, ChatBotKit records:
 *
 * - **The Rating Value**: Positive (upvote) or negative (downvote)
 * - **The Message**: Which specific bot response was rated
 * - **The Conversation**: The full context of the interaction
 * - **The Contact**: Who provided the feedback
 * - **The Bot**: Which bot generated the rated response
 * - **Optional Reason**: If the user provided additional explanation
 *
 * All of this information appears in your Ratings dashboard, where you can review, filter, and analyze the feedback.
 *
 * ## Viewing and Filtering Ratings
 *
 * Your Ratings dashboard shows all feedback in chronological order, with the most recent first. Each rating entry displays:
 *
 * - The thumbs up or thumbs down indicator
 * - When the rating was given
 * - Which bot and contact were involved
 * - Any reason the user provided
 *
 * You can filter ratings in several ways:
 *
 * **By Bot**: See all feedback for a specific chatbot by selecting it from the filter menu. This helps you compare performance across different bots or focus on improving one particular bot.
 *
 * **By Value**: Filter to show only upvotes or only downvotes. Looking at only negative ratings helps you quickly identify problems, while reviewing positive ratings shows what you're doing right.
 *
 * **By Contact**: View all ratings from a particular user to understand their overall experience.
 *
 * **By Conversation or Message**: If you're reviewing a specific interaction, you can see all the ratings associated with it.
 *
 * ## Using Ratings to Improve Your Bot
 *
 * Ratings are most valuable when you actively use them to guide improvements. Here's how to make the most of this feedback:
 *
 * **Review Negative Ratings Regularly**: Set aside time each week to look at downvoted messages. Read the bot's response and the user's reason (if provided) to understand what went wrong. Common issues include:
 * - Incorrect or outdated information
 * - Misunderstanding the user's question
 * - Unhelpful or irrelevant responses
 * - Tone that doesn't match user expectations
 *
 * **Look for Patterns**: If multiple users downvote similar types of responses, that indicates a systematic problem rather than a one-off issue. For example, if your bot consistently gets negative feedback on pricing questions, you might need to update your dataset with better pricing information.
 *
 * **Check Positive Feedback Too**: Don't just focus on problems! Review upvoted messages to identify what your bot does well. These successful interactions can guide how you handle similar questions in the future.
 *
 * **Test Your Changes**: After making improvements based on ratings, monitor whether similar questions now receive better feedback. This validates that your changes are working.
 *
 * **Follow Up on Specific Issues**: If a rating indicates a serious problem or confusion, consider reaching out to that contact directly to better understand their experience and ensure their issue was resolved.
 *
 * ## Best Practices
 *
 * **Make Rating Easy**: Ensure the thumbs up/down buttons are visible and accessible in your chat interface. Users should be able to give feedback with a single click.
 *
 * **Encourage Feedback**: You might occasionally have your bot ask "Was this answer helpful?" to remind users that they can rate responses. However, don't ask too frequently as this can be annoying.
 *
 * **Collect Reasons**: When technically possible, allow users to optionally explain their rating. Even brief explanations like "wrong answer" or "not helpful" provide valuable context beyond just the thumbs up or down.
 *
 * **Act on Feedback**: The value of ratings comes from using them to improve. If users consistently provide feedback but never see improvements, they may stop rating messages altogether.
 *
 * **Don't Overreact to Individual Ratings**: A single negative rating doesn't necessarily mean there's a problem. Look for trends across multiple interactions before making major changes.
 *
 * **Combine with Other Metrics**: Use ratings alongside other signals like conversation completion rates, escalation frequency, and direct user feedback to get a complete picture of bot performance.
 *
 * ## Understanding Rating Context
 *
 * When reviewing a rating, always look at the full conversation context. A downvote might not mean the bot's response was wrong - sometimes users are just frustrated with their situation, or they downvote because they want to talk to a human rather than a bot.
 *
 * The conversation history shows you what led up to the rated message, helping you understand whether the issue was:
 * - A truly incorrect or unhelpful response
 * - A misunderstanding that started earlier in the conversation
 * - User frustration with the overall situation
 * - A limitation of what the bot can do (vs. what the user needed)
 *
 * This context helps you make better decisions about what to improve.
 *
 * ## Practical Examples
 *
 * **Support Bot Improvement**: You notice your support bot gets frequent downvotes on questions about refunds. Reviewing the conversations, you see the bot is giving outdated policy information. You update your dataset with current refund policies, and future ratings on refund questions improve significantly.
 *
 * **Identifying Training Gaps**: Multiple negative ratings cluster around technical troubleshooting questions. This tells you the bot needs better technical documentation in its dataset, so you add detailed troubleshooting guides.
 *
 * **Tone Adjustment**: Users consistently upvote friendly, conversational responses but downvote overly formal ones. You adjust your bot's instructions to use a warmer, more casual tone, matching what users prefer.
 *
 * **Success Validation**: After redesigning your bot's approach to product recommendations, you monitor ratings on recommendation messages. Seeing an increase in positive ratings confirms your new approach is working better.
 *
 * Ratings give you a direct line to user sentiment, helping you continuously refine and improve your chatbot's performance based on real feedback from real conversations.
 */
