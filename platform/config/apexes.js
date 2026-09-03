// @ts-check
import { z } from 'zod'

const optionalApex = z.string().trim().min(1).optional().or(z.literal(''))

// @note the test environment gets stable deployment apexes before routing or
// runtime modules read them; explicitly loaded values always take precedence
if (process.env.NODE_ENV === 'test') {
  process.env.APP_APEX ||= 'chatbotkit.app'
  process.env.PORTAL_APEX ||= 'chatbotkit.agency'
  process.env.SPACE_APEX ||= 'chatbotkit.space'
  process.env.PARTNERS_APEX ||= 'chatbotkit.partners'
}

export const apexesSchema = z.object({
  APP_APEX: optionalApex,
  PORTAL_APEX: optionalApex,
  SPACE_APEX: optionalApex,
  PARTNERS_APEX: optionalApex,
})

const env = apexesSchema.parse({
  APP_APEX: process.env.APP_APEX,
  PORTAL_APEX: process.env.PORTAL_APEX,
  SPACE_APEX: process.env.SPACE_APEX,
  PARTNERS_APEX: process.env.PARTNERS_APEX,
})

export const appApex = env.APP_APEX || undefined
export const portalApex = env.PORTAL_APEX || undefined
export const spaceApex = env.SPACE_APEX || undefined
export const partnersApex = env.PARTNERS_APEX || undefined

export const APEXES = Object.freeze({
  app: appApex,
  portal: portalApex,
  space: spaceApex,
  partners: partnersApex,
})
