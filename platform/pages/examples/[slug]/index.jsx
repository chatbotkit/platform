import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'

import { roundToNearestNMinutes } from '@chatbotkit-dev/time'

import abilities from '@/data/abilities/visible'
import demos from '@/data/demos.yaml'

import prisma from '@/prisma/client'

import {
  getExampleBySlug,
  getNextExamples,
  getSortedExamples,
} from '@/lib/example.fetch'
import { withGeneration } from '@/lib/static'
import { makeJsonSafe } from '@/lib/struct'
import { getTemplate, isTemplateName } from '@/lib/template'

import Explore from '@/layouts/Explore'

import BackLink from '@/components/BackLink'
import DocsLink from '@/components/DocsLink'
import DotsLoader from '@/components/DotsLoader'
import DynamicIcon from '@/components/DynamicIcon'
import Hero from '@/components/Hero'
import Link from '@/components/Link'
import List from '@/components/List'
import Ping from '@/components/Ping'
import StructuredData from '@/components/StructuredData'
import WidgetPreview from '@/components/WidgetPreview'

import { ExamplesList } from '@/pages/examples/index'

import useWidgetInstance from '@chatbotkit/react/hooks/useWidgetInstance'

import clsx from 'clsx'

export function PageHero({
  className,

  example: {
    slug,

    icon,

    title,
    description,

    keywords,

    link,

    live,
    demo,

    files,
    url,
  },

  ...props
}) {
  const isProject = Array.isArray(files)

  return (
    <Hero
      className={clsx('mx-auto', className)}
      icon={icon}
      splitTitle={title}
      description={description}
      // @note compact drops the description to text-base - bump it back to the
      // lead-like scale used on reflection pages
      descriptionClassName="sm:text-lg md:text-xl [text-wrap:pretty]"
      compact="7xl"
      {...props}
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-left">
          <BackLink className="default-button" href="/examples">
            Back to examples
          </BackLink>
          {!isProject ? (
            <Link
              className="primary-button"
              href={
                link || {
                  pathname: '/new',
                  query: {
                    template: 'example',
                    example: slug,
                  },
                }
              }
              rel="nofollow" // @note no follow because it is should not be indexed
            >
              Copy
            </Link>
          ) : url ? (
            <a
              className="primary-button"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
            >
              View on GitHub
            </a>
          ) : null}
          {live ? (
            <a className="default-button" href="#live">
              Try <Ping className="ml-4" />
            </a>
          ) : null}
          {demo ? (
            <Link
              className="default-button"
              href={`/examples/${slug}/demo`}
              target="_blank"
            >
              Try Demo <Ping className="ml-4" />
            </Link>
          ) : null}
        </div>
        <div className="flex flex-row flex-wrap gap-2 justify-left">
          {keywords?.slice(0, 3).map((keyword) => {
            return (
              <div key={keyword} className="tag">
                {keyword}
              </div>
            )
          })}
        </div>
      </div>
    </Hero>
  )
}

export function Widget({ example, ...props }) {
  const now = roundToNearestNMinutes(5).getTime()

  const messages = example.messages?.map((message, index) => {
    return {
      id: index,

      ...message,

      createdAt: now,
    }
  })

  return (
    <div
      className={clsx('mx-auto max-w-lg')}
      style={{
        '--thisWidth': example.theme.config.popoverWidth || '420px',
        '--thisHeight': example.theme.config.popoverHeight || '860px',
      }}
    >
      <WidgetPreview
        {...props}
        key={example.slug}
        className={clsx(
          'w-[var(--thisWidth)] max-w-lg h-[var(--thisHeight)] max-h-[75vh,600px)]'
        )}
        title={example.title}
        intro={example.intro}
        initial={example.initial}
        messages={messages}
        theme={example.theme}
        interactive={true}
        button={true}
        poweredBy={false}
        {...example.widget}
      />
    </div>
  )
}

export function Blueprint({ example, ...props }) {
  return (
    <iframe
      {...props}
      key={example.slug}
      src={`/examples/${example.slug}/designer?minZoom=0.2`}
    />
  )
}

export function Editor({ example, ...props }) {
  return (
    <iframe
      {...props}
      key={example.slug}
      src={`/examples/${example.slug}/editor`}
    />
  )
}

