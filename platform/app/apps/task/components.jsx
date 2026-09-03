'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { errorToErrorResponse } from '@/lib/error'
import { throwUnprocessableEntity } from '@/lib/response'
import toast from '@/lib/toast'

import { AppScene } from '@/layouts/App'

import BotSelect from '@/components/BotSelect'
import { useConfirmDanger, useConfirmDelete } from '@/components/Confirm'
import DescriptionInput from '@/components/DescriptionInput'
import List from '@/components/List'
import NameInput from '@/components/NameInput'
import ScheduleSelect from '@/components/ScheduleSelect'
import TimezoneSelect from '@/components/TimezoneSelect'

import useControlledState from '@/hooks/useControlledState'
import usePopup from '@/hooks/usePopup'

import manifest from './app.manifest'
import {
  createTask,
  deleteTask,
  fetchTaskDetails,
  listTasks,
  triggerTask,
  updateTask,
} from './server'

import clsx from 'clsx'

export function TaskScreen({ task, bots }) {
  return (
    <div className="space-y-6">
      {/* name */}
      <div>
        <label className="default-label" htmlFor="name">
          Name
        </label>
        <div className="mt-1">
          <NameInput
            className="default-input w-full"
            name="name"
            type="text"
            defaultValue={task.name || ''}
            required={true}
          />
        </div>
        <p className="input-description">
          Name the task so it is easy to recognize in your task list.
        </p>
      </div>
      {/* description */}
      <div>
        <label className="default-label" htmlFor="description">
          Description
        </label>
        <div className="mt-1">
          <DescriptionInput
            className="default-input w-full"
            name="description"
            defaultValue={task.description || ''}
            magic={false}
            required={true}
          />
        </div>
        <p className="input-description">
          Describe what this task should do. This is required.
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
            bots={bots}
            defaultValue={task.botId}
            required={true}
            refLink={false}
            allowCreate={false}
          />
        </div>
        <p className="input-description">
          Select the bot assigned to this task. This is required.
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
    </div>
  )
}

