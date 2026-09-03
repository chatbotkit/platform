import { useEffect, useRef } from 'react'

import { formToData } from '@/lib/form'

import DocsLink from '@/components/DocsLink'
import WebhookSetupSection from '@/components/WebhookSetupSection'

import useInstallIntent from '@/hooks/useInstallIntent'
import usePopup from '@/hooks/usePopup'

/**
 * Install instructions do not always follow from what has been saved. Slack
 * builds its app manifest out of the name sitting in the form, which may not be
 * the name on record yet, so `details`, `links`, `actions` and `children` may
 * each be given as a function of the current form data instead of a value. They
 * are resolved when the popup opens, not when the button renders.
 */
function resolveOption(option, data) {
  return typeof option === 'function' ? option(data) : option
}

/**
 * Renders the install instructions of an integration. The details are the same
 * ones rendered in the setup section of the integration page.
 */
export function IntegrationInstallInstructions({
  details,
  docsSlug,
  children,
}) {
  const { sections, ...setup } = details || {}

  return (
    <div className="space-y-6">
      {sections ? (
        <WebhookSetupSection.Multi sections={sections} />
      ) : (
        <WebhookSetupSection {...setup} />
      )}
      {children}
      {docsSlug ? (
        <p className="text-sm">
          For more information see the{' '}
          <DocsLink className="default-link" slug={docsSlug}>
            integration docs
          </DocsLink>
          .
        </p>
      ) : null}
    </div>
  )
}

/**
 * Renders a button which opens the install instructions of an integration in a
 * popup. Every link is rendered as a popup action and takes the user to the
 * place where the instructions must be applied. An integration whose install
 * needs an action that is not a link - Slack copies its manifest to the
 * clipboard - passes it through `actions`.
 *
 * The popup also opens by itself when the location carries the install flag -
 * see `useInstallIntent`. That is how the setup checklist on the overview hands
 * off: the user pressed "Install" there, so the instructions are what they came
 * for. Pass `autoOpen` to decide it explicitly instead - a page carrying more
 * than one of these buttons has to say which one answers the flag.
 */
export default function IntegrationInstallButton({
  details,

  title = 'Install Instructions',
  description,

  docsSlug,

  links = [],
  actions,

  caption = 'Install',
  className = 'primary-button',

  autoOpen,

  children,

  ...props
}) {
  const { popup, openPopup } = usePopup()

  const installIntent = useInstallIntent()

  // @note the prop wins, so a caller can force the instructions open - or hold
  // them shut on a page the flag should not reach
  const shouldAutoOpen = autoOpen ?? installIntent

  const buttonRef = useRef(null)

  function openInstallPopup() {
    // @note the button sits inside the integration form, so it is the handle on
    // the values the user has typed but has not saved - `formToData` resolves a
    // button through the form it belongs to. A button rendered outside a form
    // yields nothing, which only the value-taking callers do anyway
    const data = formToData(buttonRef.current)

    const linkActions = Object.fromEntries(
      (resolveOption(links, data) || []).map(
        ({ caption, url, default: isDefault }) => [
          caption,
          {
            default: isDefault,

            fn() {
              const a = document.createElement('a')

              a.href = url
              a.target = '_blank'
              a.rel = 'noopener noreferrer'

              a.click()
            },
          },
        ]
      )
    )

    openPopup(
      <IntegrationInstallInstructions
        details={resolveOption(details, data)}
        docsSlug={docsSlug}
      >
        {resolveOption(children, data)}
      </IntegrationInstallInstructions>,
      {
        title,
        description,

        cancelButtonCaption: 'I am done',

        dialogClassName: 'sm:max-w-2xl',

        // @note the links land last so the default one, which is the whole
        // point of the popup, sits furthest from the cancel button
        actions: { ...resolveOption(actions, data), ...linkActions },
      }
    )
  }

  const autoOpenedRef = useRef(false)

  useEffect(() => {
    if (!shouldAutoOpen || autoOpenedRef.current) {
      return
    }

    // @note once per mount - the details and the links are rebuilt on every
    // render of the page, so an effect which tracked them would reopen the
    // popup the moment the user closed it and typed into the form behind it
    autoOpenedRef.current = true

    openInstallPopup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoOpen])

  function handleInstall(event) {
    event.preventDefault()

    openInstallPopup()
  }

  return (
    <>
      {popup}
      <button
        {...props}
        ref={buttonRef}
        type="button"
        className={className}
        onClick={handleInstall}
      >
        {caption}
      </button>
    </>
  )
}
