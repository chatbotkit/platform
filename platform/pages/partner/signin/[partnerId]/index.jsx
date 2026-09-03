import { getPartnerByIdentifier } from '@/lib/partner.helpers'
import { makeJsonSafe } from '@/lib/struct'

import Auth from '@/components/Auth'
import Meta from '@/components/Meta'
import Session from '@/components/Session'

export default function Signin({ partner }) {
  return (
    <>
      <Meta
        breadcrumbs={[]}
        title="Signin"
        description=""
        keywords="signin, login"
      />
      <div className="h-screen px-10 flex flex-col items-center justify-center relative text-center">
        <Session>
          <Auth
            providers={['email']}
            intermediateURL="/overview"
            partner={partner}
          />
        </Session>
      </div>
    </>
  )
}

export async function getServerSideProps(context) {
  const partnerId = context.query.partnerId

  if (!partnerId) {
    return {
      notFound: true,
    }
  }

  const partner = await getPartnerByIdentifier(partnerId)

  if (!partner) {
    return {
      notFound: true,
    }
  }

  return {
    props: makeJsonSafe({
      partner,
    }),
  }
}
