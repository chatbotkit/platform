'use client'

import List from '@/components/List'
import Ping from '@/components/Ping'

import usePopup from '@/hooks/usePopup'
import useRouter from '@/hooks/useRouter'

import clsx from 'clsx'

export function ResourceFilterPopup({
  filterOptions,

  closePopup,

  ...props
}) {
  const router = useRouter()

  return (
    <List {...props}>
      <List.Item
        id="clear"
        link={router.pathname}
        title="Clear Filter"
        body={<span className="italic">Clear the filter</span>}
        onClick={() => {
          closePopup()
        }}
      >
        <div className="tag">utility</div>
      </List.Item>
      {filterOptions?.map?.((option) => (
        <List.Item
          key={option.id}
          id={option.id}
          link={option.link}
          title={option.title}
          body={<span className="italic">{option.description}</span>}
          timestamp={option.timestamp}
          onClick={() => {
            closePopup()
          }}
        >
          {option.isSelected ? (
            <div className="tag flex flex-row items-center gap-2">
              <Ping /> selected
            </div>
          ) : null}
          <div className="tag">{option.tag}</div>
        </List.Item>
      ))}
    </List>
  )
}

export default function ResourceFilterButton({
  filterOptions,

  disabled,

  ...props
}) {
  const router = useRouter()

  const { popup, openPopup, closePopup } = usePopup({
    title: 'Filter',
    noActions: true,
  })

  function onClick() {
    openPopup(
      <ResourceFilterPopup
        filterOptions={filterOptions}
        closePopup={closePopup}
      />
    )
  }

  return (
    <>
      {popup}
      <button
        {...props}
        className={clsx('default-link text-sm', { disabled })}
        type="button"
        onClick={onClick}
        disabled={disabled}
      >
        <span>Filter</span>
        {router.query.abuse ? (
          <>
            {' '}
            <span>(abuse)</span>
          </>
        ) : null}
        {router.query.type ? (
          <>
            {' '}
            <span>({router.query.type})</span>
          </>
        ) : null}
        {router.query.botId ? (
          <>
            {' '}
            <span>(bot)</span>
          </>
        ) : null}
        {router.query.contactId ? (
          <>
            {' '}
            <span>(contact)</span>
          </>
        ) : null}
        {router.query.taskId ? (
          <>
            {' '}
            <span>(task)</span>
          </>
        ) : null}
        {router.query.conversationId ? (
          <>
            {' '}
            <span>(conversation)</span>
          </>
        ) : null}
        {router.query.messageId ? (
          <>
            {' '}
            <span>(message)</span>
          </>
        ) : null}
        {router.query.widgetIntegrationId ? (
          <>
            {' '}
            <span>(widget)</span>
          </>
        ) : null}
        {router.query.slackIntegrationId ? (
          <>
            {' '}
            <span>(slack)</span>
          </>
        ) : null}
        {router.query.discordIntegrationId ? (
          <>
            {' '}
            <span>(discord)</span>
          </>
        ) : null}
        {router.query.microsoftteamsIntegrationId ? (
          <>
            {' '}
            <span>(teams)</span>
          </>
        ) : null}
        {router.query.googlechatIntegrationId ? (
          <>
            {' '}
            <span>(googlechat)</span>
          </>
        ) : null}
        {router.query.messengerIntegrationId ? (
          <>
            {' '}
            <span>(messenger)</span>
          </>
        ) : null}
        {router.query.whatsappIntegrationId ? (
          <>
            {' '}
            <span>(whatsapp)</span>
          </>
        ) : null}
        {router.query.telegramIntegrationId ? (
          <>
            {' '}
            <span>(telegram)</span>
          </>
        ) : null}
        {router.query.twilioIntegrationId ? (
          <>
            {' '}
            <span>(twilio)</span>
          </>
        ) : null}
        {router.query.emailIntegrationId ? (
          <>
            {' '}
            <span>(email)</span>
          </>
        ) : null}
        {router.query.anamIntegrationId ? (
          <>
            {' '}
            <span>(anam)</span>
          </>
        ) : null}
        {router.query.recallIntegrationId ? (
          <>
            {' '}
            <span>(recall)</span>
          </>
        ) : null}
        {router.query.triggerIntegrationId ? (
          <>
            {' '}
            <span>(trigger)</span>
          </>
        ) : null}
        {router.query.instagramIntegrationId ? (
          <>
            {' '}
            <span>(instagram)</span>
          </>
        ) : null}
        {filterOptions?.map?.((option) => {
          return option.isSelected ? (
            <span key={option.id}>
              {' '}
              <span>({option.displayName || option.id})</span>
            </span>
          ) : null
        })}
      </button>
    </>
  )
}