export function WidgetHero({ example }) {
  return (
    <div className="relative flex flex-col lg:flex-row lg:[&>*]:w-full">
      <section className="relative z-20 section sm:flex sm:items-center sm:pb-40">
        <PageHero className="lg:max-w-xl" example={example} />
      </section>
      <section
        className="z-20 section-gray-50 skip-border bg-transparent dark:bg-transparent min-h-[calc(100vh-6rem)] flex flex-row justify-center items-center relative overflow-hidden"
        style={{
          ...(example.theme?.config?.previewImage
            ? {
                backgroundImage: `url(${example.theme.config.previewImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                backgroundAttachment: 'fixed',
              }
            : {}),
        }}
      >
        <div className="main-page">
          <Widget example={example} />
        </div>
      </section>
      <div className="pointer-events-none absolute z-10 bottom-0 left-0 w-full h-full pt-dots gradient-mask-t-10 lg:gradient-mask-l-10"></div>
    </div>
  )
}

export function BlueprintHero({ example }) {
  return (
    <div>
      <PageHero className="" example={example} />
      <div className="mx-auto max-w-7xl px-5">
        <Blueprint
          className="w-full aspect-video rounded-xl border border-gray-200 dark:border-gray-800"
          example={example}
        />
      </div>
    </div>
  )
}

export function ProjectHero({ example }) {
  return (
    <div>
      <PageHero className="" example={example} />
      <div className="mx-auto max-w-7xl px-5">
        <Editor
          className="w-full h-[800px] rounded-xl border border-gray-200 dark:border-gray-800 bg-[#eaeaea] dark:bg-[#2e3138] pt-8"
          example={example}
        />
      </div>
    </div>
  )
}

export function HeroRouter({ example }) {
  const isProject = example.files !== undefined
  const isBlueprint = example.blueprint !== undefined
  const isWidget = example.widget !== undefined || example.theme !== undefined

  if (isProject) {
    return <ProjectHero example={example} />
  }

  if (isBlueprint) {
    return <BlueprintHero example={example} />
  }

  if (isWidget) {
    return <WidgetHero example={example} />
  }

  // @note fallback to widget hero, but we should try not to reach here because
  // this is a legacy case

  return <WidgetHero example={example} />
}

export function Live({ slug, functions }) {
  const [ready, setReady] = useState(false)

  const widget = useWidgetInstance('#live-example-widget', [slug])

  useEffect(() => {
    if (!widget) {
      return
    }

    function handleReady() {
      setReady(true)

      if (functions) {
        widget.functions = functions
      }
    }

    if (widget.ready) {
      handleReady()

      return
    }

    widget.addEventListener('ready', handleReady)

    return () => {
      widget.removeEventListener('ready', handleReady)
    }
  }, [widget, functions])

  return (
    <div className="relative w-full aspect-square max-w-[100vw] max-h-[100vh] rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
      <chatbotkit-widget
        id="live-example-widget"
        class="no-global-widget-styles w-full h-full"
        layout="center"
        widget={`/examples/${slug}/frame`}
      />
      {!ready ? (
        <div className="absolute z-50 inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-950">
          <DotsLoader className="text-2xl text-gray-400 dark:text-gray-600" />
        </div>
      ) : null}
    </div>
  )
}

export function Backstory({ backstory }) {
  const [more, setMore] = useState(false)

  return (
    <div
      className={clsx(
        'border-l-8 auto-border-gray-200',
        'pl-8',
        'whitespace-pre-wrap',
        'space-y-6'
      )}
    >
      <div
        className={clsx('font-mono text-sm', {
          'md:max-h-28 md:overflow-hidden md:gradient-mask-b-60': !more,
        })}
      >
        {backstory}
      </div>
      <div>
        <button
          className="default-link"
          type="button"
          onClick={() => setMore((prevMore) => !prevMore)}
        >
          {more ? 'Show Less' : 'Show More'}
        </button>
      </div>
    </div>
  )
}

export function Screenshots({ screenshots }) {
  const scrollerRef = useRef(null)

  // @note when there is more than one screenshot we surface prev/next controls
  // and let each slide snap; a single screenshot just renders on its own
  const multiple = screenshots.length > 1

  function scrollByDirection(direction) {
    const scroller = scrollerRef.current

    if (!scroller) {
      return
    }

    const amount = scroller.clientWidth * 0.9

    scroller.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    })
  }

  return (
    <div className="main-page main-page-5xl space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight heading-highlight">
          Screenshots
        </h2>
        <p className="text-lg text-gray-500 dark:text-gray-400">
          A look at this example in action.
        </p>
      </div>
      <div className="relative">
        <div
          ref={scrollerRef}
          className={clsx(
            'flex gap-6 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2',
            // @note hide the scrollbar - navigation is via the buttons or swipe
            '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
          )}
        >
          {screenshots.map((screenshot, index) => {
            // @note a screenshot may be a bare url string or an object with a
            // src and an optional caption
            const { src, caption } =
              typeof screenshot === 'string' ? { src: screenshot } : screenshot

            return (
              <figure
                key={index}
                className={clsx(
                  'snap-center shrink-0 space-y-3',
                  multiple ? 'w-[90%] sm:w-[85%]' : 'w-full'
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={caption || `Screenshot ${index + 1}`}
                  loading="lazy"
                  className="w-full max-h-[75vh] object-contain rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900"
                />
                {caption ? (
                  <figcaption className="text-sm text-center text-gray-500 dark:text-gray-400">
                    {caption}
                  </figcaption>
                ) : null}
              </figure>
            )
          })}
        </div>
        {multiple ? (
          <>
            <button
              type="button"
              aria-label="Previous screenshot"
              onClick={() => scrollByDirection('left')}
              className="absolute top-1/2 left-2 -translate-y-1/2 flex items-center justify-center w-10 h-10 rounded-full bg-white/90 dark:bg-gray-900/90 border border-gray-200 dark:border-gray-800 shadow-md hover:bg-white dark:hover:bg-gray-900"
            >
              <DynamicIcon className="w-5 h-5" icon="lucide/chevron-left" />
            </button>
            <button
              type="button"
              aria-label="Next screenshot"
              onClick={() => scrollByDirection('right')}
              className="absolute top-1/2 right-2 -translate-y-1/2 flex items-center justify-center w-10 h-10 rounded-full bg-white/90 dark:bg-gray-900/90 border border-gray-200 dark:border-gray-800 shadow-md hover:bg-white dark:hover:bg-gray-900"
            >
              <DynamicIcon className="w-5 h-5" icon="lucide/chevron-right" />
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}

export function Content({
  example: {
    slug,

    commentary,

    live,

    functions,

    blueprint,
  },

  backstory,

  datasets,
  skillsets,

  secrets,
}) {
  return (
    <div className="main-page main-page-4xl content-prose">
      {commentary ? (
        <>
          <div>
            {/* <h2>Commentary</h2>
          <p className="lead">
            A brief commentary on the example, its purpose and its use.
          </p> */}
            <ReactMarkdown>{commentary}</ReactMarkdown>
          </div>
        </>
      ) : null}
      {backstory ? (
        <>
          <div>
            <h2>Backstory</h2>
            <p className="lead">
              Common information about the bot&apos;s experience, skills and
              personality. For more information, see the{' '}
              <DocsLink slug="backstories">Backstory</DocsLink> documentation.
            </p>
            <Backstory backstory={backstory} />
          </div>
        </>
      ) : null}
      {datasets?.length ? (
        <>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Dataset</h2>
            <p className="lead">
              This example uses a dedicated{' '}
              <DocsLink slug="datasets">Dataset</DocsLink>. Datasets provide the
              bot with the information it needs to understand and respond to
              user queries.
            </p>
            <List>
              {datasets.map((dataset) => (
                <List.Item
                  key={dataset.id}
                  className="cursor-default !gap-4"
                  icon={
                    <div className="flex flex-row justify-center items-center w-12 h-12 rounded-xl border auto-bg-gray-100 auto-border-gray-200">
                      <DynamicIcon className="w-6 h-6" icon="lucide/database" />
                    </div>
                  }
                  title={dataset.name || 'Dataset'}
                  body={
                    dataset.description || (
                      <span className="italic">
                        A dataset without description
                      </span>
                    )
                  }
                />
              ))}
            </List>
          </div>
        </>
      ) : null}
      {skillsets?.length ? (
        <>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Skillset</h2>
            <p className="lead">
              This example uses a dedicated{' '}
              <DocsLink slug="skillsets">Skillset</DocsLink>. Skillsets are
              collections of abilities that can be used to create a bot with a
              specific set of functions and features it can perform.
            </p>
            <List>
              {skillsets
                .flatMap(({ abilities }) => abilities)
                .map((ability, index) => {
                  return (
                    <List.Item
                      key={index}
                      className="cursor-default !gap-4"
                      icon={
                        <div className="flex flex-row justify-center items-center w-12 h-12 rounded-xl border auto-bg-gray-100 auto-border-gray-200">
                          <DynamicIcon
                            className="w-6 h-6"
                            icon={ability.icon || 'lucide/sparkles'}
                          />
                        </div>
                      }
                      title={ability.name || 'Ability'}
                      body={
                        ability.description || (
                          <span className="italic">
                            A skillset without description
                          </span>
                        )
                      }
                    />
                  )
                })}
            </List>
          </div>
        </>
      ) : null}
      {secrets?.length ? (
        <>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Secrets</h2>
            <p className="lead">
              This example uses <DocsLink slug="secrets">Secrets</DocsLink> to
              store sensitive information such as API keys, passwords, and other
              credentials.
            </p>
            <List>
              {secrets.map((secret, index) => {
                return (
                  <List.Item
                    key={index}
                    className="cursor-default !gap-4"
                    icon={
                      <div className="auto-bg-gray-100 auto-border-gray-200 auto-text-gray-900 p-2 rounded-xl border flex flex-row justify-center items-center w-12 h-12">
                        <DynamicIcon
                          className="w-6 h-6"
                          icon="lucide/lock-keyhole"
                        />
                      </div>
                    }
                    title={secret.name}
                    body={
                      secret.description || (
                        <span className="italic">
                          A secret without description
                        </span>
                      )
                    }
                  />
                )
              })}
            </List>
          </div>
        </>
      ) : null}
      {live ? (
        <>
          <h2 id="live" className="text-2xl font-bold">
            Live Example
          </h2>
          <p className="lead">
            This example is live and can be interacted with directly.
          </p>
          <Live slug={slug} functions={functions} />
        </>
      ) : null}
      {/* <>
      <div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Solution Diagram</h2>
          <p className="lead">
            The solution diagram shows the relationship between the
            different components of the example.
          </p>
          <SolutionDiagram
            model={model}
            dataset={dataset}
            skillset={skillset}
            integration={integration}
          />
        </div>
      </div>
    </> */}
      {/* <ul className="flex flex-wrap gap-2 !pl-0">
      {keywords.map((keyword) => {
        return (
          <li key={keyword} className="tag">
            {keyword}
          </li>
        )
      })}
    </ul> */}
    </div>
  )
}

export function More({ nextExamples }) {
  return (
    <div className="main-page">
      <h2 className="text-center text-3xl sm:text-4xl font-bold tracking-tight heading-highlight">
        More Awesome Examples
      </h2>
      <div className="mt-6">
        <ExamplesList examples={nextExamples} />
      </div>
    </div>
  )
}

export default function Page({
  example,

  backstory,

  datasets,
  skillsets,

  secrets,

  nextExamples,
}) {
  return (
    <>
      <section className="section">
        <HeroRouter example={example} />
      </section>
      {example.screenshots?.length ? (
        <section className="section-white">
          <Screenshots screenshots={example.screenshots} />
        </section>
      ) : null}
      <section className="section-white">
        <Content
          example={example}
          backstory={backstory}
          datasets={datasets}
          skillsets={skillsets}
          secrets={secrets}
        />
      </section>
      <section className="section-gray-25">
        <More nextExamples={nextExamples} />
      </section>
    </>
  )
}

Page.getLayout = function (
  children,
  { example: { slug, title, description, keywords } }
) {
  return (
    <Explore
      breadcrumbs={['Examples', 'ChatBotKit']}
      title={`${title} | AI ChatBot`} // @note we use "AI ChatBot" as the suffix because it has a higher search volume
      description={description}
      keywords={[...keywords, 'AI', 'chatbot', 'bot'].join(', ')}
      image={`/examples/${slug}/card`}
      rss={{ title: 'ChatBotKit Examples', href: '/examples/rss.xml' }}
    >
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Examples',
              item: '/examples',
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: title,
              item: `/examples/${slug}`,
            },
          ],
        }}
      />
      {children}
    </Explore>
  )
}

export async function getStaticProps(context) {
  const example = getExampleBySlug(context.params.slug)

  if (!example) {
    return {
      notFound: true,
    }
  }

  // @note hub examples have no self-contained page - their content lives on the
  // hub and the example card links straight there (getExampleHref). there is
  // nothing to render here, so return 404 rather than redirect to the hub.

  if (example.hub) {
    return {
      notFound: true,
    }
  }

  if (!example.messages?.length) {
    if (example.widget?.initial) {
      example.messages = []
    } else {
      example.messages = demos.default.messages
    }
  }

  let backstory = null

  {
    if (example.backstory) {
      backstory = example.backstory
    }

    if (example.blueprint) {
      if (!example.backstory) {
        const botResource = Object.values(example.blueprint.resources).find(
          ({ type }) => type === 'bot'
        )

        if (botResource?.data?.backstory) {
          backstory = botResource.data.backstory
        }
      }
    }
  }

  const datasets = []

  {
    if (example.dataset) {
      if (example.dataset.id) {
        const dataset = await prisma.dataset.findUnique({
          where: {
            id: example.dataset.id,
          },

          select: {
            id: true,
            name: true,
            description: true,
          },
        })

        if (dataset) {
          datasets.push(dataset)
        }
      } else {
        const dataset = { ...example.dataset }

        datasets.push(dataset)
      }
    }

    if (example.blueprint) {
      if (!example.dataset) {
        Object.entries(example.blueprint.resources)
          .filter(([, { type }]) => type === 'dataset')
          .forEach(([id, resource]) => {
            const dataset = { ...resource.data, id }

            datasets.push(dataset)
          })
      }
    }
  }

  const skillsets = []

  {
    if (example.skillset) {
      if (example.skillset.id) {
        const skillset = await prisma.skillset.findUnique({
          where: {
            id: example.skillset.id,
          },

          select: {
            id: true,

            name: true,
            description: true,

            abilities: {
              select: {
                name: true,
                description: true,
                instruction: true,
              },
            },
          },
        })

        if (skillset) {
          skillsets.push(skillset)
        }
      } else {
        const skillset = { ...example.skillset }

        skillset.abilities = skillset.abilities.map((ability) => {
          ability = { ...ability }

          if (ability.instruction && isTemplateName(ability.instruction)) {
            const template = getTemplate(ability.instruction, abilities)

            if (!template) {
              throw new Error(`Instruction "${ability.instruction}" not found`)
            }
          }

          return ability
        })

        skillsets.push(skillset)
      }
    }

    if (example.blueprint) {
      if (!example.skillset) {
        Object.entries(example.blueprint.resources)
          .filter(([, { type }]) => type === 'skillset')
          .forEach(([id, resource]) => {
            const skillset = { ...resource.data, id }

            skillset.abilities = Object.entries(example.blueprint.resources)
              .filter(([, resource]) => resource.type === 'ability')
              .filter(
                ([, resource]) => resource.data.skillsetId === skillset.id
              )
              .map(([, resource]) => {
                const ability = { ...resource.data }

                if (
                  ability.instruction &&
                  isTemplateName(ability.instruction)
                ) {
                  const template = getTemplate(ability.instruction, abilities)

                  if (!template) {
                    throw new Error(
                      `Instruction "${ability.instruction}" not found`
                    )
                  }
                }

                return ability
              })

            skillsets.push(skillset)
          })
      }
    }
  }

  const secrets = []

  {
    if (example.secrets) {
      example.secrets.forEach((secret) => {
        secrets.push(secret)
      })
    }

    if (example.blueprint) {
      Object.entries(example.blueprint.resources)
        .filter(([, { type }]) => type === 'secret')
        .forEach(([, resource]) => {
          const secret = { ...resource.data }

          secrets.push(secret)
        })
    }
  }

  const nextExamples = getNextExamples(context.params.slug)

  return {
    props: makeJsonSafe(
      {
        example,

        backstory,

        datasets,
        skillsets,

        secrets,

        nextExamples,
      },
      {
        unsafeKeys: null,
      }
    ),
  }
}

export const getStaticPaths = withGeneration(async function () {
  return {
    // @note hub examples have no self-contained page (getStaticProps returns
    // 404 for them), so don't prerender a page for them
    paths: getSortedExamples()
      .filter(({ hub }) => !hub)
      .map(({ slug }) => {
        return {
          params: {
            slug: slug,
          },
        }
      }),

    fallback: false,
  }
})
