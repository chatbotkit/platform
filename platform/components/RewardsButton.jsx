'use client'

import { useCallback } from 'react'

import { GlobalRootPortal } from '@/components/GlobalRoot'

import useLocalStorage from '@/hooks/useLocalStorage'
import usePopup from '@/hooks/usePopup'

import { GiftIcon } from '@heroicons/react/24/outline'

import clsx from 'clsx'

export const DISCORD_URL = 'https://go.cbk.ai/discord'

// @todo take them to the specific rewards channel

/**
 * @note the dot is an invitation, not an alert - so it retires itself once the
 * user has actually looked at the offer rather than nagging on every page load.
 */
export const REWARDS_SEEN_STORAGE_KEY = 'rewards:discord:seen'

/**
 * A button component that invites the user to join the community in exchange
 * for rewards. Shows a gift icon with a dot indicator until the invite has been
 * opened at least once. Clicking opens a popup with the offer.
 *
 * The caller decides who gets to see this - today the dashboard only offers it
 * to free tier accounts outside of whitelabel.
 */
export default function RewardsButton({ className }) {
  const [seen, setSeen] = useLocalStorage(REWARDS_SEEN_STORAGE_KEY, false)

  const { popup, openPopup } = usePopup({
    title: 'Earn rewards',
    cancelButtonCaption: 'Not now',
    actions: {
      'Contact Us': {
        fn: (_data, { close }) => {
          window.open('/support', '_blank', 'noopener,noreferrer')

          close()
        },
      },

      'Join Discord': {
        default: true,
        fn: (_data, { close }) => {
          window.open(DISCORD_URL, '_blank', 'noopener,noreferrer')

          close()
        },
      },
    },
  })

  const handleClick = useCallback(() => {
    setSeen(true)

    openPopup(<RewardsInvite />)
  }, [openPopup, setSeen])

  return (
    <>
      <GlobalRootPortal>{popup}</GlobalRootPortal>
      <div className="relative group/tooltip">
        <button
          type="button"
          className={clsx(
            'default-button push relative overflow-visible',
            className
          )}
          onClick={handleClick}
          aria-label="Rewards"
        >
          <GiftIcon className="h-5 w-5" />
          {!seen ? (
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-blue-500" />
          ) : null}
        </button>
        <div className="tooltip -bottom-3 w-36">Earn rewards</div>
      </div>
    </>
  )
}

export function RewardsInvite() {
  return (
    <p className="text-sm auto-text-gray-500">
      Take part in our community and earn rewards. Join our Discord to find out
      what is on offer and how to earn it.
    </p>
  )
}
