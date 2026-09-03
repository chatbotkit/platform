import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import FAQ from '@/components/FAQ'
import Hero from '@/components/Hero'
import Link from '@/components/Link'
import List, { ListItem } from '@/components/List'

import faq from '@/content/faqs/website-playground.yaml'

export const playgrounds = {
  conversation: {
    emoji: '💬',
    title: 'Conversation',
    description:
      'Test and debug conversation flows in real-time. Enter different user inputs and observe how your bot responds to each scenario.',
  },
  situation: {
    emoji: '🔁',
    title: 'Situation',
    description:
      'Quickly troubleshoot developed conversations. Configure various options and test how your bot handles different user scenarios.',
  },
  entity: {
    emoji: '🔍',
    title: 'Entity',
    description:
      'Test how your bot detects and handles personal identifiable information (PII). Validate privacy controls and data handling behavior.',
  },
  backstory: {
    emoji: '📖',
    title: 'Backstory',
    description:
      'Create compelling backstories for your AI bots. Craft detailed personas that shape how your bot communicates and responds to users.',
  },
  record: {
    emoji: '📀',
    title: 'Record',
    description:
      'Work with dataset records and transform them into different formats. Convert raw data to FAQs or structured knowledge entries.',
  },
  ability: {
    emoji: '💪',
    title: 'Ability',
    description:
      'Create and test bot abilities in a sandbox environment. Build and validate custom skills before deploying them to production.',
  },
  image: {
    emoji: '📝',
    title: 'Image',
    description:
      'Generate custom images using pre-trained models. Experiment with different parameters, styles, and prompts to create visuals.',
  },
  widget: {
    emoji: '🎨',
    title: 'Widget',
    description:
      'Build and preview custom themes for your widget integrations. Customize colors, styles, and layout for your website embedding.',
  },
  message: {
    emoji: '📱',
    title: 'Message',
    description:
      'Create and test different message types for your AI bots. Preview how various message formats render across different contexts.',
  },
  api: {
    emoji: '🔧',
    title: 'API',
    description:
      'Test REST API endpoints directly in your browser. Send requests, inspect responses, and debug your integrations in real-time.',
  },
  graphql: {
    emoji: '🔮',
    title: 'GraphQL',
    description:
      'Test GraphQL queries and mutations with an intuitive interface. Explore the schema, run operations, and inspect response data.',
  },
  jsonpath: {
    emoji: '🔗',
    title: 'JSONPath',
    description:
      'Evaluate and debug JSONPath expressions against sample JSON data. Validate your queries before using them in your integrations.',
  },
  jmespath: {
    emoji: '🔗',
    title: 'JMESPath',
    description:
      'Test and debug JMESPath expressions against JSON structures. Validate query syntax and results before deploying to production.',
  },
  html: {
    emoji: '🌐',
    title: 'HTML',
    description:
      'Test how HTML content is converted to plain text. Debug content extraction and text processing for conversational AI applications.',
  },
  pdf: {
    emoji: '📄',
    title: 'PDF',
    description:
      'Test how PDF documents are converted to text. Debug content extraction and validate text processing for your AI workflows.',
  },
}

export default function Index() {
  return (
    <section className="section-white">
      <div className="main-page main-page-list">
        <List>
          {Object.entries(playgrounds).map(
            ([slug, { href, title, description }]) => {
              return (
                <ListItem
                  key={href || slug}
                  link={href || `/playground/${slug}`}
                  title={title}
                  body={description}
                  // expanded={true}
                />
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
      breadcrumbs={['Platform']}
      title="Playground"
      description="Experiment with conversational AI in a sandbox environment. Test configurations, debug responses, and prototype new ideas without affecting production."
      keywords="playground, sandbox, testing, debugging, conversational ai, experimentation"
      image={`/playground/index/card`}
      authenticated={authenticated}
    >
      {authenticated ? (
        children
      ) : (
        <PageHero className="bg-gray-50 dark:bg-gray-950">
          <Link
            className="default-button"
            href="/playgrounds/tokens"
            target="_blank"
          >
            Learn More
          </Link>
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
      title={['Learn and experiment', 'in the chatbot playground']}
      description="Experience the excitement of learning and experimenting with conversational AI. Unlock the full potential of chatbots in a virtual environment designed to enhance your learning process."
      compact={true}
    />
  )
}

export async function getServerSideProps(context) {
  const session = await getSoftSession(context.req, context.res)

  return {
    props: makeJsonSafe({
      authenticated: !!session,
    }),
  }
}

/**
 * @doc Playgrounds
 * @description Overview of ChatBotKit Playgrounds. Learn how to use Playgrounds to experiment, debug, and prototype conversational AI workflows.
 * @category Other
 * @tags chatbot, playground, tutorials
 * @icon heroicons/play
 * @index 501
 * @date Fri, Jul 5, 2024, 12:00 AM
 *
 * ChatBotKit comes with a set of tools that let you experiment with conversational AI in a safe sandbox before you roll changes into production. We call these tools Playgrounds. Each Playground is designed around a specific kind of task, so you can test prompts, inspect structured data, debug extraction logic, and validate how your AI behaves under different conditions.
 *
 * Playgrounds are useful when you want fast feedback. Instead of editing a live bot and guessing how changes will behave, you can prototype ideas in isolation, compare outputs, and refine the setup until it works the way you expect. This makes Playgrounds especially valuable for prompt design, data transformation, API troubleshooting, and content extraction.
 */
