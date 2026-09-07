// @ts-check

/** @type {import('next').NextConfig} */
export default {
  // @note the proxy applies runtime host policies before canonical redirects
  skipTrailingSlashRedirect: true,

  // @note retain the original locale prefix and path for canonical redirects;
  // the proxy normalizes page-data paths separately for host routing
  skipProxyUrlNormalize: true,
}
