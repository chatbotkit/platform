interface Context {
  query: {
    callbackUrl?: string
  }
}

interface RedirectResult {
  destination: string
  permanent: boolean
}

export function getSigninURL(context: Context): string {
  const callbackUrl = new URL(
    context.query.callbackUrl || '/',
    'https://localhost'
  )

  return `/signin?callbackUrl=${callbackUrl.pathname + callbackUrl.search}`
}

export function getSigninRedirect(context: Context): RedirectResult {
  return {
    destination: getSigninURL(context),
    permanent: false,
  }
}
