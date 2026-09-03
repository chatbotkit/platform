import { useCallback, useMemo, useRef, useState } from 'react'

import { isValidEmail } from '@/lib/email.validation'
import { captureException } from '@/lib/error'
import toast from '@/lib/toast'
import { url as buildUrl, pathquery, tryPathquery } from '@/lib/url'

import Link from '@/components/Link'
import PartnerBanner from '@/components/PartnerBanner'
import PinInput from '@/components/PinInput'

import useIsTop from '@/hooks/useIsTop'
import useRouter from '@/hooks/useRouter'
import useSession from '@/hooks/useSession'
import useSignin from '@/hooks/useSignin'
import useSignout from '@/hooks/useSignout'

import { ChevronRightIcon } from '@heroicons/react/20/solid'

import clsx from 'clsx'

const errors = {
  Signin: 'Try signing with a different account.',
  OAuthSignin: 'Try signing with a different account.',
  OAuthCallback: 'Try signing with a different account.',
  OAuthCreateAccount: 'Try signing with a different account.',
  EmailCreateAccount: 'Try signing with a different account.',
  Callback: 'Try signing with a different account.',
  OAuthAccountNotLinked:
    'To confirm your identity, sign in with the same account you used originally.',
  EmailSignin: 'Check your email address.',
  CredentialsSignin:
    'Sign in failed. Check the details you provided are correct.',
  InvalidEmail: 'The provided email is invalid.',
  default: 'Unable to sign in.',
}

const names = {
  google: 'Google',
  'azure-ad': 'Microsoft',
  github: 'GitHub',
}

function SignInError({ error, className, children, ...props }) {
  const errorMessage = error && (errors[error] ?? errors.default)

  return (
    <div {...props} className={clsx('text-red-600', className)}>
      <span>{errorMessage}</span>
      {children}
    </div>
  )
}

