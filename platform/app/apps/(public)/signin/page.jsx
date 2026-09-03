'use client'

import { useApp } from '@/layouts/App'

import Auth from '@/components/Auth'
import Session from '@/components/Session'

export default function Signin() {
  const { config } = useApp()

  return (
    <>
      <div className="h-screen mx-auto min-w-sm max-w-lg px-10 flex flex-col items-center justify-center relative text-center">
        <Session>
          <Auth
            className="w-full"
            providers={['email']}
            title={
              config.name ? (
                <span className="hero-title heading-highlight whitespace-nowrap">
                  {config.name}
                </span>
              ) : (
                'Signin'
              )
            }
            headline={config.auth?.headline || 'Get access to amazing apps'}
            privacyLink={config.layout?.footer?.privacy}
            termsLink={config.layout?.footer?.terms}
            homeButtonURL="/"
            homeButtonCaption="Go to Overview"
            intermediateURL="/"
          />
        </Session>
      </div>
    </>
  )
}
