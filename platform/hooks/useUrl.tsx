import type { UrlTransformationOptions } from '@/lib/url'
import { url } from '@/lib/url'

import useRouter from '@/hooks/useRouter'

export default function useUrl(
  baseUrl?: string,
  thisUrl?: string,
  options: UrlTransformationOptions = {}
): string {
  const router = useRouter()

  const u = url(thisUrl || router.asPath, baseUrl, options)
    // For some reason /index appears so remove it.
    // @todo this may no longer be necessary
    .replace(/\/index$/, '/')
    // This hook is used for the Meta component. One caveat is that the landing
    // page is hosted in /landing but this is not the canonical URL. Therefore
    // we need to remove /landing from the URL.
    // @todo this is a hack and should be removed if we can find a better way
    .replace(/^\/landing/, '/')

  return u
}
