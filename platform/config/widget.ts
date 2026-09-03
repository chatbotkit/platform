import { ONE_HOUR_IN_MILLISECONDS } from '@chatbotkit-dev/time'

import { z } from 'zod'

const env = z
  .object({
    AUTO_WIDGET_USER_ID: z.string().optional(),
    AUTO_WIDGET_MODEL: z.string().optional(),
    EXAMPLE_WIDGET_USER_ID: z.string().optional(),
  })
  .parse({
    AUTO_WIDGET_USER_ID: process.env.AUTO_WIDGET_USER_ID,
    AUTO_WIDGET_MODEL: process.env.AUTO_WIDGET_MODEL,
    EXAMPLE_WIDGET_USER_ID: process.env.EXAMPLE_WIDGET_USER_ID,
  })

// @note when unset, callers fall back to the session user

export const autoWidgetUserId = env.AUTO_WIDGET_USER_ID

export const autoWidgetModel = env.AUTO_WIDGET_MODEL

export const exampleWidgetUserId = env.EXAMPLE_WIDGET_USER_ID

export const WIDGET_SESSION_DURATION_MAX_IN_MILLISECONDS =
  ONE_HOUR_IN_MILLISECONDS
