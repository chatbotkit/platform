import prisma from '@/prisma/client'

import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import DocsLink from '@/components/DocsLink'
import FAQ from '@/components/FAQ'
import Hero from '@/components/Hero'
import Link from '@/components/Link'
import TaskList from '@/components/TaskList'

import faq from '@/content/faqs/platform-tasks.yaml'

export default function Index({
  authenticated,
  botId,
  contactId,
  filterOptions,
}) {
  return (
    <section className="section-white">
      <div className="main-page main-page-list">
        <TaskList
          botId={botId}
          contactId={contactId}
          filterOptions={filterOptions}
          autoLoad
          loadMore="auto"
          actions={
            authenticated ? (
              <Link className="primary-button" href="/tasks/new">
                Create Task
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
      title="Tasks"
      authenticated={authenticated}
    >
      {authenticated ? (
        children
      ) : (
        <PageHero>
          <DocsLink className="default-button" slug="tasks">
            Learn More
          </DocsLink>
          {/* <Link
          className="primary-button"
          href={{
            pathname: '/signin',
            query: {
              callbackUrl: '/tasks',
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
      title={['Create and manage tasks', 'for your contacts']}
      description="Tasks enable your AI agents to perform scheduled or on-demand actions for your contacts, such as run workflows, automate follow-ups, and delegate routine operations."
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

  const botIdValue = context.query.botId
  const contactIdValue = context.query.contactId

  const botId = typeof botIdValue === 'string' ? botIdValue : undefined
  const contactId =
    typeof contactIdValue === 'string' ? contactIdValue : undefined

  const bots = await prisma.bot.findMany({
    where: {
      userId: session.user.id,
    },

    orderBy: [
      {
        createdAt: 'desc',
      },
    ],

    select: {
      id: true,

      name: true,
      description: true,

      createdAt: true,
    },
  })

  const filterOptions = bots.map((bot) => ({
    id: `bot-${bot.id}`,
    link: `?botId=${bot.id}`,
    title: bot.name || bot.id,
    description: bot.description || 'Bot without description',
    tag: 'bot',
    displayName: bot.name || bot.id,
    timestamp: bot.createdAt,
    isSelected: !!(context.query.botId && context.query.botId === bot.id),
  }))

  return {
    props: makeJsonSafe({
      authenticated: true,

      botId: botId,
      contactId: contactId,

      filterOptions: filterOptions,
    }),
  }
}

/**
 * @doc Tasks
 * @description Create automated actions that your AI agents can perform on schedule or on-demand
 * @category Objects
 * @tags task, automation, agent, contact, workflow, schedule
 * @index 10
 * @date Thu, May 29, 2026, 12:00 AM
 *
 * Tasks are automation tools that let your AI agents perform specific actions on a schedule or on-demand. Think of them as scheduled reminders or automated follow-ups that your agents can execute without manual intervention every time.
 *
 * ## What Are Tasks?
 *
 * A task is a specific instruction or action that an AI agent performs. Unlike conversations that happen in real-time, tasks can be scheduled to run automatically at specific times or intervals. For example, you might create a task to:
 *
 * - Send a weekly check-in message to a customer
 * - Follow up on an open support ticket every 3 days
 * - Run a monthly satisfaction survey for active users
 * - Send appointment reminders 24 hours in advance
 * - Execute custom workflows based on contact preferences
 *
 * ## Key Benefits
 *
 * **Flexible Automation**: Tasks can be scoped to a specific contact for personalized outreach, or run without a contact for general agent workflows. Your agent uses the task description to determine what to do and can tailor interactions based on any associated contact history.
 *
 * **Flexible Scheduling**: You control when and how often tasks run. Set them to execute once, daily, weekly, monthly, or create custom schedules that match your business needs. You can also trigger tasks manually whenever you need immediate action.
 *
 * **Hands-Free Operation**: Once you create a task, your AI agent handles everything automatically. The agent will execute the task according to the schedule, maintaining consistent engagement without requiring your constant attention.
 *
 * **Workflow Integration**: Tasks work seamlessly with your bots and contacts. The agent uses the bot's configuration and knowledge to perform the task, ensuring consistent responses that align with your brand and processes.
 *
 * ## How Tasks Work
 *
 * When you create a task, you specify:
 * - **The Instructions**: What the agent should do (specified in the task name and description)
 * - **The Schedule**: When and how often it should run
 * - **The Bot** (optional): Which AI agent will perform the task
 * - **The Contact** (optional): Who this task is for
 *
 * Your agent then executes the task automatically according to the schedule, creating conversations and taking actions as needed. You can monitor all task activity, see when tasks last ran, and view their outcomes in your dashboard.
 *
 * ## Getting Started
 *
 * Creating your first task is simple:
 *
 * 1. Click "Create Task" from your Tasks dashboard
 * 2. Give your task a descriptive name (e.g., "Weekly Customer Check-in")
 * 3. Add a description explaining what the agent should do
 * 4. Optionally select a contact this task is for
 * 5. Optionally choose which bot should execute the task
 * 6. Set your preferred schedule
 * 7. Click "Create" and your agent will take it from there
 *
 * You can view all your tasks in one place, see each task's status and last outcome, and track when they'll run next. Filter tasks by bot to focus on specific workflows.
 *
 * ## Practical Examples
 *
 * **Customer Success**: Create tasks for your AI agent to check in with customers 7 days after they make a purchase, asking about their experience and offering assistance.
 *
 * **Support Follow-ups**: Set up tasks to automatically follow up on open support tickets every 2-3 days until they're resolved.
 *
 * **Appointment Management**: Schedule tasks to send reminders to contacts before their scheduled appointments, reducing no-shows.
 *
 * **Engagement Campaigns**: Create recurring tasks that share relevant content or updates with specific customer segments on a regular basis.
 *
 * Tasks give you the power to automate interactions at scale, ensuring consistent agent engagement while maintaining the personal touch your contacts expect.
 */
