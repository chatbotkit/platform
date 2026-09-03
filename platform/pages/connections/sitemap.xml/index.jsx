import { getServerSideSitemapLegacy } from 'next-sitemap'

import abilitiesData from '@/data/abilities/visible'

export default function Index() {}

export async function getServerSideProps(context) {
  const connections = Array.from(
    new Set(Object.values(abilitiesData).map(({ icon }) => icon))
  ).map((icon) => {
    let slug = icon.replace(/^@.+?\//, '')

    if (slug.startsWith('https://')) {
      slug = new URL(slug).hostname
    }

    return {
      slug,
    }
  })

  // @note omit `lastmod` - the connection set is derived from static abilities
  // data with no genuine per-URL modification date, and faking daily freshness
  // erodes trust in our sitemap signals (see /ai/[category]/sitemap.xml).
  return getServerSideSitemapLegacy(
    context,
    connections.map((item) => {
      return {
        loc: `${process.env.SITE_URL}/connections/${item.slug}`,
      }
    })
  )
}
