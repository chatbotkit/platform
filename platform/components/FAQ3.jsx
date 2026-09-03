import { Content as FAQContent } from '@/components/FAQ'
import FAQStructuredData from '@/components/FAQStructuredData'

export default function FAQ3({ faq, title = 'FAQ', children }) {
  return (
    <>
      <FAQStructuredData faq={faq} />
      <div className="main-page max-w-4xl space-y-20">
        {title || children ? (
          <div className="text-center">
            {title ? (
              <h2 className="mega-title">
                <span className="heading-highlight">{title}</span>
              </h2>
            ) : null}
            <p className="mx-auto mt-3 md:mt-5 max-w-md md:max-w-4xl text-base sm:text-lg md:text-xl text-gray-500 dark:text-gray-500 [text-wrap:balance]">
              {children}
            </p>
          </div>
        ) : null}
        <FAQContent faq={faq} />
      </div>
    </>
  )
}
