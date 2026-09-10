// @note dependency-free on purpose: the proxy bundle and the client both use
// this module, and lib/url pulls in the domain parser

/**
 * A request host as the request context records it: trimmed, lower-cased,
 * port kept unless it is the default https port, and rejected outright when
 * it smuggles credentials, a path, a query or a fragment.
 */
export function normalizeRequestHost(
  value: string | null | undefined
): string | null {
  if (!value) {
    return null
  }

  try {
    const url = new URL(`https://${value.trim()}`)

    if (
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      return null
    }

    // @note the URL parser tolerates characters that would end a Set-Cookie
    // or a CSP directive early (`;`, `,`, `=`); a host never contains them
    return /^(?:\[[0-9a-f:.]+\]|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.?)(?::\d{1,5})?$/.test(
      url.host
    )
      ? url.host
      : null
  } catch {
    return null
  }
}

/**
 * The hostname of a host - a host carries the port, a hostname never does.
 * Lower-cased, IPv6 brackets kept; an unparsable host keeps its port-less
 * prefix.
 */
export function hostToHostname(host: string | null | undefined): string {
  if (!host) {
    return ''
  }

  try {
    return new URL(`http://${host}`).hostname
  } catch {
    return host.split(':')[0].toLowerCase()
  }
}
