import { useEffect, useMemo, useState } from 'react'
import { TbActivity, TbBuildingStore } from 'react-icons/tb'

import { useRouter } from 'next/router'

import { getExampleHref, getSortedExamples } from '@/lib/example.fetch'
import { makeJsonSafe } from '@/lib/struct'

import Explore from '@/layouts/Explore'

import CategoryGrid from '@/components/CategoryGrid'
import DynamicIcon from '@/components/DynamicIcon'
import FAQ from '@/components/FAQ'
import Hero from '@/components/Hero'
import Link from '@/components/Link'
import List from '@/components/List'
import StructuredData from '@/components/StructuredData'

import faq from '@/content/faqs/website-examples.yaml'

import clsx from 'clsx'
import pluralize from 'pluralize'

export function ExampleListItem({
  className,

  slug,
  icon,

  title,
  description,
  keywords,

  live,

  demo,

  hub,

  hasTheme: _hasTheme,
  hasBlueprint: _hasBlueprint,
  hasFiles: _hasFiles,

  featured: _featured,

  screenshot: _screenshot,

  ...props
}) {
  return (
    <List.Item
      {...props}
      className={clsx('!gap-4 hover:rounded-xl', className)}
      icon={
        <div className="flex flex-row justify-center items-center w-12 h-12 rounded-md border auto-bg-gray-100 auto-border-gray-200">
          <DynamicIcon className="w-6 h-6" icon={icon} />
        </div>
      }
      link={getExampleHref({ slug, hub })}
      title={title}
      body={description}
    >
      {keywords?.slice(0, 3).map((keyword) => {
        return (
          <div key={keyword} className="tag">
            {keyword}
          </div>
        )
      })}
      {live ? (
        <div className="tag lighter flex gap-2 items-center">
          <TbActivity className="w-[1em] h-[1em] text-current" />
          <span>live</span>
        </div>
      ) : null}
      {demo ? (
        <div className="tag lighter flex gap-2 items-center">
          <TbActivity className="w-[1em] h-[1em] text-current" />
          <span>demo</span>
        </div>
      ) : null}
      {hub ? (
        <div className="tag lighter flex gap-2 items-center">
          <TbBuildingStore className="w-[1em] h-[1em] text-current" />
          <span>hub</span>
        </div>
      ) : null}
    </List.Item>
  )
}

// @note when an example ships screenshots we promote it from a compact list row
// to a full-width spotlight card that leads with the screenshot as its main
// image - a way to signal the example is a bigger deal without hiding anything
export function ExampleSpotlight({
  className,

  slug,
  icon,

  title,
  description,
  keywords,

  hub,

  screenshot,

  live: _live,
  demo: _demo,
  featured: _featured,
  hasTheme: _hasTheme,
  hasBlueprint: _hasBlueprint,
  hasFiles: _hasFiles,

  ...props
}) {
  return (
    <article
      {...props}
      className={clsx(
        'group relative sm:col-span-3',
        'overflow-hidden rounded-2xl',
        'border auto-border-gray-200',
        'bg-white dark:bg-gray-950',
        'transition-all duration-200 hover:shadow-lg hover:auto-border-gray-300',
        className
      )}
    >
      <Link
        className="grid sm:grid-cols-2 focus:outline-none"
        href={getExampleHref({ slug, hub })}
      >
        <div className="relative order-first flex aspect-[16/10] items-center justify-center overflow-hidden auto-bg-gray-100 p-4 sm:order-last sm:p-6">
          <img
            className="max-h-full max-w-full rounded-lg object-contain transition-transform duration-300 group-hover:scale-[1.03]"
            src={screenshot}
            alt={title}
            loading="lazy"
            onError={(event) => event.target.remove()}
          />
        </div>
        <div className="flex flex-col gap-4 p-6 sm:p-8">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
              <DynamicIcon className="h-3.5 w-3.5" icon="lucide/sparkles" />
              Spotlight
            </span>
          </div>
          <div className="flex flex-row items-center gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md border auto-bg-gray-100 auto-border-gray-200">
              <DynamicIcon className="h-6 w-6" icon={icon} />
            </div>
            <h3 className="min-w-0 text-2xl font-bold tracking-tight auto-text-gray-900">
              {title}
            </h3>
          </div>
          <p className="auto-text-gray-500 line-clamp-3">{description}</p>
          {keywords?.length ? (
            <div className="flex flex-row flex-wrap gap-2">
              {keywords.slice(0, 3).map((keyword) => (
                <div key={keyword} className="tag">
                  {keyword}
                </div>
              ))}
            </div>
          ) : null}
          <div className="mt-auto pt-2">
            <span className="default-link inline-flex items-center gap-1 font-medium">
              View example
              <span
                aria-hidden
                className="transition-transform duration-200 group-hover:translate-x-1"
              >
                →
              </span>
            </span>
          </div>
        </div>
      </Link>
    </article>
  )
}

