import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import DocsLink from '@/components/DocsLink'
import FAQ from '@/components/FAQ'
import Hero from '@/components/Hero'
import Link from '@/components/Link'
import TokenList from '@/components/TokenList'

import faq from '@/content/faqs/platform-tokens.yaml'

export default function Index({ authenticated }) {
  return (
    <section className="section-white">
      <div className="main-page main-page-list">
        <TokenList
          autoLoad
          loadMore="auto"
          actions={
            authenticated ? (
              <Link className="primary-button" href="/tokens/new">
                Create Token
              </Link>
            ) : null
          }
        />
      </div>
    </section>
  )
}

Index.getLayout = function (children, { authenticated }) {
  return (
    <Dashboard
      breadcrumbs={['ChatBotKit']}
      title="Tokens"
      authenticated={authenticated}
    >
      {authenticated ? (
        children
      ) : (
        <PageHero>
          <DocsLink className="default-button" slug="tokens">
            Learn More
          </DocsLink>
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
      title={['Create and manage tokens', 'for API access']}
      description="Tokens are used to authenticate your API requests. You can create as many tokens as you need and manage them here."
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

  return {
    props: makeJsonSafe({
      authenticated: true,
    }),
  }
}

/**
 * @doc Tokens
 * @description Create and manage API tokens to authenticate programmatic access to your ChatBotKit account
 * @category Developers
 * @tags tokens, api, authentication, security, api key, access control
 * @index 310
 * @date Sat, May 17, 2026, 12:00 AM
 *
 * Tokens are secure credentials that allow you to access the ChatBotKit API programmatically. Think of them as special passwords designed specifically for applications, scripts, and integrations to interact with your ChatBotKit account without using your regular login credentials.
 *
 * ## What Are Tokens?
 *
 * An API token is a unique string of characters that identifies and authenticates your application when making requests to the ChatBotKit API. Instead of embedding your username and password in code (which would be insecure), you use tokens to grant secure, controlled access to your account's resources.
 *
 * Tokens enable you to:
 * - **Build Custom Integrations**: Connect ChatBotKit to your own applications and services
 * - **Automate Operations**: Create scripts to manage bots, datasets, and conversations programmatically
 * - **Use SDKs and Libraries**: Authenticate when using ChatBotKit's official SDKs (Node.js, Python, etc.)
 * - **Control Access**: Create separate tokens for different applications or team members
 * - **Maintain Security**: Revoke or rotate tokens without changing your account password
 *
 * ## How Tokens Work
 *
 * When you create a token, ChatBotKit generates a unique secret string that represents your account's authorization. You then use this token in the headers of your API requests to prove you have permission to perform operations.
 *
 * For example, when making an API call, you include your token like this:
 * ```
 * Authorization: Bearer YOUR_TOKEN_HERE
 * ```
 *
 * The ChatBotKit API receives your token, verifies it's valid and belongs to your account, then processes your request with your account's permissions. This happens automatically when you use ChatBotKit's SDKs - you just provide the token during setup, and the SDK handles the rest.
 *
 * ## Creating Your First Token
 *
 * Getting started with API tokens is straightforward:
 *
 * 1. Click **"Create Token"** from your Tokens dashboard
 * 2. Give your token a **descriptive name** (like "Production Website Integration" or "Development Testing")
 * 3. Optionally add a **description** explaining what this token is used for
 * 4. Click **"Create"** to generate the token
 * 5. **Copy the token immediately** - for security, it won't be shown again
 * 6. Store the token securely (use environment variables, secret management, or secure password storage)
 *
 * **Important**: Once you leave the token creation page, you won't be able to see the full token value again. If you lose it, you'll need to create a new token.
 *
 * ## Managing Your Tokens
 *
 * Your Tokens dashboard shows all the tokens you've created, displaying:
 * - **Name and Description**: Helps you remember what each token is for
 * - **Creation Date**: When the token was generated
 * - **Token ID**: A unique identifier (not the secret token itself)
 *
 * You can:
 * - **View Details**: See information about when and why you created each token
 * - **Delete Tokens**: Revoke access for tokens you no longer need or that may be compromised
 * - **Create Multiple Tokens**: Generate as many tokens as needed for different purposes
 *
 * ## Restricting Token Access
 *
 * By default, a token grants full access to your account's API. For tighter security, you can limit a token to specific API operations using **allowed route patterns** in the token's Advanced Options. This is especially useful when sharing tokens with external systems, third-party integrations, or team members who should only access a subset of your resources.
 *
 * Route restrictions use glob patterns matched against API path segments. For example:
 *
 * | Pattern | What it allows |
 * | --- | --- |
 * | `conversation/**` | All conversation operations |
 * | `bot/**` | All bot operations |
 * | `**&#47;list`, `**&#47;fetch` | Read-only access across all resources |
 * | `bot/<botId>/session/create` | Session creation for one specific bot |
 *
 * The token detail page includes a **Templates** picker with pre-built configurations for common use cases, including read-only access, conversation-only access, bot management, dataset management, and usage monitoring. You can select a template as a starting point and adjust it for your specific needs.
 *
 * A token with no allowed routes configured has unrestricted access to all API operations.
 *
 * ## Security Best Practices
 *
 * Tokens are powerful credentials that provide full access to your account, so it's crucial to handle them securely:
 *
 * **Never Share Tokens Publicly**: Don't commit tokens to public GitHub repositories, post them in forums, or share them in Slack messages. Treat tokens like passwords.
 *
 * **Use Environment Variables**: Store tokens in environment variables or secure secret management systems rather than hardcoding them in your application. For example, use `.env` files that are excluded from version control.
 *
 * **Restrict Token Scope**: Use route restrictions in Advanced Options to limit a token to only the operations it needs. A token that only needs to create sessions for one bot does not need full account access.
 *
 * **Create Purpose-Specific Tokens**: Use different tokens for different applications or environments. This way, if one token is compromised or an application no longer needs access, you can revoke just that token without affecting other integrations.
 *
 * **Rotate Tokens Regularly**: Periodically create new tokens and delete old ones, especially for long-running production applications. This limits the impact if a token is ever exposed.
 *
 * **Delete Unused Tokens**: If you stop using an integration or retire an application, delete its token immediately. Don't leave unused tokens active.
 *
 * **Monitor API Usage**: Keep an eye on your API usage patterns. Unusual activity might indicate a compromised token.
 *
 * **Use HTTPS Only**: Always make API requests over HTTPS (not HTTP) to ensure your token is encrypted during transmission.
 *
 * ## Common Use Cases
 *
 * **Website Integration**: Create a token for your production website that embeds ChatBotKit widgets or uses the conversation API to power custom chat interfaces.
 *
 * **Development and Testing**: Use a separate token for your development environment, so you can test changes without affecting production. Delete and recreate this token periodically.
 *
 * **Automated Scripts**: Build scripts that automatically update bot datasets with new content, generate reports on conversation metrics, or perform regular maintenance tasks.
 *
 * **CI/CD Pipelines**: Use tokens in your deployment pipelines to automatically update bot configurations or content as part of your release process.
 *
 * **Third-Party Integrations**: When connecting ChatBotKit to services like Zapier, n8n, or custom integrations, create a dedicated token for each service.
 *
 * **Team Member Access**: If you have developers or team members who need API access but shouldn't have full dashboard access, create tokens for them. When they leave or change roles, simply delete their token.
 *
 * ## What to Do If a Token Is Compromised
 *
 * If you believe a token has been exposed or compromised:
 *
 * 1. **Delete the token immediately** from your Tokens dashboard to revoke all access
 * 2. **Create a new token** if you still need API access for that purpose
 * 3. **Update your applications** with the new token
 * 4. **Review recent activity** in your account to check for any unauthorized actions
 * 5. **Notify your team** if the token was being used by multiple people or systems
 *
 * Deleting a token instantly revokes access - any requests using that token will be rejected immediately.
 *
 * ## Getting Help
 *
 * If you need assistance with tokens:
 * - Check the [API Documentation](/docs) for examples of using tokens with the REST API
 * - Review the SDK documentation for your programming language (Node.js, Python, etc.)
 * - Contact support if you're experiencing authentication issues or need help with a specific integration
 *
 * Tokens are your gateway to programmatic access to ChatBotKit, enabling you to build powerful custom integrations and automations while maintaining security and control over your account.
 */
