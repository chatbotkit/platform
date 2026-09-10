// @ts-check

/** @type {import('next').NextConfig} */
export default {
  experimental: {
    // @note dev only. The Server Components HMR cache replays every fetch a
    // render made, keyed by URL and body, when the page refreshes after a code
    // change - `cache: 'no-store'` does not opt a call out. The PlanetScale
    // driver talks to the database over fetch and its `BEGIN` request has the
    // same body every time, so a refresh handed the driver the session of a
    // transaction that had already committed and the next statement failed
    // with `transaction ... ended (transaction committed)`. Stateful HTTP
    // protocols cannot be replayed, so the cache stays off.
    serverComponentsHmrCache: false,
  },
}
