// @ts-check
import { CACHE_PRESETS, getCacheHeaders } from '@/lib/cdn'
import { retrieveImage } from '@/lib/image'
import { withGet } from '@/lib/method'
import { typeToExtension } from '@/lib/mime'
import { requiredUrlParam } from '@/lib/query.get'
import { notFound, send } from '@/lib/response'

export default withGet(async function (req) {
  const image = await retrieveImage(requiredUrlParam(req, 'imageId'))

  if (!image) {
    return notFound()
  }

  const ext = typeToExtension(image.type)

  return send(image.data, {
    ...getCacheHeaders({
      ...CACHE_PRESETS.IMMUTABLE,
      immutable: true,
    }),
    'Content-Type': image.type,
    'Content-Disposition': `attachment; filename="image.${ext}"`,
  })
})

// @note this API route is not public - no documentation available
