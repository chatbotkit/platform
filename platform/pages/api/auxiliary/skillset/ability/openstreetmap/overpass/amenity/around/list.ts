import { authenticatedHandler } from '@/lib/auxiliary.handler'
import call, { getCallError } from '@/lib/call'
import debug from '@/lib/debug'
import { FetchError } from '@/lib/fetch'

import { z } from 'zod'

const schema = z.object({
  url: z.string().optional(),
  types: z.string().optional(),
  tags: z.string(),
  radius: z.coerce.number().optional(),
  lat: z.coerce.number(),
  lon: z.coerce.number(),
})

export default authenticatedHandler(
  schema,
  async function (_session, parameters, headers) {
    debug(`openstreetmap/overpass/amenity/around/list`, { parameters, headers })

    const {
      url: apiUrl = 'https://overpass-api.de/api/interpreter',
      types: _types = 'node',
      tags: _tags,
      radius = 1000,
      lat,
      lon,
    } = parameters

    const types = _types
      .split(/[,;\s]/)
      .map((type) => type.trim())
      .filter(Boolean)

    const tags = _tags
      .split(/[,;\s]/)
      .map((tag) => tag.trim())
      .filter(Boolean)

    const lines: string[] = []

    lines.push(`[out:json];`)

    lines.push('(')

    for (const type of types) {
      for (const tag of tags) {
        lines.push(`${type}(around:${radius},${lat},${lon})[${tag}];`)
      }
    }

    lines.push(');')

    lines.push(`out body;`)
    lines.push(`>;`)
    lines.push(`out skel qt;`)

    const url = new URL(apiUrl)

    url.searchParams.set('data', lines.join('\n'))

    const response = await call(url.href, {
      method: 'GET',
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    let data

    try {
      data = await response.json()
    } catch (jsonError) {
      // @note overpass API sometimes returns XML even with 200 status when queries are malformed
      // @note throwing FetchError instead of plain Error prevents Sentry capture in auxiliary handler
      throw new FetchError(
        `Overpass API returned invalid JSON response. This may indicate a malformed query.`,
        'BAD_GATEWAY'
      )
    }

    const { elements } = data

    const items = elements
      .map(({ nodes: _nodes, ...item }) => item)
      .filter(({ tags }) => !!tags)

    return { items }
  }
)
