import StructuredData from '@/components/StructuredData'

export default function FAQStructuredData({ faq }) {
  return faq?.length ? (
    <StructuredData
      data={{
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faq.map(({ question, answer }) => {
          return {
            '@type': 'Question',
            name: question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: answer,
            },
          }
        }),
      }}
    />
  ) : null
}
