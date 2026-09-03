// @ts-check
import { z } from 'zod'

const optionalOrigin = z
  .string()
  .url()
  .refine(
    (value) => {
      try {
        return new URL(value).origin === value
      } catch {
        return false
      }
    },
    {
      message:
        'Expected an origin without a path, query, hash, or trailing slash',
    }
  )
  .optional()
  .or(z.literal(''))

// @note the test environment gets stable deployment origins before routing or
// runtime modules read them; explicitly loaded values always take precedence
if (process.env.NODE_ENV === 'test') {
  process.env.APP_MAIN_ORIGIN ||= 'https://apps.chatbotkit.com'
  process.env.APP_LABS_ORIGIN ||= 'https://labs.chatbotkit.com'
}

export const originsSchema = z.object({
  APP_MAIN_ORIGIN: optionalOrigin,
  APP_LABS_ORIGIN: optionalOrigin,
})

const env = originsSchema.parse({
  APP_MAIN_ORIGIN: process.env.APP_MAIN_ORIGIN,
  APP_LABS_ORIGIN: process.env.APP_LABS_ORIGIN,
})

export const appMainOrigin = env.APP_MAIN_ORIGIN || undefined
export const appLabsOrigin = env.APP_LABS_ORIGIN || undefined

export const appMainHost = appMainOrigin
  ? new URL(appMainOrigin).host
  : undefined
export const appLabsHost = appLabsOrigin
  ? new URL(appLabsOrigin).host
  : undefined

export const ORIGINS = Object.freeze({
  appMain: appMainOrigin,
  appLabs: appLabsOrigin,
})

export const ORIGIN_HOSTS = Object.freeze({
  appMain: appMainHost,
  appLabs: appLabsHost,
})
