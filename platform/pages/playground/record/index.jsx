import Dashboard from '@/layouts/Dashboard'

import DocsLink from '@/components/DocsLink'
import FAQ from '@/components/FAQ'
import NavHeader from '@/components/NavHeader'
import RecordInput from '@/components/RecordInput'

import faq from '@/content/faqs/website-playground-record.yaml'

export default function Index() {
  return (
    <section className="section-white">
      <div className="main-page">
        <NavHeader
          link="/playground"
          caption="playgrounds"
          title="Record"
          beta={true}
        >
          A <DocsLink slug="datasets">record</DocsLink> is the basic building
          block of the dataset. In this playground, you can type a record and
          click on the <q>magic button</q> to generate improved variations.
        </NavHeader>
        <RecordInput className="default-input" />
      </div>
    </section>
  )
}

Index.getLayout = function (children) {
  return (
    <Dashboard
      breadcrumbs={['Playground', 'ChatBotKit']}
      title="Dataset Record Playground"
      description="A playground to generate variations of a dataset record."
      keywords="chatbot, playground, record, records"
      image={`/playground/record/card`}
    >
      {children}
      <FAQ faq={faq} />
    </Dashboard>
  )
}

/**
 * @doc Playgrounds
 * @index 50
 *
 * ## Record
 *
 * The [Record Playground](https://chatbotkit.com/playground/record) helps you work with dataset records and turn them into more useful formats. It is especially helpful when you want to improve raw source material before using it in a dataset.
 *
 * Use it to convert rough notes into cleaner knowledge entries, FAQs, or structured content that is easier for your AI workflows to consume.
 */
