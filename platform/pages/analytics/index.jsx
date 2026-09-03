import { timePlusDays } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'
import {
  breakdownTotalContactsWithConversationsOverPeriod,
  breakdownTotalConversationsOverPeriod,
  breakdownTotalMessagesOfTypeOverPeriod,
  breakdownTotalMessagesOverPeriod,
  breakdownTotalRatingsOverPeriod,
  breakdownTotalUsageTokensOverPeriod,
  getAverageMessagesOfTypeOverPeriod,
  getTotalContacts,
  getTotalContactsWithConversationsOverPeriod,
  getTotalConversationsOverPeriod,
  getTotalMessagesOfTypeOverPeriod,
  getTotalMessagesOverPeriod,
  getTotalRatingsOverPeriod,
  getTotalThumbsDownOverPeriod,
  getTotalThumbsUpOverPeriod,
  getTotalUsageTokensOverPeriod,
  listContacts,
  listContactsWithConversationsOverPeriod,
  listContactsWithMessagesOverPeriod,
  listContactsWithRatingsOverPeriod,
  listEventLogsOfTypeActionsGroupedByTypeOverPeriod,
  listTopBotsByTokenUsageOverPeriod,
  listTopContactsByTokenUsageOverPeriod,
  listTopDownvotersOverPeriod,
  listTopUpvotersOverPeriod,
} from '@/prisma/sql'
import { MessageType } from '@/prisma/types'

import { captureException } from '@/lib/error'
import { shortFormat } from '@/lib/number'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import DynamicIcon from '@/components/DynamicIcon'
import FAQ from '@/components/FAQ'
import { GlobalRootPortal } from '@/components/GlobalRoot'
import List from '@/components/List'
import SimpleTabs from '@/components/SimpleTabs'

import usePopup from '@/hooks/usePopup'

import faq from '@/content/faqs/platform-analytics.yaml'

import { LineChart } from '@tremor/react'

import clsx from 'clsx'
import pluralize from 'pluralize'

const DEFAULT_PERIOD = 30

export function DailyChart({ title, data }) {
  data = data.map(({ date, total }) => {
    return {
      date: new Date(date).getDate(),
      total: total,
    }
  })

  return data.length ? (
    <div className="flex-1 border border-gray-200 dark:border-gray-800 rounded-xl p-2">
      <h3 className="text-base font-semibold">{title}</h3>
      <LineChart
        className="h-80 text-xs"
        data={data}
        index="date"
        categories={['total']}
        colors={['indigo']}
        valueFormatter={(number) =>
          `${Intl.NumberFormat('us').format(number).toString()}`
        }
        yAxisWidth={60}
      />
    </div>
  ) : null
}

