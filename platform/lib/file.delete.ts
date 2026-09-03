import prisma from '@/prisma/client'

import { deleteObjects } from '@/lib/storage'
interface FileToDelete {
  id: string
  userId: string
}

/**
 * Deletes a file from both S3 storage and database
 */
export async function deleteFile(file: FileToDelete): Promise<void> {
  await deleteObjects('file', file.id)

  // eslint-disable-next-line custom-eslint-rules/require-safe-prisma-delete
  await prisma.file.delete({
    where: {
      id: file.id,
    },
  })
}
