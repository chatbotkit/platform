import prisma from '@/prisma/client'

import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import BotList from '@/components/BotList'
import ContactList from '@/components/ContactList'
import ConversationList from '@/components/ConversationList'
import Emoji from '@/components/Emoji'
import FAQ from '@/components/FAQ'
import Headline from '@/components/Headline'
import PageSections from '@/components/PageSections'

import faq from '@/content/faqs/platform-ratings.yaml'

import clsx from 'clsx'

export function RatingInformation({ rating }) {
  const ratingValue = rating.value >= 0 ? 'upvote' : 'downvote'
  const ratingEmoji = rating.value >= 0 ? '👍' : '👎'

  const isPositive = rating.value >= 0

  return (
    <div className="space-y-6">
      <div
        className={clsx('border rounded-lg p-6', {
          'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20':
            isPositive,
          'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20':
            !isPositive,
        })}
      >
        <div className="flex items-center gap-4">
          <div
            className={clsx('text-4xl', {
              'text-green-600 dark:text-green-400': isPositive,
              'text-red-600 dark:text-red-400': !isPositive,
            })}
          >
            <Emoji>{ratingEmoji}</Emoji>
          </div>
          <div>
            <h3
              className={clsx('text-lg font-semibold', {
                'text-green-800 dark:text-green-200': isPositive,
                'text-red-800 dark:text-red-200': !isPositive,
              })}
            >
              {ratingValue.charAt(0).toUpperCase() + ratingValue.slice(1)}
            </h3>
            <p
              className={clsx('text-sm', {
                'text-green-600 dark:text-green-400': isPositive,
                'text-red-600 dark:text-red-400': !isPositive,
              })}
            >
              Rating value: {rating.value >= 0 ? '+' : ''}
              {rating.value}
            </p>
          </div>
        </div>
        {rating.reason && (
          <div
            className={clsx('mt-4 pt-4 border-t border-opacity-20', {
              'border-green-200': isPositive,
              'border-red-200': !isPositive,
            })}
          >
            <h4
              className={clsx('font-medium mb-2', {
                'text-green-800 dark:text-green-200': isPositive,
                'text-red-800 dark:text-red-200': !isPositive,
              })}
            >
              User Feedback
            </h4>
            <p
              className={clsx('italic', {
                'text-green-700 dark:text-green-300': isPositive,
                'text-red-700 dark:text-red-300': !isPositive,
              })}
            >
              &ldquo;{rating.reason}&rdquo;
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export function AnalysisInsights({ rating }) {
  if (rating.value >= 0) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">
          Positive Feedback Analysis
        </h4>
        <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
          <li>
            • This positive rating indicates user satisfaction with the response
          </li>
          {rating.reason && (
            <li>• User feedback: &ldquo;{rating.reason}&rdquo;</li>
          )}
          {rating.bot && (
            <li>
              • The bot performed well - consider this interaction as a success
              pattern
            </li>
          )}
          {rating.message && (
            <li>
              • Review the conversation context to understand what made this
              response effective
            </li>
          )}
          <li>
            • Use insights from positive ratings to improve similar interactions
          </li>
        </ul>
      </div>
    )
  } else {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <h4 className="font-medium text-red-800 dark:text-red-200 mb-2">
          Improvement Opportunities
        </h4>
        <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
          {rating.reason && (
            <li>• Review the specific reason: &ldquo;{rating.reason}&rdquo;</li>
          )}
          {rating.bot && (
            <li>
              • Consider updating the bot&apos;s training data or backstory
            </li>
          )}
          {rating.message && (
            <li>
              • Analyze the conversation context that led to this response
            </li>
          )}
          <li>
            • Look for patterns in similar downvotes to identify systematic
            issues
          </li>
          <li>
            • Use this feedback to improve future responses in similar
            situations
          </li>
        </ul>
      </div>
    )
  }
}

export default function Index({ rating }) {
  // const ratingValue = rating.value >= 0 ? 'upvote' : 'downvote'
  // const ratingEmojiName = rating.value >= 0 ? 'thumbs-up' : 'thumbs-down'

  return (
    <>
      {/* <div className="main-page last">
        <NavHeader link="/ratings" caption="ratings" title="Rating">
          <p>
            <Emoji name={ratingEmojiName} /> This {ratingValue} provides
            feedback on chatbot interactions. Use this information to analyze
            user satisfaction and improve chatbot performance.
          </p>
        </NavHeader>
      </div> */}
      <PageSections className="pt-12">
        <section data-page-section-title="Information">
          <div className="main-page">
            <Headline title="Rating Information">
              Details about this rating and when it was cast.
            </Headline>
            <RatingInformation rating={rating} />
          </div>
        </section>
        <section data-page-section-title="Analysis">
          <div className="main-page">
            <Headline title="Analysis">
              Insights and recommendations based on this rating.
            </Headline>
            <AnalysisInsights rating={rating} />
          </div>
        </section>
        {rating.id && rating.contact ? (
          <section data-page-section-title="Contact">
            <div className="main-page">
              <Headline title="Contact">
                The contact associated with this rating.
              </Headline>
              <ContactList
                defaultItems={[rating.contact]}
                exportRoute={null}
                filter={false}
                quickAccess={true}
              />
            </div>
          </section>
        ) : null}
        {rating.id && rating.conversation ? (
          <section data-page-section-title="Conversation">
            <div className="main-page">
              <Headline title="Conversation">
                The conversation associated with this rating.
              </Headline>
              <ConversationList
                defaultItems={[rating.conversation]}
                exportRoute={null}
                filter={false}
                quickAccess={true}
              />
            </div>
          </section>
        ) : null}
        {rating.id && rating.bot ? (
          <section data-page-section-title="Bot">
            <div className="main-page">
              <Headline title="Bot">
                The bot associated with this rating.
              </Headline>
              <BotList
                defaultItems={[rating.bot]}
                exportRoute={null}
                filter={false}
                quickAccess={true}
              />
            </div>
          </section>
        ) : null}
        {/* {rating.id ? (
          <section>
            <div className="main-page">
              <Headline title="Meta">
                Meta fields assigned to this rating.
              </Headline>
              <MetaArea instance={rating} />
            </div>
          </section>
        ) : null} */}
      </PageSections>
    </>
  )
}

Index.getLayout = function (children, { rating }) {
  return (
    <Dashboard
      breadcrumbs={['Ratings', 'ChatBotKit']}
      title={rating.name || rating.id || 'New'}
      authenticated={true}
    >
      {children}
      <FAQ faq={faq} />
    </Dashboard>
  )
}

export async function getServerSideProps(context) {
  const session = await getSoftSession(context.req, context.res)

  if (!session) {
    return {
      redirect: {
        destination: `/signin?callbackUrl=${context.resolvedUrl}`,
        permanent: false,
      },
    }
  }

  const rating = await prisma.rating.findUnique({
    where: {
      id: context.params.ratingId,
    },
    include: {
      contact: true,
      conversation: true,
      message: true,
      bot: true,
    },
  })

  if (!rating) {
    return {
      notFound: true,
    }
  }

  if (rating.userId !== session.user.id) {
    return {
      notFound: true,
    }
  }

  return {
    props: makeJsonSafe({
      rating,
    }),
  }
}
