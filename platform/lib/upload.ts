import { throwBadRequest } from '@/lib/response'

/**
 * Extracts a file from a multipart form data request
 */
export async function getUploadFile(req: Request): Promise<File> {
  const formData = await req.formData()

  const fileField = formData.get('file')

  if (!fileField) {
    return throwBadRequest()
  }

  let fileObject: File | null

  if (typeof fileField === 'object' && fileField !== null) {
    fileObject = fileField as File
  } else {
    fileObject = null
  }

  if (!fileObject) {
    return throwBadRequest()
  }

  return fileObject
}
