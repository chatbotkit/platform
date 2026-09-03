import { Prisma } from '@chatbotkit-dev/db/client'

/**
 * @note wrapper around Prisma.join for easier mocking in tests
 */
export function join<T>(values: readonly T[]): ReturnType<typeof Prisma.join> {
  return Prisma.join(values)
}
