import { throwBadRequest } from '@/lib/response'

import type { ZodSchema } from 'zod'

export async function parseRequestJson<T>(req: Request): Promise<T> {
  try {
    return await req.json()
  } catch {
    throwBadRequest()
  }
}

export async function parseRequestSchema<T>(
  req: Request,
  schema: ZodSchema<T>
): Promise<T> {
  const data = await parseRequestJson(req)

  const result = await schema.safeParseAsync(data)

  if (!result.success) {
    throwBadRequest() // @todo write back the exact error
  }

  return result.data
}
