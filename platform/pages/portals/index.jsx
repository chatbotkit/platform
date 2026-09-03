import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import DocsLink from '@/components/DocsLink'
import FAQ from '@/components/FAQ'
import Hero from '@/components/Hero'
import Link from '@/components/Link'
import PortalList from '@/components/PortalList'

import faq from '@/content/faqs/platform-portals.yaml'

export default function Index({ authenticated }) {
  return (
    <section className="section-white">
      <div className="main-page main-page-list">
        <PortalList
          autoLoad
          loadMore="auto"
          actions={
            authenticated ? (
              <Link className="primary-button" href="/portals/new">
                Create Portal
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
      title="Portals"
      authenticated={authenticated}
    >
      {authenticated ? (
        children
      ) : (
        <PageHero>
          <DocsLink className="default-button" slug="portals">
            Learn More
          </DocsLink>
          {/* <Link
          className="primary-button"
          href={{
            pathname: '/signin',
            query: {
              callbackUrl: '/portals',
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
      title={['Create and manage', 'user portals']}
      description="Portals are a way to package multiple conversational AI applications into a single experience with a unique URL and branding."
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
 * @doc Portals
 * @description Create focused AI experiences for different teams and audiences using dedicated portal websites with custom apps, access control, and branding
 * @category Resources
 * @tags portals, apps, access, collaboration, workspace, branding, configuration, slug
 * @index 12
 * @date Sat, Aug 23, 2025, 12:00 AM
 *
 * Portals let you package ChatBotKit apps into dedicated experiences for
 * specific groups of users. Instead of giving everyone access to everything,
 * you can create purpose-built spaces for support, operations, sales, or
 * internal teams - each with its own URL, branding, and set of capabilities.
 *
 * ## What Portals Are
 *
 * A portal is a standalone workspace where selected users can access selected
 * apps with a custom experience. Each portal gets a unique slug that becomes
 * its live URL at `{slug}.<portal apex>`. Portals are fully isolated from
 * each other - different portals can expose different apps to different users
 * with different branding, all under a single ChatBotKit account.
 *
 * Every portal is defined by:
 *
 * - **Name and Description**: A recognizable label and summary for your portal
 * - **Slug**: The unique identifier that forms the portal URL
 * - **Apps**: Which applications are available to portal users
 * - **Users**: Who is allowed to access the portal
 * - **Layout**: How the portal looks and feels (header, footer, sidebar)
 *
 * ## Available Apps
 *
 * Portals can include any combination of these applications:
 *
 * - **Chat**: Conversational AI interface where users interact with your bots. You can specify which bots are available, set starter messages, customize the title, and enable model selection or knowledge sources.
 * - **Task**: Task management for scheduling and running automated AI agent actions on behalf of contacts.
 * - **Connect**: Contact management for managing and interacting with contacts directly.
 * - **Inbox**: Conversation review dashboard for monitoring, filtering, and managing conversations. Supports filter controls for integration, safety, and console conversations.
 * - **Usage**: Usage analytics and reporting dashboard for tracking platform consumption and activity.
 *
 * If you only need chat, enable just that. If your team needs full operational
 * visibility, enable inbox, usage, and task together. The combination is
 * entirely up to you.
 *
 * ## Configuring Apps
 *
 * Each app can be toggled on or off, and some apps accept additional
 * configuration to tailor their behavior within the portal.
 *
 * ### Chat Configuration
 *
 * The chat app has the richest set of options:
 *
 * - **Bots**: Select specific bots to make available in the portal. Users will be able to start conversations with any of the listed bots.
 * - **Initial Messages**: Define suggested starter prompts that appear when a user opens a new chat. For example: "@bot welcome" or "Help me with onboarding".
 * - **Title and Description**: Customize the chat heading and description shown to portal users.
 * - **Models**: Enable or disable the ability for users to select different AI models.
 * - **Sources**: Control which knowledge sources are available - datasets, skillsets, spaces, MCPs, web search, and creative mode.
 * - **Save**: Allow users to save their conversation history.
 *
 * ### Inbox Configuration
 *
 * The inbox app lets you control which conversation filters are visible:
 *
 * - **Integration Filter**: Show or hide conversations from integrations (e.g., Slack, WhatsApp)
 * - **Safety Filter**: Show or hide conversations flagged by safety moderation
 * - **Console Filter**: Show or hide conversations from the developer console
 *
 * This is useful for creating focused review portals - for example, a safety
 * review portal that only shows moderation-flagged conversations, or a support
 * portal that only shows integration conversations.
 *
 * ## Controlling User Access
 *
 * The users section determines who can sign into your portal. Access is
 * controlled through email matchers - patterns that match against the email
 * address a user signs in with.
 *
 * You can use two types of matchers:
 *
 * - **Exact email**: `admin@company.com` - grants access to one specific person
 * - **Domain wildcard**: `*@company.com` - grants access to anyone with that email domain
 *
 * Add one matcher per line. For example, to allow your entire company plus a
 * specific external collaborator:
 *
 * - `*@company.com`
 * - `contractor@partner.io`
 *
 * Users who do not match any pattern will be denied access when they try to
 * sign in.
 *
 * ## Customizing Layout and Branding
 *
 * The layout section lets you shape the portal's visual presentation so it
 * feels like your own product.
 *
 * ### Header
 *
 * Toggle the top header bar on or off. Useful for embedding portals where you
 * want a cleaner look.
 *
 * ### Footer
 *
 * - **Made With Branding**: Show or hide the "Made with ChatBotKit" badge
 * - **Privacy Policy**: Add a link to your privacy policy
 * - **Terms of Service**: Add a link to your terms of service
 *
 * ### Sidebar
 *
 * - **Title**: The name displayed at the top of the sidebar navigation
 * - **Logo**: A logo image URL shown in the sidebar
 * - **Icon**: A smaller icon image for compact views
 * - **Link**: Where the sidebar title/logo links to when clicked
 *
 * Together, these options let you white-label the portal experience for your
 * team or customers.
 *
 * ## Common Use Cases
 *
 * **Customer Support Portal**
 * Give your support team a dedicated inbox with integration conversation
 * filters enabled, so they see exactly the conversations coming from your
 * live channels.
 *
 * **Safety Review Portal**
 * Create a focused portal for your trust and safety team with only the inbox
 * app, filtered to show safety-flagged conversations.
 *
 * **Developer Portal**
 * Set up a portal with inbox (all filters visible) and usage analytics so
 * your engineering team can debug and monitor bot activity.
 *
 * **Team Chat Portal**
 * Build a chat-only portal with a curated set of expert bots, starter
 * prompts, and a custom title - perfect for onboarding a department to AI
 * assistants.
 *
 * **All-in-One Internal Portal**
 * Create a broader portal for internal users who need access to chat, inbox,
 * task management, and usage reporting in one place.
 *
 * ## Portal Templates
 *
 * When creating a new portal, you can start from a built-in template that
 * pre-configures the apps and settings for common scenarios:
 *
 * - **Chat Portal**: A simple portal with just the chat application
 * - **Customer Support Portal**: Inbox configured for integration conversations
 * - **Safety Review Portal**: Inbox configured for safety-flagged content
 * - **Developer Portal**: Inbox with all filters plus usage analytics
 * - **All-in-One Portal**: Chat, inbox, usage, and task together
 * - **Team Chat Portal**: Chat with pre-configured bots and starter messages
 *
 * Templates are a starting point - you can customize everything after creation.
 *
 * ## Getting Started
 *
 * 1. Go to the Portals page and click **Create Portal**.
 * 2. Choose a template or start from scratch.
 * 3. Set a clear name, description, and unique slug.
 * 4. Select which apps to enable and configure their options.
 * 5. Add user access matchers for who should be able to sign in.
 * 6. Customize the layout with your branding (logo, title, footer links).
 * 7. Save and share the portal URL with your team.
 *
 * ## Best Practices
 *
 * - **Start focused**: Begin with one app and a small set of users, then expand as you learn what works
 * - **Use descriptive names**: When you have multiple portals, clear names help you manage them at a glance
 * - **Scope access tightly**: Use domain wildcards for teams, exact emails for external collaborators
 * - **Leverage templates**: Start from a template that matches your use case and customize from there
 * - **Brand consistently**: Set sidebar logo, title, and footer links so the portal feels like part of your product
 * - **Create separate portals per audience**: Rather than one portal with everything, create targeted portals for each team or workflow
 *
 * Portals give you the flexibility to create tailored AI experiences for every
 * team and use case - from a simple single-bot chat page to a full operational
 * dashboard - all managed from your ChatBotKit account.
 */
