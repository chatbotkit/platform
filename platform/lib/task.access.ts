import type { Task } from '@/prisma/types'

export function canUseTask(
  userId: string | undefined | null,
  task: Pick<Task, 'userId'>
): boolean {
  return task.userId === userId
}
