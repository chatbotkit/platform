import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import DocsLink from '@/components/DocsLink'
import FAQ from '@/components/FAQ'
import Hero from '@/components/Hero'
import Link from '@/components/Link'
import SkillsetList from '@/components/SkillsetList'

import faq from '@/content/faqs/platform-skillsets.yaml'

export default function Index({ authenticated }) {
  return (
    <section className="section-white">
      <div className="main-page main-page-list">
        <SkillsetList
          autoLoad
          loadMore="auto"
          actions={
            authenticated ? (
              <Link className="primary-button" href="/skillsets/new">
                Create Skillset
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
      title="Develop Advanced Chatbot Skills with ChatBotKit - Custom Skillsets"
      description="Transform your chatbot with custom skillsets on ChatBotKit. Equip your bot with the unique data and skills it needs to understand and interact with users more effectively. Ideal for creating responsive, intelligent conversational agents that cater to specific user needs and scenarios."
      keywords="chatbot skill development, custom chatbot skills, ChatBotKit skillsets, advanced chatbot functionalities, personalized chatbot interactions, chatbot data training, intelligent conversational agents, user-specific chatbot abilities, enhancing chatbot responses, conversational AI skills, chatbot customization tools, interactive bot skills"
      authenticated={authenticated}
    >
      {authenticated ? (
        children
      ) : (
        <PageHero>
          <DocsLink className="default-button" slug="skillsets">
            Learn More
          </DocsLink>
          {/* <Link
          className="primary-button"
          href={{
            pathname: '/signin',
            query: {
              callbackUrl: '/skillsets',
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
      title={['Teach your AI bots', 'news skills']}
      description="Unlock the full potential of your AI bots by teaching them new skills."
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
 * @doc Skillsets
 * @description Overview of how chatbot Skillsets and Skillset instructions work. Learn how to customize your chatbot's abilities and improve its performance.
 * @category Resources
 * @tags skillsets, abilities, actions, tools, skills
 * @icon heroicons/cube-transparent
 * @index 1
 * @date Sat, Feb 21, 2026, 12:00 AM
 *
 * Skillsets are collections of abilities that teach your AI bots how to perform specific actions and tasks. Think of a skillset as giving your bot a toolbox of capabilities - from simple actions like fetching web pages or searching data, to complex operations like sending emails, creating calendar events, or analyzing documents.
 *
 * When you connect a skillset to your bot, the AI automatically understands what actions it can take and when to use them. For example, if your bot has a skillset with email-sending abilities, it can automatically send confirmation emails when users request them, or trigger notifications based on conversation context.
 *
 * ## What You Can Do with Skillsets
 *
 * **Create Custom Actions**: Build skillsets that give your bots the exact capabilities your business needs. Whether you need to connect to your internal APIs, interact with external services, or perform specialized tasks, skillsets make it possible.
 *
 * **Connect to Services**: Integrate with popular tools and platforms like Slack, Gmail, Google Calendar, Airtable, and hundreds of others. Each connection becomes an ability your bot can use automatically during conversations.
 *
 * **Combine Abilities**: A single skillset can contain multiple related abilities. For example, a "Customer Support" skillset might include abilities to search your knowledge base, create support tickets, send email notifications, and update your CRM - all working together seamlessly.
 *
 * **Reuse Across Bots**: Once you create a skillset, you can attach it to multiple bots. This means you can build a library of capabilities once and use them across your entire organization.
 *
 * ## How Skillsets Work
 *
 * Every skillset has a **name** and **description** that help both you and your AI understand its purpose. Importantly, these aren't just labels - the AI actually reads and uses this information to understand when and how to use the skillset's abilities. Think of it as giving your bot context about the tools it has available.
 *
 * Inside each skillset, you add **abilities** - individual actions the bot can perform. Each ability includes detailed instructions that tell the AI exactly how to execute that action, what information it needs, and how to handle the results.
 *
 * When your bot is having a conversation, it can see all the abilities from its connected skillsets. The AI analyzes what the user is asking for, determines which ability (if any) would be helpful, and executes it automatically. The results are then incorporated naturally into the conversation.
 *
 * ## Getting Started
 *
 * Creating your first skillset is simple:
 *
 * 1. Click **"Create Skillset"** from your Skillsets dashboard
 * 2. Give it a **descriptive name** that clearly indicates its purpose (like "Customer Support Tools" or "Sales Assistant")
 * 3. Add a **detailed description** explaining what capabilities this skillset provides and when to use them - remember, the AI reads this!
 * 4. Start adding **abilities** - you can build custom abilities or use pre-made templates for popular services
 * 5. **Connect the skillset** to your bots by editing the bot settings and selecting the skillset
 *
 * You can create as many skillsets as you need. Many users organize them by function (Support, Sales, Operations) or by service (Gmail Integration, Database Tools, Analytics).
 *
 * **Note on Skillsets and AI Skills:** ChatBotKit Skillsets share properties and
 * behaviors with what are now commonly known as "skills" in AI systems (such as
 * those popularized by Anthropic's Claude), although ChatBotKit's skillsets
 * pre-date this terminology. Like modern AI skills, a skillset's **name and
 * description are automatically known to the AI agent** and directly influence its
 * behavior. The agent uses these fields to understand when and how to apply the
 * skillset's capabilities. Additionally, connected abilities provide the agent
 * with detailed information about how to use each connected capability, making
 * skillsets a comprehensive system for extending AI agent functionality.
 *
 * ## Tips for Success
 *
 * **Write Clear Names and Descriptions**: Since the AI reads your skillset's name and description, make them informative. Instead of "Tools," try "Customer Support Knowledge Base and Ticketing Tools." This helps the AI understand when these abilities are relevant.
 *
 * **Group Related Abilities**: Keep abilities that work together in the same skillset. For example, if you have abilities for reading and writing to a database, keep them together so the AI can perform complete workflows.
 *
 * **Start Simple**: Begin with one or two abilities and test them thoroughly before adding more. This makes it easier to troubleshoot and understand how your bot behaves.
 *
 * **Test in Conversations**: Use the built-in chat feature on each skillset's page to test how your abilities work in real conversations. This helps you refine the instructions and see what the AI understands.
 *
 * **Keep Abilities Focused**: Each ability should do one thing well. Instead of one giant "handle customer request" ability, create separate abilities for "search knowledge base," "create ticket," and "send notification." The AI can combine them as needed.
 */
