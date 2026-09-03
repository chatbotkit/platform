import { getCookieCsrfToken } from '@/lib/csrf'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'
import { hostname } from '@/lib/url'

import DynamicIcon from '@/components/DynamicIcon'
import ProfileBar from '@/components/ProfileBar'

export default function Page({ query, csrfToken }) {
  const name = hostname(query.redirect_uri)

  return (
    <>
      <ProfileBar compact={true} />
      <div className="w-screen h-screen flex flex-col justify-center items-center gap-10">
        <div className="flex flex-col gap-4 items-center">
          <div className="flex flex-row gap-2 justify-center items-center">
            <DynamicIcon className="w-28 h-28" icon={`@logo/chatbotkit.com`} />
            <DynamicIcon className="w-40 h-40" icon={`@logo/${name}`} />
          </div>
          <div className="max-w-lg text-sm">
            {name} is requesting full access to your ChatBotKit account - the
            same access an API key provides. If you do not trust this site,
            please click Cancel.
          </div>
        </div>
        <form
          method="POST"
          action={`/oauth/authorize?${new URLSearchParams(
            Object(query)
          ).toString()}`}
        >
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <div className="flex flex-row gap-2">
            <button
              className="default-button"
              type="submit"
              name="approval"
              value="granted"
              tabIndex={2}
            >
              Accept
            </button>
            <button
              className="danger-button"
              type="submit"
              name="approval"
              value="denied"
              tabIndex={1}
              autoFocus
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </>
  )
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

  return {
    props: makeJsonSafe({
      query: context.query,

      csrfToken: getCookieCsrfToken(context.req),
    }),
  }
}
