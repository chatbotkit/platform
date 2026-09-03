'use client'

import { useApp } from '@/layouts/App'

import Auth from '@/components/Auth'
import Session from '@/components/Session'

export default function Verify() {
  const { config } = useApp()

  return (
    <>
      <div className="h-screen mx-auto min-w-sm max-w-lg px-10 flex flex-col items-center justify-center relative text-center">
        <Session>
          <Auth
            className="w-full"
            providers={[]}
            title={
              config.title ? (
                <span className="screen-title heading-highlight whitespace-nowrap">
                  {config.title}
                </span>
              ) : (
                'Verify'
              )
            }
            headline={config.auth?.headline || 'Get access to amazing apps'}
            privacyLink={config.layout?.footer?.privacy}
            termsLink={config.layout?.footer?.terms}
          >
            <p className="font-semibold">
              Check your inbox for your sign-in details.
            </p>
          </Auth>
        </Session>
      </div>
    </>
  )
}
