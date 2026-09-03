// @ts-check
import { CACHE_PRESETS, getCacheHeaders } from '@/lib/cdn'
import { withGet } from '@/lib/method'
import { typeToExtension } from '@/lib/mime'
import { requiredUrlParam } from '@/lib/query.get'
import { notFound, send } from '@/lib/response'
import { retrieveVideo } from '@/lib/video'

export default withGet(async function (req) {
  const video = await retrieveVideo(requiredUrlParam(req, 'videoId'))

  if (!video) {
    return notFound()
  }

  const ext = typeToExtension(video.type)

  return send(video.data, {
    ...getCacheHeaders({
      ...CACHE_PRESETS.IMMUTABLE,
      immutable: true,
    }),
    'Content-Type': video.type,
    'Content-Disposition': `attachment; filename="video.${ext}"`,
  })
})
