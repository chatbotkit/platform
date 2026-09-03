'use server'

import { appActionHandler } from '@/lib/app.action'
import { getSessionClient } from '@/lib/cbk.sdk'
import { captureException } from '@/lib/error'
import { throwInternalServerError } from '@/lib/response'

import ConfigSchema from './config'
import { APP_NAME } from './const'

import { z } from 'zod'

const DEFAULT_PERIOD = 30

/**
 * @action
 */
export const getOverview = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({}),
  async (_config, session, {}) => {
    try {
      const cbk = await getSessionClient(session)

      const result = await cbk.platform.report.generateTyped(
        'clr3m5n8k000d08jqar7s8t4n',
        {
          periodDays: DEFAULT_PERIOD,
        }
      )

      return result
    } catch (e) {
      await captureException(e)

      throwInternalServerError('Failed to fetch app data')
    }
  }
)
