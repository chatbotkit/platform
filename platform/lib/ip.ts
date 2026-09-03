// IP address parsing and classification. Pure string work with no runtime
// dependency, so it is usable from the Node and Edge runtimes alike. The
// caller decides separately whether the source of a value is trusted.

/**
 * Parses a dotted-quad IPv4 address into its four octets. Returns null when
 * the text is not a well-formed address (leading zeros, whitespace, missing
 * or extra parts and out-of-range octets are all rejected).
 */
export function parseIpv4Address(value: string): number[] | null {
  const parts = value.split('.')

  if (parts.length !== 4) {
    return null
  }

  const octets: number[] = []

  for (const part of parts) {
    if (!/^(0|[1-9][0-9]{0,2})$/.test(part)) {
      return null
    }

    const octet = Number(part)

    if (octet > 255) {
      return null
    }

    octets.push(octet)
  }

  return octets
}

/**
 * Expands an IPv6 address to its eight 16-bit groups. A trailing dotted quad
 * (`::ffff:127.0.0.1`) becomes two groups. Returns null when the text is not
 * a well-formed address; a zone index (`fe80::1%eth0`) is not accepted.
 */
export function parseIpv6Address(value: string): number[] | null {
  let text = value

  const lastColon = text.lastIndexOf(':')

  if (text.includes('.')) {
    if (lastColon === -1) {
      return null
    }

    const v4 = parseIpv4Address(text.slice(lastColon + 1))

    if (!v4) {
      return null
    }

    text =
      text.slice(0, lastColon + 1) +
      ((v4[0] << 8) | v4[1]).toString(16) +
      ':' +
      ((v4[2] << 8) | v4[3]).toString(16)
  }

  const halves = text.split('::')

  if (halves.length > 2) {
    return null
  }

  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : []

  const missing = 8 - head.length - tail.length

  if (
    (halves.length === 1 && missing !== 0) ||
    (halves.length === 2 && missing <= 0)
  ) {
    return null
  }

  const groups: number[] = []

  for (const group of [...head, ...Array(missing).fill('0'), ...tail]) {
    if (!/^[0-9a-f]{1,4}$/i.test(group)) {
      return null
    }

    groups.push(parseInt(group, 16))
  }

  return groups
}

export function isIpv4Address(value: string): boolean {
  return parseIpv4Address(value) !== null
}

export function isIpv6Address(value: string): boolean {
  return parseIpv6Address(value) !== null
}

/**
 * Checks an IPv4 or IPv6 address literal.
 */
export function isIpAddress(value: string): boolean {
  return isIpv4Address(value) || isIpv6Address(value)
}

/**
 * IPv4 ranges that are never a legitimate destination for a request made on
 * a user's or model's behalf: unspecified, loopback, private, carrier-grade
 * NAT, link-local (including cloud metadata at 169.254.169.254), the
 * IETF/benchmark/documentation reservations, multicast, reserved and
 * broadcast.
 */
export function isForbiddenIpv4Address(octets: number[]): boolean {
  const [a, b] = octets

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (octets[2] === 0 || octets[2] === 2)) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && octets[2] === 100) ||
    (a === 203 && b === 0 && octets[2] === 113) ||
    a >= 224
  )
}

/**
 * IPv6 ranges that are never a legitimate destination: unspecified,
 * loopback, IPv4-mapped and IPv4-translated forms (classified by the IPv4
 * inside), NAT64 well-known prefix, discard, documentation, unique-local,
 * link-local, site-local and multicast.
 */
export function isForbiddenIpv6Address(groups: number[]): boolean {
  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups

  const embeddedV4 = (hi: number, lo: number) => [
    hi >> 8,
    hi & 0xff,
    lo >> 8,
    lo & 0xff,
  ]

  // ::/128 and ::1/128
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) {
    if (g6 === 0 && (g7 === 0 || g7 === 1)) {
      return true
    }
  }

  // ::ffff:a.b.c.d - IPv4-mapped
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff) {
    return isForbiddenIpv4Address(embeddedV4(g6, g7))
  }

  // ::ffff:0:a.b.c.d - IPv4-translated (RFC 2765)
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0xffff && g5 === 0) {
    return isForbiddenIpv4Address(embeddedV4(g6, g7))
  }

  // 64:ff9b::/96 - NAT64
  if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) {
    return isForbiddenIpv4Address(embeddedV4(g6, g7))
  }

  // 100::/64 discard, 2001:db8::/32 documentation, 2002::/16 6to4 (classify
  // the embedded IPv4)
  if (g0 === 0x100 && g1 === 0 && g2 === 0 && g3 === 0) {
    return true
  }

  if (g0 === 0x2001 && g1 === 0xdb8) {
    return true
  }

  if (g0 === 0x2002) {
    return isForbiddenIpv4Address(embeddedV4(g1, g2))
  }

  // fc00::/7 unique-local, fe80::/10 link-local, fec0::/10 site-local,
  // ff00::/8 multicast
  return (
    (g0 & 0xfe00) === 0xfc00 ||
    (g0 & 0xffc0) === 0xfe80 ||
    (g0 & 0xffc0) === 0xfec0 ||
    (g0 & 0xff00) === 0xff00
  )
}

/**
 * Whether a resolved or literal address may be connected to. Anything that
 * is not a well-formed public unicast address is refused, including text
 * that is not an address at all - the caller passes only what it is about
 * to connect to. Brackets and an IPv6 zone index (`fe80::1%eth0`, which
 * names a local interface) are stripped for classification.
 */
export function isForbiddenAddress(address: string): boolean {
  const text = address.replace(/^\[|\]$/g, '').replace(/%.*$/, '')

  const octets = parseIpv4Address(text)

  if (octets) {
    return isForbiddenIpv4Address(octets)
  }

  const groups = parseIpv6Address(text)

  if (groups) {
    return isForbiddenIpv6Address(groups)
  }

  return true
}
