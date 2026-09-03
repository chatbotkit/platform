import { getExamplesWithExportedThemes } from '@/lib/example.fetch'
import { makeJsonSafe } from '@/lib/struct'
import { buildTheme, themes as builtinThemes, parseTheme } from '@/lib/theme'

import Dashboard from '@/layouts/Dashboard'

import DocsLink from '@/components/DocsLink'
import FAQ from '@/components/FAQ'
import NavHeader from '@/components/NavHeader'
import ThemeDesigner from '@/components/ThemeDesigner'

import faq from '@/content/faqs/website-playground-widget.yaml'

export default function Index({ defaultTheme, themes }) {
  return (
    <section className="section-white">
      <div className="main-page">
        <NavHeader link="/playground" caption="playgrounds" title="Widget">
          <p>
            The following playground helps build your personalized theme that
            fits perfectly with your brand. For more information see the{' '}
            <DocsLink className="default-link" slug="widget">
              Widget Integration
            </DocsLink>{' '}
            docs.
          </p>
        </NavHeader>
        <ThemeDesigner
          className="h-screen max-h-[800px] rounded-xl border border-gray-200 dark:border-gray-800"
          defaultTheme={defaultTheme}
          defaultThemes={themes}
        />
      </div>
    </section>
  )
}

Index.getLayout = function (children) {
  return (
    <Dashboard
      breadcrumbs={['Playground', 'ChatBotKit']}
      title="AI Widget Playground"
      description="Use this playground to experiment with different themes to see how they affect the chatbot's widget."
      keywords="chatbot, playground, theme, themes, widget, ai widget, free AI builder, free"
      image={`/playground/widget/card`}
    >
      {children}
      <FAQ faq={faq} />
    </Dashboard>
  )
}

export async function getStaticProps() {
  let defaultTheme = 'default'

  const themes = [].concat(
    Object.entries(builtinThemes).map(([name, config]) =>
      buildTheme(name, config)
    ),

    getExamplesWithExportedThemes().map(({ title, theme }) => {
      let build

      if (typeof theme === 'string') {
        build = buildTheme(parseTheme(theme), { name: title })
      } else {
        build = buildTheme(theme.name, { ...theme.config, name: title })

        if (title === 'AI Answers') {
          defaultTheme = build
        }
      }

      return build
    })
  )

  return {
    props: makeJsonSafe({
      defaultTheme: defaultTheme,
      themes: themes,
    }),
  }
}

/**
 * @doc Playgrounds
 * @index 80
 *
 * ## Widget
 *
 * The [Widget Playground](https://chatbotkit.com/playground/widget) helps you preview and refine the appearance of embedded widgets. It is the right place to test themes, colors, and layout details before you ship a widget to your site.
 *
 * Use it when you want to align the widget with your brand, compare built-in and custom themes, or validate a visual design before deployment.
 */