export function ExamplesList({ examples }) {
  return (
    <>
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'Conversational AI Examples',
          description: 'Collection of AI-powered chatbot and agent examples',
          numberOfItems: examples.length,
          itemListElement: examples.map((example, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            item: {
              '@type': 'SoftwareApplication',
              name: example.title,
              description: example.description,
              applicationCategory: 'AI Chatbot',
              url: `${getExampleHref(example)}`,
              ...(example.keywords?.length && {
                keywords: example.keywords.join(', '),
              }),
            },
          })),
        }}
      />
      <List>
        {examples.map((example) => (
          <ExampleListItem {...example} key={example.slug} />
        ))}
      </List>
    </>
  )
}

export function Listing({ examples }) {
  const router = useRouter()

  const categories = useMemo(() => {
    function makeFilter(...searchTerms) {
      return ({ keywords = [] }) => {
        return searchTerms.some((searchTerm) => {
          return keywords.some((keyword) =>
            keyword.includes(pluralize(searchTerm, 1))
          )
        })
      }
    }

    return [
      {
        name: 'Featured',
        description:
          'Our most complete, ready-to-deploy solutions - a curated place to start.',
        filter: ({ featured }) => featured,
      },
      {
        name: 'Live',
        description: 'Interactive examples you can try right now.',
        filter: ({ live }) => live,
      },
      {
        name: 'Demo',
        description: 'Playable demos of what agents can do.',
        filter: ({ demo }) => demo,
      },
      {
        name: 'Blueprint',
        description:
          'Full agent blueprints you can open, clone, and customize.',
        filter: ({ hasBlueprint }) => hasBlueprint,
      },
      {
        name: 'Hub',
        description: 'Community-published examples from the Hub.',
        filter: ({ hub }) => !!hub,
      },
      {
        name: 'Project',
        description: 'Complete code projects built on the SDK.',
        filter: ({ hasFiles }) => hasFiles,
      },
      {
        name: 'Ecommerce',
        filter: makeFilter('ecommerce'),
      },
      {
        name: 'Calendar',
        filter: makeFilter('calendar', 'schedule', 'appointment'),
      },
      {
        name: 'Science',
        filter: makeFilter('science', 'math', 'geography'),
      },
      {
        name: 'Coding',
        filter: makeFilter('coding'),
      },
      {
        name: 'Terraform',
        filter: ({ title = '' }) => title.toLowerCase().includes('terraform'),
      },
      {
        name: 'Architecture',
        description:
          'Reference architectures for composing multi-agent systems.',
        filter: ({ keywords = [] }) => {
          return keywords.some((keyword) =>
            ['architecture', 'architectures'].includes(keyword)
          )
        },
      },
      {
        name: 'Support',
        filter: makeFilter('support'),
      },
      {
        name: 'Assistant',
        filter: makeFilter('assistant', 'assistent'),
      },
      {
        name: 'Agent',
        filter: makeFilter('agent'),
      },
      {
        name: 'Themes',
        description: 'Widget examples showcasing custom look and feel.',
        filter: ({ hasTheme }) => hasTheme,
      },
      {
        name: 'All',
        description: 'Every example in the catalogue.',
        filter: () => true,
      },
    ]
  }, [])

  // @note the gallery lands on the featured cut rather than the whole listing,
  // so this is what a bare /examples url means - and the one category we leave
  // the query param off for
  const defaultCategory = useMemo(
    () => categories.find(({ name }) => name === 'Featured'),
    [categories]
  )

  const [filter, setFilter] = useState(() => defaultCategory.filter)

  const [selectedCategoryName, setSelectedCategoryName] = useState(
    defaultCategory.name
  )

  useEffect(() => {
    if (router.isReady) {
      const categoryParam = router.query.category

      if (categoryParam) {
        const category = categories.find(
          (cat) => cat.name.toLowerCase() === categoryParam.toLowerCase()
        )

        if (category) {
          setFilter(() => category.filter)
          setSelectedCategoryName(category.name)
        }
      } else {
        setFilter(() => defaultCategory.filter)
        setSelectedCategoryName(defaultCategory.name)
      }
    }
  }, [router.isReady, router.query.category, categories, defaultCategory])

  const handleCategoryChange = (categoryName, categoryFilter) => {
    setFilter(() => categoryFilter)
    setSelectedCategoryName(categoryName)

    const query =
      categoryName === defaultCategory.name
        ? {}
        : { category: categoryName.toLowerCase() }

    router.push(
      {
        pathname: router.pathname,
        query,
      },
      undefined,
      { shallow: true }
    )
  }

  const shown = useMemo(() => {
    // @note every category lists latest first (the examples prop is already
    // date-sorted, newest first). the Featured view is the exception: it
    // captures the latest across the catalogue but floats featured entries to
    // the top, via a stable sort on the flag over the already-latest-first array
    if (selectedCategoryName === defaultCategory.name) {
      return examples.slice().sort(
        (a, b) =>
          // @note lead with screenshot spotlights, then featured entries, both
          // over the already-latest-first array via a stable sort
          Number(!!b.screenshot) - Number(!!a.screenshot) ||
          Number(!!b.featured) - Number(!!a.featured)
      )
    }

    return examples.filter(filter)
  }, [examples, filter, selectedCategoryName, defaultCategory.name])

  const selectedCategory = useMemo(
    () => categories.find(({ name }) => name === selectedCategoryName),
    [categories, selectedCategoryName]
  )

  return (
    <div className="space-y-12">
      <div className="flex flex-row flex-wrap gap-1">
        {categories.map(({ name, filter: categoryFilter }) => (
          <button
            key={name}
            className={clsx('default-button tiny push', {
              selected: selectedCategoryName === name,
            })}
            type="button"
            onClick={() => handleCategoryChange(name, categoryFilter)}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="space-y-8">
        <div className="border-b border-gray-200 dark:border-gray-800 pb-4">
          <div className="flex items-baseline gap-3">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              {selectedCategoryName}
            </h2>
            <span className="text-sm text-gray-400 dark:text-gray-500">
              {shown.length} {pluralize('example', shown.length)}
            </span>
          </div>
          {selectedCategory?.description ? (
            <p className="mt-1 text-base text-gray-500 dark:text-gray-400">
              {selectedCategory.description}
            </p>
          ) : null}
        </div>
        <CategoryGrid>
          <CategoryGrid.Content>
            {shown.map((example) =>
              example.screenshot ? (
                <ExampleSpotlight {...example} key={example.slug} />
              ) : (
                <ExampleListItem {...example} key={example.slug} as="article" />
              )
            )}
          </CategoryGrid.Content>
        </CategoryGrid>
      </div>
    </div>
  )
}

export default function Index({ examples }) {
  return (
    <>
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'AI Agent Examples',
          description:
            'Discover a world of conversational AI with our extensive collection of chatbot examples.',
          url: '/examples',
          publisher: {
            '@type': 'Organization',
            name: 'ChatBotKit',
            url: '/',
          },
          numberOfItems: examples.length,
        }}
      />
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'ChatBotKit',
              item: '/',
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Examples',
              item: '/examples',
            },
          ],
        }}
      />
      <section className="section-white skip-border">
        <div className="main-page pt-0 main-page-6xl">
          <Listing examples={examples} />
        </div>
      </section>
    </>
  )
}

