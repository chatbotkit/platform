/* eslint-disable custom-eslint-rules/no-restricted-client-imports -- stamps the runtime hosts onto <html> per request; the constants are the build-time fallback */
import NextDocument, { Head, Html, Main, NextScript } from 'next/document'

import { appApex, partnersApex, portalApex, spaceApex } from '@/config/apexes'
import { appLabsHost, appMainHost } from '@/config/origins'
import {
  apiUrl,
  siteHost,
  siteUrl,
  staticUrl,
  widgetUrl,
} from '@/config/site'
import { hostToHostname } from '@/lib/host.parse'

import { setupRequestContext } from '@/lib/context.setup'
import {
  executeInContext,
  getContextFrontendHost,
  getContextRequestHost,
} from '@/lib/context.store'
import {
  getExternalAPIHost,
  getExternalFrontendHost,
  getExternalStaticHost,
  getExternalWidgetHost,
  servesCleanAPIRoutes,
} from '@/lib/host'
import {
  getPartnerByIdentifier,
  getPartnerSlugFromHostname,
} from '@/lib/partner.helpers'

import GlobalRoot from '@/components/GlobalRoot'

export default class Document extends NextDocument {
  static async getInitialProps(ctx) {
    return executeInContext(async () => {
      if (ctx.req) {
        setupRequestContext(ctx.req)
      }

      const initialProps = await NextDocument.getInitialProps(ctx)

      let _host = null

      {
        _host = ctx.req
          ? getContextFrontendHost() || getContextRequestHost()
          : null

        _host = _host || siteHost
      }

      let _partner = null

      {
        const _hostname = hostToHostname(_host)

        const partnerSlug = getPartnerSlugFromHostname(_hostname)

        if (partnerSlug) {
          const partner = await getPartnerByIdentifier(partnerSlug)

          if (partner) {
            _partner = {
              name: partner.name,
              logo: partner.logo,
              icon: partner.icon,
              whitelabel: !!partner.whitelabel,
              experience: partner.experience,
            }
          }
        }
      }

      return {
        ...initialProps,

        // @note the configured origins and the hosts derived from them do not
        // depend on a request, so they are always stamped - a prerendered page
        // otherwise leaves the browser seeding the static, widget and API
        // hosts from the page origin, and that carries into client-side
        // navigation. Only the request host itself needs a request; without
        // one the browser falls back to the host cookie and the page origin
        _siteUrl: siteUrl,
        _staticUrl: staticUrl,
        _widgetUrl: widgetUrl,
        _apiUrl: apiUrl,
        _staticHost: getExternalStaticHost(),
        _widgetHost: getExternalWidgetHost(),
        _apiHost: getExternalAPIHost(),
        _apiCleanRoutes: servesCleanAPIRoutes(getExternalAPIHost()) ? '1' : '0',

        ...(ctx.req
          ? {
              _host: _host,
              _siteHost: getExternalFrontendHost(),
            }
          : {}),

        _appApex: appApex,
        _portalApex: portalApex,
        _spaceApex: spaceApex,
        _partnersApex: partnersApex,

        _appMainHost: appMainHost,
        _appLabsHost: appLabsHost,

        _partner,
      }
    })
  }

  render() {
    return (
      <Html
        lang="en"
        data-audience={this.props._host}
        data-site-url={this.props._siteUrl}
        data-static-url={this.props._staticUrl}
        data-widget-url={this.props._widgetUrl}
        data-api-url={this.props._apiUrl}
        data-site-host={this.props._siteHost}
        data-static-host={this.props._staticHost}
        data-widget-host={this.props._widgetHost}
        data-api-host={this.props._apiHost}
        data-api-clean-routes={this.props._apiCleanRoutes}
        data-app-apex={this.props._appApex}
        data-portal-apex={this.props._portalApex}
        data-space-apex={this.props._spaceApex}
        data-partners-apex={this.props._partnersApex}
        data-app-main-host={this.props._appMainHost}
        data-app-labs-host={this.props._appLabsHost}
        data-partner={this.props._partner ? '1' : '0'}
        data-partner-name={this.props._partner?.name}
        data-partner-logo={this.props._partner?.logo}
        data-partner-icon={this.props._partner?.icon}
        data-partner-whitelabel={
          this.props._partner
            ? this.props._partner.whitelabel
              ? '1'
              : '0'
            : undefined
        }
        data-partner-experience={this.props._partner?.experience}
        // Suppress hydration warnings caused by browser extensions injecting
        // class/style attributes
        suppressHydrationWarning
      >
        <Head>
          <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
        </Head>
        <body
          // Suppress hydration warnings caused by browser extensions injecting
          // DOM nodes into body
          suppressHydrationWarning
        >
          <GlobalRoot
          // @note global-root must be a direct body sibling to #__next so it
          // is never inside the element that headlessUI Dialog marks as `inert`
          // when a modal opens. PopButton/MenuButton portals here; if this div
          // were inside #__next it would become inert and menus would be
          // unclickable inside any headlessUI Dialog.
          />
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}
