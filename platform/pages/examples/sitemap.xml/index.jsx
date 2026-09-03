import { getServerSideSitemapLegacy } from 'next-sitemap'

import { getStartOfDay } from '@chatbotkit-dev/time'

import { getSortedExamples } from '@/lib/example.fetch'

export default function Index() {}

export async function getServerSideProps(context) {
  const today = getStartOfDay().toISOString()

  return getServerSideSitemapLegacy(
    context,
    getSortedExamples()
      // @note hub examples redirect to /hub - they are listed in the hub's own
      // sitemap, so we don't emit a redirecting /examples/<slug> here
      .filter((item) => !item.hub)
      .map((item) => {
        return {
          loc: `${process.env.SITE_URL}/examples/${item.slug}`,
          lastmod: item.date ? new Date(item.date).toISOString() : today,
        }
      })
  )
}
