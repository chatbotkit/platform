'use client'

import { useCallback, useImperativeHandle, useMemo, useState } from 'react'

import {
  buildTemplateCatalogue,
  resolveAbilityDisplayIcon,
} from '@/lib/ability.icon'

import useAbilityCreateDialog from '@/components/AbilityCreateDialog'
import Link from '@/components/Link'
import ResourceList from '@/components/ResourceList'
import SecretConnectionStatus from '@/components/SecretConnectionStatus'
import SkillsetAbilityTester from '@/components/SkillsetAbilityTester'

import useAbilityTemplates from '@/hooks/useAbilityTemplates'
import usePopup from '@/hooks/usePopup'
import useRouter from '@/hooks/useRouter'
import { isSecretAuthenticatable } from '@/hooks/useSecretAuthenticate'
import { SECRET_NEEDS_SETUP } from '@/hooks/useSkillsetSecrets'

import clsx from 'clsx'

export default function SkillsetAbilityList({
  skillsetId,

  // @note abilities and their secrets belong to the skillset, so they inherit
  // the skillset's blueprint rather than the selected project
  blueprintId,

  kind = 'ability',

  listRoute = `/api/v1/skillset/${skillsetId}/ability/list`,
  exportRoute = null, // `/api/v1/skillset/${skillsetId}/ability/export`,

  deleteRoute = `/api/v1/skillset/${skillsetId}/ability/[id]/delete`,

  instanceRoute = `/skillsets/${skillsetId}/abilities/[id]`,

  // @note when a caller pins a create link we keep linking out, otherwise the
  // catalogue dialog adds abilities without leaving the page
  createLink,
  createTitle = 'Create ability',

  // @note lets a caller outside this list open the same catalogue dialog, so
  // every "create ability" on the page lands in one place
  createRef,

  // @note the skillset's secrets, so a row can say when the secret behind it
  // still needs setting up
  secrets,

  // @note the page owns the authentication flow, so opening an ability can
  // finish the secret behind it rather than only reporting on it
  authenticate,

  onCreate,

  defaultItems = [],
  defaultTotalCount = null,

  filter = false,

  extraTags: _extraTags,

  ...props
}) {
  const [items, setItems] = useState(defaultItems)
  const [totalCount, setTotalCount] = useState(defaultTotalCount)

  const handleCreate = useCallback(
    (created) => {
      setItems((items) => [...created, ...items])

      setTotalCount((totalCount) =>
        typeof totalCount === 'number'
          ? totalCount + created.length
          : totalCount
      )

      onCreate?.(created)
    },
    [onCreate]
  )

  const [createPopup, openCreatePopup] = useAbilityCreateDialog({
    skillsetId,
    blueprintId,

    onCreate: handleCreate,
  })

  useImperativeHandle(createRef, () => ({ open: openCreatePopup }), [
    openCreatePopup,
  ])

  const secretsById = useMemo(() => {
    return Object.fromEntries(
      (secrets || []).map((secret) => [secret.id, secret])
    )
  }, [secrets])

  const extraTags = useMemo(() => {
    return (
      _extraTags ||
      (({ linkedSecretId, linkedFileId }) => {
        // @note only flag what the owner can actually act on - a personal
        // secret is connected by each contact, so it is never blocking here
        const needsSetup =
          secretsById[linkedSecretId]?.status === SECRET_NEEDS_SETUP

        return (
          <>
            {linkedSecretId ? (
              <div className={clsx('tag', { warning: needsSetup })}>
                {needsSetup ? '⚠ secret needs setup' : '⋈ secret'}
              </div>
            ) : null}
            {linkedFileId ? <div className="tag">⋈ file</div> : null}
          </>
        )
      })
    )
  }, [_extraTags, secretsById])

  const router = useRouter()

  // @note an ability is only ever as ready as the secret behind it, so opening
  // one says which connection it uses and how it stands

  const extraQuickAccessContent = useCallback(
    ({ linkedSecretId }) => {
      const secret = secretsById[linkedSecretId]

      if (!secret) {
        return null
      }

      return (
        <div className="flex flex-row flex-wrap items-center gap-2 text-sm">
          <span>
            Uses the <strong>{secret.name}</strong> connection.
          </span>
          <SecretConnectionStatus secret={secret} />
        </div>
      )
    },
    [secretsById]
  )

  // @note and, when it is the owner's to finish, offers to finish it here -
  // authenticating through its link, or opening the connection when it wants a
  // value typed into it instead

  const extraQuickAccessActions = useCallback(
    ({ linkedSecretId }) => {
      const secret = secretsById[linkedSecretId]

      if (secret?.status !== SECRET_NEEDS_SETUP) {
        return null
      }

      if (isSecretAuthenticatable(secret)) {
        return {
          Authenticate: {
            fn: (_, { close }) => {
              authenticate?.(secret)

              close()
            },
          },
        }
      }

      return {
        'Open Connection': {
          fn: (_, { close }) => {
            router.push(`/secrets/${secret.id}`)

            close()
          },
        },
      }
    },
    [secretsById, authenticate, router]
  )

  const { popup, openPopup } = usePopup()

  const extraButtons = useMemo(() => {
    return {
      Test:
        ({ id }) =>
        () => {
          openPopup(
            <SkillsetAbilityTester
              skillset={{ id: skillsetId }}
              ability={{ id }}
            />,
            {
              title: 'Test Ability',
              description:
                'Quickly test this ability with custom input to see how it performs.',
              cancelButtonCaption: 'Close',
              closePopupOnClickOutside: false,
            }
          )
        },
    }
  }, [skillsetId, openPopup])

  // @note abilities added from the catalogue embed their template id in the
  // stored instruction, so the authoritative icon is recoverable from the
  // template rather than guessed from the ability name. The create dialog on
  // this page already loads (and caches) this catalogue, so this shares its
  // fetch rather than adding one.
  const { templates } = useAbilityTemplates()

  const catalogue = useMemo(
    () => buildTemplateCatalogue(templates),
    [templates]
  )

  const iconMapper = useMemo(() => {
    return (ability) => resolveAbilityDisplayIcon(ability, catalogue)
  }, [catalogue])

  return (
    <ResourceList
      {...props}
      kind={kind}
      listRoute={listRoute}
      exportRoute={exportRoute}
      deleteRoute={deleteRoute}
      instanceRoute={instanceRoute}
      items={items}
      setItems={setItems}
      totalCount={totalCount}
      setTotalCount={setTotalCount}
      filter={filter}
      trailingActions={
        createLink ? (
          <Link className="text-sm default-link" href={createLink}>
            {createTitle}
          </Link>
        ) : (
          <button
            className="text-sm default-link"
            type="button"
            onClick={openCreatePopup}
          >
            {createTitle}
          </button>
        )
      }
      extraTags={extraTags}
      extraButtons={extraButtons}
      extraQuickAccessContent={extraQuickAccessContent}
      extraQuickAccessActions={extraQuickAccessActions}
      extraGlobalRoot={
        <>
          {popup}
          {createPopup}
        </>
      }
      iconMapper={iconMapper}
    />
  )
}
