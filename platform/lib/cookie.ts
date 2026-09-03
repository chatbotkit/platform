import Cookie from 'universal-cookie'

// @todo replace universal-cookie with a library that works better for us and it
// does not have hidden features and behaviors we do not want - like the one we
// see here to change HAS_DOCUMENT_COOKIE based on environment

export function parse(cookie: string): Cookie {
  const c = new Cookie(cookie)

  if (process.env.NODE_ENV === 'test') {
    // @ts-expect-error in jest we need this to work
    c.HAS_DOCUMENT_COOKIE = false
  }

  return c
}

export function stringify(cookies: Cookie): string {
  return Object.entries(cookies.getAll())
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('; ')
}
