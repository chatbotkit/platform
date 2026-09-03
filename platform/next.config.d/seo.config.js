/* eslint-disable import/no-anonymous-default-export */
// @ts-check

/**
 * SEO hygiene headers.
 *
 * Auxiliary, non-canonical endpoints were showing up in Google Search Console
 * as "Crawled - currently not indexed" and diluting crawl budget away from real
 * content:
 *
 *   - `/.../card` returns a social-share PNG (see lib/card.response). It is an
 *     image, not a document, so there is no HTML head to carry a `<meta robots>`
 *     tag - the HTTP layer is the only place to mark it `noindex`.
 *   - `/.../designer` is a full-screen interactive iframe embed of a blueprint
 *     that already has its own canonical page (e.g. `/examples/:slug`).
 *
 * Neither should ever compete for indexing, so we tag them `noindex, follow`:
 * Googlebot drops the URL from the index while still following any links it
 * finds. This does not affect social scrapers or browsers fetching the card
 * image - `X-Robots-Tag` only instructs search crawlers about indexing.
 */
export default {
  async headers() {
    const noindex = [
      {
        key: 'X-Robots-Tag',
        value: 'noindex, follow',
      },
    ]

    return [
      // the standalone site card image
      {
        source: '/card',
        headers: noindex,
      },

      // per-item social-share card images (e.g. /reflections/:slug/card)
      {
        source: '/:path*/card',
        headers: noindex,
      },

      // interactive blueprint embeds (e.g. /examples/:slug/designer)
      {
        source: '/:path*/designer',
        headers: noindex,
      },
    ]
  },
}
