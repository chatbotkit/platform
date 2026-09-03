'use client'

import { useCallback, useEffect, useState } from 'react'

import { errorToErrorResponse } from '@/lib/error'
import toast from '@/lib/toast'

import { AppNavExtra } from '@/layouts/App'

import { useConfirmDelete } from '@/components/Confirm'
import DescriptionInput from '@/components/DescriptionInput'
import List from '@/components/List'
import NameInput from '@/components/NameInput'
import ScheduleSelect from '@/components/ScheduleSelect'
import TimezoneSelect from '@/components/TimezoneSelect'

import usePopup from '@/hooks/usePopup'
import useRouter from '@/hooks/useRouter'

import { APP_NAME } from '../const'
import {
  cancelTask,
  createTask,
  deleteTask,
  listExecutions,
  listTasks,
  triggerTask,
  updateTask,
} from '../server'

import clsx from 'clsx'
import { TriangleAlert } from 'lucide-react'

function unwrap(result) {
  if (!result) {
    throw new Error('Unexpected action result')
  }

  if ('error' in result) {
    throw errorToErrorResponse(result.error)
  }

  return result
}

const NAMED_SCHEDULES = new Set([
  'quarterhourly',
  'halfhourly',
  'hourly',
  'twicedaily',
  'daily',
  'twiceweekly',
  'weekly',
  'twicemonthly',
  'monthly',
])

function classifySchedule(schedule) {
  if (!schedule || schedule === 'never') {
    return { kind: 'ondemand', label: 'on demand' }
  }

  if (NAMED_SCHEDULES.has(schedule)) {
    return { kind: 'recurring', label: `Recurring · ${schedule}` }
  }

  if (schedule.trim().split(/\s+/).length === 5) {
    return { kind: 'recurring', label: `Recurring · ${schedule}` }
  }

  if (/^\d{1,2}:\d{2}$/.test(schedule)) {
    return { kind: 'recurring', label: `Daily at ${schedule}` }
  }

  const date = new Date(schedule)

  if (!Number.isNaN(date.getTime())) {
    return { kind: 'once', label: `Once · ${date.toLocaleString()}` }
  }

  return { kind: 'recurring', label: schedule }
}

function formatTime(value) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString()
}

function OutcomeTag({ status, outcome }) {
  const running = status === 'running'

  const tone = running
    ? 'tag-info'
    : outcome === 'success'
      ? 'tag-success'
      : outcome === 'failure'
        ? 'tag-danger'
        : 'tag-muted'

  return (
    <span className={clsx('tag', tone)}>{running ? 'running' : outcome}</span>
  )
}

/* --------------------------- create / edit dialog ------------------------- */

/**
 * The shared task form for both create and edit. Fields are uncontrolled and
 * read back via the popup's `formToData`; `defaults` pre-fills them when
 * editing an existing task.
 */
function TaskFields({ defaults = {} }) {
  return (
    <div className="space-y-6">
      <div>
        <label className="default-label" htmlFor="name">
          Name
        </label>
        <div className="mt-1">
          <NameInput
            className="default-input w-full"
            name="name"
            defaultValue={defaults.name || ''}
            placeholder="Triage stale issues"
            required
          />
        </div>
      </div>

      <div>
        <label className="default-label" htmlFor="description">
          Description
        </label>
        <div className="mt-1">
          <DescriptionInput
            className="default-input w-full"
            name="description"
            defaultValue={defaults.description || ''}
            placeholder="What should the agent do? Be specific about scope and the definition of done."
            magic={false}
            required
          />
        </div>
      </div>

      <div>
        <label className="default-label" htmlFor="schedule">
          Schedule
        </label>
        <div className="mt-1">
          <ScheduleSelect
            className="default-input w-full"
            name="schedule"
            defaultValue={defaults.schedule || 'never'}
            allowCustom={true}
          />
        </div>
        <p className="input-description">
          <code>never</code> runs on demand only. Pick an interval, or a custom
          cron / date.
        </p>
      </div>

      <div>
        <label className="default-label" htmlFor="timezone">
          Timezone
        </label>
        <div className="mt-1">
          <TimezoneSelect
            className="default-input w-full"
            name="timezone"
            defaultValue={defaults.timezone || undefined}
          />
        </div>
      </div>
    </div>
  )
}

/* -------------------------------- detail ---------------------------------- */

