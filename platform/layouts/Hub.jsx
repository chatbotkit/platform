import { navbarButtons } from '@/config/navigation'

import Confirm from '@/components/Confirm'
import MainNavbar from '@/components/MainNavbar'
import Meta from '@/components/Meta'
import Widget from '@/components/Widget'

export const rootUrl = '/' // deliberately set / so that the user can exit

const navigation = [
  {
    title: 'Hub',
    href: '/hub',

    exactMatch: true,
  },
  {
    title: 'Blueprints',
    href: '/hub/blueprints',

    panel: {
      items: [
        {
          title: 'Top AI Blueprints',
          description: 'The most popular ai blueprints on ChatBotKit',
          href: '/hub/blueprints',
        },
        {
          title: 'Latest AI Blueprints',
          description: 'The latest ai blueprints on ChatBotKit',
          href: '/hub/blueprints/latest',
        },
        {
          title: 'Create and Publish AI Blueprints →',
          description: 'Create and publish your own AI blueprints',
          href: '/blueprints/new',
        },
      ],
    },
  },
  {
    title: 'Bots',
    href: '/hub/bots',

    panel: {
      items: [
        {
          title: 'Top AI Bots',
          description: 'The most popular ai bots on ChatBotKit',
          href: '/hub/bots',
        },
        {
          title: 'Latest AI Bots',
          description: 'The latest ai bots on ChatBotKit',
          href: '/hub/bots/latest',
        },
        {
          title: 'Create and Publish AI Bots →',
          description: 'Create and publish your own AI bots',
          href: '/bots/new',
        },
      ],
    },
  },
  {
    title: 'Datasets',
    href: '/hub/datasets',

    panel: {
      items: [
        {
          title: 'Top AI Datasets',
          description: 'The most popular ai datasets on ChatBotKit',
          href: '/hub/datasets',
        },
        {
          title: 'Latest AI Datasets',
          description: 'The latest ai datasets on ChatBotKit',
          href: '/hub/datasets/latest',
        },
        {
          title: 'Create and Publish AI Datasets →',
          description: 'Create and publish your own AI datasets',
          href: '/datasets/new',
        },
      ],
    },
  },
  {
    title: 'Skillset',
    href: '/hub/skillsets',

    panel: {
      items: [
        {
          title: 'Top AI Skillsets',
          description: 'The most popular ai skillsets on ChatBotKit',
          href: '/hub/skillsets',
        },
        {
          title: 'Latest AI Skillsets',
          description: 'The latest ai skillsets on ChatBotKit',
          href: '/hub/skillsets/latest',
        },
        {
          title: 'Create and Publish AI Skillsets →',
          description: 'Create and publish your own AI skillsets',
          href: '/skillsets/new',
        },
      ],
    },
  },
  {
    title: 'Widgets',
    href: '/hub/widgets',

    panel: {
      items: [
        {
          title: 'Top AI Widgets',
          description: 'The most popular ai widgets on ChatBotKit',
          href: '/hub/widgets',
        },
        {
          title: 'Latest AI Widgets',
          description: 'The latest ai widgets on ChatBotKit',
          href: '/hub/widgets/latest',
        },
        {
          title: 'Create and Publish AI Widgets →',
          description: 'Create and publish your own AI widgets',
          href: '/integrations/widget/new',
        },
      ],
    },
  },
  {
    title: 'Collections',
    href: '/hub/collections',

    panel: {
      items: [
        {
          title: 'GPTs',
          description:
            'Discover the transformative potential of Generative Pre-trained Transformers (GPTs) in AI writing technology.',
          href: '/hub/collections/gpts',
        },
        {
          title: 'Top AI Image Generators',
          description:
            'Discover the top AI image generators of 2024, transforming digital art and marketing with detailed, creative visuals.',
          href: '/hub/collections/top-ai-image-generators',
        },
        {
          title: 'All Collections',
          description: 'Discover all collections on ChatBotKit',
          href: '/hub/collections',
        },
      ],
    },
  },
]

export default function Hub({
  breadcrumbs,
  title,
  description,
  keywords,
  image,
  rss,

  children,
}) {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-white dark:bg-black">
      <Meta
        breadcrumbs={breadcrumbs || ['Hub', 'ChatBotKit']}
        title={title}
        description={description}
        keywords={keywords}
        image={image}
        rss={rss}
      />
      <Widget />
      <MainNavbar
        rootUrl={rootUrl}
        navigation={navigation}
        buttons={navbarButtons}
        miniDarkModeSwitch={true}
      />
      <Confirm>
        <main>
          <div>{children}</div>
        </main>
      </Confirm>
    </div>
  )
}