export function TaskList({
  tasks: _tasks,
  setTasks: _setTasks,

  bots: _bots,
}) {
  const confirmDelete = useConfirmDelete()
  const confirmDanger = useConfirmDanger()

  const { popup, openPopup, closePopup } = usePopup()

  const [tasks, setTasks] = useControlledState([], _tasks, _setTasks)

  const [bots] = useState(_bots)

  const taskDetailsCacheRef = useRef({})
  const inFlightTaskDetailsRef = useRef({})

  const prefetchTaskDetails = useCallback(async (taskId, options = {}) => {
    if (!taskId || String(taskId).startsWith('temp-')) {
      return null
    }

    const { force = false } = options

    const now = Date.now()
    const cacheEntry = taskDetailsCacheRef.current[taskId]

    if (!force && cacheEntry && now - cacheEntry.cachedAt < 30_000) {
      return cacheEntry.data
    }

    if (inFlightTaskDetailsRef.current[taskId]) {
      return inFlightTaskDetailsRef.current[taskId]
    }

    const request = (async () => {
      const result = await fetchTaskDetails({ id: taskId })

      if (!result || 'error' in result) {
        throw new Error(result?.error?.message || 'Failed to load task details')
      }

      taskDetailsCacheRef.current[taskId] = {
        data: result,
        cachedAt: Date.now(),
      }

      return result
    })()

    inFlightTaskDetailsRef.current[taskId] = request

    try {
      return await request
    } finally {
      delete inFlightTaskDetailsRef.current[taskId]
    }
  }, [])

  const openTaskDetailsScreen = useCallback(
    (taskId) => {
      const cachedDetails = taskDetailsCacheRef.current[taskId]?.data || null

      openPopup(
        <TaskDetailsScreen
          taskId={taskId}
          initialDetails={cachedDetails}
          prefetchTaskDetails={prefetchTaskDetails}
        />,
        {
          title: 'Task Details',
        }
      )

      prefetchTaskDetails(taskId, { force: true }).catch(() => {
        // @note handled in popup fetch flow
      })
    },
    [openPopup, prefetchTaskDetails]
  )

  useEffect(() => {
    const taskIdsToPrefetch = tasks
      .filter((task) => !String(task.id).startsWith('temp-'))
      .sort((a, b) => {
        if (a.status === 'running' && b.status !== 'running') {
          return -1
        }

        if (a.status !== 'running' && b.status === 'running') {
          return 1
        }

        return 0
      })
      .slice(0, 6)
      .map((task) => task.id)

    taskIdsToPrefetch.forEach((taskId) => {
      prefetchTaskDetails(taskId).catch(() => {
        // @note prefetch failures are non-blocking
      })
    })
  }, [prefetchTaskDetails, tasks])

  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const freshTasks = await listTasks({})

        if (!freshTasks || 'error' in freshTasks) {
          return
        }

        setTasks((tasks) => {
          const tempTasks = tasks.filter((task) =>
            String(task.id).startsWith('temp-')
          )

          const mergedTasks = freshTasks.map((freshTask) => {
            const currentTask = tasks.find((task) => task.id === freshTask.id)

            return currentTask ? { ...currentTask, ...freshTask } : freshTask
          })

          return [...tempTasks, ...mergedTasks]
        })
      } catch {
        // @note polling errors are intentionally ignored to keep the list responsive
      }
    }, 30_000)

    return () => clearInterval(pollInterval)
  }, [setTasks])

  const openCreateTaskScreen = useCallback(
    (task = {}) => {
      openPopup(<TaskScreen task={task} bots={bots} />, {
        title: 'Create Task',
        actions: {
          Create: {
            fn: async (props) => {
              closePopup()

              const toastId = toast.loading('Creating task...', {})

              const tempId = `temp-${Date.now()}-${Math.random()}`

              const isImmediateRun = props.schedule === 'never'

              setTasks((tasks) => [
                ...tasks,
                {
                  ...props,
                  id: tempId,
                  status: isImmediateRun ? 'running' : 'idle',
                  outcome: 'pending',
                },
              ])

              try {
                const result = await createTask(props)

                if (!result) {
                  return throwUnprocessableEntity('Unexpected action result')
                }

                if ('error' in result) {
                  throw errorToErrorResponse(result.error)
                }

                setTasks((tasks) =>
                  tasks.map((task) =>
                    task.id === tempId ? { ...task, id: result.id } : task
                  )
                )

                toast.success('Task created!', { id: toastId })
              } catch (e) {
                setTasks((tasks) => tasks.filter((task) => task.id !== tempId))

                toast.error(e.message, { id: toastId })
              }
            },

            default: true,
          },
        },
      })
    },
    [bots, closePopup, openPopup, setTasks]
  )

  const openUpdateTaskScreen = useCallback(
    (task) => {
      openPopup(<TaskScreen task={task} bots={bots} />, {
        title: 'Update Task',
        actions: {
          Update: {
            fn: async (props) => {
              closePopup()

              const toastId = toast.loading('Updating task...', {})

              const previousTasks = [...tasks]

              setTasks((tasks) =>
                tasks.map((t) => (t.id === task.id ? { ...t, ...props } : t))
              )

              try {
                const result = await updateTask({
                  id: task.id,
                  ...props,
                })

                if (!result) {
                  return throwUnprocessableEntity('Unexpected action result')
                }

                if ('error' in result) {
                  throw errorToErrorResponse(result.error)
                }

                toast.success('Task updated!', { id: toastId })
              } catch (e) {
                setTasks(previousTasks)

                toast.error(e.message, { id: toastId })
              }
            },

            default: true,
          },
        },
      })
    },
    [bots, closePopup, openPopup, setTasks, tasks]
  )

  return (
    <>
      {popup}
      <div className="flex flex-col gap-2">
        {tasks.length ? (
          <List
            actions={
              tasks.length > 0 ? (
                <button
                  className="primary-button small"
                  type="button"
                  onClick={openCreateTaskScreen}
                >
                  Add Task
                </button>
              ) : null
            }
          >
            {tasks.map(
              ({ id, name, description, botId, schedule, status, outcome }) => {
                return (
                  <List.Item
                    key={id}
                    className="cursor-pointer"
                    icon={null}
                    title={name || id}
                    body={
                      description || (
                        <span className="italic">
                          A task without description
                        </span>
                      )
                    }
                    timestamp={null}
                    onClick={() => openTaskDetailsScreen(id)}
                    onMouseEnter={() => {
                      prefetchTaskDetails(id).catch(() => {
                        // @note prefetch failures are non-blocking
                      })
                    }}
                    onFocus={() => {
                      prefetchTaskDetails(id).catch(() => {
                        // @note prefetch failures are non-blocking
                      })
                    }}
                    focusable={true}
                    actions={{
                      ...(status !== 'running'
                        ? {
                            Trigger: async () => {
                              const confirmed = await confirmDanger(
                                'Are you sure you want to trigger this task now?',
                                {
                                  title: 'Trigger Task',
                                  actions: {
                                    Trigger: { result: true, default: true },
                                  },
                                }
                              )

                              if (!confirmed) {
                                return
                              }

                              const toastId = toast.loading(
                                'Triggering task...',
                                {}
                              )

                              const previousTasks = tasks

                              setTasks((tasks) =>
                                tasks.map((task) =>
                                  task.id === id
                                    ? {
                                        ...task,
                                        status: 'running',
                                        outcome: 'pending',
                                      }
                                    : task
                                )
                              )

                              try {
                                const result = await triggerTask({ id })

                                if (!result) {
                                  return throwUnprocessableEntity(
                                    'Unexpected action result'
                                  )
                                }

                                if ('error' in result) {
                                  throw errorToErrorResponse(result.error)
                                }

                                prefetchTaskDetails(id, { force: true }).catch(
                                  () => {
                                    // @note background refresh errors are non-blocking
                                  }
                                )

                                toast.success('Task triggered!', {
                                  id: toastId,
                                })
                              } catch (e) {
                                setTasks(previousTasks)

                                toast.error(e.message, { id: toastId })
                              }
                            },
                          }
                        : {}),

                      Details: () => openTaskDetailsScreen(id),

                      Edit: () =>
                        openUpdateTaskScreen({
                          id,
                          name,
                          description,
                          botId,
                          schedule,
                        }),

                      Delete: async () => {
                        if (
                          !(await confirmDelete(
                            'Are you sure you want to delete this task?'
                          ))
                        ) {
                          return
                        }

                        const toastId = toast.loading('Deleting task...', {})

                        const previousTasks = tasks

                        setTasks(previousTasks.filter((task) => task.id !== id))

                        try {
                          const result = await deleteTask({ id })

                          if (!result) {
                            return throwUnprocessableEntity(
                              'Unexpected action result'
                            )
                          }

                          if ('error' in result) {
                            throw errorToErrorResponse(result.error)
                          }

                          toast.success('Task deleted!', { id: toastId })
                        } catch (e) {
                          setTasks(previousTasks)

                          toast.error(e.message, { id: toastId })
                        }
                      },
                    }}
                  >
                    <div className="flex flex-wrap gap-2">
                      <div className="tag">schedule: {schedule}</div>
                      <div className="tag">status: {status || 'unknown'}</div>
                      <div className="tag">outcome: {outcome || 'pending'}</div>
                    </div>
                  </List.Item>
                )
              }
            )}
          </List>
        ) : null}
        {tasks.length === 0 ? (
          <button
            className="primary-button"
            type="button"
            onClick={() => openCreateTaskScreen()}
          >
            Add Task
          </button>
        ) : null}
      </div>
    </>
  )
}

