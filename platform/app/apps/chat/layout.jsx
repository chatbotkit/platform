import {
  getPublicAppConfig,
  getUserAppConfig,
} from '@/lib/app.router.app.config'
import { getAppManifestPath } from '@/lib/app.router.app.manifest'
import { withAppRouterContext } from '@/lib/app.router.context'

import App from '@/layouts/App'
import { Error } from '@/layouts/Errata'

import NoSsr from '@/components/NoSsr'

import manifest from './app.manifest'
import Main from './components/Main'
import { APP_NAME } from './const'
import { listAll } from './server'

async function generateMetadataImpl() {
  const config = await getPublicAppConfig()

  const { name = manifest.name, description = manifest.description } =
    config || {}

  return {
    title: name,
    description: description,
    keywords: 'chatbotkit, chat, chatbot, agentic ai, conversational ai, bots',
    manifest: getAppManifestPath(APP_NAME),
  }
}

async function Layout({ children }) {
  const [config, result] = await Promise.all([
    getUserAppConfig(APP_NAME),
    listAll({}),
  ])

  if (!result) {
    return (
      <div className="main-page main-page-3xl">
        <Error error="loading" error_description="Loading..." />
      </div>
    )
  }

  if ('error' in result) {
    return (
      <div className="main-page main-page-3xl">
        <Error
          error={result.error.code}
          error_description={result.error.message}
        />
      </div>
    )
  }

  const { bots, models, sources, conversations, conversation } = result

  return (
    <App slug={APP_NAME} goBackTo=":prev" config={config}>
      {/* @note client-only app embed - keep <NoSsr>, do not SSR these dashboard
          tools. Full rationale: app/apps/layout.jsx */}
      <NoSsr>
        <Main
          bots={bots}
          models={models}
          sources={sources}
          conversations={conversations}
          conversation={conversation}
        >
          {children}
        </Main>
      </NoSsr>
    </App>
  )
}

export const maxDuration = 800

/**
 * @doc Apps
 * @index 10
 *
 * ## [Chat](https://chatbotkit.com/apps/chat)
 *
 * Chat stands as the flagship application of the ChatBotKit ecosystem, designed to consolidate and streamline multi-agent management for enhanced AI collaboration. This revolutionary app transforms how users interact with multiple AI agents by providing a unified conversational canvas where sophisticated AI cooperation becomes seamless and intuitive.
 *
 * ### Key Features of Chat
 *
 * - **Multi-Agent Conversations**: Chat enables users to interact with multiple AI agents simultaneously within a single conversation interface, allowing for complex collaborative interactions that leverage the unique strengths of different specialized agents.
 * - **Enhanced AI Collaboration**: The app facilitates sophisticated coordination between AI agents, enabling them to work together on complex tasks while maintaining context and coherence throughout the conversation.
 * - **Unified Interface**: Rather than managing separate conversations with individual agents, Chat provides a streamlined experience where all AI interactions flow naturally within one conversational space.
 * - **Context Preservation**: Advanced context management ensures that information shared with one agent remains accessible to others when appropriate, creating a truly collaborative AI environment.
 *
 * ### Why Choose Chat?
 *
 * Chat represents the future of AI interaction, moving beyond simple one-to-one conversations to enable sophisticated multi-agent collaboration. Whether you're coordinating research across multiple specialized AI assistants, managing complex customer service scenarios that require different types of expertise, or exploring creative projects that benefit from diverse AI perspectives, Chat provides the infrastructure for truly collaborative AI experiences.
 *
 * The app is particularly valuable for businesses and individuals who need to leverage multiple AI capabilities simultaneously, enabling workflows that were previously impossible with traditional single-agent interactions.
 *
 * Whether you need quick answers from specialized agents or complex multi-step collaboration across different AI capabilities, Chat is designed to facilitate seamless multi-agent interactions that maximize the collective intelligence of your AI resources.
 */

export const generateMetadata = withAppRouterContext(generateMetadataImpl)

export default withAppRouterContext(Layout)
