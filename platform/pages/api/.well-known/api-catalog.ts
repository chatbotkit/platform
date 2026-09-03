import { getExternalAPIHostURL, getExternalFrontendHostURL } from '@/lib/host'
import { withGet } from '@/lib/method'
import { send } from '@/lib/response'

const API_CATALOG_PROFILE_URI = 'https://www.rfc-editor.org/info/rfc9727'
const CONTENT_SIGNAL_VALUE = 'ai-train=no, search=yes, ai-input=yes'

const LINKSET_CONTENT_TYPE = `application/linkset+json; charset=utf-8; profile="${API_CATALOG_PROFILE_URI}"`

export default withGet(async function () {
  const apiBaseUrl = getExternalAPIHostURL('/v1')
  const specUrl = getExternalAPIHostURL('/v1/spec')
  const statusUrl = getExternalAPIHostURL('/v1/status/ping')
  const catalogUrl = getExternalFrontendHostURL('/.well-known/api-catalog')

  const docsUrl = 'https://docs.cbk.ai/spec/v1'

  const body = {
    linkset: [
      {
        anchor: apiBaseUrl,
        'service-desc': [
          {
            href: specUrl,
            type: 'application/json',
            title: 'ChatBotKit API v1 OpenAPI specification',
          },
        ],
        'service-doc': [
          {
            href: docsUrl,
            type: 'text/html',
            title: 'ChatBotKit API v1 documentation',
          },
        ],
        status: [
          {
            href: statusUrl,
            type: 'application/json',
            title: 'ChatBotKit API v1 health check',
          },
        ],
      },
    ],
  }

  return send(JSON.stringify(body, null, 2), {
    'Content-Type': LINKSET_CONTENT_TYPE,
    Link: `<${catalogUrl}>; rel="self"; type="application/linkset+json"; profile="${API_CATALOG_PROFILE_URI}"`,
    'Content-Signal': CONTENT_SIGNAL_VALUE,
  })
})