function TaskDetailsScreen({ taskId, initialDetails, prefetchTaskDetails }) {
  const [state, setState] = useState({
    loading: !initialDetails,
    refreshing: !!initialDetails,
    error: null,
    details: initialDetails || null,
  })

  useEffect(() => {
    let active = true

    async function loadTaskDetails() {
      setState((state) => ({
        ...state,
        loading: !state.details,
        refreshing: !!state.details,
        error: null,
      }))

      try {
        const result = await prefetchTaskDetails(taskId, { force: true })

        if (!active) {
          return
        }

        setState({
          loading: false,
          refreshing: false,
          error: null,
          details: result,
        })
      } catch (error) {
        if (!active) {
          return
        }

        setState((state) => ({
          loading: false,
          refreshing: false,
          error: error?.message || 'Failed to load task details',
          details: state.details,
        }))
      }
    }

    loadTaskDetails()

    return () => {
      active = false
    }
  }, [prefetchTaskDetails, taskId])

  if (state.loading) {
    return <p className="text-sm auto-text-gray-500">Loading task details...</p>
  }

  if (state.error && !state.details) {
    return <p className="text-sm text-red-500">{state.error}</p>
  }

  const { details } = state

  return (
    <div className="space-y-4">
      {state.refreshing ? (
        <p className="text-xs auto-text-gray-500">Updating details...</p>
      ) : null}
      {state.error ? (
        <p className="text-xs text-amber-600">
          Showing cached details. {state.error}
        </p>
      ) : null}
      <div className="text-sm auto-text-gray-500">
        {details.description || 'No description'}
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="tag">schedule: {details.schedule || 'never'}</div>
        <div className="tag">status: {details.status || 'unknown'}</div>
        <div className="tag">outcome: {details.outcome || 'pending'}</div>
      </div>
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Conversation</h4>
        {details.conversation ? (
          <div className="text-sm">
            <div>{details.conversation.name || details.conversation.id}</div>
            {details.conversation.description ? (
              <div className="auto-text-gray-500">
                {details.conversation.description}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm auto-text-gray-500">
            No conversation has been created for this task yet.
          </p>
        )}
      </div>
      {details.messages?.length ? (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Recent Messages</h4>
          <div className="max-h-80 overflow-auto space-y-2">
            {details.messages.map((message) => (
              <div
                key={message.id}
                className="text-sm p-2 rounded-lg auto-bg-gray-50"
              >
                <div className="text-xs auto-text-gray-500">
                  {(message.from || message.type || 'message') +
                    (message.createdAt
                      ? ` · ${new Date(message.createdAt).toLocaleString()}`
                      : '')}
                </div>
                <div>
                  {message.text || <span className="italic">No text</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Scene({ className, ...props }) {
  return (
    <AppScene
      {...props}
      className={clsx('scene', className)}
      name={null}
      headline="Smart Task Automation"
      description={manifest.description}
    />
  )
}

export function Main({ tasks: _tasks, bots }) {
  const [tasks, setTasks] = useState(_tasks)

  return (
    <>
      {/* scene */}
      <Scene compact={true} />
      {/* tasks */}
      <TaskList tasks={tasks} setTasks={setTasks} bots={bots} />
    </>
  )
}
