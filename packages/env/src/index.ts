import { ok } from 'assert'

export const isTest: boolean =
  process.env.NODE_ENV === 'test' || process.env.TARGET_ENV === 'test'

export const isDevelopment: boolean =
  isTest ||
  process.env.NODE_ENV === 'development' ||
  process.env.TARGET_ENV === 'development'

export const isStaging: boolean =
  !isTest &&
  process.env.NODE_ENV === 'production' &&
  process.env.TARGET_ENV === 'staging'

export const isProduction: boolean =
  !isTest &&
  process.env.NODE_ENV === 'production' &&
  (process.env.TARGET_ENV === 'production' || !process.env.TARGET_ENV)

/**
 * Inline assertions to ensure the environment is correctly set.
 */
ok(isDevelopment || isStaging || isProduction, 'unknown environment')
ok(!(isDevelopment && isStaging), 'multiple environments detected')
ok(!(isDevelopment && isProduction), 'multiple environments detected')
ok(!(isStaging && isProduction), 'multiple environments detected')