Index.getLayout = function (children) {
  return (
    <Explore
      breadcrumbs={['ChatBotKit']}
      title="AI Agent Examples"
      description="Discover a world of conversational AI with our extensive collection of chatbot examples. Get inspired by a variety of chatbot use cases across industries such as healthcare, education, retail, and more. These examples provide practical insights into how chatbots enhance customer service, marketing, sales, and other key business areas."
      keywords="chatbot examples, chatbot use cases, chatbot applications, chatbot industries, chatbot ideas, chatbot inspiration"
      image={`/examples/index/card`}
      rss={{ title: 'ChatBotKit Examples', href: '/examples/rss.xml' }}
    >
      <section className="section-white">
        <Hero
          title="AI Agent Examples"
          description="Real-world examples of autonomous systems, AI agents, and code. Fork them, learn from them, and build your own."
          // @note compact drops the description to text-base - bump it back to
          // the lead-like scale used on reflection pages
          descriptionClassName="sm:text-lg md:text-xl [text-wrap:pretty]"
          compact="6xl"
        >
          {/* <Link
            className="default-button"
            href="https://formshare.ai/s/VxmDbi0euK"
            target="_blank"
          >
            Request Example
          </Link> */}
        </Hero>
      </section>
      {children}
      <FAQ faq={faq} withSection={false} />
    </Explore>
  )
}

export async function getStaticProps() {
  const examples = getSortedExamples()
    // @note getSortedExamples orders by date, newest first - every category
    // lists latest first. the Featured view additionally floats featured
    // entries to the top (see the Listing `shown` memo)
    .filter(({ hidden }) => !hidden)
    .map(
      ({
        slug,
        icon,

        title,
        description,
        keywords,

        featured,

        live,

        demo,

        hub,

        theme,

        blueprint,

        files,

        screenshots,
      }) => {
        // @note normalise the first screenshot (a bare url string or an object
        // with a src) into a single src the listing can spotlight
        const [firstScreenshot] = screenshots || []

        const screenshot = firstScreenshot
          ? typeof firstScreenshot === 'string'
            ? firstScreenshot
            : firstScreenshot.src
          : null

        return {
          slug,
          icon,

          title,
          description,
          keywords,

          featured,

          live,

          demo,

          hub,

          hasTheme: !!theme?.config,
          hasBlueprint: !!blueprint?.resources,
          hasFiles: !!files,

          screenshot,
        }
      }
    )

  return {
    props: makeJsonSafe({
      examples,

      length: examples.length,
    }),
  }
}
