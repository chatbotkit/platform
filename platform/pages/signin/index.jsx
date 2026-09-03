import { providers as authProviders } from '@/lib/auth.providers'
import { makeJsonSafe } from '@/lib/struct'

import Auth from '@/components/Auth'
import Meta from '@/components/Meta'

export default function Signin({
  title = 'Signin',
  description = 'Signin',
  keywords = ['ChatBotKit', 'ChatBot', 'AI', 'Chat', 'Bot', 'Signin', 'Login'],
  providers = ['email'],
  homeButtonURL,
  intermediateURL = '/welcome',
}) {
  return (
    <>
      <Meta
        breadcrumbs={[]}
        title={title}
        description={description}
        keywords={keywords}
      />
      <div className="h-screen px-10 flex flex-col items-center justify-center relative text-center">
        <Auth
          providers={providers}
          homeButtonURL={homeButtonURL}
          intermediateURL={intermediateURL}
        />
      </div>
    </>
  )
}

// @note force server-side rendering so _document.getInitialProps receives the
// real request with host headers, which is needed to set the data-audience
// attribute on the html element correctly for each host
export async function getServerSideProps() {
  return {
    props: makeJsonSafe({
      // @note only the providers that are actually configured - the OAuth
      // providers are presence-gated on their credentials in
      // lib/auth.providers.ts, so a local or self-hosted deployment without
      // them must not render their sign-in buttons
      providers: authProviders.map(({ id }) => id),
    }),
  }
}
