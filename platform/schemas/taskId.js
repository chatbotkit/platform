/* eslint-disable import/no-anonymous-default-export */
// @ts-check
import prisma from '@/prisma/client'

import schema from '@/lib/joi.schema'
import {
  throwNotAuthenticated,
  throwNotAuthorized,
  throwNotFound,
} from '@/lib/response'
import { canUseTask } from '@/lib/task.access'

/**
 * @param {'use'} accessType
 * @returns {import('joi').Schema}
 */
export default function (accessType) {
  return schema
    .string()
    .allow(null, '')
    .external(async function (value, helpers) {
      if (value) {
        value = value.trim()
      }

      if (!value) {
        if (value === undefined) {
          return
        } else {
          return null
        }
      }

      const { user } = helpers?.prefs?.context?.session || {}

      if (!user) {
        return throwNotAuthenticated()
      }

      const task = await prisma.task.findUniqueByIdentifier(user, value)

      if (!task) {
        throw throwNotFound(`Task not found`)
      }

      if (accessType === 'use' && !canUseTask(user.id, task)) {
        return throwNotAuthorized('You are not authorized to use this task')
      }

      return task
    }, 'taskId')
}
