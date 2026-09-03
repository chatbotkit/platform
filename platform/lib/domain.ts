import { ParseResultType, parseDomain } from 'parse-domain'

export function getRootDomain(input: string): string {
  const result = parseDomain(input)

  let domain: string

  switch (result.type) {
    case ParseResultType.Invalid: {
      throw new Error('Invalid domain')
    }

    case ParseResultType.NotListed: {
      throw new Error('Not listed domain')
    }

    case ParseResultType.Reserved: {
      domain = result.hostname

      break
    }

    case ParseResultType.Ip: {
      domain = result.hostname

      break
    }

    default: {
      domain = result.domain
        ? [result.domain, ...result.topLevelDomains].join('.')
        : result.hostname

      break
    }
  }

  domain = domain.toLowerCase().replace(/\.+$/, '')

  return domain
}

export function tryGetRootDomain(input: string): string | null {
  try {
    return getRootDomain(input)
  } catch {
    return null
  }
}

export function getRegisterableName(input: string): string {
  const result = parseDomain(input)

  let name: string

  switch (result.type) {
    case ParseResultType.Invalid: {
      throw new Error('Invalid domain')
    }

    case ParseResultType.NotListed: {
      throw new Error('Not listed domain')
    }

    case ParseResultType.Reserved:
    case ParseResultType.Ip: {
      // @note for reserved domains and IPs, return the full hostname as the name
      name = result.hostname

      break
    }

    default: {
      // @note extract just the domain name part (e.g., 'google' from 'google.com')
      name = result.domain || result.hostname

      break
    }
  }

  name = name.toLowerCase()

  return name
}

export function tryGetRegistrableName(input: string): string | null {
  try {
    return getRegisterableName(input)
  } catch {
    return null
  }
}

/**
 * It is important to note that there is a significant difference between a
 * domain and a hostname (or host) in the context of ChatBotKit. A domain is
 * a string that represents a domain name, while a hostname is a string that
 * represents a domain name and the subdomain. Thus, the domain is in the form
 * of the root domain, while the hostname is in the form of the domain plus any
 * subdomains. In the context of ChatBotKit an IP address is also considered a
 * a domain as it is a whole.
 */
