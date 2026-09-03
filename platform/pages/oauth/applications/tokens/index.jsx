import { useState } from 'react'

import { timeAgo } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import { useConfirmDelete } from '@/components/Confirm'
import DynamicIcon from '@/components/DynamicIcon'
import FAQ from '@/components/FAQ'
import Hero from '@/components/Hero'
import List from '@/components/List'

import useFetch from '@/hooks/useFetch'

import faq from '@/content/faqs/platform-tokens.yaml'

export default function Index({ tokens: _tokens }) {
  const confirmDelete = useConfirmDelete()

  const [tokens, setTokens] = useState(_tokens)

  const { fetch } = useFetch({ loadingMessage: true, failureMessage: true })

  async function deleteToken(tokenId) {
    if (!(await confirmDelete('Do you really want to delete this token?'))) {
      return
    }

    const oldTokens = tokens

    setTokens(tokens.filter((token) => token.id !== tokenId))

    const { error } = await fetch(`/api/oauth/revoke`, {
      data: {
        id: tokenId,
      },
    })

    if (error) {
      setTokens(oldTokens)
    }
  }

  return (
    <section className="section-white">
      <div className="main-page main-page-list">
        <List emptyMessage="You do not have any tokens yet.">
          {tokens.map(
            ({
              id,
              name,
              description,
              createdAt,
              accessTokenExpiresAt,
              refreshTokenExpiresAt,
              application,
            }) => {
              const expiresAt = [
                accessTokenExpiresAt,
                refreshTokenExpiresAt,
              ]
                .filter(Boolean)
                .map((value) => new Date(value).getTime())

              return (
                <List.Item
                  key={id}
                  icon={
                    <DynamicIcon
                      className="w-16 h-16 text-6xl rounded-full"
                      icon={application.icon || '📱'}
                    />
                  }
                  title={name || application.name || id}
                  body={
                    description ||
                    application.description || (
                      <span className="italic">
                        A token without description
                      </span>
                    )
                  }
                  timestamp={createdAt}
                >
                  <button
                    className="text-sm danger-link"
                    type="button"
                    onClick={() => deleteToken(id)}
                  >
                    Delete
                  </button>
                  {expiresAt.length ? (
                    <div className="tag">
                      expires {timeAgo(Math.max(...expiresAt))}
                    </div>
                  ) : null}
                </List.Item>
              )
            }
          )}
        </List>
      </div>
    </section>
  )
}

Index.getLayout = function (children, { authenticated }) {
  return (
    <Dashboard
      breadcrumbs={['ChatBotKit']}
      title="Access"
      authenticated={authenticated}
    >
      {authenticated ? (
        <>
          <PageHero className="bg-gray-50 dark:bg-gray-950">
            {/* pass */}
          </PageHero>
          {children}
        </>
      ) : (
        <PageHero>
          {/* <Link
          className="primary-button"
          href={{
            pathname: '/signin',
            query: {
              callbackUrl: '/tokens',
            },
          }}
        >
          Sign in
        </Link> */}
        </PageHero>
      )}
      <FAQ faq={faq} />
    </Dashboard>
  )
}

export function PageHero(props) {
  return (
    <Hero
      {...props}
      title={['Manage OAuth', 'access tokens']}
      description="Access tokens are used to authenticate your API requests. You can create as many tokens as you need and manage them here."
      compact={true}
    />
  )
}

export async function getServerSideProps(context) {
  const session = await getSoftSession(context.req, context.res)

  if (!session) {
    return {
      props: makeJsonSafe({
        authenticated: false,
      }),
    }
  }

  const tokens = await prisma.oAuthApplicationToken.findMany({
    where: {
      userId: session.user.id,
    },

    orderBy: [
      {
        createdAt: 'desc',
      },
    ],

    select: {
      id: true,

      name: true,
      description: true,

      createdAt: true,

      accessTokenExpiresAt: true,
      refreshTokenExpiresAt: true,

      application: {
        select: {
          name: true,
          description: true,

          redirectUris: true,
        },
      },
    },
  })

  tokens.forEach((token) => {
    if (token.application) {
      const hostname = token.application.redirectUris
        .map((url) => new URL(url).hostname)
        .filter((hostname) => !/^localhost/.test(hostname))[0]

      token.application.icon = `@logo/${hostname}`

      delete token.application.redirectUris
    }
  })

  return {
    props: makeJsonSafe({
      authenticated: true,

      tokens: tokens,
    }),
  }
}
