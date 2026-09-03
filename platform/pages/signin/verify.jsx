import { makeJsonSafe } from '@/lib/struct'

import Auth from '@/components/Auth'
import Meta from '@/components/Meta'

export default function Verify({
  title = 'Verify',
  description = 'Verify',
  keywords = ['ChatBotKit', 'ChatBot', 'AI', 'Chat', 'Bot', 'Verify', 'Login'],
  providers = [],
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
        <Auth providers={providers}>
          <p className="font-semibold">
            Check your inbox for your sign-in details.
          </p>
        </Auth>
      </div>
    </>
  )
}

// @note force server-side rendering so _document.getInitialProps receives the
// real request with host headers, which is needed to set the data-audience
// attribute on the html element correctly for each host
export async function getServerSideProps() {
  return { props: makeJsonSafe({}) }
}