export default function Auth({
  status: _status,

  title: _title,

  // headline = 'The fastest way to build conversational AI bots',
  headline = 'AI Platform That Transforms and Grows your Business',

  partner,

  continueButtonCaption = 'Continue',

  homeButtonURL = '/overview',
  homeButtonCaption = 'Go to Overview',

  intermediateURL,

  providers = [],

  signinParameters = undefined,

  privacyLink,
  termsLink,

  className,

  children,

  ...props
}) {
  const router = useRouter()

  const session = useSession()

  const { signout } = useSignout()

  const sessionStatus = _status || session.status

  // @note the reason why we use formRef and not even.target.form is because it
  // appear the latter is not supported by all browsers so this is the most
  // cross-browser solution we can find

  const formRef = useRef()

  const callbackUrl = useMemo(() => {
    if (!router.query.callbackUrl) {
      return null
    }

    // @note strips the host from absolute callback urls so the redirect
    // always stays on the serving origin

    return tryPathquery(router.query.callbackUrl)
  }, [router.query.callbackUrl])

  const nextUrl = useMemo(() => {
    const theNextUrl = callbackUrl || homeButtonURL || '/'

    if (intermediateURL) {
      return pathquery(
        buildUrl(intermediateURL, undefined, {
          query: { callbackUrl: theNextUrl },
        })
      )
    } else {
      return theNextUrl
    }
  }, [homeButtonURL, intermediateURL, callbackUrl])

  const [signInWith, setSignInWith] = useState(null)

  const isTop = useIsTop()

  const { signin: _signIn } = useSignin()

  const signIn = useCallback(
    async (provider, options, parameters) => {
      if (!['email', 'credentials'].includes(provider)) {
        await _signIn(provider, options, parameters)

        return
      }

      try {
        const response = await _signIn(
          provider,
          { ...options, redirect: false },
          parameters
        )

        // special email handling

        if (provider === 'email') {
          if (response?.ok) {
            setSignInWith('email')

            toast.success('Check your email for your sign-in code.')

            return
          }
        }

        // generic handling

        if (response?.url) {
          const url = new URL(response.url, window.location.origin)

          router.push(url.href)

          return
        }

        if (response?.error) {
          const url = new URL(window.location.pathname, window.location.origin)

          url.searchParams.append('error', response.error)

          router.replace(url.href)

          return
        }

        {
          const url = new URL(window.location.pathname, window.location.origin)

          url.searchParams.append('error', 'Signin')

          router.replace(url.href)

          return
        }
      } catch (e) {
        await captureException(e)

        const url = new URL(window.location.pathname, window.location.origin)

        url.searchParams.append('error', 'Signin')

        router.replace(url.href)

        return
      }
    },
    [router, _signIn]
  )

  const signInWithEmailAndPin = useCallback(async () => {
    const emailInput = formRef.current.email

    const email = emailInput.value?.trim()

    if (!email) {
      emailInput.setCustomValidity('This email is required')
      emailInput.reportValidity()

      return
    }

    if (!isValidEmail(email)) {
      emailInput.setCustomValidity('This email is invalid')
      emailInput.reportValidity()

      return
    }

    const tokenInput = formRef.current.token

    const token = tokenInput.value?.trim()

    if (!token) {
      tokenInput.setCustomValidity('This token is required')
      tokenInput.reportValidity()

      return
    }

    toast.success('Signing you in...')

    const url = new URL('/api/auth/callback/email', window.location.origin)

    url.searchParams.append('email', formRef.current.email.value)
    url.searchParams.append('token', formRef.current.token.value)
    url.searchParams.append('callbackUrl', nextUrl)

    router.push(url.href)
  }, [nextUrl, router])

  const title = _title || 'ChatBotKit'

  return sessionStatus === 'loading' ? null : (
    <form {...props} className={clsx('space-y-4', className)} ref={formRef}>
      {partner ? (
        <>
          <PartnerBanner className="text-7xl" partner={partner} />
        </>
      ) : (
        <>
          {title ? (
            <h1 className="text-5xl font-bold tracking-tight">
              <Link href="/">{title}</Link>
            </h1>
          ) : null}
          {headline ? <p>{headline}</p> : null}
        </>
      )}
      {
        sessionStatus === 'authenticated' ? (
          <div className="space-y-4">
            <div className="flex flex-col space-y-4">
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  window.location = nextUrl
                }}
              >
                {callbackUrl ? continueButtonCaption : homeButtonCaption}
              </button>
              <button
                className="default-button"
                type="button"
                onClick={() =>
                  signout({ callbackUrl: router.query.callbackUrl || '/' })
                }
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : sessionStatus === 'unauthenticated' ? (
          <div className="space-y-4">
            {router.query.error ? (
              <div className="max-w-sm">
                <SignInError error={router.query.error} />
              </div>
            ) : null}
            {isTop ? (
              <>
                {providers
                  .filter((provider) => provider !== 'email')
                  .map((provider, index) => {
                    return (
                      <div key={provider} className="flex flex-col space-x-2">
                        <button
                          className={clsx({
                            'primary-button': index === 0,
                            'default-button': index !== 0,
                          })}
                          type="button"
                          onClick={() =>
                            signIn(
                              provider,
                              { callbackUrl: nextUrl },
                              {
                                ...signinParameters,
                              }
                            )
                          }
                        >
                          Sign in with {names[provider] || provider}
                        </button>
                      </div>
                    )
                  })}
                {providers
                  .filter((provider) => provider === 'email')
                  .map((provider) => {
                    return (
                      <div
                        key={provider}
                        className="text-left border-t border-t-1 border-l-0 border-r-0 border-b-0 border-gray-200 dark:border-gray-700 pt-5 space-y-2"
                      >
                        <p className="text-sm">Login with email</p>
                        <div className="default-input flex flex-row gap-2 items-center justify-center">
                          <input
                            className="none-input p-0 w-full"
                            type="email"
                            name="email"
                            placeholder="Email"
                            spellCheck={false}
                            onKeyDown={(event) => {
                              if (event.key !== 'Enter') {
                                return
                              }

                              if (!formRef.current.checkValidity()) {
                                return
                              }

                              event.preventDefault()

                              const emailInput = formRef.current.email

                              const email = emailInput.value?.trim()

                              if (!email) {
                                return
                              }

                              if (!isValidEmail(email)) {
                                emailInput.setCustomValidity(
                                  'This email is invalid'
                                )
                                emailInput.reportValidity()

                                return
                              }

                              signIn(
                                'email',
                                {
                                  callbackUrl: nextUrl,
                                  email: email,
                                },
                                {
                                  ...signinParameters,
                                }
                              )
                            }}
                          />
                          <button
                            className="primary-button small"
                            type="button"
                            onClick={(event) => {
                              event.preventDefault()

                              if (!formRef.current.checkValidity()) {
                                return
                              }

                              const emailInput = formRef.current.email

                              const email = emailInput.value?.trim()

                              if (!email) {
                                return
                              }

                              if (!isValidEmail(email)) {
                                emailInput.setCustomValidity(
                                  'This email is invalid'
                                )
                                emailInput.reportValidity()

                                return
                              }

                              signIn(
                                'email',
                                {
                                  callbackUrl: nextUrl,
                                  email: email,
                                },
                                {
                                  ...signinParameters,
                                }
                              )
                            }}
                          >
                            <ChevronRightIcon className="w-[1em] h-[1em]" />
                          </button>
                        </div>
                        {signInWith === 'email' ? (
                          <div className="space-y-2">
                            <p className="text-sm">
                              Please check your email for a sign-in code.
                            </p>
                            <div className="default-input flex flex-row gap-2 items-center justify-center">
                              <PinInput
                                className="flex-1"
                                containerClassName="space-x-2"
                                pinClassName="default-input tiny text-center w-[3em]"
                                name="token"
                                length={6}
                                autoFocus={true}
                                onComplete={() =>
                                  setTimeout(signInWithEmailAndPin, 100)
                                }
                              />
                              <button
                                className="primary-button small"
                                type="button"
                                onClick={signInWithEmailAndPin}
                              >
                                <ChevronRightIcon className="w-[1em] h-[1em]" />
                              </button>
                            </div>
                            <p className="text-xs">
                              You can paste the code from your email directly
                              into the fields above.
                            </p>
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
              </>
            ) : (
              <>
                <div className="flex flex-col space-x-2">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() =>
                      window.open(window.location.href, '_blank', 'popup')
                    }
                  >
                    Sign in
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null /* @todo what do we show when loading */
      }
      {children}
      {privacyLink && termsLink ? (
        <div className="flex flex-row gap-2 justify-center">
          {privacyLink ? (
            <a
              className="default-link"
              href={privacyLink}
              target="_blank"
              rel="noreferrer"
            >
              Privacy
            </a>
          ) : null}
          {privacyLink ? (
            <a
              className="default-link"
              href={termsLink}
              target="_blank"
              rel="noreferrer"
            >
              Terms
            </a>
          ) : null}
        </div>
      ) : null}
    </form>
  )
}
