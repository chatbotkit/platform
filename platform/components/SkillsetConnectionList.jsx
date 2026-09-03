'use client'

import { useState } from 'react'

import { SecretKind } from '@/prisma/enums'

import { resolveSecretDisplayIcon } from '@/lib/secret.icon'

import DynamicIcon from '@/components/DynamicIcon'
import List from '@/components/List'
import SecretConnectionStatus from '@/components/SecretConnectionStatus'

import useFetch from '@/hooks/useFetch'
import usePopup from '@/hooks/usePopup'
import useRouter from '@/hooks/useRouter'
import { isSecretAuthenticatable } from '@/hooks/useSecretAuthenticate'
import useSecretTemplates from '@/hooks/useSecretTemplates'

/**
 * The one decision that actually changes how a secret behaves, asked in plain
 * language rather than as a `kind` dropdown.
 *
 * Nothing else is edited here. A value is never typed into this dialog - an
 * oauth secret is authenticated through its link once saved, and anything else
 * is filled in on the secret page itself.
 */
function SecretQuickEdit({ secret }) {
  const [kind, setKind] = useState(secret.kind || SecretKind.shared)

  return (
    <div className="space-y-6">
      <div>
        <label className="default-label" htmlFor="kind">
          Who connects it?
        </label>
        <div className="mt-1">
          <select
            className="default-input w-full"
            name="kind"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
          >
            <option value={SecretKind.shared}>
              Everyone uses one account you connect
            </option>
            <option value={SecretKind.personal}>
              Each of your users connects their own
            </option>
          </select>
        </div>
        <p className="input-description">
          {kind === SecretKind.shared
            ? 'You connect it once, and every conversation uses that account.'
            : 'Your users are asked to connect their own account the first time an ability needs it. There is nothing for you to set up.'}
        </p>
      </div>
    </div>
  )
}

/**
 * The secrets a skillset's abilities depend on, and what is left to do to them.
 *
 * Abilities share secrets - eight Gmail abilities all sit behind the one Google
 * Mail secret - so this reports per secret rather than per ability.
 */
export default function SkillsetConnectionList({
  secrets = [],
  loading = false,

  // @note the page owns the authentication flow, so the ability list can offer
  // it too without a second listener reporting the same result
  authenticate,

  onChange,
}) {
  const router = useRouter()

  // @note connections are persisted secrets, so their icon is recovered from
  // the catalogue secret template they map to rather than guessed from the
  // name. The ability create dialog on this page already loads (and caches)
  // this catalogue, so this shares its fetch rather than adding one.
  const { secretTemplates } = useSecretTemplates()

  const { popup, openPopup, closePopup, setDisabled } = usePopup()

  const { fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  async function handleSave(secret, { kind }) {
    setDisabled(true)

    try {
      const { error } = await fetch(`/api/v1/secret/${secret.id}/update`, {
        data: { kind },

        successMessage: 'Connection updated.',
      })

      if (error) {
        return
      }

      closePopup()

      const updated = await onChange?.()

      // @note authenticating is only possible against the saved secret, so it
      // happens here rather than from the dialog - and switching to a shared
      // account is exactly what leaves it needing to be authenticated

      const fresh = updated?.find(({ id }) => id === secret.id)

      if (isSecretAuthenticatable(fresh)) {
        authenticate?.(fresh)
      }
    } finally {
      setDisabled(false)
    }
  }

  function handleClick(secret) {
    openPopup(<SecretQuickEdit secret={secret} />, {
      title: secret.name,
      description: secret.description,
      closePopupOnClickOutside: true,
      actions: {
        ...(isSecretAuthenticatable(secret)
          ? { Authenticate: { fn: () => authenticate?.(secret) } }
          : {}),

        Open: { fn: () => router.push(`/secrets/${secret.id}`) },

        Save: {
          default: true,

          fn: (data) => handleSave(secret, data),
        },
      },
    })
  }

  if (!secrets.length) {
    return (
      <p className="mt-6 text-sm">
        {loading
          ? 'Loading connections...'
          : "None of this skillset's abilities use a secret."}
      </p>
    )
  }

  return (
    <>
      {popup}
      <List>
        {secrets.map((secret) => {
          const { id, name, description } = secret

          return (
            <List.Item
              key={id}
              icon={
                <DynamicIcon
                  className="w-12 h-12 text-[3rem] rounded-md object-cover bg-white"
                  icon={resolveSecretDisplayIcon(secret, secretTemplates)}
                />
              }
              onClick={() => handleClick(secret)}
              title={name}
              body={description}
            >
              <div className="flex flex-row flex-wrap items-center gap-2">
                <SecretConnectionStatus secret={secret} />
              </div>
            </List.Item>
          )
        })}
      </List>
    </>
  )
}
