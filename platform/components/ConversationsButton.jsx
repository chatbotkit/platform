'use client'

import ConversationList from '@/components/ConversationList'

import usePopup from '@/hooks/usePopup'

/**
 * Opens the conversations for a specific resource (bot, task, or channel
 * integration) in a popup, filtered down to that resource. Selecting a
 * conversation opens it in a separate window so the underlying page - typically
 * the blueprint designer - stays where it is.
 *
 * Any filter props are forwarded to <ConversationList> (e.g. `botId`, `taskId`,
 * `widgetIntegrationId`, `triggerIntegrationId`).
 *
 * @param {object} props
 * @param {string} [props.title] - popup title
 * @param {import('react').ReactNode} [props.caption] - button label
 * @param {string} [props.className]
 * @param {boolean} [props.disabled]
 */
export default function ConversationsButton({
  title = 'Conversations',
  caption = 'Conversations',
  className = 'default-button tiny !text-xxs w-full',
  disabled = false,
  ...filter
}) {
  const { popup, openPopup } = usePopup()

  return (
    <>
      {popup}
      <button
        className={className}
        type="button"
        disabled={disabled}
        onClick={() => {
          openPopup(
            <ConversationList
              exportRoute={null}
              filter={false}
              autoLoad={true}
              quickAccess={true}
              openInNewWindow={true}
              {...filter}
            />,
            {
              title,
              noActions: true,
              cancelButtonCaption: 'Close',
              dialogClassName: 'sm:max-w-3xl',
            }
          )
        }}
      >
        {caption}
      </button>
    </>
  )
}