export function Card({
  title,
  description,

  value,
  change,
  dimension,

  period,

  details,

  className,

  ...props
}) {
  const { popup, openPopup } = usePopup({
    cancelButtonCaption: 'Close',

    dialogClassName:
      'w-screen h-screen lg:max-w-[calc(100vw*0.8)] lg:max-h-[calc(100vh*0.8)] !p-0',
    dialogInnerClassName: 'overflow-auto',
  })

  function showDetails() {
    openPopup(
      <div className="px-4 space-y-4">
        {details.metric ? (
          <Card
            title={details.metric.title}
            description={details.metric.description}
            value={details.metric.value}
            change={details.metric.change}
            dimension={details.metric.dimension}
            period={details.metric.period}
          />
        ) : null}
        {details.lineChart ? (
          <DailyChart title="Breakdown" data={details.lineChart} />
        ) : null}
        {details.tabs ? (
          <SimpleTabs
            tabs={{
              ...(details.tabs.allList && {
                All: {
                  children: (
                    <List>
                      {details.tabs.allList.map((item, index) => (
                        <List.Item
                          key={index}
                          link={item.link}
                          target="_blank"
                          title={item.name}
                          body={item.description}
                          timestamp={item.createdAt}
                        >
                          {item.tags?.map((tag, tagIndex) =>
                            typeof tag === 'string' ? (
                              <span className="tag" key={tagIndex}>
                                {tag}
                              </span>
                            ) : (
                              <span className="tag" key={tagIndex}>
                                {tag.value}
                              </span>
                            )
                          )}
                        </List.Item>
                      ))}
                    </List>
                  ),
                },
              }),
              ...(details.tabs.botList && {
                Bots: {
                  children: (
                    <List>
                      {details.tabs.botList.map((item, index) => (
                        <List.Item
                          key={index}
                          link={item.link}
                          target="_blank"
                          title={item.name}
                          body={item.description}
                        >
                          {item.tags?.map((tag, tagIndex) =>
                            typeof tag === 'string' ? (
                              <span className="tag" key={tagIndex}>
                                {tag}
                              </span>
                            ) : (
                              <span className="tag" key={tagIndex}>
                                {tag.value}
                              </span>
                            )
                          )}
                        </List.Item>
                      ))}
                    </List>
                  ),
                },
              }),
              ...(details.tabs.contactList && {
                Contacts: {
                  children: (
                    <List>
                      {details.tabs.contactList.map((item, index) => (
                        <List.Item
                          key={index}
                          link={item.link}
                          target="_blank"
                          title={item.name}
                          body={item.description}
                        >
                          {item.tags?.map((tag, tagIndex) =>
                            typeof tag === 'string' ? (
                              <span className="tag" key={tagIndex}>
                                {tag}
                              </span>
                            ) : (
                              <span className="tag" key={tagIndex}>
                                {tag.value}
                              </span>
                            )
                          )}
                        </List.Item>
                      ))}
                    </List>
                  ),
                },
              }),
            }}
          />
        ) : details.list ? (
          <List>
            {details.list.map((item, index) => (
              <List.Item
                key={index}
                link={item.link}
                target="_blank"
                title={item.name}
                body={item.description}
                timestamp={item.createdAt}
                icon={
                  item.icon ? (
                    <DynamicIcon
                      className="w-10 h-10 rounded-full"
                      icon={item.icon}
                    />
                  ) : undefined
                }
              >
                {item.tags?.map((tag, index) =>
                  typeof tag === 'string' ? (
                    <span className="tag" key={index}>
                      {tag}
                    </span>
                  ) : (
                    <span className="tag" key={index}>
                      {tag.value} {pluralize(tag.name, tag.value)}
                    </span>
                  )
                )}
              </List.Item>
            ))}
          </List>
        ) : null}
      </div>,
      {
        title: details.metric.title,
        description: details.metric.description,
      }
    )
  }

  const hasDetails = value > 0 && !!details

  return (
    <>
      <GlobalRootPortal>{popup}</GlobalRootPortal>
      <div
        {...props}
        className={clsx(
          'flex flex-col gap-2',
          'auto-text-gray-800',
          {
            'auto-bg-gray-50': !hasDetails,
            'auto-bg-gray-100': hasDetails,
          },
          'border auto-border-gray-200 rounded-xl',
          'p-5',
          {
            'cursor-pointer hover:auto-border-gray-300': hasDetails,
          },
          className
        )}
        onClick={details ? showDetails : undefined}
      >
        <div className="text-md font-semibold">{title}</div>
        <div className="text-sm">{description}</div>
        <div className="flex-1" />
        <div className="text-4xl">
          <span>{shortFormat(value)}</span>
          {change ? (
            <sup className="ml-2">
              <span className="text-xs">
                {change > 0 ? '+' : ''}
                {shortFormat(change)}
              </span>
            </sup>
          ) : null}
        </div>
        {dimension && <div className="text-xs">{dimension}</div>}
        {period && <div className="text-xs">{period}</div>}
      </div>
    </>
  )
}

export default function Analytics({ data, periodCaption }) {
  return (
    <>
      <div className="main-page">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold">Analytics</h1>
        </div>
        <p className="mt-4 sm:text-sm">
          This section provides comprehensive insights into your platform key
          performance metrics for the {periodCaption}. Click on any metric to
          see detailed breakdowns and trends.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {data.map(
            (
              { title, description, value, change, dimension, period, details },
              index
            ) => (
              <Card
                key={index}
                title={title}
                description={description}
                value={value}
                change={change}
                dimension={dimension}
                period={period}
                details={details}
              />
            )
          )}
        </div>
      </div>
    </>
  )
}

