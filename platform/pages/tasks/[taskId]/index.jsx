import { useState } from 'react'

import { DEFAULT_LIMITS, PLATFORM_LIMITS } from '@/config/execution'

import prisma from '@/prisma/client'

import { formToData } from '@/lib/form'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'
import toast from '@/lib/toast'

import Dashboard from '@/layouts/Dashboard'

import BotSelect from '@/components/BotSelect'
import CodeAction from '@/components/CodeAction'
import { useConfirm, useConfirmDelete } from '@/components/Confirm'
import ContactSelect from '@/components/ContactSelect'
import ConversationList from '@/components/ConversationList'
import DurationSelect from '@/components/DurationSelect'
import EventLog from '@/components/EventLog'
import Expando from '@/components/Expando'
import ExpiresAtInput from '@/components/ExpiresAtInput'
import FAQ from '@/components/FAQ'
import GeneralBasicOptions from '@/components/GeneralBasicOptions'
import Headline from '@/components/Headline'
import MetaInput from '@/components/MetaInput'
import PageSections from '@/components/PageSections'
import ScheduleSelect from '@/components/ScheduleSelect'
import TaskExecutionList from '@/components/TaskExecutionList'
import ThisSolution from '@/components/ThisSolution'
import TimezoneSelect from '@/components/TimezoneSelect'

import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'
import useScopedCreateData from '@/hooks/useScopedCreateData'

import faq from '@/content/faqs/platform-task-instance.yaml'

export const VISIBLE_EVENT_TYPES = [
  // @note whitelist only specific events if applicable
]

