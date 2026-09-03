import { isAdmin } from '@/lib/admin'
import { isDevelopment, isProduction, isStaging } from '@/lib/env'
import {
  getExternalAPIHost,
  getExternalAPIHostURL,
  getExternalFrontendHost,
  getExternalFrontendHostURL,
  getExternalHost,
  getExternalHostURL,
  getLocalAPIHost,
  getLocalAPIHostURL,
  getLocalHost,
  getLocalHostURL,
} from '@/lib/host'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Admin from '@/layouts/Admin'

export default function Index({ settings }) {
  return (
    <div className="main-page">
      <div className="prose max-w-none dark:prose-invert">
        <table className="font-mono text-xs">
          <thead className="font-bold">
            <tr>
              <td>setting</td>
              <td>value</td>
            </tr>
          </thead>
          <tbody>
            {Object.entries(settings).map(([name, value]) => {
              return (
                <tr key={name}>
                  <td className="truncate">{name}</td>
                  <td className="truncate">{(value ?? '-').toString()}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

Index.getLayout = function (children) {
  return <Admin title="System">{children}</Admin>
}

export async function getServerSideProps(context) {
  const session = await getSoftSession(context.req, context.res)

  if (!session) {
    return {
      redirect: {
        destination: `/signin?callbackUrl=${context.resolvedUrl}`,
        permanent: false,
      },
    }
  }

  if (!isAdmin(session.user)) {
    return {
      notFound: true,
    }
  }

  const settings = {
    // environment
    ...{
      'process.env.NODE_ENV': process.env.NODE_ENV,
      'process.env.TARGET_ENV': process.env.TARGET_ENV,
      'process.env.SITE_URL': process.env.SITE_URL,
      'env.isDevelopment': isDevelopment,
      'env.isStaging': isStaging,
      'env.isProduction': isProduction,
    },

    // urls
    ...{
      'host.getLocalHost()': getLocalHost(),
      'host.getLocalHostURL()': getLocalHostURL(),
      'host.getExternalHost()': getExternalHost(),
      'host.getExternalHostURL()': getExternalHostURL(),
      'host.getLocalAPIHost()': getLocalAPIHost(),
      'host.getLocalAPIHostURL()': getLocalAPIHostURL(),
      'host.getExternalAPIHost()': getExternalAPIHost(),
      'host.getExternalAPIHostURL()': getExternalAPIHostURL(),
      'host.getExternalFrontendHost()': getExternalFrontendHost(),
      'host.getExternalFrontendHostURL()': getExternalFrontendHostURL(),
    },
  }

  return {
    props: makeJsonSafe({
      settings,
    }),
  }
}