Analytics.getLayout = function (children) {
  return (
    <Dashboard
      breadcrumbs={['ChatBotKit']}
      title="Analytics"
      description="Comprehensive analytics and insights for your ChatBotKit platform usage"
      keywords="analytics, insights, dashboard, metrics, conversations, messages, ratings"
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

  try {
    let days =
      Math.abs(
        parseInt((context.query.period || DEFAULT_PERIOD).toString(), 10)
      ) || DEFAULT_PERIOD

    // @todo perhaps allow greater range for certain types of plans

    if (![1, 7, 30].includes(days)) {
      days = DEFAULT_PERIOD
    }

    const periodEnd = new Date()

    const periodStart = timePlusDays(-days, periodEnd)

    const periodCaption = `last ${days} ${pluralize('day', days)}`

    const data = await prisma.$queryMap({
      // contact

      totalContacts: prisma.$queryRawTyped(getTotalContacts(session.user.id)),

      listOfContacts: prisma.$queryRawTyped(listContacts(session.user.id, 100)),

      totalActiveContacts: prisma.$queryRawTyped(
        getTotalContactsWithConversationsOverPeriod(
          session.user.id,
          periodStart,
          periodEnd
        )
      ),

      totalActiveContactsPreviousPeriod: prisma.$queryRawTyped(
        getTotalContactsWithConversationsOverPeriod(
          session.user.id,
          timePlusDays(-DEFAULT_PERIOD, periodStart),
          periodStart
        )
      ),

      listOfActiveContactsWithConversations: prisma.$queryRawTyped(
        listContactsWithConversationsOverPeriod(
          session.user.id,
          periodStart,
          periodEnd,
          100
        )
      ),

      listOfActiveContactsWithMessages: prisma.$queryRawTyped(
        listContactsWithMessagesOverPeriod(
          session.user.id,
          periodStart,
          periodEnd,
          100
        )
      ),

      breakdownOfActiveContacts: prisma.$queryRawTyped(
        breakdownTotalContactsWithConversationsOverPeriod(
          session.user.id,
          periodStart,
          periodEnd
        )
      ),

      // conversation

      totalConversations: prisma.$queryRawTyped(
        getTotalConversationsOverPeriod(session.user.id, periodStart, periodEnd)
      ),

      totalConversationsPreviousPeriod: prisma.$queryRawTyped(
        getTotalConversationsOverPeriod(
          session.user.id,
          timePlusDays(-DEFAULT_PERIOD, periodStart),
          periodStart
        )
      ),

      breakdownOfConversations: prisma.$queryRawTyped(
        breakdownTotalConversationsOverPeriod(
          session.user.id,
          periodStart,
          periodEnd
        )
      ),

      // message

      totalMessages: prisma.$queryRawTyped(
        getTotalMessagesOverPeriod(session.user.id, periodStart, periodEnd)
      ),

      totalMessagesPreviousPeriod: prisma.$queryRawTyped(
        getTotalMessagesOverPeriod(
          session.user.id,
          timePlusDays(-DEFAULT_PERIOD, periodStart),
          periodStart
        )
      ),

      breakdownOfMessages: prisma.$queryRawTyped(
        breakdownTotalMessagesOverPeriod(
          session.user.id,
          periodStart,
          periodEnd
        )
      ),

      totalUserMessages: prisma.$queryRawTyped(
        getTotalMessagesOfTypeOverPeriod(
          session.user.id,
          MessageType.user,
          periodStart,
          periodEnd
        )
      ),

      totalUserMessagesPreviousPeriod: prisma.$queryRawTyped(
        getTotalMessagesOfTypeOverPeriod(
          session.user.id,
          MessageType.user,
          timePlusDays(-DEFAULT_PERIOD, periodStart),
          periodStart
        )
      ),

      breakdownOfUserMessages: prisma.$queryRawTyped(
        breakdownTotalMessagesOfTypeOverPeriod(
          session.user.id,
          MessageType.user,
          periodStart,
          periodEnd
        )
      ),

      totalBotMessages: prisma.$queryRawTyped(
        getTotalMessagesOfTypeOverPeriod(
          session.user.id,
          MessageType.bot,
          periodStart,
          periodEnd
        )
      ),

      totalBotMessagesPreviousPeriod: prisma.$queryRawTyped(
        getTotalMessagesOfTypeOverPeriod(
          session.user.id,
          MessageType.bot,
          timePlusDays(-DEFAULT_PERIOD, periodStart),
          periodStart
        )
      ),

      breakdownOfBotMessages: prisma.$queryRawTyped(
        breakdownTotalMessagesOfTypeOverPeriod(
          session.user.id,
          MessageType.bot,
          periodStart,
          periodEnd
        )
      ),

      totalActivityMessages: prisma.$queryRawTyped(
        getTotalMessagesOfTypeOverPeriod(
          session.user.id,
          MessageType.activity,
          periodStart,
          periodEnd
        )
      ),

      totalActivityMessagesPreviousPeriod: prisma.$queryRawTyped(
        getTotalMessagesOfTypeOverPeriod(
          session.user.id,
          MessageType.activity,
          timePlusDays(-DEFAULT_PERIOD, periodStart),
          periodStart
        )
      ),

      breakdownOfActivityMessages: prisma.$queryRawTyped(
        breakdownTotalMessagesOfTypeOverPeriod(
          session.user.id,
          MessageType.activity,
          periodStart,
          periodEnd
        )
      ),

      listOfActions: prisma.$queryRawTyped(
        listEventLogsOfTypeActionsGroupedByTypeOverPeriod(
          session.user.id,
          periodStart,
          periodEnd,
          100
        )
      ),

      averageUserMessagesPerConversation: prisma.$queryRawTyped(
        getAverageMessagesOfTypeOverPeriod(
          session.user.id,
          MessageType.user,
          periodStart,
          periodEnd
        )
      ),

      averageBotMessagesPerConversation: prisma.$queryRawTyped(
        getAverageMessagesOfTypeOverPeriod(
          session.user.id,
          MessageType.bot,
          periodStart,
          periodEnd
        )
      ),

      averageActivityMessagesPerConversation: prisma.$queryRawTyped(
        getAverageMessagesOfTypeOverPeriod(
          session.user.id,
          MessageType.activity,
          periodStart,
          periodEnd
        )
      ),

      // ratings

      totalRatings: prisma.$queryRawTyped(
        getTotalRatingsOverPeriod(session.user.id, periodStart, periodEnd)
      ),

      totalRatingsPreviousPeriod: prisma.$queryRawTyped(
        getTotalRatingsOverPeriod(
          session.user.id,
          timePlusDays(-DEFAULT_PERIOD, periodStart),
          periodStart
        )
      ),

      totalThumbsUp: prisma.$queryRawTyped(
        getTotalThumbsUpOverPeriod(session.user.id, periodStart, periodEnd)
      ),

      totalThumbsUpPreviousPeriod: prisma.$queryRawTyped(
        getTotalThumbsUpOverPeriod(
          session.user.id,
          timePlusDays(-DEFAULT_PERIOD, periodStart),
          periodStart
        )
      ),

      totalThumbsDown: prisma.$queryRawTyped(
        getTotalThumbsDownOverPeriod(session.user.id, periodStart, periodEnd)
      ),

      totalThumbsDownPreviousPeriod: prisma.$queryRawTyped(
        getTotalThumbsDownOverPeriod(
          session.user.id,
          timePlusDays(-DEFAULT_PERIOD, periodStart),
          periodStart
        )
      ),

      breakdownOfRatings: prisma.$queryRawTyped(
        breakdownTotalRatingsOverPeriod(session.user.id, periodStart, periodEnd)
      ),

      listOfContactsWithRatings: prisma.$queryRawTyped(
        listContactsWithRatingsOverPeriod(
          session.user.id,
          periodStart,
          periodEnd,
          100
        )
      ),

      listOfTopUpvoters: prisma.$queryRawTyped(
        listTopUpvotersOverPeriod(session.user.id, periodStart, periodEnd, 20)
      ),

      listOfTopDownvoters: prisma.$queryRawTyped(
        listTopDownvotersOverPeriod(session.user.id, periodStart, periodEnd, 20)
      ),

      // token usage

      totalTokens: prisma.$queryRawTyped(
        getTotalUsageTokensOverPeriod(session.user.id, periodStart, periodEnd)
      ),

      totalTokensPreviousPeriod: prisma.$queryRawTyped(
        getTotalUsageTokensOverPeriod(
          session.user.id,
          timePlusDays(-DEFAULT_PERIOD, periodStart),
          periodStart
        )
      ),

      breakdownOfTokens: prisma.$queryRawTyped(
        breakdownTotalUsageTokensOverPeriod(
          session.user.id,
          periodStart,
          periodEnd
        )
      ),

      listOfTopBotsByTokenUsage: prisma.$queryRawTyped(
        listTopBotsByTokenUsageOverPeriod(
          session.user.id,
          periodStart,
          periodEnd,
          20
        )
      ),

      listOfTopContactsByTokenUsage: prisma.$queryRawTyped(
        listTopContactsByTokenUsageOverPeriod(
          session.user.id,
          periodStart,
          periodEnd,
          20
        )
      ),
    })

    return {
      props: makeJsonSafe({
        data: [
          // token usage
          {
            title: 'Total Tokens',
            description: 'Total tokens consumed',
            value: Number(data.totalTokens[0].total),
            change:
              Number(data.totalTokens[0].total) -
              Number(data.totalTokensPreviousPeriod[0].total),
            period: periodCaption,

            details: {
              metric: {
                title: 'Total Tokens',
                description: 'Total tokens consumed',
                value: Number(data.totalTokens[0].total),
                change:
                  Number(data.totalTokens[0].total) -
                  Number(data.totalTokensPreviousPeriod[0].total),
                period: periodCaption,
              },

              lineChart: data.breakdownOfTokens.map(({ date, total }) => ({
                date: date?.toISOString().split('T')[0],
                total: Number(total),
              })),

              tabs: {
                allList: [
                  ...data.listOfTopBotsByTokenUsage.map(
                    ({ id, name, description, total }) => ({
                      id: id,
                      name: name || `Bot ${id}`,
                      description: description || `Bot ID: ${id}`,
                      link: `/bots/${id}`,
                      tags: [{ value: `${shortFormat(Number(total))} tokens` }],
                    })
                  ),
                  ...data.listOfTopContactsByTokenUsage.map(
                    ({ id, name, description, total }) => ({
                      id: id,
                      name: name || `Contact ${id}`,
                      description: description || `Contact ID: ${id}`,
                      link: `/contacts/${id}`,
                      tags: [{ value: `${shortFormat(Number(total))} tokens` }],
                    })
                  ),
                ],
                botList: data.listOfTopBotsByTokenUsage.map(
                  ({ id, name, description, total }) => ({
                    id: id,
                    name: name || `Bot ${id}`,
                    description: description || `Bot ID: ${id}`,
                    link: `/bots/${id}`,
                    tags: [{ value: `${shortFormat(Number(total))} tokens` }],
                  })
                ),
                contactList: data.listOfTopContactsByTokenUsage.map(
                  ({ id, name, description, total }) => ({
                    id: id,
                    name: name || `Contact ${id}`,
                    description: description || `Contact ID: ${id}`,
                    link: `/contacts/${id}`,
                    tags: [{ value: `${shortFormat(Number(total))} tokens` }],
                  })
                ),
              },
            },
          },

          // conversation
          {
            title: 'Total Conversations',
            description: 'Number of conversations handled',
            value: data.totalConversations[0].total,
            change:
              data.totalConversations[0].total -
              data.totalConversationsPreviousPeriod[0].total,
            period: periodCaption,

            details: {
              metric: {
                title: 'Total Conversations',
                description: 'Number of conversations handled',
                value: data.totalConversations[0].total,
                change:
                  data.totalConversations[0].total -
                  data.totalConversationsPreviousPeriod[0].total,
                period: periodCaption,
              },

              lineChart: data.breakdownOfConversations.map(
                ({ date, total }) => ({
                  date: date?.toISOString().split('T')[0],
                  total: total,
                })
              ),

              list: data.listOfActiveContactsWithConversations.map(
                ({
                  id,

                  name,
                  description,

                  email,
                  nick,

                  meta,

                  _countValue,
                  _countType,

                  ...rest
                }) => ({
                  ...rest,

                  id: id,
                  link: `/contacts/${id}`,

                  icon: `@gravatar/${email}`,

                  name: name || email || nick || id,
                  description: description || `id: ${id}`,

                  tags: [
                    { name: 'conversation', value: _countValue },
                    ...(typeof meta === 'object' &&
                    meta !== null &&
                    'app' in meta
                      ? [meta.app]
                      : []),
                  ],
                })
              ),
            },
          },

          // message
          {
            title: 'Total Messages',
            description: 'Number of messages exchanged',
            value: data.totalMessages[0].total,
            change:
              data.totalMessages[0].total -
              data.totalMessagesPreviousPeriod[0].total,
            period: periodCaption,

            details: {
              metric: {
                title: 'Total Messages',
                description: 'Number of messages exchanged',
                value: data.totalMessages[0].total,
                change:
                  data.totalMessages[0].total -
                  data.totalMessagesPreviousPeriod[0].total,
                period: periodCaption,
              },

              lineChart: data.breakdownOfMessages.map(({ date, total }) => ({
                date: date?.toISOString().split('T')[0],
                total: total,
              })),

              list: data.listOfActiveContactsWithMessages.map(
                ({
                  id,

                  name,
                  description,

                  email,
                  nick,

                  meta,

                  createdAt,

                  _countValue,
                  _countType,

                  ...rest
                }) => ({
                  ...rest,

                  id: id,
                  link: `/contacts/${id}`,

                  icon: `@gravatar/${email}`,

                  name: name || email || nick || id,
                  description: description || `id: ${id}`,

                  createdAt,

                  tags: [
                    { name: 'message', value: _countValue },

                    ...(typeof meta === 'object' &&
                    meta !== null &&
                    'app' in meta
                      ? [meta.app]
                      : []),
                  ],
                })
              ),
            },
          },
          {
            title: 'Total User Requests',
            description: 'Number of user requests processed',
            value: data.totalUserMessages[0].total,
            change:
              data.totalUserMessages[0].total -
              data.totalUserMessagesPreviousPeriod[0].total,
            period: periodCaption,

            details: {
              metric: {
                title: 'Total User Requests',
                description: 'Number of user requests processed',
                value: data.totalUserMessages[0].total,
                change:
                  data.totalUserMessages[0].total -
                  data.totalUserMessagesPreviousPeriod[0].total,
                period: periodCaption,
              },

              lineChart: data.breakdownOfUserMessages.map(
                ({ date, total }) => ({
                  date: date?.toISOString().split('T')[0],
                  total: total,
                })
              ),
            },
          },
          {
            title: 'Total Agent Responses',
            description: 'Number of agent responses delivered',
            value: data.totalBotMessages[0].total,
            change:
              data.totalBotMessages[0].total -
              data.totalBotMessagesPreviousPeriod[0].total,
            period: periodCaption,

            details: {
              metric: {
                title: 'Total Agent Responses',
                description: 'Number of agent responses delivered',
                value: data.totalBotMessages[0].total,
                change:
                  data.totalBotMessages[0].total -
                  data.totalBotMessagesPreviousPeriod[0].total,
                period: periodCaption,
              },

              lineChart: data.breakdownOfBotMessages.map(({ date, total }) => ({
                date: date?.toISOString().split('T')[0],
                total: total,
              })),
            },
          },
          {
            title: 'Total Agent Actions',
            description: 'Number of agent actions taken',
            value: data.totalActivityMessages[0].total,
            change:
              data.totalActivityMessages[0].total -
              data.totalActivityMessagesPreviousPeriod[0].total,
            period: periodCaption,

            details: {
              metric: {
                title: 'Total Agent Actions',
                description: 'Number of agent actions taken',
                value: data.totalActivityMessages[0].total,
                change:
                  data.totalActivityMessages[0].total -
                  data.totalActivityMessagesPreviousPeriod[0].total,
                period: periodCaption,
              },

              lineChart: data.breakdownOfActivityMessages.map(
                ({ date, total }) => ({
                  date: date?.toISOString().split('T')[0],
                  total: total,
                })
              ),

              list: data.listOfActions.map(
                ({ type, name, description, _countValue, _countType }) => ({
                  id: type,

                  name: name || type,
                  description: description || `Action type: ${type}`,

                  tags: [{ name: 'action', value: _countValue }],
                })
              ),
            },
          },
          {
            title: 'Average Number of User Requests per Conversation',
            description:
              'Average number of user messages taken in conversations',
            value: data.averageUserMessagesPerConversation[0].average,
            period: periodCaption,
          },
          {
            title: 'Average Number of Agent Responses per Conversation',
            description:
              'Average number of agent messages taken in conversations',
            value: data.averageBotMessagesPerConversation[0].average,
            period: periodCaption,
          },
          {
            title: 'Average Number of Actions per Conversation',
            description: 'Average number of actions taken in conversations',
            value: data.averageActivityMessagesPerConversation[0].average,
            period: periodCaption,
          },

          // ratings
          {
            title: 'Total Ratings',
            description: 'Number of ratings received',
            value: Number(data.totalRatings[0].total),
            change:
              Number(data.totalRatings[0].total) -
              Number(data.totalRatingsPreviousPeriod[0].total),
            period: periodCaption,

            details: {
              metric: {
                title: 'Total Ratings',
                description: 'Number of ratings received',
                value: Number(data.totalRatings[0].total),
                change:
                  Number(data.totalRatings[0].total) -
                  Number(data.totalRatingsPreviousPeriod[0].total),
                period: periodCaption,
              },

              lineChart: data.breakdownOfRatings.map(
                ({ date, total, thumbsUp, thumbsDown }) => ({
                  date: date?.toISOString
                    ? date.toISOString().split('T')[0]
                    : date,
                  total: Number(total),
                  thumbsUp: Number(thumbsUp),
                  thumbsDown: Number(thumbsDown),
                })
              ),

              list: data.listOfContactsWithRatings.map(
                ({
                  id,

                  name,
                  description,

                  email,
                  nick,

                  meta,

                  createdAt,

                  _upvoteCount,
                  _downvoteCount,

                  _countValue,
                  _countType,

                  ...rest
                }) => ({
                  ...rest,

                  id: id,
                  link: `/contacts/${id}`,

                  icon: `@gravatar/${email}`,

                  name: name || email || nick || id,
                  description: description || `id: ${id}`,

                  createdAt,

                  tags: [
                    { name: 'rating', value: _countValue },

                    ...(typeof meta === 'object' &&
                    meta !== null &&
                    'app' in meta
                      ? [meta.app]
                      : []),

                    { name: 'upvote', value: _upvoteCount },
                    { name: 'downvote', value: _downvoteCount },
                  ],
                })
              ),
            },
          },
          {
            title: 'Thumbs Up',
            description: 'Number of positive ratings received',
            value: Number(data.totalThumbsUp[0].total),
            change:
              Number(data.totalThumbsUp[0].total) -
              Number(data.totalThumbsUpPreviousPeriod[0].total),
            period: periodCaption,

            details: {
              metric: {
                title: 'Thumbs Up',
                description: 'Number of positive ratings received',
                value: Number(data.totalThumbsUp[0].total),
                change:
                  Number(data.totalThumbsUp[0].total) -
                  Number(data.totalThumbsUpPreviousPeriod[0].total),
                period: periodCaption,
              },

              list: data.listOfTopUpvoters.map(
                ({
                  id,

                  name,
                  description,

                  email,
                  nick,

                  meta,

                  createdAt,

                  _countValue,
                  _countType,

                  ...rest
                }) => ({
                  ...rest,

                  id: id,
                  link: `/contacts/${id}`,

                  icon: `@gravatar/${email}`,

                  name: name || email || nick || id,
                  description: description || `id: ${id}`,

                  createdAt,

                  tags: [
                    { name: 'upvote', value: _countValue },

                    ...(typeof meta === 'object' &&
                    meta !== null &&
                    'app' in meta
                      ? [meta.app]
                      : []),
                  ],
                })
              ),
            },
          },
          {
            title: 'Thumbs Down',
            description: 'Number of negative ratings received',
            value: Number(data.totalThumbsDown[0].total),
            change:
              Number(data.totalThumbsDown[0].total) -
              Number(data.totalThumbsDownPreviousPeriod[0].total),
            period: periodCaption,

            details: {
              metric: {
                title: 'Thumbs Down',
                description: 'Number of negative ratings received',
                value: Number(data.totalThumbsDown[0].total),
                change:
                  Number(data.totalThumbsDown[0].total) -
                  Number(data.totalThumbsDownPreviousPeriod[0].total),
                period: periodCaption,
              },

              list: data.listOfTopDownvoters.map(
                ({
                  id,

                  name,
                  description,

                  email,
                  nick,

                  meta,

                  createdAt,

                  _countValue,
                  _countType,

                  ...rest
                }) => ({
                  ...rest,

                  id: id,
                  link: `/contacts/${id}`,

                  icon: `@gravatar/${email}`,

                  name: name || email || nick || id,
                  description: description || `id: ${id}`,

                  createdAt,

                  tags: [
                    { name: 'downvote', value: _countValue },

                    ...(typeof meta === 'object' &&
                    meta !== null &&
                    'app' in meta
                      ? [meta.app]
                      : []),
                  ],
                })
              ),
            },
          },

          // contact
          {
            title: 'Total Contacts',
            description: 'Number of unique contacts',
            value: data.totalContacts[0].total,
            period: 'all time',

            details: {
              metric: {
                title: 'Total Contacts',
                description: 'Number of unique contacts',
                value: data.totalContacts[0].total,
                period: 'all time',
              },

              list: data.listOfContacts.map(
                ({ id, name, description, email, nick, meta, createdAt }) => ({
                  id,
                  link: `/contacts/${id}`,

                  icon: `@gravatar/${email}`,

                  name: name || email || nick || id,
                  description: description,

                  createdAt,

                  tags:
                    typeof meta === 'object' && meta !== null && 'app' in meta
                      ? [meta.app]
                      : [],
                })
              ),
            },
          },
          {
            title: 'Active Contacts',
            description: 'Number of active contacts',
            value: data.totalActiveContacts[0].total,
            change:
              data.totalActiveContacts[0].total -
              data.totalActiveContactsPreviousPeriod[0].total,
            period: periodCaption,

            details: {
              metric: {
                title: 'Active Contacts',
                description: 'Number of active contacts',
                value: data.totalActiveContacts[0].total,
                change:
                  data.totalActiveContacts[0].total -
                  data.totalActiveContactsPreviousPeriod[0].total,
                period: periodCaption,
              },

              lineChart: data.breakdownOfActiveContacts.map(
                ({ date, total }) => ({
                  date: date?.toISOString().split('T')[0],
                  total: total,
                })
              ),

              list: data.listOfActiveContactsWithConversations.map(
                ({
                  id,

                  name,
                  description,

                  email,
                  nick,

                  meta,

                  _countValue,
                  _countType,

                  ...rest
                }) => ({
                  ...rest,

                  id: id,
                  link: `/contacts/${id}`,

                  icon: `@gravatar/${email}`,

                  name: name || email || nick || id,
                  description: description || `id: ${id}`,

                  tags: [
                    { name: _countType, value: _countValue },
                    ...(typeof meta === 'object' &&
                    meta !== null &&
                    'app' in meta
                      ? [meta.app]
                      : []),
                  ],
                })
              ),
            },
          },
        ],

        periodStart,
        periodEnd,
        periodCaption,
      }),
    }
  } catch (e) {
    await captureException(e)

    return {
      redirect: {
        destination: `/overview`,
        permanent: false,
      },
    }
  }
}