function ExecutionsLog({ taskId, reloadKey }) {
  const [executions, setExecutions] = useState(null)

  useEffect(() => {
    let live = true

    setExecutions(null)
    ;(async () => {
      try {
        const { executions } = unwrap(await listExecutions({ taskId }))

        if (live) {
          setExecutions(executions)
        }
      } catch (e) {
        toast.error(e.message)

        if (live) {
          setExecutions([])
        }
      }
    })()

    return () => {
      live = false
    }
  }, [taskId, reloadKey])

  if (executions === null) {
    return <p className="text-sm auto-text-gray-500">Loading runs...</p>
  }

  if (executions.length === 0) {
    return (
      <p className="text-sm auto-text-gray-500">
        No runs yet. Use <span className="font-medium">Run now</span> to start
        one.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {executions.map((e) => (
        <div
          key={e.id}
          className="flex items-start gap-3 rounded-lg auto-bg-gray-100 px-3 py-2 text-sm"
        >
          <OutcomeTag status={e.status} outcome={e.outcome} />
          <div className="min-w-0 flex-1">
            <div className="auto-text-gray-500">{formatTime(e.createdAt)}</div>
            {e.summary && (
              <div className="mt-1 whitespace-pre-wrap">{e.summary}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function TaskDetail({ task, onChanged, onEdit }) {
  const [busy, setBusy] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const schedule = classifySchedule(task.schedule)

  const refresh = () => setReloadKey((k) => k + 1)

  const run = async () => {
    setBusy(true)

    const toastId = toast.loading('Starting...', {})

    try {
      unwrap(await triggerTask({ taskId: task.id }))

      toast.success('Task started', { id: toastId })

      await onChanged()
      refresh()
    } catch (e) {
      toast.error(e.message, { id: toastId })
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    setBusy(true)

    try {
      unwrap(await cancelTask({ taskId: task.id }))

      await onChanged()
      refresh()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 pt-20 pb-10 md:px-10">
      <div className="flex flex-col gap-4">
        {/* identity */}
        <div className="flex flex-col gap-2">
          <h1 className="text-lg font-medium">{task.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="tag tag-muted">{schedule.label}</span>
            <OutcomeTag status={task.status} outcome={task.outcome} />
          </div>
        </div>

        {/* action toolbar - delete lives in the list row menu, not here */}
        <div className="flex flex-wrap items-center gap-2">
          {task.status === 'running' ? (
            <button
              type="button"
              className="default-button"
              disabled={busy}
              onClick={cancel}
            >
              Cancel run
            </button>
          ) : (
            <button
              type="button"
              className="primary-button"
              disabled={busy}
              onClick={run}
            >
              Run now
            </button>
          )}
          <button
            type="button"
            className="default-button"
            onClick={() => onEdit(task)}
          >
            Edit
          </button>
        </div>

        {task.description ? (
          <p className="whitespace-pre-wrap text-sm auto-text-gray-600">
            {task.description}
          </p>
        ) : (
          <p className="text-sm italic auto-text-gray-400">
            No description yet - use Edit to add one.
          </p>
        )}

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t auto-border-gray-100 pt-4 text-sm sm:grid-cols-3">
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs auto-text-gray-400">Schedule</dt>
            <dd className="auto-text-gray-700">{schedule.label}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs auto-text-gray-400">Next run</dt>
            <dd className="auto-text-gray-700">{formatTime(task.nextRunAt)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs auto-text-gray-400">Last run</dt>
            <dd className="auto-text-gray-700">{formatTime(task.lastRunAt)}</dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Run log</h2>
        <ExecutionsLog taskId={task.id} reloadKey={reloadKey} />
      </div>
    </div>
  )
}

/* --------------------------------- shell ---------------------------------- */

export function TasksMain({ factory, instance }) {
  const [tasks, setTasks] = useState(instance.tasks)
  const [activeId, setActiveId] = useState(instance.tasks[0]?.id ?? null)

  const router = useRouter()

  const { popup, openPopup, closePopup } = usePopup()

  const confirmDelete = useConfirmDelete()

  const openWarning = () => {
    openPopup(
      <div className="space-y-3 text-sm">
        <p>This factory&apos;s GitHub App isn&apos;t connected yet.</p>
        <p className="auto-text-gray-500">
          Until you connect it, the agent can&apos;t act on your
          organisation&apos;s repositories - tasks will run but have no GitHub
          access.
        </p>
      </div>,
      {
        title: 'GitHub not connected',
        type: 'alert',
        actions: {
          'Open Settings': {
            default: true,
            fn: () => {
              closePopup()
              router.push(`/apps/${APP_NAME}/${factory}/settings`)
            },
          },
        },
      }
    )
  }

  const reloadTasks = useCallback(async () => {
    try {
      const { tasks } = unwrap(await listTasks({ factory }))

      setTasks(tasks)
    } catch (e) {
      toast.error(e.message)
    }
  }, [factory])

  // Quick actions exposed from each row's menu - a superset lives in TaskDetail.
  const runTask = async (task) => {
    const toastId = toast.loading('Starting...', {})

    try {
      unwrap(await triggerTask({ taskId: task.id }))

      toast.success('Task started', { id: toastId })

      await reloadTasks()
    } catch (e) {
      toast.error(e.message, { id: toastId })
    }
  }

  const cancelRun = async (task) => {
    try {
      unwrap(await cancelTask({ taskId: task.id }))

      await reloadTasks()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const removeTask = async (task) => {
    const confirmed = await confirmDelete(
      `Delete task "${task.name}"? This cannot be undone.`,
      { title: 'Delete task' }
    )

    if (!confirmed) {
      return
    }

    try {
      unwrap(await deleteTask({ taskId: task.id }))

      if (activeId === task.id) {
        setActiveId(null)
      }

      await reloadTasks()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const openCreate = useCallback(() => {
    const submit = (runNow) => async (props) => {
      const name = (props?.name || '').trim()
      const description = (props?.description || '').trim()

      if (!name) {
        toast.error('Give the task a name')

        return
      }

      if (!description) {
        toast.error('Describe what the task should do')

        return
      }

      closePopup()

      const toastId = toast.loading('Creating task...', {})

      try {
        unwrap(
          await createTask({
            factory,
            name,
            description,
            schedule: props.schedule,
            timezone: props.timezone,
            runNow,
          })
        )

        toast.success(runNow ? 'Task created and started' : 'Task created', {
          id: toastId,
        })

        await reloadTasks()
      } catch (e) {
        toast.error(e.message, { id: toastId })
      }
    }

    openPopup(<TaskFields />, {
      title: 'New task',
      actions: {
        'Create task': { fn: submit(false) },
        'Create & run now': { fn: submit(true) },
      },
    })
  }, [factory, openPopup, closePopup, reloadTasks])

  const openEdit = (task) => {
    const submit = async (props) => {
      const name = (props?.name || '').trim()
      const description = (props?.description || '').trim()

      if (!name) {
        toast.error('Give the task a name')

        return
      }

      if (!description) {
        toast.error('Describe what the task should do')

        return
      }

      closePopup()

      const toastId = toast.loading('Saving task...', {})

      try {
        unwrap(
          await updateTask({
            taskId: task.id,
            name,
            description,
            schedule: props.schedule,
            timezone: props.timezone,
          })
        )

        toast.success('Task updated', { id: toastId })

        await reloadTasks()
      } catch (e) {
        toast.error(e.message, { id: toastId })
      }
    }

    openPopup(<TaskFields defaults={task} />, {
      title: 'Edit task',
      actions: {
        'Save changes': { default: true, fn: submit },
      },
    })
  }

  const activeTask = tasks.find((t) => t.id === activeId) || null

  return (
    <div className="flex h-screen w-full flex-row">
      {popup}

      <AppNavExtra>
        <div className="flex items-center gap-2">
          {!instance.githubConfigured && (
            <button
              type="button"
              onClick={openWarning}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-amber-600 hover:auto-bg-gray-100 dark:text-amber-400"
            >
              <TriangleAlert className="h-4 w-4" />
              GitHub not connected
            </button>
          )}
          <button type="button" className="primary-button" onClick={openCreate}>
            New task
          </button>
        </div>
      </AppNavExtra>

      {/* list */}
      <div className="subtle-scrollbar w-full max-w-[22rem] shrink-0 overflow-auto p-3">
        <List
          emptyMessage={
            <>
              No tasks yet. Use <span className="font-medium">New task</span> to
              create one.
            </>
          }
        >
          {tasks.map((task) => {
            const schedule = classifySchedule(task.schedule)
            const running = task.status === 'running'

            return (
              <List.Item
                key={task.id}
                title={task.name}
                selected={activeId === task.id}
                onClick={() => setActiveId(task.id)}
                actions={{
                  ...(running
                    ? { 'Cancel run': () => cancelRun(task) }
                    : { 'Run now': () => runTask(task) }),
                  Edit: () => openEdit(task),
                  Delete: () => removeTask(task),
                }}
              >
                <OutcomeTag status={task.status} outcome={task.outcome} />
                <span className="tag tag-muted">{schedule.label}</span>
              </List.Item>
            )
          })}
        </List>
      </div>

      {/* detail */}
      <div className="w-full overflow-auto border-l auto-border-gray-100">
        {activeTask ? (
          <TaskDetail
            key={activeTask.id}
            task={activeTask}
            onChanged={reloadTasks}
            onEdit={openEdit}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 p-8 text-center">
            <p className="text-sm auto-text-gray-500">
              Select a task to see its run log.
            </p>
            <p className="text-xs auto-text-gray-400">
              Everything the agent does is a task - recurring or one-off.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
