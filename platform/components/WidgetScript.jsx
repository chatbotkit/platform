import Script from 'next/script'

export default function WidgetScript() {
  return (
    <Script
      // @note lazyOnLoad is causing CLS (Cumulative Layout Shift) issues
      // strategy="lazyOnload"
      strategy="afterInteractive"
      id="chatbotkit-widget"
      src="/integrations/widget/v2.js"
    />
  )
}
