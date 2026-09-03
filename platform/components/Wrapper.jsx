import '@/styles/globals.css'

import Console from '@/components/Console'
import GTag from '@/components/GTag'
import Notifications from '@/components/Notifications'
import Progress from '@/components/Progress'
import ReloadingPageErrorBoundary from '@/components/ReloadingPageErrorBoundary'
import Session from '@/components/Session'
import Theme from '@/components/Theme'

export default function Wrapper({
  Component,

  pageProps,

  session = Component?.session,
  theme = Component?.theme,

  children,
}) {
  const getLayout = Component?.getLayout || ((page) => page)

  return (
    <ReloadingPageErrorBoundary>
      <Console />
      <GTag />
      <Theme theme={theme}>
        <Progress />
        <Session session={session}>
          <Notifications>
            {Component
              ? getLayout(<Component {...pageProps} />, pageProps)
              : null}
            {children}
            {/* @note disabled because it si part of the document - see the
                _document.jsx file for details */}
            {/* <GlobalRoot /> */}
          </Notifications>
        </Session>
      </Theme>
    </ReloadingPageErrorBoundary>
  )
}
