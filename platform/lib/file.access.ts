import { type File, FileVisibility } from '@/prisma/types'

export function canUseFile(
  userId: string | undefined | null,
  file: File
): boolean {
  return file.userId === userId || file.visibility === FileVisibility.public
}

export function canManipulateFile(
  userId: string | undefined | null,
  file: File
): boolean {
  return file.userId === userId
}
