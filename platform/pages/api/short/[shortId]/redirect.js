// @ts-check
import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notFound, redirect } from '@/lib/response'
import { retrieveShortURL } from '@/lib/short'

export default withGet(async function (req) {
  const shortId = requiredUrlParam(req, 'shortId')

  const url = await retrieveShortURL(shortId)

  if (!url) {
    return notFound()
  }

  return redirect(new URL(url))
})
