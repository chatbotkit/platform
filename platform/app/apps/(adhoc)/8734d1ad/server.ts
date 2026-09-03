'use server'

import { Schedule } from '@/prisma/types'

import { appActionHandler, appContactActionHandler } from '@/lib/app.action'
import { getSessionClient } from '@/lib/cbk.sdk'
import debug from '@/lib/debug'
import { errorToErrorResponse } from '@/lib/error'
import { equal, pick } from '@/lib/object'
import {
  throwNotAuthorized,
  throwNotFound,
  throwUnprocessableEntity,
} from '@/lib/response'

import ConfigSchema from './config'
import { APP_NAME, CONTACT_NAMESPACE } from './const'

import type { TaskListResponse } from '@chatbotkit/sdk/contact/task/v1'
import type { TaskUpdateResponse } from '@chatbotkit/sdk/task/v1'

import { z } from 'zod'

function getBuiltinTasks(config: unknown): {
  name?: string
  description?: string
  botId?: string
  schedule?: string
  icon?: string
}[] {
  const { tasks: builtinTasks = [] } = config as {
    tasks: {
      name?: string
      description?: string
      botId?: string
      schedule?: string
      icon?: string
    }[]
  }

  if (Array.isArray(builtinTasks)) {
    return builtinTasks.map(({ name, description, botId, schedule, icon }) => {
      return {
        name: name?.toString(),
        description: description?.toString(),
        botId: botId?.toString(),
        schedule: Schedule[schedule as keyof typeof Schedule] || Schedule.never,
        icon: icon?.toString(),
      }
    })
  } else {
    return []
  }
}

function compareTasks(
  a: {
    id?: string
    name?: string
    description?: string
    botId?: string
    schedule?: string
    meta?: Record<string, unknown>
    createdAt?: number
    updatedAt?: number
    icon?: string
  },
  b: {
    id?: string
    name?: string
    description?: string
    botId?: string
    schedule?: string
    meta?: Record<string, unknown>
    createdAt?: number
    updatedAt?: number
    icon?: string
  }
): boolean {
  return equal(
    pick(a, ['name', 'description', 'botId']),
    pick(b, ['name', 'description', 'botId'])
  )
}

/**
 * @action
 */
export const listTasks = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({}),
  async (
    config,
    session,
    contact,
    {}
  ): Promise<
    (TaskListResponse['items'][number] & {
      icon?: string
      immutable?: boolean
      defaultSchedule?: string
    })[]
  > => {
    debug(`list tasks`).log('apps.8734d1ad.listTasks')

    const userClient = await getSessionClient(session)

    const { items: tasks } = await userClient.contact.task
      .list(contact.id)
      .cache()

    // handle builtin tasks
    {
      const builtinTasks = getBuiltinTasks(config)

      if (builtinTasks.length > 0) {
        // ensure builtin tasks are created
        {
          await Promise.all(
            builtinTasks.map(async (task) => {
              if (!task.name || !task.description || !task.botId) {
                return
              }

              const exists = tasks.some((t) => compareTasks(t, task))

              debug(`checking task existence`, { task, exists }).log(
                'apps.8734d1ad.listTasks'
              )

              if (!exists) {
                debug(`create builtin task`, { task }).log(
                  'apps.8734d1ad.listTasks'
                )

                const { id } = await userClient.task.create({
                  contactId: contact.id,
                  name: task.name,
                  description: task.description,
                  botId: task.botId,
                  schedule: Schedule.never,
                })

                tasks.push({
                  id: id,
                  name: task.name,
                  description: task.description,
                  botId: task.botId,
                  schedule: Schedule.never,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                })
              }
            })
          )
        }

        // delete and remove tasks that are not in builtin tasks
        {
          const customTasks = tasks.filter(
            (task) => !builtinTasks.some((t) => compareTasks(t, task))
          )

          await Promise.all(
            customTasks.map(async (task) => {
              try {
                debug(`delete custom task`, { task }).log(
                  'apps.8734d1ad.listTasks'
                )

                await userClient.task.delete(task.id)
              } catch {
                // pass
              }

              tasks.splice(tasks.indexOf(task), 1)
            })
          )
        }

        // delete and remove tasks that are duplicated
        {
          const seenTasks: Record<string, boolean> = {}

          const duplicatedTasks = tasks.filter((task) => {
            const key = JSON.stringify(
              pick(task, ['name', 'description', 'botId'])
            )

            if (seenTasks[key]) {
              return true
            }

            seenTasks[key] = true

            return false
          })

          await Promise.all(
            duplicatedTasks.map(async (task) => {
              try {
                debug(`delete duplicate task`, { task }).log(
                  'apps.8734d1ad.listTasks'
                )

                await userClient.task.delete(task.id)
              } catch {
                // pass
              }

              tasks.splice(tasks.indexOf(task), 1)
            })
          )
        }

        // set the builtin task icon
        {
          tasks.forEach((task) => {
            const builtinTask = builtinTasks.find((t) => compareTasks(t, task))

            if (builtinTask) {
              ;(task as { icon?: string }).icon = builtinTask.icon
            }
          })
        }

        // mark builtin tasks as not editable or deletable
        {
          tasks.forEach((task) => {
            const builtinTask = builtinTasks.find((t) => compareTasks(t, task))

            if (builtinTask) {
              ;(task as { immutable?: boolean }).immutable = true
            }
          })
        }

        // set builtin tasks default schedule
        {
          tasks.forEach((task) => {
            const builtinTask = builtinTasks.find((t) => compareTasks(t, task))

            if (builtinTask) {
              ;(task as { defaultSchedule?: string }).defaultSchedule =
                builtinTask.schedule
            }
          })
        }
      }
    }

    return tasks
  }
)

/**
 * @action
 */
export const toggleTask = appContactActionHandler(
  APP_NAME,
  CONTACT_NAMESPACE,
  ConfigSchema,
  z.object({
    id: z.string(),
    enabled: z.boolean(),
  }),
  async (
    config,
    session,
    _contact,
    { id, enabled }
  ): Promise<TaskUpdateResponse> => {
    debug(`toggling task`, { id, enabled }).log('apps.8734d1ad.toggleTask')

    const userClient = await getSessionClient(session)

    const tasks = await listTasks({})

    if (!tasks) {
      return throwUnprocessableEntity('Unexpected action result')
    }

    if ('error' in tasks) {
      throw errorToErrorResponse(tasks.error)
    }

    const task = tasks.find((task) => task.id === id)

    if (!task) {
      throwNotFound()
    }

    const builtinTasks = getBuiltinTasks(config)

    const builtinTask = builtinTasks.find((t) => compareTasks(t, task))

    if (!builtinTask) {
      throwNotAuthorized()
    }

    return await userClient.task.update(task.id, {
      schedule: enabled ? builtinTask.schedule : Schedule.never,
    })
  }
)

/**
 * @action
 */
export const listAll = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({}),
  async (
    _config,
    _session,
    {}
  ): Promise<{
    tasks: TaskListResponse['items']
  }> => {
    const tasks = await listTasks({})

    if (!tasks) {
      return throwUnprocessableEntity('Unexpected action result')
    }

    if ('error' in tasks) {
      throw errorToErrorResponse(tasks.error)
    }

    return { tasks }
  }
)