export function Form({ task, updateCounter = 0, onTaskUpdate }) {
  const confirm = useConfirm()

  const confirmDelete = useConfirmDelete()

  const [taskStatus, setTaskStatus] = useState(task.status)

  const router = useRouter()

  const scopeCreateData = useScopedCreateData()

  const { code, fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  async function handleOnSubmit(event) {
    event.preventDefault()

    const data = formToData(event.target)

    if (!data) {
      return
    }

    if (task.id) {
      const { error } = await fetch(`/api/v1/task/${task.id}/update`, {
        data,

        successMessage: 'Task updated.',
      })

      if (!error) {
        Object.assign(task, data)

        onTaskUpdate?.()
      }
    } else {
      const {
        data: { id: taskId },
      } = await fetch(`/api/v1/task/create`, {
        data: scopeCreateData(data),

        successMessage: 'Task created.',
      })

      if (taskId) {
        router.push(`/tasks/${taskId}`)
      }
    }
  }

  async function handleDelete(event) {
    event.preventDefault()

    if (!(await confirmDelete('Do you really want to delete this task?'))) {
      return
    }

    const { error } = await fetch(`/api/v1/task/${task.id}/delete`, {
      data: {},
    })

    if (!error) {
      router.push(`/tasks`)
    }
  }

  async function handleTrigger(event) {
    event.preventDefault()

    if (
      !(await confirm('Are you sure you want to run this task immediately?'))
    ) {
      return
    }

    const toastId = toast.loading('Triggering task...', {})

    try {
      const { error } = await fetch(`/api/v1/task/${task.id}/trigger`, {
        method: 'POST',
        data: {},
        successMessage: 'Task triggered.',
        failureMessage: 'Failed to trigger task.',
      })

      if (!error) {
        onTaskUpdate?.()
        setTaskStatus('running')
      }
    } catch (e) {
      toast.error(e.message, { id: toastId })
    }
  }

  async function handleCancelTask(event) {
    event.preventDefault()

    if (!(await confirm('Are you sure you want to cancel this task?'))) {
      return
    }

    const { error } = await fetch(`/api/v1/task/${task.id}/cancel`, {
      method: 'POST',
      data: {},
      successMessage: 'Task canceled.',
      failureMessage: 'Failed to cancel task.',
    })

    if (!error) {
      onTaskUpdate?.()
      setTaskStatus('idle')
    }
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      <ThisSolution
        type="task"
        instance={task}
        updateKey={updateCounter}
        portal={true}
      />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          {/* task configuration */}
          <div>
            <Headline title="Task Configuration">
              This information is used to configure the task.
            </Headline>
            <div className="mt-6 space-y-6">
              {/* general basic options */}
              <GeneralBasicOptions instance={task} />
              {/* contactId */}
              <div>
                <label className="default-label" htmlFor="contactId">
                  Contact
                </label>
                <div className="mt-1">
                  <ContactSelect
                    className="default-input w-full max-w-xs"
                    name="contactId"
                    defaultValue={task.contactId}
                  />
                </div>
                <p className="input-description">
                  Optionally associate this task with a specific contact by
                  entering their ID.
                </p>
              </div>
              {/* botId */}
              <div>
                <label className="default-label" htmlFor="botId">
                  Bot
                </label>
                <div className="mt-1">
                  <BotSelect
                    className="default-input w-full max-w-xs"
                    name="botId"
                    defaultValue={task.botId}
                  />
                </div>
                <p className="input-description">
                  Select an existing bot (optional).
                </p>
              </div>
              {/* schedule */}
              <div>
                <label className="default-label" htmlFor="schedule">
                  Schedule
                </label>
                <div className="mt-1">
                  <ScheduleSelect
                    className="default-input w-full max-w-xs"
                    name="schedule"
                    defaultValue={task.schedule}
                    allowCustom={true}
                  />
                </div>
                <p className="input-description">
                  The task scheduled defines how often to invoke the task.
                </p>
              </div>
              {/* timezone */}
              <div>
                <label className="default-label" htmlFor="timezone">
                  Timezone
                </label>
                <div className="mt-1">
                  <TimezoneSelect
                    className="default-input w-full max-w-xs"
                    name="timezone"
                    defaultValue={task.timezone}
                  />
                </div>
                <p className="input-description">
                  The timezone used for cron and local-time schedules.
                </p>
              </div>
              {/* advanced options */}
              <Expando
                titleClassName="default-link text-sm"
                title="Advanced Options"
              >
                {/* expiry */}
                <div>
                  <label className="default-label" htmlFor="expiresAt">
                    Expires
                  </label>
                  <div className="mt-1">
                    <ExpiresAtInput
                      className="default-input w-full max-w-xs"
                      name="expiresAt"
                      defaultValue={task.expiresAt}
                    />
                  </div>
                  <p className="input-description">
                    When set, the task is automatically deleted at this time (in
                    your local timezone). Leave empty for no expiry.
                  </p>
                </div>
                {/* sessionDuration */}
                <div>
                  <label className="default-label" htmlFor="sessionDuration">
                    Session Duration
                  </label>
                  <div className="mt-1">
                    <DurationSelect
                      className="default-input w-full max-w-xs"
                      name="sessionDuration"
                      defaultValue={task.sessionDuration}
                      nullable
                      defaultCaption="1 day (default)"
                    />
                  </div>
                  <p className="input-description">
                    The bot will be able to continue the same conversation for
                    the specified time period.
                  </p>
                </div>
                {/* maxIterations */}
                <div>
                  <label className="default-label" htmlFor="maxIterations">
                    Max Iterations
                  </label>
                  <div className="mt-1">
                    <input
                      type="number"
                      className="default-input w-full max-w-xs sm:text-sm"
                      name="maxIterations"
                      defaultValue={task.maxIterations || ''}
                      min={PLATFORM_LIMITS.minIterations}
                      max={PLATFORM_LIMITS.maxIterations}
                      placeholder={DEFAULT_LIMITS.maxIterations}
                    />
                  </div>
                  <p className="input-description">
                    The maximum number of iterations per task execution (
                    {PLATFORM_LIMITS.minIterations}-
                    {PLATFORM_LIMITS.maxIterations}). Leave empty for the
                    default of {DEFAULT_LIMITS.maxIterations}.
                  </p>
                </div>
                {/* maxTime */}
                <div>
                  <label className="default-label" htmlFor="maxTime">
                    Max Time
                  </label>
                  <div className="mt-1">
                    <DurationSelect
                      className="default-input w-full max-w-xs sm:text-sm"
                      name="maxTime"
                      defaultValue={task.maxTime}
                      minutesOptions={[15, 30, 45]}
                      hoursOptions={[1, 2, 4, 6, 12, 24]}
                      defaultCaption="1 hour (default)"
                    />
                  </div>
                  <p className="input-description">
                    The maximum time allowed for the task execution (
                    {PLATFORM_LIMITS.minTime / 60000} minutes-
                    {PLATFORM_LIMITS.maxTime / 3600000} hours). Leave empty for
                    the default of {DEFAULT_LIMITS.maxTime / 3600000} hours.
                  </p>
                </div>
                {/* meta */}
                <div>
                  <label className="default-label" htmlFor="meta">
                    Meta
                  </label>
                  <div className="mt-1">
                    <MetaInput name="meta" defaultMeta={task.meta} />
                  </div>
                  <p className="input-description">
                    Custom metadata for this task.
                  </p>
                </div>
              </Expando>
            </div>
          </div>
        </div>
        {/* actions */}
        <div>
          <div className="action-area">
            {/* <BackLink className="default-button" href="/tasks">
              Back To Tasks
            </BackLink> */}
            {task.id ? (
              <button
                type="button"
                className="danger-button"
                onClick={handleDelete}
              >
                Delete
              </button>
            ) : null}
            {task.id ? (
              <button
                type="button"
                className="danger-button"
                onClick={handleCancelTask}
                disabled={taskStatus !== 'running'}
              >
                Cancel Task
              </button>
            ) : null}
            {task.id ? (
              <button
                type="button"
                className="default-button"
                onClick={handleTrigger}
              >
                Trigger Now
              </button>
            ) : null}
            <span className="action-area-space" />
            <button type="submit" className="primary-button">
              {task.id ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </form>
    </>
  )
}

export default function Index({ task }) {
  const [updateCounter, setUpdateCounter] = useState(0)

  return (
    <>
      {/* <div className="main-page last">
        <NavHeader link="/tasks" caption="tasks" title="Task" beta={true}>
          <p>
            A task is a unit of work that is performed by an agent. It can be
            scheduled to run at a specific time or on a recurring basis.
          </p>
        </NavHeader>
      </div> */}
      <PageSections className="pt-12">
        <section data-page-section-title="Configuration">
          <div className="main-page">
            <Form
              task={task}
              updateCounter={updateCounter}
              onTaskUpdate={() => setUpdateCounter((value) => value + 1)}
            />
          </div>
        </section>
        {task.id ? (
          <section data-page-section-title="Executions">
            <div className="main-page">
              <Headline title="Executions">
                Review individual task runs and cancel a specific execution when
                needed.
              </Headline>
              <TaskExecutionList
                key={`task-executions-${updateCounter}`}
                taskId={task.id}
              />
            </div>
          </section>
        ) : null}
        {task.id && task.conversations && task.conversations.length > 0 ? (
          <section data-page-section-title="Conversations">
            <div className="main-page">
              <Headline title="Conversations">
                Conversations linked to this task.
              </Headline>
              <ConversationList
                defaultItems={task.conversations}
                exportRoute={null}
                filter={false}
                quickAccess={true}
              />
            </div>
          </section>
        ) : null}
        {/* {task.id ? (
          <section>
            <div className="main-page">
              <Headline title="Meta">
                Meta fields assigned to this task.
              </Headline>
              <MetaArea instance={task} />
            </div>
          </section>
        ) : null} */}
        {task.id ? (
          <section data-page-section-title="Events">
            <div className="main-page">
              <Headline title="Events">
                Keep tabs on the progress of your task events.
              </Headline>
              <EventLog
                key={`task-events-${updateCounter}`}
                eventTypes={VISIBLE_EVENT_TYPES}
                autoLoad={true}
                contextFilters={{ taskId: task.id }}
                filter={false}
              />
            </div>
          </section>
        ) : null}
      </PageSections>
    </>
  )
}

Index.getLayout = function (children, { task }) {
  return (
    <Dashboard
      breadcrumbs={['Tasks', 'ChatBotKit']}
      title={task.name || task.id || 'New'}
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

  if (context.query.taskId === 'new') {
    return {
      props: makeJsonSafe({
        task: {},
      }),
    }
  }

  const task = await prisma.task.findUnique({
    where: {
      id: context.query.taskId,
    },

    include: {
      contact: {
        select: {
          id: true,

          name: true,
          description: true,
        },
      },

      bot: {
        select: {
          id: true,

          name: true,
          description: true,
        },
      },

      conversations: {
        select: {
          id: true,

          name: true,
          description: true,

          createdAt: true,
          updatedAt: true,
        },
      },
    },
  })

  if (!task) {
    return {
      notFound: true,
    }
  }

  if (task.userId !== session.user.id) {
    return {
      notFound: true,
    }
  }

  return {
    props: makeJsonSafe({
      task,
    }),
  }
}

/**
 * @doc Tasks
 * @category Objects
 * @index 11
 *
 * ## Configuring Task Details
 *
 * When you create or edit a task, you have several options to control exactly how your AI agent executes the work. Understanding these settings helps you create effective automated workflows that serve your contacts perfectly.
 *
 * ### Basic Configuration
 *
 * **Name and Description**: Give your task a clear, descriptive name that explains its purpose at a glance. The description is crucial - this is where you tell your AI agent exactly what to do when the task runs. Be specific about the action you want taken, what the agent should say, or what outcome you're looking for. For example: "Send a friendly check-in message asking how they're enjoying the product and if they need any help."
 *
 * **Contact** (optional): Associate this task with a specific contact. When set, the agent can personalize task execution based on that contact's history and context. Tasks without a contact are useful for general agent workflows that are not tied to a specific individual.
 *
 * **Bot** (optional): Choose which AI agent will execute this task. The bot you select will use its configured knowledge, personality, and capabilities when performing the task. This means you can have different bots handling different types of tasks (e.g., a support bot for technical follow-ups, a sales bot for outreach).
 *
 * ### Scheduling Options
 *
 * The schedule determines when your task runs:
 *
 * - **One-time**: The task runs once at the next scheduled time, then stops
 * - **Hourly**: Perfect for urgent monitoring or time-sensitive follow-ups
 * - **Daily**: Good for regular check-ins or daily updates
 * - **Weekly**: Ideal for recurring meetings reminders or weekly reports
 * - **Monthly**: Great for monthly reviews, billing reminders, or periodic surveys
 * - **Custom**: Create your own cron schedule for precise timing control
 *
 * **Timezone**: Choose the timezone used for cron and local-time schedules. This ensures your task runs at the correct local time for your audience, regardless of where the servers are located.
 *
 * Once you set a schedule, your dashboard shows you when the task last ran and when it will run next, so you always know the status of your automations.
 *
 * ### Advanced Options
 *
 * **Session Duration**: This controls how long the bot can continue a conversation started by the task. If your task initiates a conversation and the contact responds, the bot will stay active in that conversation for the specified duration. For example, if you set this to 1 hour and the task starts a conversation at 2 PM, the bot can continue responding to that contact until 3 PM.
 *
 * **Max Iterations**: This limits how many agent iterations are allowed during a single task execution. Use this to keep open-ended tasks from running indefinitely. The configurable range is 10 to 100,000 iterations. If you leave this empty, the task uses the default of 1,000 iterations.
 *
 * **Max Time**: This limits how long a single task execution is allowed to run. Use this for long-running workflows where time is a better safety boundary than iteration count. The configurable range is 15 minutes to 24 hours. If you leave this empty, the task uses the default of 15 minutes.
 *
 * **Meta Fields**: Add custom metadata to your tasks for advanced tracking and organization. This is useful for integrating with other systems, categorizing tasks, or storing additional context that your workflows might need.
 *
 * ### Task Actions
 *
 * **Trigger Now**: Don't want to wait for the next scheduled run? Click "Trigger Now" to execute the task immediately. This is perfect for testing your task or handling urgent situations where you need the agent to act right away.
 *
 * **Cancel Task**: If a task is currently running, click "Cancel Task" to stop the active execution and return the task to an idle state. The task is not deleted; it remains configured and can run again on its schedule or be triggered manually later.
 *
 * **Executions**: Each run appears in the executions list. Use this list to review individual task runs and cancel a specific execution when you need more precise control than canceling the task as a whole.
 *
 * **Monitoring**: After your task runs, you can see the conversations it created and review what actions your agent took. This helps you verify that tasks are working as expected and provides transparency into your automated workflows.
 *
 * ### Best Practices
 *
 * - **Start Simple**: Create a basic task first, test it with "Trigger Now", and refine the description based on how your agent performs
 * - **Be Specific**: The more detailed your task description, the better your agent can execute it
 * - **Monitor Results**: Check the conversations and events created by your tasks to ensure they're achieving your goals
 * - **Adjust Schedules**: Start with longer intervals and increase frequency once you're confident the task is working well
 * - **Use Meaningful Names**: When you have many tasks, clear names help you quickly understand what each one does
 *
 * Tasks give you incredible flexibility to automate personalized interactions at scale. With the right configuration, your AI agents can maintain consistent, helpful engagement with every contact on your behalf.
 */
