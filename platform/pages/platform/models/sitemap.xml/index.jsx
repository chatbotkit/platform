import { getServerSideSitemapLegacy } from 'next-sitemap'

import { getExternalHostURL } from '@/lib/host'

import { getStartOfDay } from '@chatbotkit-dev/time'

import { visibleModels } from '@/config/models'

export default function Index() {}

export async function getServerSideProps(context) {
  const modelIds = Object.keys(visibleModels)

  const today = getStartOfDay().toISOString()

  return getServerSideSitemapLegacy(
    context,
    modelIds.map((modelId) => {
      return {
        loc: getExternalHostURL(`/platform/models/${modelId}`),
        lastmod: today,
      }
    })
  )
}
