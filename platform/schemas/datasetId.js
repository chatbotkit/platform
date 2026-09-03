/* eslint-disable import/no-anonymous-default-export */
// @ts-check
import prisma from '@/prisma/client'

import { canManipulateDataset, canUseDataset } from '@/lib/dataset.access'
import schema from '@/lib/joi.schema'
import {
  throwNotAuthenticated,
  throwNotAuthorized,
  throwNotFound,
} from '@/lib/response'

/**
 * @param {'use'|'manipulate'} accessType
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

      const dataset = await prisma.dataset.findUniqueByIdentifier(user, value)

      if (!dataset) {
        throw throwNotFound(`Dataset not found`)
      }

      if (
        accessType === 'use' &&
        (await canUseDataset(user.id, dataset)) === false
      ) {
        return throwNotAuthorized('You are not authorized to use this dataset')
      }

      if (
        accessType === 'manipulate' &&
        (await canManipulateDataset(user.id, dataset)) === false
      ) {
        return throwNotAuthorized(
          'You are not authorized to manipulate this dataset'
        )
      }

      return dataset
    }, 'datasetId')
}
